import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
	LayoutAnimation,
	Platform,
	Pressable,
	Text,
	UIManager,
	View,
} from "react-native";
import { CardMetadata } from "@/components/internalProductCard/CardMetadata";
import { matchesExternalDisplayFilter } from "@/components/internalProductCard/displayFilter";
import {
	filterRelatedExternals,
	sortRelatedExternals,
} from "@/components/internalProductCard/sortExternals";
import { styles } from "@/components/internalProductCard/styles";
import type { InternalProductCardProps } from "@/components/internalProductCard/types";
import { Colors } from "@/constants/Colors";
import { getQuantityColor } from "@/constants/Products";
import { useTheme } from "@/hooks/useTheme";
import { logger } from "@/services/logger";
import ExternalProductCard from "./ExternalProductCard";

if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function InternalProductCard({
	internalProduct,
	externalProducts,
	events = [],
	onMetadataPress,
	selectedFilters,
}: InternalProductCardProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];
	const [isExpanded, setIsExpanded] = useState(false);

	logger.debug("Products", "InternalProductCard props:", {
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

	logger.debug(
		"Products",
		`Barcode matching debug for ${internalProduct.sparkys_product_name}`,
		{
			internalProductBarcodes: internalProduct.products,
			externalProductSkus: externalProducts.map((ext) => ext.unique_id_sku),
			matchingExternals: externalProducts.filter((ext) =>
				internalProduct.products.includes(ext.unique_id_sku),
			),
		},
	);

	// Get all external products for this internal product
	const allRelatedExternals = externalProducts.filter((ext) =>
		internalProduct.products.includes(ext.unique_id_sku),
	);

	// For display, respect the showArchived filter, then sort by frequency,
	// recency, then reverse alphabetical.
	const showArchived = selectedFilters?.external?.showArchived === true;
	const filteredExternals = filterRelatedExternals(
		allRelatedExternals,
		showArchived,
	);
	const relatedExternals = sortRelatedExternals(filteredExternals, events);

	logger.debug(
		"Products",
		`RelatedExternals result for ${internalProduct.sparkys_product_name}`,
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

	// Quantity from active products only (for threshold calculations).
	const totalQuantity = allRelatedExternals
		.filter((ext) => (ext.status || "active") === "active")
		.reduce((total, ext) => total + ext.quantity, 0);

	const quantityColorType = getQuantityColor(
		totalQuantity,
		internalProduct.threshold_quantity,
	);

	const getQuantityColorValue = (colorType: "red" | "blue" | "green") => {
		switch (colorType) {
			case "red":
				return "#dc3545";
			case "green":
				return "#28a745";
			default:
				return colors.primary;
		}
	};

	const toggleExpansion = () => {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setIsExpanded(!isExpanded);
	};

	const isArchived = internalProduct.status === "archived";

	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: colors.cardBackground },
				isArchived && { opacity: 0.6, backgroundColor: colors.surface },
			]}
		>
			<Pressable
				style={styles.cardHeader}
				onPress={() =>
					router.push(
						`/internal-product/${encodeURIComponent(internalProduct.id)}`,
					)
				}
			>
				<View style={styles.headerLeft}>
					<View style={styles.productNameRow}>
						<Text style={[styles.productName, { color: colors.text }]}>
							{internalProduct.sparkys_product_name}
							{isArchived && (
								<Text
									style={[
										styles.archivedLabel,
										{ color: colors.textSecondary },
									]}
								>
									{" "}
									(Archived)
								</Text>
							)}
						</Text>
						{internalProduct.never_out && (
							<View style={styles.neverOutBadge}>
								<Text style={styles.neverOutText}>Never Out</Text>
							</View>
						)}
					</View>
					<Text style={[styles.externalCount, { color: colors.textSecondary }]}>
						{relatedExternals.length} external product
						{relatedExternals.length !== 1 ? "s" : ""}
					</Text>
				</View>
				<View style={styles.headerRight}>
					<Text style={styles.quantity}>
						<Text
							style={{
								color: isArchived
									? colors.textSecondary
									: getQuantityColorValue(quantityColorType),
							}}
						>
							{totalQuantity}
						</Text>
						<Text
							style={{
								color: isArchived ? colors.textSecondary : colors.primary,
							}}
						>
							{" "}
							/ {internalProduct.threshold_quantity ?? 0}
						</Text>
					</Text>
					<Pressable onPress={toggleExpansion} style={styles.expandButton}>
						<Ionicons
							name={isExpanded ? "chevron-up" : "chevron-down"}
							size={20}
							color={colors.icon}
						/>
					</Pressable>
				</View>
			</Pressable>

			<CardMetadata
				internalProduct={internalProduct}
				colors={colors}
				selectedFilters={selectedFilters}
				onMetadataPress={onMetadataPress}
			/>

			{isExpanded && (
				<View style={styles.externalProductsContainer}>
					{relatedExternals.length > 0 ? (
						relatedExternals
							.filter((externalProduct) =>
								matchesExternalDisplayFilter(
									externalProduct,
									selectedFilters?.external,
								),
							)
							.map((externalProduct) => (
								<ExternalProductCard
									key={externalProduct.unique_id_sku}
									externalProduct={externalProduct}
									onMetadataPress={onMetadataPress}
									selectedFilters={{ external: selectedFilters?.external }}
								/>
							))
					) : (
						<View style={styles.emptyExternalProducts}>
							<Text style={[styles.emptyText, { color: colors.textSecondary }]}>
								No external products assigned to this internal product yet
							</Text>
						</View>
					)}
				</View>
			)}
		</View>
	);
}
