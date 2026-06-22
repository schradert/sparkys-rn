import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/Colors";
import type { ExternalProduct, InternalProduct } from "@/constants/Products";
import { useTheme } from "@/hooks/useTheme";
import MetadataGrid from "./MetadataGrid";
import { getExternalMetadataItems } from "./metadataMaps";
import PillList from "./PillList";

interface ExternalProductViewProps {
	product: ExternalProduct;
	internalProduct: InternalProduct | null;
}

/** Read-only display of an external product's SKU, quantity, and metadata. */
export default function ExternalProductView({
	product,
	internalProduct,
}: ExternalProductViewProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<>
			<View style={styles.skuContainer}>
				<Text style={[styles.skuValue, { color: colors.text }]}>
					{product.unique_id_sku}
				</Text>
				<View style={styles.quantityHeaderContainer}>
					<Text style={[styles.quantity, { color: colors.primary }]}>
						{product.quantity}
					</Text>
				</View>
			</View>

			{internalProduct && (
				<Pressable
					style={[
						styles.internalProductLink,
						{ backgroundColor: colors.surface, borderColor: colors.border },
					]}
					onPress={() =>
						router.push(
							`/internal-product/${encodeURIComponent(internalProduct.id)}`,
						)
					}
				>
					<View style={styles.internalProductInfo}>
						<Text
							style={[styles.internalLabel, { color: colors.textSecondary }]}
						>
							Grouped under Internal Product
						</Text>
						<Text style={[styles.internalName, { color: colors.primary }]}>
							{internalProduct.sparkys_product_name}
						</Text>
					</View>
					<Ionicons name="arrow-forward" size={20} color={colors.primary} />
				</Pressable>
			)}

			<MetadataGrid items={getExternalMetadataItems(product)} />

			{product.distributors.length > 0 && (
				<PillList
					title="Distributors"
					icon="storefront-outline"
					iconSize={16}
					values={product.distributors}
				/>
			)}
		</>
	);
}

const styles = StyleSheet.create({
	skuContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 20,
	},
	skuValue: {
		fontSize: 18,
		color: "#1a1a1a",
		fontFamily: "monospace",
		fontWeight: "600",
		flex: 1,
	},
	quantityHeaderContainer: {
		alignItems: "flex-end",
	},
	quantity: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#007bff",
	},
	internalProductLink: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		backgroundColor: "#f8f9fa",
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#dee2e6",
		marginBottom: 20,
	},
	internalProductInfo: {
		flex: 1,
	},
	internalLabel: {
		fontSize: 12,
		color: "#6c757d",
		textTransform: "uppercase",
		fontWeight: "500",
		marginBottom: 4,
	},
	internalName: {
		fontSize: 16,
		color: "#007bff",
		fontWeight: "600",
	},
});
