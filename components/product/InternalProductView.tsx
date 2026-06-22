import { StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/Colors";
import type { InternalProduct } from "@/constants/Products";
import { useTheme } from "@/hooks/useTheme";
import MetadataGrid from "./MetadataGrid";
import { getInternalMetadataItems } from "./metadataMaps";
import PillList from "./PillList";

interface InternalProductViewProps {
	product: InternalProduct;
	totalQuantity: number;
	totalQuantityColor: string;
}

/** Read-only display of an internal product's name, quantities, and metadata. */
export default function InternalProductView({
	product,
	totalQuantity,
	totalQuantityColor,
}: InternalProductViewProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<>
			<View style={styles.productNameRow}>
				<Text style={[styles.productName, { color: colors.text }]}>
					{product.sparkys_product_name}
				</Text>
				{product.never_out && (
					<View style={styles.neverOutBadge}>
						<Text style={styles.neverOutText}>Never Out</Text>
					</View>
				)}
			</View>

			<View style={styles.quantityRow}>
				<View style={[styles.quantityBox, { backgroundColor: colors.surface }]}>
					<Text style={[styles.quantityLabel, { color: colors.textSecondary }]}>
						Total Quantity
					</Text>
					<Text style={[styles.quantity, { color: totalQuantityColor }]}>
						{totalQuantity}
					</Text>
				</View>

				<View style={[styles.quantityBox, { backgroundColor: colors.surface }]}>
					<Text style={[styles.quantityLabel, { color: colors.textSecondary }]}>
						Threshold Quantity
					</Text>
					<Text style={[styles.quantity, { color: colors.primary }]}>
						{product.threshold_quantity}
					</Text>
				</View>
			</View>

			<MetadataGrid items={getInternalMetadataItems(product)} />

			{product.occasions.length > 0 && (
				<PillList
					title="Occasions"
					icon="calendar-outline"
					iconSize={14}
					values={product.occasions}
				/>
			)}
		</>
	);
}

const styles = StyleSheet.create({
	productNameRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginBottom: 16,
	},
	productName: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#1a1a1a",
	},
	quantityRow: {
		flexDirection: "row",
		gap: 12,
		marginBottom: 16,
	},
	quantityBox: {
		flex: 1,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
	},
	quantityLabel: {
		fontSize: 14,
		color: "#6c757d",
		flex: 1,
	},
	quantity: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#007bff",
	},
	neverOutBadge: {
		backgroundColor: "#c026d3",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		alignSelf: "center",
	},
	neverOutText: {
		fontSize: 12,
		fontWeight: "600",
		color: "white",
		textTransform: "uppercase",
	},
});
