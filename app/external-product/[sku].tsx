import { Ionicons } from "@expo/vector-icons";
import { type Href, router, useLocalSearchParams } from "expo-router";
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
import { Colors } from "@/constants/Colors";
import type { ExternalProduct, InternalProduct } from "@/constants/Products";
import {
	archiveExternalProduct,
	isMetadataItemArchived,
	PRODUCT_FIELD_OPTIONS,
	unarchiveExternalProduct,
} from "@/constants/Products";
import { useSheetsData } from "@/hooks/useSheetsData";
import { useTheme } from "@/hooks/useTheme";
import { logger } from "@/services/logger";
import {
	getAllExternalProducts,
	getAllInternalProducts,
	getExternalProductBySku,
	setExternalProducts,
	updateExternalProduct,
	updateInternalProduct as updateInternalProductInStore,
} from "@/store/products";

export default function ExternalProductDetail() {
	const { theme } = useTheme();
	const colors = Colors[theme];

	// Helper function to add (Archived) labels to metadata options
	const addArchivedLabels = (
		options: readonly string[],
		fieldKey: string,
	): string[] => {
		return options.map((option) => {
			const isArchived = isMetadataItemArchived(fieldKey, option);
			return isArchived ? `${option} (Archived)` : option;
		});
	};
	const {
		updateExternalProduct: updateExternalProductInSheet,
		updateInternalProduct: updateInternalProductInSheet,
		archiveExternalProduct,
		unarchiveExternalProduct,
		logAuditEvent,
	} = useSheetsData();
	const { sku } = useLocalSearchParams<{ sku: string }>();
	const [externalProduct, setExternalProduct] =
		useState<ExternalProduct | null>(null);
	const [internalProduct, setInternalProduct] =
		useState<InternalProduct | null>(null);
	const [originalInternalProduct, setOriginalInternalProduct] =
		useState<InternalProduct | null>(null);
	const [loading, setLoading] = useState(true);
	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isArchiving, setIsArchiving] = useState(false);
	const [editedProduct, setEditedProduct] = useState<ExternalProduct | null>(
		null,
	);
	const [originalProduct, setOriginalProduct] =
		useState<ExternalProduct | null>(null);

	useEffect(() => {
		if (!sku) return;

		// Use React.startTransition to batch updates and prevent cascading effects
		React.startTransition(() => {
			const external = getExternalProductBySku(sku);
			setExternalProduct(external || null);

			if (external) {
				// Find the internal product that contains this external product's SKU
				const allInternalProducts = getAllInternalProducts();
				const internal = allInternalProducts.find((internal) =>
					internal.products.includes(external.unique_id_sku),
				);
				setInternalProduct(internal || null);
				setOriginalInternalProduct(internal || null);
				setEditedProduct(external);
				setOriginalProduct(external);
			}

			setLoading(false);
		});
	}, [sku]);

	const handleIncrementStock = () => {
		if (!externalProduct || !editedProduct) return;
		const currentQuantity = editedProduct.quantity;
		const newQuantity = currentQuantity + externalProduct.bag_quantity;

		setEditedProduct({
			...editedProduct,
			quantity: newQuantity,
		});
	};

	const handleDecrementStock = () => {
		if (!externalProduct || !editedProduct) return;
		const currentQuantity = editedProduct.quantity;
		const newQuantity = Math.max(0, currentQuantity - 1);

		setEditedProduct({
			...editedProduct,
			quantity: newQuantity,
		});
	};

	const handleSave = async () => {
		if (!editedProduct || !externalProduct || !originalProduct) return;

		// Check if there are any actual changes
		const hasExternalChanges =
			editedProduct.manufacturer_color !== originalProduct.manufacturer_color ||
			editedProduct.brand !== originalProduct.brand ||
			editedProduct.size !== originalProduct.size ||
			editedProduct.bag_quantity !== originalProduct.bag_quantity ||
			JSON.stringify(editedProduct.distributors) !==
				JSON.stringify(originalProduct.distributors) ||
			editedProduct.quantity !== originalProduct.quantity;

		// Check if internal product assignment changed
		const hasInternalProductChange =
			internalProduct?.id !== originalInternalProduct?.id;

		if (!hasExternalChanges && !hasInternalProductChange) {
			setIsEditing(false);
			return;
		}

		setIsSaving(true);
		try {
			// 1) External field changes. The sheets service audits these itself
			//    (it diffs before/after), so we do NOT log an audit event here.
			if (hasExternalChanges) {
				const productForSheet = {
					unique_id_sku: editedProduct.unique_id_sku,
					manufacturer_color: editedProduct.manufacturer_color,
					brand: editedProduct.brand,
					size: editedProduct.size,
					bag_quantity: editedProduct.bag_quantity,
					distributors: editedProduct.distributors.join(", "),
					quantity: editedProduct.quantity,
					status: editedProduct.status || "active",
				};

				const result = await updateExternalProductInSheet(productForSheet);
				if (!result.success) {
					logger.error("ExternalProduct", "Failed to update external fields", {
						error: result.error,
						sku: editedProduct.unique_id_sku,
					});
					Alert.alert("Error", result.error || "Failed to update product");
					return;
				}
				// Keep the store in lockstep with the sheet, so a later reassignment
				// failure can't leave the store showing stale external fields.
				updateExternalProduct(externalProduct.unique_id_sku, editedProduct);
				setExternalProduct(editedProduct);
				setOriginalProduct(editedProduct);
			}

			// 2) Internal-product reassignment: two sheet writes (remove from old,
			//    add to new). Check each result, and if the second write fails roll
			//    the first one back, so a SKU is never left orphaned (removed from
			//    its old product but never added to the new one). Store updates are
			//    deferred until both writes succeed.
			if (hasInternalProductChange) {
				const sku = externalProduct.unique_id_sku;
				const toInternalSheet = (p: InternalProduct) => ({
					id: p.id,
					sparkys_product_name: p.sparkys_product_name,
					product_type: p.product_type,
					sparkys_color: p.sparkys_color,
					texture: p.texture,
					shape: p.shape,
					occasions: p.occasions.join(", "),
					products: p.products.join(", "),
					threshold_quantity: p.threshold_quantity,
					never_out: p.never_out,
					status: p.status,
				});

				const updatedOldInternal = originalInternalProduct
					? {
							...originalInternalProduct,
							products: originalInternalProduct.products.filter(
								(s) => s !== sku,
							),
						}
					: null;
				const updatedNewInternal = internalProduct
					? { ...internalProduct, products: [...internalProduct.products, sku] }
					: null;

				// Step A: remove the SKU from the old internal product.
				if (originalInternalProduct && updatedOldInternal) {
					const removeResult = await updateInternalProductInSheet(
						toInternalSheet(updatedOldInternal),
					);
					if (!removeResult.success) {
						logger.error(
							"ExternalProduct",
							"Reassign: failed to remove SKU from old internal product",
							{
								error: removeResult.error,
								sku,
								oldInternalId: originalInternalProduct.id,
							},
						);
						Alert.alert(
							"Error",
							removeResult.error || "Failed to reassign product",
						);
						return; // nothing persisted for the reassignment yet — safe to abort
					}
				}

				// Step B: add the SKU to the new internal product; roll back A on failure.
				if (internalProduct && updatedNewInternal) {
					const addResult = await updateInternalProductInSheet(
						toInternalSheet(updatedNewInternal),
					);
					if (!addResult.success) {
						logger.error(
							"ExternalProduct",
							"Reassign: failed to add SKU to new internal product; rolling back",
							{
								error: addResult.error,
								sku,
								newInternalId: internalProduct.id,
							},
						);
						if (originalInternalProduct) {
							const rollback = await updateInternalProductInSheet(
								toInternalSheet(originalInternalProduct),
							);
							if (rollback.success) {
								logger.warn(
									"ExternalProduct",
									"Reassign rolled back: SKU restored to old internal product",
									{ sku, oldInternalId: originalInternalProduct.id },
								);
							} else {
								logger.error(
									"ExternalProduct",
									"Reassign ROLLBACK FAILED: SKU orphaned from old internal product",
									{
										error: rollback.error,
										sku,
										oldInternalId: originalInternalProduct.id,
									},
								);
							}
						}
						Alert.alert(
							"Error",
							addResult.error || "Failed to reassign product",
						);
						return;
					}
				}

				// Both sheet writes succeeded — update the store and write the audit event.
				if (originalInternalProduct && updatedOldInternal) {
					updateInternalProductInStore(
						originalInternalProduct.id,
						updatedOldInternal,
					);
				}
				if (internalProduct && updatedNewInternal) {
					updateInternalProductInStore(internalProduct.id, updatedNewInternal);
				}
				await logAuditEvent({
					timestamp: new Date().toISOString(),
					event_type: "edit",
					object_type: "external_product",
					object_id: externalProduct.unique_id_sku,
					object_name: externalProduct.unique_id_sku,
					changes: JSON.stringify({
						internal_product:
							internalProduct?.sparkys_product_name || "Unassigned",
					}),
					before_state: JSON.stringify({
						internal_product:
							originalInternalProduct?.sparkys_product_name || "Unassigned",
					}),
					sheet_name: "external_products",
				});
				setOriginalInternalProduct(internalProduct);
			}

			setIsEditing(false);
			Alert.alert("Success", "Product updated successfully");
		} catch (error) {
			logger.error("ExternalProduct", "Failed to update product", {
				error,
				sku: externalProduct?.unique_id_sku,
			});
			Alert.alert("Error", "Failed to update product");
		} finally {
			setIsSaving(false);
		}
	};

	const handleCancel = () => {
		// Revert to original product state
		if (originalProduct) {
			setExternalProduct(originalProduct);
			setEditedProduct(originalProduct);
		}
		if (originalInternalProduct) {
			setInternalProduct(originalInternalProduct);
		}
		setIsEditing(false);
	};

	const handleFieldChange = (
		field: keyof ExternalProduct,
		value: string | number,
	) => {
		if (!editedProduct) return;
		setEditedProduct({
			...editedProduct,
			[field]: value,
		});
	};

	const handleDistributorsChange = (distributorValue: string) => {
		if (!editedProduct) return;

		const distributors = editedProduct.distributors || [];
		const isSelected = distributors.includes(distributorValue);

		if (isSelected) {
			setEditedProduct({
				...editedProduct,
				distributors: distributors.filter((d) => d !== distributorValue),
			});
		} else {
			setEditedProduct({
				...editedProduct,
				distributors: [...distributors, distributorValue],
			});
		}
	};

	const handleArchive = async () => {
		if (!externalProduct) return;

		const isCurrentlyArchived = externalProduct.status === "archived";
		const action = isCurrentlyArchived ? "unarchive" : "archive";

		Alert.alert(
			`${action.charAt(0).toUpperCase() + action.slice(1)} Product`,
			`Are you sure you want to ${action} "${externalProduct.unique_id_sku}"?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: action.charAt(0).toUpperCase() + action.slice(1),
					style: isCurrentlyArchived ? "default" : "destructive",
					onPress: async () => {
						setIsArchiving(true);
						try {
							const result = isCurrentlyArchived
								? await unarchiveExternalProduct(externalProduct.unique_id_sku)
								: await archiveExternalProduct(externalProduct.unique_id_sku);

							if (result.success) {
								const newStatus: "active" | "archived" = isCurrentlyArchived
									? "active"
									: "archived";
								const updatedProduct = {
									...externalProduct,
									status: newStatus,
								};
								updateExternalProduct(
									externalProduct.unique_id_sku,
									updatedProduct,
								);
								setExternalProduct(updatedProduct);
								setEditedProduct(updatedProduct);
								setOriginalProduct(updatedProduct);
								Alert.alert("Success", `Product ${action}d successfully!`);
							} else {
								Alert.alert(
									"Error",
									result.error || `Failed to ${action} product`,
								);
							}
						} catch (error) {
							logger.error("ExternalProduct", `Failed to ${action} product`, {
								error,
								sku: externalProduct.unique_id_sku,
								action,
							});
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

	if (!externalProduct) {
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
						External product not found
					</Text>
				</View>
			</SafeAreaView>
		);
	}

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
			label: "Manufacturer Color",
		},
		{
			field: "brand",
			value: externalProduct.brand,
			icon: getIconForMetadata("brand"),
			label: "Brand",
		},
		{
			field: "size",
			value: externalProduct.size,
			icon: getIconForMetadata("size"),
			label: "Size",
		},
		{
			field: "bag_quantity",
			value: externalProduct.bag_quantity?.toString(),
			icon: getIconForMetadata("bag_quantity"),
			label: "Bag Quantity",
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
					External Product
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
										: externalProduct.status === "archived"
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
					<View style={styles.skuContainer}>
						<Text style={[styles.skuValue, { color: colors.text }]}>
							{externalProduct.unique_id_sku}
						</Text>
						<View style={styles.quantityHeaderContainer}>
							{isEditing ? (
								<View style={styles.quantityControls}>
									<Pressable
										onPress={handleDecrementStock}
										style={[
											styles.quantityButton,
											{ backgroundColor: colors.error },
										]}
									>
										<Ionicons name="remove" size={16} color="white" />
									</Pressable>
									{isEditing ? (
										<TextInput
											style={[
												styles.quantityInputClickable,
												{
													color: colors.primary,
													borderColor: colors.primary,
													backgroundColor: colors.cardBackground,
												},
											]}
											value={editedProduct?.quantity.toString() || ""}
											onChangeText={(text) => {
												if (editedProduct) {
													const quantity = parseInt(text, 10);
													setEditedProduct({
														...editedProduct,
														quantity: isNaN(quantity) ? 0 : quantity,
													});
												}
											}}
											keyboardType="numeric"
											selectTextOnFocus
										/>
									) : (
										<Text style={[styles.quantity, { color: colors.primary }]}>
											{externalProduct?.quantity}
										</Text>
									)}
									<Pressable
										onPress={handleIncrementStock}
										style={[
											styles.quantityButton,
											{ backgroundColor: colors.success },
										]}
									>
										<Ionicons name="add" size={16} color="white" />
									</Pressable>
								</View>
							) : (
								<Text style={[styles.quantity, { color: colors.primary }]}>
									{externalProduct.quantity}
								</Text>
							)}
						</View>
					</View>

					{/* Internal Product Link */}
					{internalProduct && !isEditing && (
						<Pressable
							style={[
								styles.internalProductLink,
								{
									backgroundColor: colors.surface,
									borderColor: colors.border,
								},
							]}
							onPress={() =>
								router.push(
									`/internal-product/${encodeURIComponent(internalProduct.id)}`,
								)
							}
						>
							<View style={styles.internalProductInfo}>
								<Text
									style={[
										styles.internalLabel,
										{ color: colors.textSecondary },
									]}
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

					{/* Editable Fields */}
					{isEditing && editedProduct && (
						<>
							<CollapsibleRadioSection
								title="Internal Product"
								options={getAllInternalProducts()
									.filter((p) => p.status === "active")
									.map((p) => p.sparkys_product_name)}
								selectedValue={internalProduct?.sparkys_product_name || ""}
								onSelectionChange={(value) => {
									const selectedInternal = getAllInternalProducts().find(
										(p) => p.sparkys_product_name === value,
									);
									if (selectedInternal) {
										setInternalProduct(selectedInternal);
									}
								}}
							/>
							<CollapsibleRadioSection
								title="Manufacturer Color"
								options={addArchivedLabels(
									PRODUCT_FIELD_OPTIONS.manufacturer_color,
									"manufacturer_color",
								)}
								selectedValue={editedProduct.manufacturer_color}
								onSelectionChange={(value) =>
									handleFieldChange(
										"manufacturer_color",
										value.replace(" (Archived)", ""),
									)
								}
							/>
							<CollapsibleRadioSection
								title="Brand"
								options={addArchivedLabels(
									PRODUCT_FIELD_OPTIONS.manufacturer,
									"manufacturer",
								)}
								selectedValue={editedProduct.brand}
								onSelectionChange={(value) =>
									handleFieldChange("brand", value.replace(" (Archived)", ""))
								}
							/>
							<CollapsibleRadioSection
								title="Size"
								options={addArchivedLabels(PRODUCT_FIELD_OPTIONS.size, "size")}
								selectedValue={editedProduct.size}
								onSelectionChange={(value) =>
									handleFieldChange("size", value.replace(" (Archived)", ""))
								}
							/>
							<CollapsibleRadioSection
								title="Bag Quantity"
								options={addArchivedLabels(
									PRODUCT_FIELD_OPTIONS.bagQuantity,
									"bagQuantity",
								)}
								selectedValue={editedProduct.bag_quantity.toString()}
								onSelectionChange={(value) =>
									handleFieldChange(
										"bag_quantity",
										parseInt(value.replace(" (Archived)", ""), 10),
									)
								}
							/>

							<CollapsibleMultiSelectSection
								title="Distributors"
								options={addArchivedLabels(
									PRODUCT_FIELD_OPTIONS.distributor,
									"distributor",
								)}
								selectedValues={editedProduct.distributors}
								onSelectionChange={(values) =>
									setEditedProduct({
										...editedProduct,
										distributors: values.map((v) =>
											v.replace(" (Archived)", ""),
										),
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
												case "manufacturer_color":
													return `/metadata/colors/${encodeURIComponent(value)}`;
												case "brand":
													return `/metadata/manufacturers/${encodeURIComponent(value)}`;
												case "size":
													return `/metadata/sizes/${encodeURIComponent(value)}`;
												case "bag_quantity":
													return `/metadata/bagQuantities/${encodeURIComponent(value)}`;
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
													? { onPress: () => router.push(route as Href) }
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

							{/* Read-only Distributors */}
							{externalProduct.distributors.length > 0 && (
								<View style={styles.section}>
									<Text style={[styles.sectionTitle, { color: colors.text }]}>
										Distributors
									</Text>
									<View style={styles.distributorsContainer}>
										{externalProduct.distributors.map((distributor, index) => (
											<View
												key={`${distributor}-${index}`}
												style={[
													styles.distributorPill,
													{
														backgroundColor: colors.surface,
														borderColor: colors.border,
													},
												]}
											>
												<Ionicons
													name="storefront-outline"
													size={16}
													color={colors.primary}
												/>
												<Text
													style={[
														styles.distributorText,
														{ color: colors.primary },
													]}
												>
													{distributor}
												</Text>
											</View>
										))}
									</View>
								</View>
							)}
						</>
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
	quantityDisplayContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	quantity: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#007bff",
	},
	editButton: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: "#f8f9fa",
		justifyContent: "center",
		alignItems: "center",
	},
	quantityEditContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	quantityInput: {
		borderWidth: 1,
		borderColor: "#dee2e6",
		borderRadius: 6,
		paddingHorizontal: 12,
		paddingVertical: 8,
		fontSize: 18,
		fontWeight: "bold",
		minWidth: 80,
		textAlign: "center",
		backgroundColor: "white",
	},
	editActions: {
		flexDirection: "row",
		gap: 8,
	},
	saveButton: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: "#28a745",
		justifyContent: "center",
		alignItems: "center",
	},
	cancelButton: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: "#dc3545",
		justifyContent: "center",
		alignItems: "center",
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
	section: {
		marginBottom: 20,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#1a1a1a",
		marginBottom: 12,
	},
	distributorsContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	distributorPill: {
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
	distributorText: {
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
	editQuantityButton: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: "#f8f9fa",
		justifyContent: "center",
		alignItems: "center",
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
	distributorsEditContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		marginTop: 12,
	},
	distributorEditPill: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 16,
		borderWidth: 1,
	},
	distributorEditText: {
		fontSize: 14,
		fontWeight: "500",
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
	productHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: 20,
	},
	productTitleContainer: {
		flex: 1,
		marginRight: 16,
	},
	productTitle: {
		fontSize: 20,
		fontWeight: "600",
		color: "#1a1a1a",
		marginBottom: 4,
	},
	skuSubtitle: {
		fontSize: 12,
		color: "#6c757d",
		fontFamily: "monospace",
	},
	quantityHeaderContainer: {
		alignItems: "flex-end",
	},
	quantityControls: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	quantityButton: {
		width: 32,
		height: 32,
		borderRadius: 16,
		justifyContent: "center",
		alignItems: "center",
	},
	quantityInputClickable: {
		borderWidth: 2,
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
		fontSize: 18,
		fontWeight: "bold",
		minWidth: 80,
		textAlign: "center",
	},
});
