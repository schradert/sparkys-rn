import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import CollapsibleMultiSelectSection from "@/components/CollapsibleMultiSelectSection";
import CollapsibleRadioSection from "@/components/CollapsibleRadioSection";
import { Colors } from "@/constants/Colors";
import type { InternalProduct } from "@/constants/Products";
import { PRODUCT_FIELD_OPTIONS } from "@/constants/Products";
import { useTheme } from "@/hooks/useTheme";
import { addArchivedLabels } from "./metadataLabels";

interface InternalProductEditFormProps {
	editedProduct: InternalProduct;
	setEditedProduct: (product: InternalProduct) => void;
	totalQuantity: number;
	totalQuantityColor: string;
}

/**
 * Edit-mode form for an internal product. Receives a concrete `editedProduct`
 * (never null), so every field control reads and writes it directly without a
 * defensive guard.
 */
export default function InternalProductEditForm({
	editedProduct,
	setEditedProduct,
	totalQuantity,
	totalQuantityColor,
}: InternalProductEditFormProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	const handleFieldChange = (field: keyof InternalProduct, value: string) => {
		setEditedProduct({ ...editedProduct, [field]: value });
	};

	return (
		<>
			<View style={styles.productNameRow}>
				<TextInput
					style={[
						styles.productNameInput,
						{
							color: colors.text,
							borderColor: colors.border,
							backgroundColor: colors.surface,
						},
					]}
					value={editedProduct.sparkys_product_name}
					onChangeText={(text) =>
						setEditedProduct({ ...editedProduct, sparkys_product_name: text })
					}
					placeholder="Enter product name"
					placeholderTextColor={colors.textSecondary}
				/>
				<Pressable
					style={[
						styles.neverOutToggleBadge,
						editedProduct.never_out
							? styles.neverOutToggleActive
							: styles.neverOutToggleInactive,
					]}
					onPress={() =>
						setEditedProduct({
							...editedProduct,
							never_out: !editedProduct.never_out,
						})
					}
				>
					<Text
						style={[
							styles.neverOutToggleText,
							editedProduct.never_out
								? styles.neverOutToggleTextActive
								: styles.neverOutToggleTextInactive,
						]}
					>
						Never Out
					</Text>
				</Pressable>
			</View>

			<View style={styles.quantityRow}>
				<View
					style={[
						styles.quantityBox,
						{ backgroundColor: colors.surface },
						{ opacity: 0.6 },
					]}
				>
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
					<TextInput
						style={[
							styles.thresholdInput,
							{
								color: colors.primary,
								borderColor: colors.border,
								backgroundColor: colors.cardBackground,
							},
						]}
						value={editedProduct.threshold_quantity.toString()}
						onChangeText={(text) => {
							const threshold = parseInt(text, 10);
							setEditedProduct({
								...editedProduct,
								threshold_quantity: Number.isNaN(threshold) ? 0 : threshold,
							});
						}}
						keyboardType="numeric"
						selectTextOnFocus
					/>
				</View>
			</View>

			<CollapsibleRadioSection
				title="Product Type"
				options={addArchivedLabels(
					PRODUCT_FIELD_OPTIONS.productType,
					"productType",
				)}
				selectedValue={editedProduct.product_type}
				onSelectionChange={(value) =>
					handleFieldChange("product_type", value.replace(" (Archived)", ""))
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
					handleFieldChange("sparkys_color", value.replace(" (Archived)", ""))
				}
			/>
			<CollapsibleRadioSection
				title="Texture"
				options={addArchivedLabels(PRODUCT_FIELD_OPTIONS.texture, "texture")}
				selectedValue={editedProduct.texture}
				onSelectionChange={(value) =>
					handleFieldChange("texture", value.replace(" (Archived)", ""))
				}
			/>
			<CollapsibleRadioSection
				title="Shape"
				options={addArchivedLabels(PRODUCT_FIELD_OPTIONS.shape, "shape")}
				selectedValue={editedProduct.shape}
				onSelectionChange={(value) =>
					handleFieldChange("shape", value.replace(" (Archived)", ""))
				}
			/>

			<CollapsibleMultiSelectSection
				title="Occasions"
				options={addArchivedLabels(PRODUCT_FIELD_OPTIONS.occasion, "occasion")}
				selectedValues={editedProduct.occasions}
				onSelectionChange={(values) =>
					setEditedProduct({
						...editedProduct,
						occasions: values.map((v) => v.replace(" (Archived)", "")),
					})
				}
			/>
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
	productNameInput: {
		fontSize: 24,
		fontWeight: "bold",
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
		flex: 1,
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
});
