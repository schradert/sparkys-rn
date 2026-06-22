import { StyleSheet, Text, TextInput, View } from "react-native";
import CollapsibleRadioSection from "@/components/CollapsibleRadioSection";
import { Colors } from "@/constants/Colors";
import { PRODUCT_FIELD_OPTIONS } from "@/constants/Products";
import { useTheme } from "@/hooks/useTheme";
import type { NewExternalProduct } from "./types";

interface AddExternalProductFormProps {
	product: NewExternalProduct;
	internalProductNames: string[];
	onChange: (update: Partial<NewExternalProduct>) => void;
}

/**
 * The new-external-product form body shown after scanning an unknown barcode:
 * the read-only SKU, the assign-to-internal picker, the manufacturer
 * color/brand/size pickers, and the bag/current quantity inputs.
 */
export default function AddExternalProductForm({
	product,
	internalProductNames,
	onChange,
}: AddExternalProductFormProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<>
			<View style={styles.inputGroup}>
				<Text style={[styles.inputLabel, { color: colors.text }]}>
					Barcode (SKU)
				</Text>
				<TextInput
					style={[
						styles.textInput,
						styles.disabledInput,
						{
							backgroundColor: colors.surface,
							borderColor: colors.border,
							color: colors.textSecondary,
						},
					]}
					value={product.unique_id_sku}
					placeholder="Scanned barcode"
					placeholderTextColor={colors.textSecondary}
					editable={false}
				/>
			</View>

			<CollapsibleRadioSection
				title="Assign to Internal Product"
				options={internalProductNames}
				selectedValue={product.assigned_internal_product || ""}
				onSelectionChange={(productName) =>
					onChange({ assigned_internal_product: productName })
				}
			/>

			<View
				style={[styles.sectionSeparator, { backgroundColor: colors.border }]}
			/>

			<CollapsibleRadioSection
				title="Manufacturer Color"
				options={PRODUCT_FIELD_OPTIONS.manufacturer_color || []}
				selectedValue={product.manufacturer_color}
				onSelectionChange={(color) => onChange({ manufacturer_color: color })}
			/>

			<CollapsibleRadioSection
				title="Brand"
				options={PRODUCT_FIELD_OPTIONS.manufacturer || []}
				selectedValue={product.brand}
				onSelectionChange={(brand) => onChange({ brand })}
			/>

			<CollapsibleRadioSection
				title="Size"
				options={PRODUCT_FIELD_OPTIONS.size || []}
				selectedValue={product.size}
				onSelectionChange={(size) => onChange({ size })}
			/>

			<View style={styles.quantityRow}>
				<View style={styles.quantityField}>
					<Text style={[styles.inputLabel, { color: colors.text }]}>
						Bag Quantity
					</Text>
					<TextInput
						style={[
							styles.textInput,
							{
								backgroundColor: colors.surface,
								borderColor: colors.border,
								color: colors.text,
							},
						]}
						value={product.bag_quantity.toString()}
						onChangeText={(text) =>
							onChange({ bag_quantity: parseInt(text, 10) || 0 })
						}
						placeholder="50"
						placeholderTextColor={colors.textSecondary}
						keyboardType="numeric"
					/>
				</View>

				<View style={styles.quantityField}>
					<Text style={[styles.inputLabel, { color: colors.text }]}>
						Current Quantity
					</Text>
					<TextInput
						style={[
							styles.textInput,
							{
								backgroundColor: colors.surface,
								borderColor: colors.border,
								color: colors.text,
							},
						]}
						value={product.quantity.toString()}
						onChangeText={(text) =>
							onChange({ quantity: parseInt(text, 10) || 0 })
						}
						placeholder="0"
						placeholderTextColor={colors.textSecondary}
						keyboardType="numeric"
					/>
				</View>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	inputGroup: {
		marginBottom: 16,
	},
	inputLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: "#495057",
		marginBottom: 8,
	},
	textInput: {
		borderWidth: 1,
		borderColor: "#dee2e6",
		borderRadius: 8,
		padding: 12,
		fontSize: 16,
		backgroundColor: "white",
		color: "#495057",
	},
	disabledInput: {
		backgroundColor: "#f8f9fa",
		color: "#6c757d",
	},
	sectionSeparator: {
		height: 1,
		backgroundColor: "#dee2e6",
		marginVertical: 20,
		marginHorizontal: 4,
	},
	quantityRow: {
		flexDirection: "row",
		gap: 16,
	},
	quantityField: {
		flex: 1,
	},
});
