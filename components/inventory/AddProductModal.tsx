import { Ionicons } from "@expo/vector-icons";
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";
import AddExternalProductForm from "./AddExternalProductForm";
import AddInternalProductForm from "./AddInternalProductForm";
import AddMetadataForm from "./AddMetadataForm";
import type { NewExternalProduct, NewInternalProduct, ViewMode } from "./types";

interface AddProductModalProps {
	visible: boolean;
	currentView: ViewMode;
	currentViewLabel: string;
	scannedBarcode: string;
	isSubmitting: boolean;
	newInternalProduct: NewInternalProduct;
	newExternalProduct: NewExternalProduct;
	internalProductNames: string[];
	newMetadataValue: string;
	onSave: () => void;
	onClose: () => void;
	onInternalChange: (update: Partial<NewInternalProduct>) => void;
	onExternalChange: (update: Partial<NewExternalProduct>) => void;
	onMetadataValueChange: (value: string) => void;
}

/**
 * The slide-up add modal. Its title, body form, and submit handler all switch on
 * the current view and whether a barcode was scanned: products view shows the
 * internal form (no scan) or the external form (after a scan); metadata views
 * show the add-value form. The save button reflects the submitting state.
 */
export default function AddProductModal({
	visible,
	currentView,
	currentViewLabel,
	scannedBarcode,
	isSubmitting,
	newInternalProduct,
	newExternalProduct,
	internalProductNames,
	newMetadataValue,
	onSave,
	onClose,
	onInternalChange,
	onExternalChange,
	onMetadataValueChange,
}: AddProductModalProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={onClose}
		>
			<View
				style={[styles.modalContainer, { backgroundColor: colors.background }]}
			>
				<View
					style={[
						styles.modalHeader,
						{
							backgroundColor: colors.cardBackground,
							borderBottomColor: colors.borderLight,
						},
					]}
				>
					<Text style={[styles.modalTitle, { color: colors.text }]}>
						{currentView === "products"
							? "Add New Product"
							: `Add New ${currentViewLabel.slice(0, -1)}`}
					</Text>
					<View style={styles.modalHeaderActions}>
						<Pressable
							onPress={onSave}
							style={[
								styles.saveButton,
								{ backgroundColor: colors.primary },
								isSubmitting && { opacity: 0.6 },
							]}
							disabled={isSubmitting}
						>
							{isSubmitting ? (
								<Ionicons name="hourglass" size={24} color="white" />
							) : (
								<Ionicons name="checkmark" size={24} color="white" />
							)}
						</Pressable>
						<Pressable
							onPress={onClose}
							style={[styles.closeButton, { backgroundColor: colors.surface }]}
						>
							<Ionicons name="close" size={24} color={colors.textSecondary} />
						</Pressable>
					</View>
				</View>

				<ScrollView
					style={styles.formScrollView}
					showsVerticalScrollIndicator={false}
				>
					<View style={styles.formSection}>
						{currentView === "products" ? (
							scannedBarcode ? (
								<AddExternalProductForm
									product={newExternalProduct}
									internalProductNames={internalProductNames}
									onChange={onExternalChange}
								/>
							) : (
								<AddInternalProductForm
									product={newInternalProduct}
									onChange={onInternalChange}
								/>
							)
						) : (
							<AddMetadataForm
								singularLabel={currentViewLabel.slice(0, -1)}
								value={newMetadataValue}
								onChangeValue={onMetadataValueChange}
							/>
						)}
					</View>
				</ScrollView>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	modalContainer: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 16,
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e5e9",
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#1a1a1a",
	},
	modalHeaderActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	saveButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: "#007bff",
		justifyContent: "center",
		alignItems: "center",
	},
	closeButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		justifyContent: "center",
		alignItems: "center",
	},
	formScrollView: {
		flex: 1,
		paddingHorizontal: 16,
		paddingTop: 16,
	},
	formSection: {
		marginBottom: 24,
	},
});
