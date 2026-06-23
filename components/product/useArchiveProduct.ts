/** Hook driving the archive/unarchive confirmation flow on product screens. */
import { useState } from "react";
import { Alert } from "react-native";
import { logger } from "@/services/logger";

type MutationResult = { success: boolean; error?: string };

interface UseArchiveProductOptions {
	/** Logger tag for failures, e.g. "InternalProduct". */
	logTag: string;
	/** Current archive status of the product. */
	isArchived: boolean;
	/** Display name used in the confirmation alert. */
	name: string;
	/** Sheet mutation to run for the chosen action. */
	mutate: (action: "archive" | "unarchive") => Promise<MutationResult>;
	/** Apply the new status locally (store + component state) on success. */
	onArchived: (status: "active" | "archived") => void;
}

interface UseArchiveProductResult {
	isArchiving: boolean;
	/** Raise the confirmation alert and run the flow when confirmed. */
	confirmArchive: () => void;
}

/**
 * Shared archive/unarchive confirmation flow for the product detail screens.
 * Owns the in-flight flag, raises the confirm alert, runs the chosen sheet
 * mutation, and surfaces success/error alerts. Callers pass a non-null product
 * via `name`/`isArchived`, so there is no missing-product guard to test.
 */
export function useArchiveProduct({
	logTag,
	isArchived,
	name,
	mutate,
	onArchived,
}: UseArchiveProductOptions): UseArchiveProductResult {
	const [isArchiving, setIsArchiving] = useState(false);

	const confirmArchive = () => {
		const action = isArchived ? "unarchive" : "archive";
		const actionTitle = action.charAt(0).toUpperCase() + action.slice(1);

		Alert.alert(
			`${actionTitle} Product`,
			`Are you sure you want to ${action} "${name}"?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: actionTitle,
					style: isArchived ? "default" : "destructive",
					onPress: async () => {
						setIsArchiving(true);
						try {
							const result = await mutate(action);
							if (result.success) {
								onArchived(isArchived ? "active" : "archived");
								Alert.alert("Success", `Product ${action}d successfully!`);
							} else {
								Alert.alert(
									"Error",
									result.error || `Failed to ${action} product`,
								);
							}
						} catch (error) {
							logger.error(logTag, `Failed to ${action} product`, {
								error,
								name,
								action,
							});
							Alert.alert("Error", `Failed to ${action} product`);
						} finally {
							setIsArchiving(false);
						}
					},
				},
			],
		);
	};

	return { isArchiving, confirmArchive };
}
