import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import CollapsibleMultiSelectSection from "@/components/CollapsibleMultiSelectSection";
import CollapsibleRadioSection from "@/components/CollapsibleRadioSection";
import { Colors } from "@/constants/Colors";
import { PRODUCT_FIELD_OPTIONS } from "@/constants/Products";
import { useTheme } from "@/hooks/useTheme";
import type { NewInternalProduct } from "./types";

interface AddInternalProductFormProps {
	product: NewInternalProduct;
	onChange: (update: Partial<NewInternalProduct>) => void;
}

/** The new-internal-product form body (name, never-out, threshold, metadata). */
export default function AddInternalProductForm({
	product,
	onChange,
}: AddInternalProductFormProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<>
			<View style={styles.nameRow}>
				<View style={styles.nameContainer}>
					<TextInput
						style={[
							styles.nameInput,
							{
								backgroundColor: colors.surface,
								borderColor: colors.border,
								color: colors.text,
							},
						]}
						value={product.sparkys_product_name}
						onChangeText={(text) => onChange({ sparkys_product_name: text })}
						placeholder="Product Name..."
						placeholderTextColor={colors.textSecondary}
						autoFocus
					/>
				</View>
				<Pressable
					style={[
						styles.neverOutToggleBadge,
						product.never_out
							? styles.neverOutToggleActive
							: styles.neverOutToggleInactive,
					]}
					onPress={() => onChange({ never_out: !product.never_out })}
				>
					<Text
						style={[
							styles.neverOutToggleText,
							product.never_out
								? styles.neverOutToggleTextActive
								: styles.neverOutToggleTextInactive,
						]}
					>
						Never Out
					</Text>
				</Pressable>
			</View>

			<View style={styles.quantityRow}>
				<View style={[styles.quantityBox, { backgroundColor: colors.surface }]}>
					<Text style={[styles.quantityLabel, { color: colors.textSecondary }]}>
						Total Quantity
					</Text>
					<Text style={[styles.quantity, { color: colors.text }]}>0</Text>
				</View>
				<View style={[styles.quantityBox, { backgroundColor: colors.surface }]}>
					<Text style={[styles.quantityLabel, { color: colors.textSecondary }]}>
						Threshold Quantity
					</Text>
					<TextInput
						style={[
							styles.thresholdInput,
							{
								backgroundColor: colors.cardBackground,
								borderColor: colors.border,
								color: colors.primary,
							},
						]}
						value={(product.threshold_quantity || 0).toString()}
						onChangeText={(text) => {
							const threshold = parseInt(text, 10);
							onChange({
								threshold_quantity: Number.isNaN(threshold) ? 0 : threshold,
							});
						}}
						placeholder="0"
						placeholderTextColor={colors.textSecondary}
						keyboardType="numeric"
						selectTextOnFocus
					/>
				</View>
			</View>

			<CollapsibleRadioSection
				title="Product Type"
				options={PRODUCT_FIELD_OPTIONS.productType || []}
				selectedValue={product.product_type}
				onSelectionChange={(type) => onChange({ product_type: type })}
			/>

			<CollapsibleRadioSection
				title="Sparky's Color"
				options={PRODUCT_FIELD_OPTIONS.sparkys_color || []}
				selectedValue={product.sparkys_color}
				onSelectionChange={(color) => onChange({ sparkys_color: color })}
			/>

			<CollapsibleRadioSection
				title="Texture"
				options={PRODUCT_FIELD_OPTIONS.texture || []}
				selectedValue={product.texture}
				onSelectionChange={(texture) => onChange({ texture })}
			/>

			<CollapsibleRadioSection
				title="Shape"
				options={PRODUCT_FIELD_OPTIONS.shape || []}
				selectedValue={product.shape}
				onSelectionChange={(shape) => onChange({ shape })}
			/>

			<CollapsibleMultiSelectSection
				title="Occasions"
				options={PRODUCT_FIELD_OPTIONS.occasion || []}
				selectedValues={product.occasions}
				onSelectionChange={(occasions) => onChange({ occasions })}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	nameRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginBottom: 16,
	},
	nameContainer: {
		flex: 1,
	},
	nameInput: {
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 12,
		fontSize: 18,
		fontWeight: "600",
		minHeight: 48,
	},
	quantityRow: {
		flexDirection: "row",
		gap: 16,
	},
	quantityBox: {
		flex: 1,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		marginBottom: 16,
	},
	quantityLabel: {
		fontSize: 12,
		fontWeight: "600",
		marginBottom: 4,
	},
	quantity: {
		fontSize: 24,
		fontWeight: "bold",
		minWidth: 60,
		textAlign: "left",
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
