import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
	LayoutAnimation,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	UIManager,
	View,
} from "react-native";
import { Colors } from "@/constants/Colors";
import type {
	ExternalProduct,
	getExternalProductsForInternal,
	getInternalProductTotalQuantity,
	InternalProduct,
} from "@/constants/Products";
import { getQuantityColor } from "@/constants/Products";
import { useTheme } from "@/hooks/useTheme";
import ExternalProductCard from "./ExternalProductCard";

if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface InternalProductCardProps {
	internalProduct: InternalProduct;
	externalProducts: ExternalProduct[];
	onMetadataPress?: (field: string, value: string) => void;
	selectedFilters?: {
		internal?: {
			product_type?: string[];
			texture?: string[];
			shape?: string[];
			occasions?: string[];
			sparkys_color?: string[];
		};
		external?: {
			manufacturer_color?: string[];
			brand?: string[];
			size?: string[];
			distributors?: string[];
		};
	};
}

export default function InternalProductCard({
	internalProduct,
	externalProducts,
	onMetadataPress,
	selectedFilters,
}: InternalProductCardProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];
	const [isExpanded, setIsExpanded] = useState(false);

	// Debug logging
	console.log("InternalProductCard props:", {
		internalProduct,
		externalProductsCount: externalProducts?.length || 0,
		internalProductBarcodes: internalProduct?.products,
		occasions: internalProduct?.occasions,
		occasionsType: typeof internalProduct?.occasions,
		occasionsLength: internalProduct?.occasions?.length,
		occasionValues: internalProduct?.occasions,
		threshold_quantity: internalProduct?.threshold_quantity,
		threshold_type: typeof internalProduct?.threshold_quantity,
	});

	// Debug the barcode matching
	console.log(
		"Barcode matching debug for",
		internalProduct.sparkys_product_name + ":",
		{
			internalProductBarcodes: internalProduct.products,
			externalProductSkus:
				externalProducts?.map((ext) => ext.unique_id_sku) || [],
			matchingExternals:
				externalProducts?.filter((ext) =>
					internalProduct.products.includes(ext.unique_id_sku),
				) || [],
		},
	);

	const relatedExternals = externalProducts.filter((ext) =>
		internalProduct.products.includes(ext.unique_id_sku),
	);

	console.log(
		"RelatedExternals result for",
		internalProduct.sparkys_product_name + ":",
		{
			relatedExternalsCount: relatedExternals.length,
			internalProductBarcodes: internalProduct.products,
			barcodesIsArray: Array.isArray(internalProduct.products),
			barcodesLength: internalProduct.products?.length || 0,
			externalProductsPassedIn: externalProducts?.length || 0,
			sampleExternalSkus: externalProducts
				.slice(0, 3)
				.map((ext) => ext.unique_id_sku),
		},
	);

	const totalQuantity = relatedExternals.reduce(
		(total, ext) => total + ext.quantity,
		0,
	);

	const quantityColorType = getQuantityColor(
		totalQuantity,
		internalProduct.threshold_quantity,
	);

	console.log("Color calculation:", {
		productName: internalProduct.sparkys_product_name,
		totalQuantity,
		threshold: internalProduct.threshold_quantity,
		colorType: quantityColorType,
	});

	const getQuantityColorValue = (colorType: "red" | "blue" | "green") => {
		switch (colorType) {
			case "red":
				return "#dc3545";
			case "green":
				return "#28a745";
			case "blue":
			default:
				return colors.primary;
		}
	};

	const getIconForMetadata = (field: string): string => {
		switch (field) {
			case "product_type":
				return "shapes-outline";
			case "texture":
				return "hand-left-outline";
			case "shape":
				return "diamond-outline";
			case "sparkys_color":
				return "color-palette-outline";
			case "occasions":
				return "calendar-outline";
			default:
				return "information-circle-outline";
		}
	};

	const metadataItems = [
		{
			field: "product_type",
			value: internalProduct.product_type,
			icon: getIconForMetadata("product_type"),
		},
		{
			field: "texture",
			value: internalProduct.texture,
			icon: getIconForMetadata("texture"),
		},
		{
			field: "shape",
			value: internalProduct.shape,
			icon: getIconForMetadata("shape"),
		},
		{
			field: "sparkys_color",
			value: internalProduct.sparkys_color,
			icon: getIconForMetadata("sparkys_color"),
		},
	].filter((item) => item.value && item.value.trim() !== "");

	const toggleExpansion = () => {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setIsExpanded(!isExpanded);
	};

	const handleMetadataPress = (field: string, value: string) => {
		onMetadataPress?.(field, value);
	};

	const isMetadataSelected = (field: string, value: string): boolean => {
		const internalFilters = selectedFilters?.internal;
		if (!internalFilters) return false;
		const fieldFilters = internalFilters[field as keyof typeof internalFilters];
		return fieldFilters ? fieldFilters.includes(value) : false;
	};

	return (
		<View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
			<Pressable
				style={styles.cardHeader}
				onPress={() =>
					router.push(
						`/internal-product/${encodeURIComponent(internalProduct.sparkys_product_name)}`,
					)
				}
			>
				<View style={styles.headerLeft}>
					<Text style={[styles.productName, { color: colors.text }]}>
						{internalProduct.sparkys_product_name}
					</Text>
					<Text style={[styles.externalCount, { color: colors.textSecondary }]}>
						{relatedExternals.length} external product
						{relatedExternals.length !== 1 ? "s" : ""}
					</Text>
				</View>
				<View style={styles.headerRight}>
					<Text style={styles.quantity}>
						<Text style={{ color: getQuantityColorValue(quantityColorType) }}>
							{totalQuantity}
						</Text>
						<Text style={{ color: colors.primary }}>
							{" "}
							/ {internalProduct.threshold_quantity ?? 0}
						</Text>
					</Text>
					{relatedExternals.length > 0 && (
						<Pressable onPress={toggleExpansion} style={styles.expandButton}>
							<Ionicons
								name={isExpanded ? "chevron-up" : "chevron-down"}
								size={20}
								color={colors.icon}
							/>
						</Pressable>
					)}
				</View>
			</Pressable>

			{/* Internal product metadata */}
			<View style={styles.metadataGrid}>
				{metadataItems.map((item) => {
					const isSelected = isMetadataSelected(item.field, item.value!);
					return (
						<Pressable
							key={item.field}
							style={[
								styles.metadataItem,
								{ backgroundColor: colors.metadataBackground },
								isSelected && {
									backgroundColor: colors.primary,
								},
							]}
							onPress={() => handleMetadataPress(item.field, item.value!)}
						>
							<Ionicons
								name={item.icon as any}
								size={16}
								color={isSelected ? "white" : colors.icon}
							/>
							<Text
								style={[
									styles.metadataValue,
									{ color: colors.textSecondary },
									isSelected && { color: "white", fontWeight: "600" },
								]}
								numberOfLines={1}
							>
								{item.value}
							</Text>
						</Pressable>
					);
				})}
			</View>

			{/* Occasions displayed horizontally */}
			{internalProduct?.occasions &&
				Array.isArray(internalProduct.occasions) &&
				internalProduct.occasions.length > 0 && (
					<View style={styles.occasionsContainer}>
						{internalProduct.occasions?.map((occasion, index) => {
							const isSelected = isMetadataSelected("occasions", occasion);
							return (
								<Pressable
									key={`${occasion}-${index}`}
									style={[
										styles.occasionPill,
										{ backgroundColor: colors.metadataBackground },
										isSelected && {
											backgroundColor: colors.primary,
										},
									]}
									onPress={() => handleMetadataPress("occasions", occasion)}
								>
									<Ionicons
										name="calendar-outline"
										size={16}
										color={isSelected ? "white" : colors.icon}
									/>
									<Text
										style={[
											styles.occasionText,
											{ color: colors.textSecondary },
											isSelected && { color: "white", fontWeight: "600" },
										]}
										numberOfLines={1}
									>
										{occasion}
									</Text>
								</Pressable>
							);
						})}
					</View>
				)}

			{/* Expandable external products */}
			{isExpanded && relatedExternals.length > 0 && (
				<View style={styles.externalProductsContainer}>
					{relatedExternals
						.filter((externalProduct) => {
							// Apply external product filters only for display
							return Object.entries(selectedFilters?.external || {}).every(
								([key, selectedValues]) => {
									if (!selectedValues || selectedValues.length === 0)
										return true;
									if (key === "distributors") {
										return selectedValues.some((selectedValue) =>
											externalProduct.distributors.includes(selectedValue),
										);
									}
									const productValue = externalProduct[
										key as keyof ExternalProduct
									] as string;
									return selectedValues.includes(productValue);
								},
							);
						})
						.map((externalProduct) => (
							<ExternalProductCard
								key={externalProduct.unique_id_sku}
								externalProduct={externalProduct}
								onMetadataPress={onMetadataPress}
								selectedFilters={{ external: selectedFilters?.external }}
							/>
						))}
				</View>
			)}
		</View>
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
	headerLeft: {
		flex: 1,
		marginRight: 12,
	},
	headerRight: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	productName: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1a1a1a",
		marginBottom: 2,
	},
	externalCount: {
		fontSize: 12,
		color: "#6c757d",
		fontStyle: "italic",
	},
	quantity: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#007bff",
	},
	expandButton: {
		padding: 4,
	},
	occasionsContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		marginTop: 12,
		marginBottom: 4,
		gap: 6,
		justifyContent: "flex-start",
	},
	occasionPill: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f8f9fa",
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 6,
		flex: 0,
		minWidth: "22%",
		maxWidth: "24%",
		gap: 4,
	},
	occasionText: {
		fontSize: 11,
		fontWeight: "500",
		color: "#495057",
	},
	metadataGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		marginTop: 4,
	},
	metadataItem: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f8f9fa",
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 6,
		flex: 0,
		minWidth: "22%",
		maxWidth: "24%",
		gap: 4,
	},
	metadataValue: {
		fontSize: 11,
		color: "#495057",
		fontWeight: "500",
		flex: 1,
	},
	externalProductsContainer: {
		marginTop: 12,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: "#e1e5e9",
	},
});
