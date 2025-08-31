import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CollapsibleRadioSection from "@/components/CollapsibleRadioSection";
import ExternalProductCard from "@/components/ExternalProductCard";
import { Colors } from "@/constants/Colors";
import type { ExternalProduct, InternalProduct } from "@/constants/Products";
import {
	archiveInternalProduct,
	getQuantityColor,
	isMetadataItemArchived,
	PRODUCT_FIELD_OPTIONS,
	unarchiveInternalProduct,
} from "@/constants/Products";
import { useSheetsData } from "@/hooks/useSheetsData";
import { useTheme } from "@/hooks/useTheme";
import {
	getAllInternalProducts,
	getExternalProductsForInternal,
	getInternalProductByName,
	setInternalProducts,
	updateInternalProduct,
} from "@/store/products";

export default function InternalProductDetail() {
	const { theme } = useTheme();
	const colors = Colors[theme];

	// Helper function to add (Archived) labels to metadata options
	const addArchivedLabels = (options: string[], fieldKey: string): string[] => {
		return options.map((option) => {
			const isArchived = isMetadataItemArchived(fieldKey, option);
			return isArchived ? `${option} (Archived)` : option;
		});
	};
	const { updateInternalProduct: updateInternalProductInSheet } =
		useSheetsData();
	const { id } = useLocalSearchParams<{ id: string }>();
	const productName = decodeURIComponent(id || "");
	const [internalProduct, setInternalProduct] =
		useState<InternalProduct | null>(null);
	const [externalProducts, setExternalProducts] = useState<ExternalProduct[]>(
		[],
	);
	const [loading, setLoading] = useState(true);
	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isArchiving, setIsArchiving] = useState(false);
	const [editedProduct, setEditedProduct] = useState<InternalProduct | null>(
		null,
	);

	useEffect(() => {
		if (!id) return;

		const internal = getInternalProductByName(productName);
		const externals = internal ? getExternalProductsForInternal(internal) : [];

		setInternalProduct(internal || null);
		setEditedProduct(internal || null);
		setExternalProducts(externals);
		setLoading(false);
	}, [id]);

	const handleSave = async () => {
		if (!editedProduct || !internalProduct) return;

		setIsSaving(true);
		try {
			// Simulate API call delay
			await new Promise((resolve) => setTimeout(resolve, 1000));
			updateInternalProduct(
				internalProduct.sparkys_product_name,
				editedProduct,
			);
			setInternalProduct(editedProduct);
			setIsEditing(false);
			Alert.alert("Success", "Product updated successfully");
		} catch (error) {
			Alert.alert("Error", "Failed to update product");
		} finally {
			setIsSaving(false);
		}
	};

	const handleCancel = () => {
		setEditedProduct(internalProduct);
		setIsEditing(false);
	};

	const handleFieldChange = (field: keyof InternalProduct, value: string) => {
		if (!editedProduct) return;
		setEditedProduct({
			...editedProduct,
			[field]: value,
		});
	};

	const handleOccasionsChange = (occasionValue: string) => {
		if (!editedProduct) return;

		const occasions = editedProduct.occasions || [];
		const isSelected = occasions.includes(occasionValue);

		if (isSelected) {
			setEditedProduct({
				...editedProduct,
				occasions: occasions.filter((o) => o !== occasionValue),
			});
		} else {
			setEditedProduct({
				...editedProduct,
				occasions: [...occasions, occasionValue],
			});
		}
	};

	const handleArchive = async () => {
		if (!internalProduct) return;

		const isCurrentlyArchived = internalProduct.status === "archived";
		const action = isCurrentlyArchived ? "unarchive" : "archive";

		Alert.alert(
			`${action.charAt(0).toUpperCase() + action.slice(1)} Product`,
			`Are you sure you want to ${action} "${internalProduct.sparkys_product_name}"?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: action.charAt(0).toUpperCase() + action.slice(1),
					style: isCurrentlyArchived ? "default" : "destructive",
					onPress: async () => {
						setIsArchiving(true);
						try {
							// Update spreadsheet with new status
							const newStatus = isCurrentlyArchived ? "active" : "archived";
							const productForSheet = {
								sparkys_product_name: internalProduct.sparkys_product_name,
								product_type: internalProduct.product_type,
								sparkys_color: internalProduct.sparkys_color,
								texture: internalProduct.texture,
								shape: internalProduct.shape,
								occasions: internalProduct.occasions.join(", "),
								products: internalProduct.products.join(", "),
								threshold_quantity: internalProduct.threshold_quantity,
								status: newStatus,
							};

							const result =
								await updateInternalProductInSheet(productForSheet);
							if (result.success) {
								// Update global store immediately
								const updatedProduct = {
									...internalProduct,
									status: newStatus,
								};
								updateInternalProduct(
									internalProduct.sparkys_product_name,
									updatedProduct,
								);

								// Update local component state
								setInternalProduct(updatedProduct);
								setEditedProduct(updatedProduct);

								Alert.alert("Success", `Product ${action}d successfully!`);
							} else {
								Alert.alert(
									"Error",
									result.error || `Failed to ${action} product`,
								);
							}
						} catch (error) {
							Alert.alert("Error", `Failed to ${action} product`);
						} finally {
							setIsArchiving(false);
						}
					},
				},
			],
		);
	};

	if (loading) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.cardBackground }]}
			>
				<ActivityIndicator size="large" color={colors.primary} />
			</SafeAreaView>
		);
	}

	if (!internalProduct) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.cardBackground }]}
			>
				<View style={styles.header}>
					<Pressable onPress={() => router.back()}>
						<Ionicons name="arrow-back" size={24} color={colors.text} />
					</Pressable>
					<Text style={[styles.headerTitle, { color: colors.text }]}>
						Product Not Found
					</Text>
				</View>
				<View style={styles.errorContainer}>
					<Text style={[styles.errorText, { color: colors.error }]}>
						Internal product not found
					</Text>
				</View>
			</SafeAreaView>
		);
	}

	const totalQuantity = externalProducts
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
			label: "Product Type",
		},
		{
			field: "texture",
			value: internalProduct.texture,
			icon: getIconForMetadata("texture"),
			label: "Texture",
		},
		{
			field: "shape",
			value: internalProduct.shape,
			icon: getIconForMetadata("shape"),
			label: "Shape",
		},
		{
			field: "sparkys_color",
			value: internalProduct.sparkys_color,
			icon: getIconForMetadata("sparkys_color"),
			label: "Sparky's Color",
		},
	].filter((item) => item.value && item.value.trim() !== "");

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.cardBackground }]}
		>
			<View
				style={[
					styles.header,
					{
						backgroundColor: colors.cardBackground,
						borderBottomColor: colors.borderLight,
					},
				]}
			>
				<Pressable onPress={() => router.back()}>
					<Ionicons name="arrow-back" size={24} color={colors.text} />
				</Pressable>
				<Text style={[styles.headerTitle, { color: colors.text }]}>
					Internal Product
				</Text>
				<View style={styles.headerActions}>
					{!isEditing && (
						<Pressable
							onPress={handleArchive}
							style={[
								styles.circleButton,
								{ backgroundColor: colors.primary },
								isArchiving && styles.disabledButton,
							]}
							disabled={isArchiving}
						>
							<Ionicons
								name={
									isArchiving
										? "hourglass"
										: internalProduct.status === "archived"
											? "refresh-outline"
											: "archive-outline"
								}
								size={20}
								color="white"
							/>
						</Pressable>
					)}
					<Pressable
						onPress={isEditing ? handleSave : () => setIsEditing(true)}
						style={[
							styles.circleButton,
							{ backgroundColor: colors.primary },
							isSaving && styles.disabledButton,
						]}
						disabled={isSaving}
					>
						<Ionicons
							name={isSaving ? "hourglass" : isEditing ? "checkmark" : "pencil"}
							size={20}
							color="white"
						/>
					</Pressable>
					{isEditing && (
						<Pressable
							onPress={handleCancel}
							style={[styles.circleButton, { backgroundColor: colors.error }]}
						>
							<Ionicons name="close" size={20} color="white" />
						</Pressable>
					)}
				</View>
			</View>

			<View
				style={[
					styles.contentContainer,
					{ backgroundColor: colors.background },
				]}
			>
				<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
					<View
						style={[
							styles.productCard,
							{ backgroundColor: colors.cardBackground },
						]}
					>
						<Text style={[styles.productName, { color: colors.text }]}>
							{internalProduct.sparkys_product_name}
						</Text>

						<View
							style={[
								styles.quantityContainer,
								{ backgroundColor: colors.surface },
							]}
						>
							<Text
								style={[styles.quantityLabel, { color: colors.textSecondary }]}
							>
								Total Quantity
							</Text>
							<Text style={styles.quantity}>
								<Text
									style={{ color: getQuantityColorValue(quantityColorType) }}
								>
									{totalQuantity}
								</Text>
								<Text style={{ color: colors.primary }}>
									{" "}
									/ {internalProduct.threshold_quantity}
								</Text>
							</Text>
						</View>

						{/* Editable Fields */}
						{isEditing && editedProduct && (
							<>
								<CollapsibleRadioSection
									title="Product Type"
									options={addArchivedLabels(
										PRODUCT_FIELD_OPTIONS.productType,
										"productType",
									)}
									selectedValue={editedProduct.product_type}
									onSelectionChange={(value) =>
										handleFieldChange(
											"product_type",
											value.replace(" (Archived)", ""),
										)
									}
								/>
								<CollapsibleRadioSection
									title="Sparky's Color"
									options={addArchivedLabels(
										PRODUCT_FIELD_OPTIONS.sparkys_color,
										"sparkys_color",
									)}
									selectedValue={editedProduct.sparkys_color}
									onSelectionChange={(value) =>
										handleFieldChange(
											"sparkys_color",
											value.replace(" (Archived)", ""),
										)
									}
								/>
								<CollapsibleRadioSection
									title="Texture"
									options={addArchivedLabels(
										PRODUCT_FIELD_OPTIONS.texture,
										"texture",
									)}
									selectedValue={editedProduct.texture}
									onSelectionChange={(value) =>
										handleFieldChange(
											"texture",
											value.replace(" (Archived)", ""),
										)
									}
								/>
								<CollapsibleRadioSection
									title="Shape"
									options={addArchivedLabels(
										PRODUCT_FIELD_OPTIONS.shape,
										"shape",
									)}
									selectedValue={editedProduct.shape}
									onSelectionChange={(value) =>
										handleFieldChange("shape", value.replace(" (Archived)", ""))
									}
								/>

								{/* Occasions - Multi-select */}
								<View
									style={[
										styles.multiSelectSection,
										{ backgroundColor: colors.cardBackground },
									]}
								>
									<Text style={[styles.sectionTitle, { color: colors.text }]}>
										Occasions (Multi-select)
									</Text>
									<View style={styles.occasionsEditContainer}>
										{addArchivedLabels(
											PRODUCT_FIELD_OPTIONS.occasion,
											"occasion",
										).map((occasionLabel) => {
											const occasion = occasionLabel.replace(" (Archived)", "");
											const isSelected =
												editedProduct.occasions?.includes(occasion) || false;
											return (
												<Pressable
													key={occasionLabel}
													onPress={() => handleOccasionsChange(occasion)}
													style={[
														styles.occasionEditPill,
														{
															backgroundColor: isSelected
																? colors.primary
																: colors.surface,
															borderColor: colors.border,
														},
													]}
												>
													<Text
														style={[
															styles.occasionEditText,
															{ color: isSelected ? "white" : colors.text },
														]}
													>
														{occasionLabel}
													</Text>
												</Pressable>
											);
										})}
									</View>
								</View>
							</>
						)}

						{!isEditing && (
							<>
								{/* Read-only Occasions */}
								{internalProduct.occasions.length > 0 && (
									<View style={styles.section}>
										<Text style={[styles.sectionTitle, { color: colors.text }]}>
											Occasions
										</Text>
										<View style={styles.occasionsContainer}>
											{internalProduct.occasions.map((occasion, index) => (
												<View
													key={`${occasion}-${index}`}
													style={[
														styles.occasionPill,
														{
															backgroundColor: colors.surface,
															borderColor: colors.border,
														},
													]}
												>
													<Ionicons
														name="calendar-outline"
														size={14}
														color={colors.primary}
													/>
													<Text
														style={[
															styles.occasionText,
															{ color: colors.primary },
														]}
													>
														{occasion}
													</Text>
												</View>
											))}
										</View>
									</View>
								)}

								{/* Read-only Metadata */}
								<View style={styles.section}>
									<Text style={[styles.sectionTitle, { color: colors.text }]}>
										Product Details
									</Text>
									<View style={styles.metadataGrid}>
										{metadataItems.map((item) => (
											<View
												key={item.field}
												style={[
													styles.metadataItem,
													{ backgroundColor: colors.surface },
												]}
											>
												<Ionicons
													name={item.icon as any}
													size={20}
													color={colors.primary}
												/>
												<View style={styles.metadataContent}>
													<Text
														style={[
															styles.metadataLabel,
															{ color: colors.textSecondary },
														]}
													>
														{item.label}
													</Text>
													<Text
														style={[
															styles.metadataValue,
															{ color: colors.text },
														]}
													>
														{item.value}
													</Text>
												</View>
											</View>
										))}
									</View>
								</View>
							</>
						)}
					</View>

					{/* External Products */}
					{externalProducts.length > 0 && (
						<View
							style={[
								styles.externalProductsCard,
								{ backgroundColor: colors.cardBackground },
							]}
						>
							<Text style={[styles.sectionTitle, { color: colors.text }]}>
								External Products ({externalProducts.length})
							</Text>
							<Text
								style={[
									styles.sectionSubtitle,
									{ color: colors.textSecondary },
								]}
							>
								These are the manufacturer products grouped under this internal
								product
							</Text>
							{externalProducts.map((externalProduct) => (
								<ExternalProductCard
									key={externalProduct.unique_id_sku}
									externalProduct={externalProduct}
								/>
							))}
						</View>
					)}
				</ScrollView>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	contentContainer: {
		flex: 1,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e5e9",
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#1a1a1a",
		flex: 1,
		textAlign: "center",
	},
	headerActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	content: {
		flex: 1,
		padding: 16,
	},
	productCard: {
		backgroundColor: "white",
		borderRadius: 12,
		padding: 20,
		marginBottom: 16,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
	},
	productName: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#1a1a1a",
		marginBottom: 16,
	},
	quantityContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 20,
		paddingVertical: 12,
		paddingHorizontal: 16,
		backgroundColor: "#f8f9fa",
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
	section: {
		marginBottom: 20,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#1a1a1a",
		marginBottom: 12,
	},
	sectionSubtitle: {
		fontSize: 14,
		color: "#6c757d",
		marginBottom: 16,
		fontStyle: "italic",
	},
	occasionsContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	occasionPill: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f8f9fa",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "#dee2e6",
		gap: 6,
	},
	occasionText: {
		fontSize: 14,
		fontWeight: "500",
		color: "#007bff",
	},
	metadataGrid: {
		gap: 12,
	},
	metadataItem: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f8f9fa",
		padding: 16,
		borderRadius: 8,
		gap: 12,
	},
	metadataContent: {
		flex: 1,
	},
	metadataLabel: {
		fontSize: 12,
		color: "#6c757d",
		textTransform: "uppercase",
		fontWeight: "500",
		marginBottom: 2,
	},
	metadataValue: {
		fontSize: 16,
		color: "#1a1a1a",
		fontWeight: "500",
	},
	externalProductsCard: {
		backgroundColor: "white",
		borderRadius: 12,
		padding: 20,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
	},
	errorContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 20,
	},
	errorText: {
		fontSize: 16,
		color: "#dc3545",
		textAlign: "center",
	},
	circleButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		justifyContent: "center",
		alignItems: "center",
		marginLeft: 8,
	},
	disabledButton: {
		opacity: 0.7,
	},
	multiSelectSection: {
		marginBottom: 16,
		borderRadius: 12,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		overflow: "hidden",
		padding: 16,
	},
	occasionsEditContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		marginTop: 12,
	},
	occasionEditPill: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 16,
		borderWidth: 1,
	},
	occasionEditText: {
		fontSize: 14,
		fontWeight: "500",
	},
});
