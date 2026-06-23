/** Mutation state and handlers for the metadata detail screen. */

import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { PRODUCT_FIELD_OPTIONS } from "@/constants/Products";
import { getSheetNameForViewMode } from "@/hooks/sheetsData/mappings";
import { useSheetsData } from "@/hooks/useSheetsData";
import { logger } from "@/services/logger";

interface UseMetadataActionsArgs {
	viewMode: string;
	decodedItemName: string;
	fieldKey: string | null;
	editedValue: string;
	setEditedValue: (value: string) => void;
}

/**
 * Owns the metadata detail screen's mutation state and async handlers. It reads
 * the sheet mutations from `useSheetsData` and exposes save/archive/unarchive/
 * cancel actions plus the in-flight flags the route uses to drive its UI.
 */
export function useMetadataActions({
	viewMode,
	decodedItemName,
	fieldKey,
	editedValue,
	setEditedValue,
}: UseMetadataActionsArgs) {
	const { updateMetadata, archiveMetadata, unarchiveMetadata } =
		useSheetsData();

	const [isSaving, setIsSaving] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [isArchiving, setIsArchiving] = useState(false);

	async function handleSave() {
		if (!editedValue.trim()) {
			Alert.alert("Error", "Please enter a value");
			return;
		}

		const trimmedValue = editedValue.trim();

		if (trimmedValue === decodedItemName) {
			Alert.alert("Info", "No changes to save");
			router.back();
			return;
		}

		const existingValues: readonly string[] =
			PRODUCT_FIELD_OPTIONS[fieldKey as keyof typeof PRODUCT_FIELD_OPTIONS] ??
			[];
		if (existingValues.includes(trimmedValue)) {
			Alert.alert("Error", "This value already exists");
			return;
		}

		const sheetName = getSheetNameForViewMode(viewMode);
		if (!sheetName) {
			Alert.alert("Error", "Cannot update this metadata type");
			return;
		}

		setIsSaving(true);
		try {
			const result = await updateMetadata(
				sheetName,
				decodedItemName,
				trimmedValue,
			);

			if (result.success) {
				Alert.alert("Success", `"${trimmedValue}" has been saved!`);
				router.back();
			} else {
				Alert.alert("Error", result.error || "Failed to save changes");
			}
		} catch (error) {
			logger.error("Metadata", "Failed to save changes", {
				error,
				sheetName,
				oldValue: decodedItemName,
				newValue: trimmedValue,
			});
			Alert.alert("Error", "Failed to save changes");
		} finally {
			setIsSaving(false);
		}
	}

	async function handleArchive() {
		const sheetName = getSheetNameForViewMode(viewMode);
		if (!sheetName) {
			Alert.alert("Error", "Cannot archive this metadata type");
			return;
		}

		Alert.alert(
			"Archive Value",
			`Are you sure you want to archive "${decodedItemName}"?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Archive",
					style: "default",
					onPress: async () => {
						setIsArchiving(true);
						try {
							const result = await archiveMetadata(sheetName, decodedItemName);
							if (result.success) {
								Alert.alert(
									"Success",
									`"${decodedItemName}" has been archived!`,
								);
								router.back();
							} else {
								Alert.alert("Error", result.error || "Failed to archive item");
							}
						} catch (error) {
							logger.error("Metadata", "Failed to archive item", {
								error,
								sheetName,
								value: decodedItemName,
							});
							Alert.alert("Error", "Failed to archive item");
						} finally {
							setIsArchiving(false);
						}
					},
				},
			],
		);
	}

	async function handleUnarchive() {
		const sheetName = getSheetNameForViewMode(viewMode);
		if (!sheetName) {
			Alert.alert("Error", "Cannot unarchive this metadata type");
			return;
		}

		Alert.alert(
			"Unarchive Value",
			`Are you sure you want to unarchive "${decodedItemName}"?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Unarchive",
					style: "default",
					onPress: async () => {
						setIsArchiving(true);
						try {
							const result = await unarchiveMetadata(
								sheetName,
								decodedItemName,
							);
							if (result.success) {
								Alert.alert(
									"Success",
									`"${decodedItemName}" has been unarchived!`,
								);
								router.back();
							} else {
								Alert.alert(
									"Error",
									result.error || "Failed to unarchive item",
								);
							}
						} catch (error) {
							logger.error("Metadata", "Failed to unarchive item", {
								error,
								sheetName,
								value: decodedItemName,
							});
							Alert.alert("Error", "Failed to unarchive item");
						} finally {
							setIsArchiving(false);
						}
					},
				},
			],
		);
	}

	function handleCancel() {
		setEditedValue(decodedItemName);
		setIsEditing(false);
	}

	return {
		isSaving,
		isEditing,
		setIsEditing,
		isArchiving,
		handleSave,
		handleArchive,
		handleUnarchive,
		handleCancel,
	};
}
