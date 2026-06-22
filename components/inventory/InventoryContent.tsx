import type { ReactElement } from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import InfiniteScroll from "@/components/InfiniteScroll";
import { Colors } from "@/constants/Colors";
import type { InternalProduct } from "@/constants/Products";
import { useTheme } from "@/hooks/useTheme";

interface InventoryContentProps {
	data: (InternalProduct | string)[];
	renderItem: (info: { item: InternalProduct | string }) => ReactElement;
	keyExtractor: (item: InternalProduct | string) => string;
	refreshing: boolean;
	error: string | null;
	onRefresh: () => void;
}

/**
 * The scrollable list region: an optional loading bar while sheets refresh, an
 * error banner with a retry, and the infinite-scrolling list of the current view.
 */
export default function InventoryContent({
	data,
	renderItem,
	keyExtractor,
	refreshing,
	error,
	onRefresh,
}: InventoryContentProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<View
			style={[styles.contentContainer, { backgroundColor: colors.background }]}
		>
			{refreshing && (
				<View
					style={[
						styles.loadingContainer,
						{
							backgroundColor: colors.surface,
							borderBottomColor: colors.borderLight,
						},
					]}
				>
					<ActivityIndicator size="small" color={colors.primary} />
					<Text style={[styles.loadingText, { color: colors.textSecondary }]}>
						Loading data...
					</Text>
				</View>
			)}

			{error && (
				<View
					style={[styles.errorContainer, { backgroundColor: colors.surface }]}
				>
					<Text style={[styles.errorText, { color: colors.error }]}>
						{error}
					</Text>
					<Pressable
						onPress={onRefresh}
						style={[styles.retryButton, { backgroundColor: colors.primary }]}
					>
						<Text style={styles.retryButtonText}>Retry</Text>
					</Pressable>
				</View>
			)}

			<InfiniteScroll
				data={data}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				onRefresh={onRefresh}
				refreshing={refreshing}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	contentContainer: {
		flex: 1,
	},
	loadingContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		padding: 16,
		backgroundColor: "#f8f9fa",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e5e9",
	},
	loadingText: {
		marginLeft: 8,
		fontSize: 14,
		color: "#6c757d",
	},
	errorContainer: {
		padding: 16,
		backgroundColor: "#f8d7da",
		borderBottomWidth: 1,
		borderBottomColor: "#f5c2c7",
		alignItems: "center",
	},
	errorText: {
		fontSize: 14,
		color: "#721c24",
		textAlign: "center",
		marginBottom: 8,
	},
	retryButton: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		backgroundColor: "#dc3545",
		borderRadius: 6,
	},
	retryButtonText: {
		color: "white",
		fontSize: 14,
		fontWeight: "600",
	},
});
