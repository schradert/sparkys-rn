import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CollapsibleMultiSelectSection from "@/components/CollapsibleMultiSelectSection";
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
	getInternalProductById,
	getInternalProductByName,
	setInternalProducts,
	subscribeToStoreChanges,
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
	const {
		updateInternalProduct: updateInternalProductInSheet,
		archiveInternalProduct,
		unarchiveInternalProduct,
	} = useSheetsData();
	const { id } = useLocalSearchParams<{ id: string }>();
	const productId = decodeURIComponent(id || "");
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
	const [originalProduct, setOriginalProduct] =
		useState<InternalProduct | null>(null);

	useEffect(() => {
		if (!id) return;

		// Use React.startTransition to batch updates and prevent cascading effects
		React.startTransition(() => {
			const internal = getInternalProductById(productId);
			const externals = internal
				? getExternalProductsForInternal(internal)
				: [];

			setInternalProduct(internal || null);
			setEditedProduct(internal || null);
			setOriginalProduct(internal || null);
			setExternalProducts(externals);
			setLoading(false);
		});
	}, [id, productId]);

	// Subscribe to store changes to refresh when external products are updated
	useEffect(() => {
		const unsubscribe = subscribeToStoreChanges(() => {
			if (!id) return;

			const internal = getInternalProductById(productId);
			const externals = internal
				? getExternalProductsForInternal(internal)
				: [];

			setInternalProduct(internal || null);
			setExternalProducts(externals);
		});

		return unsubscribe;
	}, [id, productId]);

	const handleSave = async () => {
		if (!editedProduct || !internalProduct || !originalProduct) return;

		// Check for duplicate names (excluding current product)
		if (
			editedProduct.sparkys_product_name !==
			originalProduct.sparkys_product_name
		) {
			const allProducts = getAllInternalProducts();
			const existingProduct = allProducts.find(
				(p) =>
					p.id !== editedProduct.id &&
					p.sparkys_product_name.toLowerCase().trim() ===
						editedProduct.sparkys_product_name.toLowerCase().trim(),
			);
			if (existingProduct) {
				Alert.alert("Error", "A product with this name already exists");
				return;
			}
		}

		// Check if there are any actual changes
		const hasChanges =
			editedProduct.sparkys_product_name !==
				originalProduct.sparkys_product_name ||
			editedProduct.product_type !== originalProduct.product_type ||
			editedProduct.sparkys_color !== originalProduct.sparkys_color ||
			editedProduct.texture !== originalProduct.texture ||
			editedProduct.shape !== originalProduct.shape ||
			JSON.stringify(editedProduct.occasions) !==
				JSON.stringify(originalProduct.occasions) ||
			editedProduct.threshold_quantity !== originalProduct.threshold_quantity ||
			editedProduct.never_out !== originalProduct.never_out;

		if (!hasChanges) {
			setIsEditing(false);
			return;
		}

		setIsSaving(true);
		try {
			// Update spreadsheet first
			const productForSheet = {
				id: editedProduct.id,
				sparkys_product_name: editedProduct.sparkys_product_name,
				product_type: editedProduct.product_type,
				sparkys_color: editedProduct.sparkys_color,
				texture: editedProduct.texture,
				shape: editedProduct.shape,
				occasions: editedProduct.occasions.join(", "),
				products: editedProduct.products.join(", "),
				threshold_quantity: editedProduct.threshold_quantity,
				never_out: editedProduct.never_out,
				status: editedProduct.status || "active",
			};

			const result = await updateInternalProductInSheet(productForSheet);
			if (result.success) {
				// Update global store - use ID as lookup key
				updateInternalProduct(originalProduct.id, editedProduct);
				setInternalProduct(editedProduct);
				setOriginalProduct(editedProduct);
				setIsEditing(false);
				Alert.alert("Success", "Product updated successfully");
			} else {
				Alert.alert("Error", result.error || "Failed to update product");
			}
		} catch (error) {
			Alert.alert("Error", "Failed to update product");
		} finally {
			setIsSaving(false);
		}
	};

	const handleCancel = () => {
		setEditedProduct(originalProduct);
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
							const result = isCurrentlyArchived
								? await unarchiveInternalProduct(internalProduct.id)
								: await archiveInternalProduct(internalProduct.id);

							if (result.success) {
								const newStatus = isCurrentlyArchived ? "active" : "archived";
								const updatedProduct = {
									...internalProduct,
									status: newStatus,
								};
								updateInternalProduct(internalProduct.id, updatedProduct);
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
					<View style={styles.productNameRow}>
						{isEditing ? (
							<TextInput
								style={[
									styles.productNameInput,
									{
										color: colors.text,
										borderColor: colors.border,
										backgroundColor: colors.surface,
									},
								]}
								value={editedProduct?.sparkys_product_name || ""}
								onChangeText={(text) => {
									if (editedProduct) {
										setEditedProduct({
											...editedProduct,
											sparkys_product_name: text,
										});
									}
								}}
								placeholder="Enter product name"
								placeholderTextColor={colors.textSecondary}
							/>
						) : (
							<Text style={[styles.productName, { color: colors.text }]}>
								{internalProduct.sparkys_product_name}
							</Text>
						)}
						{isEditing ? (
							<Pressable
								style={[
									styles.neverOutToggleBadge,
									editedProduct?.never_out
										? styles.neverOutToggleActive
										: styles.neverOutToggleInactive,
								]}
								onPress={() => {
									if (editedProduct) {
										setEditedProduct({
											...editedProduct,
											never_out: !editedProduct.never_out,
										});
									}
								}}
							>
								<Text
									style={[
										styles.neverOutToggleText,
										editedProduct?.never_out
											? styles.neverOutToggleTextActive
											: styles.neverOutToggleTextInactive,
									]}
								>
									Never Out
								</Text>
							</Pressable>
						) : (
							internalProduct.never_out && (
								<View style={styles.neverOutBadge}>
									<Text style={styles.neverOutText}>Never Out</Text>
								</View>
							)
						)}
					</View>

					<View style={styles.quantityRow}>
						<View
							style={[
								styles.quantityBox,
								{ backgroundColor: colors.surface },
								isEditing && { opacity: 0.6 },
							]}
						>
							<Text
								style={[styles.quantityLabel, { color: colors.textSecondary }]}
							>
								Total Quantity
							</Text>
							<Text
								style={[
									styles.quantity,
									{ color: getQuantityColorValue(quantityColorType) },
								]}
							>
								{totalQuantity}
							</Text>
						</View>

						<View
							style={[styles.quantityBox, { backgroundColor: colors.surface }]}
						>
							<Text
								style={[styles.quantityLabel, { color: colors.textSecondary }]}
							>
								Threshold Quantity
							</Text>
							{isEditing ? (
								<TextInput
									style={[
										styles.thresholdInput,
										{
											color: colors.primary,
											borderColor: colors.border,
											backgroundColor: colors.cardBackground,
										},
									]}
									value={editedProduct?.threshold_quantity?.toString() || ""}
									onChangeText={(text) => {
										if (!editedProduct) return;
										const threshold = parseInt(text, 10);
										setEditedProduct({
											...editedProduct,
											threshold_quantity: isNaN(threshold) ? 0 : threshold,
										});
									}}
									keyboardType="numeric"
									selectTextOnFocus
								/>
							) : (
								<Text style={[styles.quantity, { color: colors.primary }]}>
									{internalProduct.threshold_quantity}
								</Text>
							)}
						</View>
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
									handleFieldChange("texture", value.replace(" (Archived)", ""))
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

							<CollapsibleMultiSelectSection
								title="Occasions"
								options={addArchivedLabels(
									PRODUCT_FIELD_OPTIONS.occasion,
									"occasion",
								)}
								selectedValues={editedProduct.occasions}
								onSelectionChange={(values) =>
									setEditedProduct({
										...editedProduct,
										occasions: values.map((v) => v.replace(" (Archived)", "")),
									})
								}
							/>
						</>
					)}

					{!isEditing && (
						<>
							{/* Read-only Metadata */}
							<View style={styles.section}>
								<Text style={[styles.sectionTitle, { color: colors.text }]}>
									Product Details
								</Text>
								<View style={styles.metadataGrid}>
									{metadataItems.map((item) => {
										const getMetadataRoute = (field: string, value: string) => {
											switch (field) {
												case "product_type":
													return `/metadata/productTypes/${encodeURIComponent(value)}`;
												case "texture":
													return `/metadata/textures/${encodeURIComponent(value)}`;
												case "shape":
													return `/metadata/shapes/${encodeURIComponent(value)}`;
												case "sparkys_color":
													return `/metadata/colors/${encodeURIComponent(value)}`;
												default:
													return null;
											}
										};

										const route = getMetadataRoute(item.field, item.value);
										const MetadataComponent = route ? Pressable : View;

										return (
											<MetadataComponent
												key={item.field}
												style={[
													styles.metadataItem,
													{ backgroundColor: colors.surface },
												]}
												{...(route
													? { onPress: () => router.push(route) }
													: {})}
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
															{ color: route ? colors.primary : colors.text },
														]}
													>
														{item.value}
													</Text>
												</View>
												{route && (
													<Ionicons
														name="chevron-forward"
														size={16}
														color={colors.primary}
													/>
												)}
											</MetadataComponent>
										);
									})}
								</View>
							</View>

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
						</>
					)}

					{/* External Products */}
					{externalProducts.length > 0 && (
						<View style={styles.section}>
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
		paddingBottom: 32,
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
	productNameInput: {
		fontSize: 24,
		fontWeight: "bold",
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
		flex: 1,
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
	quantityDisplay: {
		flexDirection: "row",
		alignItems: "center",
	},
	thresholdInput: {
		borderWidth: 1,
		borderRadius: 6,
		paddingHorizontal: 8,
		paddingVertical: 4,
		fontSize: 24,
		fontWeight: "bold",
		minWidth: 60,
		textAlign: "center",
	},
	inputGroup: {
		marginBottom: 16,
	},
	inputLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: "#495057",
		marginBottom: 8,
	},
	neverOutToggleBadge: {
		paddingHorizontal: 12,
		paddingVertical: 4,
		borderRadius: 16,
		alignSelf: "center",
	},
	neverOutToggleActive: {
		backgroundColor: "#c026d3",
		borderWidth: 2,
		borderColor: "#c026d3",
	},
	neverOutToggleInactive: {
		backgroundColor: "transparent",
		borderWidth: 2,
		borderColor: "#c026d3",
		borderStyle: "dashed",
	},
	neverOutToggleText: {
		fontSize: 12,
		fontWeight: "600",
		textTransform: "uppercase",
	},
	neverOutToggleTextActive: {
		color: "white",
	},
	neverOutToggleTextInactive: {
		color: "#9ca3af",
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
