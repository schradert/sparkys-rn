import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/Colors";
import type { ExternalProduct } from "@/constants/Products";
import { useTheme } from "@/hooks/useTheme";

interface ExternalProductCardProps {
	externalProduct: ExternalProduct;
	onMetadataPress?: (field: string, value: string) => void;
	selectedFilters?: {
		external?: {
			manufacturer_color?: string[];
			brand?: string[];
			size?: string[];
			distributors?: string[];
		};
	};
}

export default function ExternalProductCard({
	externalProduct,
	onMetadataPress,
	selectedFilters,
}: ExternalProductCardProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	// Debug logging
	console.log("ExternalProductCard props:", {
		externalProduct,
		distributors: externalProduct?.distributors,
		distributorsType: typeof externalProduct?.distributors,
		distributorsLength: externalProduct?.distributors?.length,
		distributorValues: externalProduct?.distributors,
	});

	const getIconForMetadata = (field: string): string => {
		switch (field) {
			case "manufacturer_color":
				return "color-palette-outline";
			case "brand":
				return "business-outline";
			case "size":
				return "resize-outline";
			case "bag_quantity":
				return "bag-outline";
			case "distributors":
				return "storefront-outline";
			default:
				return "information-circle-outline";
		}
	};

	const metadataItems = [
		{
			field: "manufacturer_color",
			value: externalProduct.manufacturer_color,
			icon: getIconForMetadata("manufacturer_color"),
		},
		{
			field: "brand",
			value: externalProduct.brand,
			icon: getIconForMetadata("brand"),
		},
		{
			field: "size",
			value: externalProduct.size,
			icon: getIconForMetadata("size"),
		},
	].filter((item) => item.value && item.value.trim() !== "");

	const handleMetadataPress = (field: string, value: string) => {
		onMetadataPress?.(field, value);
	};

	const isMetadataSelected = (field: string, value: string): boolean => {
		const externalFilters = selectedFilters?.external;
		if (!externalFilters) return false;
		const fieldFilters = externalFilters[field as keyof typeof externalFilters];
		return fieldFilters ? fieldFilters.includes(value) : false;
	};

	const isArchived = externalProduct.status === "archived";

	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: colors.surface },
				isArchived && { opacity: 0.6, backgroundColor: colors.background },
			]}
		>
			<Pressable
				style={styles.cardHeader}
				onPress={() =>
					router.push(`/external-product/${externalProduct.unique_id_sku}`)
				}
			>
				<View style={styles.headerLeft}>
					<Text style={[styles.sku, { color: colors.textSecondary }]}>
						{externalProduct.unique_id_sku}
						{isArchived && (
							<Text
								style={[styles.archivedLabel, { color: colors.textSecondary }]}
							>
								{" "}
								(Archived)
							</Text>
						)}
					</Text>
				</View>
				<Text
					style={[
						styles.quantity,
						{ color: isArchived ? colors.textSecondary : colors.primary },
					]}
				>
					{externalProduct.quantity}
				</Text>
			</Pressable>

			{/* External product metadata grid */}
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

			{/* Distributors displayed horizontally */}
			{externalProduct?.distributors &&
				Array.isArray(externalProduct.distributors) &&
				externalProduct.distributors.length > 0 && (
					<View style={styles.distributorsContainer}>
						{externalProduct.distributors?.map((distributor, index) => {
							const isSelected = isMetadataSelected(
								"distributors",
								distributor,
							);
							return (
								<Pressable
									key={`${distributor}-${index}`}
									style={[
										styles.distributorPill,
										{ backgroundColor: colors.metadataBackground },
										isSelected && {
											backgroundColor: colors.primary,
										},
									]}
									onPress={() =>
										handleMetadataPress("distributors", distributor)
									}
								>
									<Ionicons
										name="storefront-outline"
										size={16}
										color={isSelected ? "white" : colors.icon}
									/>
									<Text
										style={[
											styles.distributorText,
											{ color: colors.textSecondary },
											isSelected && { color: "white", fontWeight: "600" },
										]}
										numberOfLines={1}
									>
										{distributor}
									</Text>
								</Pressable>
							);
						})}
					</View>
				)}
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: "#f8f9fa",
		borderRadius: 8,
		padding: 12,
		marginVertical: 4,
		marginLeft: 16,
		borderLeftWidth: 3,
		borderLeftColor: "#007bff",
	},
	cardHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: 8,
	},
	headerLeft: {
		flex: 1,
		marginRight: 12,
	},
	productTitle: {
		fontSize: 14,
		fontWeight: "600",
		color: "#1a1a1a",
		marginBottom: 2,
	},
	sku: {
		fontSize: 11,
		color: "#6c757d",
		fontStyle: "italic",
	},
	quantity: {
		fontSize: 16,
		fontWeight: "bold",
		color: "#007bff",
	},
	distributorsContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		marginTop: 12,
		marginBottom: 4,
		gap: 6,
		justifyContent: "flex-start",
	},
	distributorPill: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f8f9fa",
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 6,
		gap: 4,
	},
	distributorText: {
		fontSize: 11,
		fontWeight: "500",
		color: "#495057",
	},
	metadataGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 6,
		marginTop: 2,
	},
	metadataItem: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f8f9fa",
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 6,
		flex: 0,
		minWidth: "30%",
		maxWidth: "32%",
		gap: 4,
	},
	metadataValue: {
		fontSize: 11,
		color: "#495057",
		fontWeight: "500",
		flex: 1,
	},
	archivedLabel: {
		fontSize: 10,
		fontWeight: "400",
		fontStyle: "italic",
	},
});
