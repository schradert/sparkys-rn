import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/Colors";
import { isMetadataItemArchived } from "@/constants/Products";
import { useTheme } from "@/hooks/useTheme";
import type { MetadataViewMode } from "./inventoryMaps";
import { FIELD_KEY_FOR_VIEW_MODE } from "./inventoryMaps";

/**
 * A single metadata value card in a metadata view (e.g. one product type). Taps
 * navigate to the metadata-browse route; archived items are dimmed and labeled.
 * MetadataCard is only rendered for metadata views, so the fieldKey is always
 * resolvable.
 */
export default function MetadataCard({
	item,
	viewMode,
}: {
	item: string;
	viewMode: MetadataViewMode;
}) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	const fieldKey = FIELD_KEY_FOR_VIEW_MODE[viewMode];
	const isArchived = isMetadataItemArchived(fieldKey, item);

	return (
		<Pressable
			style={[
				styles.card,
				{ backgroundColor: colors.cardBackground },
				isArchived && { opacity: 0.6, backgroundColor: colors.surface },
			]}
			onPress={() =>
				router.push(`/metadata/${viewMode}/${encodeURIComponent(item)}`)
			}
		>
			<View style={styles.cardHeader}>
				<Text
					style={[
						styles.productName,
						{ color: isArchived ? colors.textSecondary : colors.text },
					]}
				>
					{item}
					{isArchived ? " (Archived)" : ""}
				</Text>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: "white",
		borderRadius: 12,
		padding: 16,
		marginVertical: 8,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
	},
	cardHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: 12,
	},
	productName: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1a1a1a",
		flex: 1,
		marginRight: 12,
	},
});
