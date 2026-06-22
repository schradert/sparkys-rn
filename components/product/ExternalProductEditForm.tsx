import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import CollapsibleMultiSelectSection from "@/components/CollapsibleMultiSelectSection";
import CollapsibleRadioSection from "@/components/CollapsibleRadioSection";
import { Colors } from "@/constants/Colors";
import type { ExternalProduct, InternalProduct } from "@/constants/Products";
import { PRODUCT_FIELD_OPTIONS } from "@/constants/Products";
import { useTheme } from "@/hooks/useTheme";
import { getAllInternalProducts } from "@/store/products";
import { addArchivedLabels } from "./metadataLabels";

interface ExternalProductEditFormProps {
	editedProduct: ExternalProduct;
	setEditedProduct: (product: ExternalProduct) => void;
	selectedInternal: InternalProduct | null;
	setSelectedInternal: (internal: InternalProduct) => void;
	onIncrement: () => void;
	onDecrement: () => void;
}

/**
 * Edit-mode form for an external product: the SKU header with quantity
 * stepper, the internal-product reassignment radio, the manufacturer field
 * radios, and the distributors multi-select. Operates on a concrete
 * `editedProduct`, so the controls need no null guard.
 */
export default function ExternalProductEditForm({
	editedProduct,
	setEditedProduct,
	selectedInternal,
	setSelectedInternal,
	onIncrement,
	onDecrement,
}: ExternalProductEditFormProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	const handleFieldChange = (
		field: keyof ExternalProduct,
		value: string | number,
	) => {
		setEditedProduct({ ...editedProduct, [field]: value });
	};

	return (
		<>
			<View style={styles.skuContainer}>
				<Text style={[styles.skuValue, { color: colors.text }]}>
					{editedProduct.unique_id_sku}
				</Text>
				<View style={styles.quantityHeaderContainer}>
					<View style={styles.quantityControls}>
						<Pressable
							onPress={onDecrement}
							style={[styles.quantityButton, { backgroundColor: colors.error }]}
						>
							<Ionicons name="remove" size={16} color="white" />
						</Pressable>
						<TextInput
							style={[
								styles.quantityInputClickable,
								{
									color: colors.primary,
									borderColor: colors.primary,
									backgroundColor: colors.cardBackground,
								},
							]}
							value={editedProduct.quantity.toString()}
							onChangeText={(text) => {
								const quantity = parseInt(text, 10);
								setEditedProduct({
									...editedProduct,
									quantity: Number.isNaN(quantity) ? 0 : quantity,
								});
							}}
							keyboardType="numeric"
							selectTextOnFocus
						/>
						<Pressable
							onPress={onIncrement}
							style={[
								styles.quantityButton,
								{ backgroundColor: colors.success },
							]}
						>
							<Ionicons name="add" size={16} color="white" />
						</Pressable>
					</View>
				</View>
			</View>

			<CollapsibleRadioSection
				title="Internal Product"
				options={getAllInternalProducts()
					.filter((p) => p.status === "active")
					.map((p) => p.sparkys_product_name)}
				selectedValue={selectedInternal?.sparkys_product_name || ""}
				onSelectionChange={(value) => {
					const selected = getAllInternalProducts().find(
						(p) => p.sparkys_product_name === value,
					);
					/* istanbul ignore else -- the radio only offers existing active product names, so the lookup always matches */
					if (selected) {
						setSelectedInternal(selected);
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
						distributors: values.map((v) => v.replace(" (Archived)", "")),
					})
				}
			/>
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
