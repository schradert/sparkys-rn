import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
	Alert,
	LayoutAnimation,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	UIManager,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CollapsibleRadioSection from "@/components/CollapsibleRadioSection";
import { Colors } from "@/constants/Colors";
import {
	convertProductToSheet,
	isMetadataItemArchived,
	PRODUCT_FIELD_OPTIONS,
	type Product,
} from "@/constants/Products";
import { useSheetsData } from "@/hooks/useSheetsData";
import { useTheme } from "@/hooks/useTheme";
import { getProductById, updateProduct } from "@/store/products";

if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ProductDetail() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const product = getProductById(id as string);
	const [editedProduct, setEditedProduct] = useState<Product>({ ...product! });
	const [isSaving, setIsSaving] = useState(false);
	const { updateProduct: updateProductInSheets } = useSheetsData();
	const { theme } = useTheme();
	const colors = Colors[theme];

	// Helper function to add (Archived) labels to metadata options
	const addArchivedLabels = (options: string[], fieldKey: string): string[] => {
		return options.map((option) => {
			const isArchived = isMetadataItemArchived(fieldKey, option);
			return isArchived ? `${option} (Archived)` : option;
		});
	};

	// Map field names to their corresponding metadata field keys
	const getFieldKey = (field: string): string => {
		switch (field) {
			case "productType":
				return "productType";
			case "manufacturer_color":
				return "manufacturer_color";
			case "sparkys_color":
				return "sparkys_color";
			case "manufacturer":
				return "manufacturer";
			case "size":
				return "size";
			case "texture":
				return "texture";
			case "bagQuantity":
				return "bagQuantity";
			case "shape":
				return "shape";
			case "distributor":
				return "distributor";
			case "occasion":
				return "occasion";
			default:
				return field;
		}
	};

	if (!product) {
		return (
			<SafeAreaView style={styles.container} edges={["top", "bottom"]}>
				<View style={styles.header}>
					<Pressable onPress={() => router.back()} style={styles.backButton}>
						<Ionicons name="arrow-back" size={24} color="#007bff" />
					</Pressable>
					<Text style={styles.headerTitle}>Product Not Found</Text>
				</View>
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>Product not found</Text>
				</View>
			</SafeAreaView>
		);
	}

	function formatCategoryTitle(category: string): string {
		if (category === "manufacturer") return "Brand";
		if (category === "bagQuantity") return "Bag Quantity";
		if (category === "productType") return "Product Type";

		return (
			category.charAt(0).toUpperCase() +
			category.slice(1).replace(/([A-Z])/g, " $1")
		);
	}

	async function handleSave() {
		setIsSaving(true);
		try {
			// First update local store
			updateProduct(editedProduct.id, editedProduct);

			// Then update sheets
			const productSheet = convertProductToSheet(editedProduct);
			const result = await updateProductInSheets(productSheet);

			if (result.success) {
				Alert.alert("Success", "Product saved successfully!");
				router.back();
			} else {
				Alert.alert("Error", result.error || "Failed to save to spreadsheet");
			}
		} catch (error) {
			Alert.alert("Error", "Failed to save product");
		} finally {
			setIsSaving(false);
		}
	}

	function incrementQuantity(amount: number) {
		setEditedProduct((prev) => ({
			...prev,
			quantity: Math.max(0, prev.quantity + amount),
		}));
	}

	function incrementByBag() {
		incrementQuantity(editedProduct.bagQuantity);
	}

	function decrementByBag() {
		incrementQuantity(-editedProduct.bagQuantity);
	}

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.cardBackground }]}
			edges={["top", "bottom"]}
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
				<Pressable
					onPress={() => router.back()}
					style={[styles.backButton, { backgroundColor: colors.surface }]}
				>
					<Ionicons name="arrow-back" size={24} color={colors.primary} />
				</Pressable>
				<Text style={[styles.headerTitle, { color: colors.text }]}>
					{product.name}
				</Text>
				<Pressable
					onPress={handleSave}
					style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
					disabled={isSaving}
				>
					{isSaving ? (
						<Ionicons name="hourglass-outline" size={24} color="white" />
					) : (
						<Ionicons name="checkmark" size={24} color="white" />
					)}
				</Pressable>
			</View>

			<View
				style={[
					styles.contentContainer,
					{ backgroundColor: colors.background },
				]}
			>
				<ScrollView
					style={styles.scrollView}
					showsVerticalScrollIndicator={false}
				>
					<View style={styles.section}>
						<Text style={[styles.sectionTitle, { color: colors.text }]}>
							Basic Information
						</Text>

						<View style={styles.inputGroup}>
							<Text
								style={[styles.inputLabel, { color: colors.textSecondary }]}
							>
								Product ID
							</Text>
							<TextInput
								style={[
									styles.textInput,
									styles.disabledInput,
									{
										backgroundColor: colors.surface,
										color: colors.textMuted,
										borderColor: colors.border,
									},
								]}
								value={editedProduct.id}
								editable={false}
							/>
						</View>

						<View style={styles.inputGroup}>
							<Text
								style={[styles.inputLabel, { color: colors.textSecondary }]}
							>
								Product Name
							</Text>
							<TextInput
								style={[
									styles.textInput,
									styles.disabledInput,
									{
										backgroundColor: colors.surface,
										color: colors.textMuted,
										borderColor: colors.border,
									},
								]}
								value={editedProduct.name}
								editable={false}
							/>
						</View>
					</View>

					<View style={styles.section}>
						<Text style={[styles.sectionTitle, { color: colors.text }]}>
							Quantity
						</Text>

						<View style={styles.quantityContainer}>
							<View style={styles.bagQuantityButtons}>
								<Pressable
									style={styles.bagQuantityButton}
									onPress={incrementByBag}
								>
									<Text style={styles.bagQuantityButtonText}>
										+{editedProduct.bagQuantity}
									</Text>
									<Text style={styles.bagQuantityLabel}>Add Bag</Text>
								</Pressable>
							</View>

							<View style={styles.quantityInputContainer}>
								<View style={styles.quantityControls}>
									<Pressable
										style={styles.quantityButton}
										onPress={() => incrementQuantity(-1)}
									>
										<Ionicons name="remove" size={20} color="#007bff" />
									</Pressable>

									<TextInput
										style={styles.quantityInput}
										value={editedProduct.quantity.toString()}
										onChangeText={(text) => {
											const numValue = text === "" ? 0 : parseInt(text, 10);
											setEditedProduct((prev) => ({
												...prev,
												quantity: Number.isNaN(numValue)
													? 0
													: Math.max(0, numValue),
											}));
										}}
										keyboardType="number-pad"
									/>

									<Pressable
										style={styles.quantityButton}
										onPress={() => incrementQuantity(1)}
									>
										<Ionicons name="add" size={20} color="#007bff" />
									</Pressable>
								</View>
								<Text style={styles.quantityLabel}>Current Quantity</Text>
							</View>

							<View style={styles.bagQuantityButtons}>
								<Pressable
									style={styles.bagQuantityButton}
									onPress={decrementByBag}
								>
									<Text style={styles.bagQuantityButtonText}>
										-{editedProduct.bagQuantity}
									</Text>
									<Text style={styles.bagQuantityLabel}>Remove Bag</Text>
								</Pressable>
							</View>
						</View>
					</View>

					<View style={styles.section}>
						<Text style={styles.sectionTitle}>Product Details</Text>

						{Object.entries(PRODUCT_FIELD_OPTIONS).map(([field, options]) => (
							<CollapsibleRadioSection
								key={field}
								title={formatCategoryTitle(field)}
								options={addArchivedLabels(options, getFieldKey(field))}
								selectedValue={editedProduct[field as keyof Product] as string}
								onSelectionChange={(value) =>
									setEditedProduct((prev) => ({
										...prev,
										[field]: value.replace(" (Archived)", ""),
									}))
								}
							/>
						))}
					</View>
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
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e5e9",
	},
	backButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: "#f8f9fa",
		justifyContent: "center",
		alignItems: "center",
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#1a1a1a",
		flex: 1,
		textAlign: "center",
		marginHorizontal: 16,
	},
	saveButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: "#007bff",
		justifyContent: "center",
		alignItems: "center",
	},
	saveButtonDisabled: {
		backgroundColor: "#6c757d",
	},
	scrollView: {
		flex: 1,
		paddingHorizontal: 16,
	},
	section: {
		marginTop: 24,
		marginBottom: 16,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#1a1a1a",
		marginBottom: 16,
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
	quantityContainer: {
		alignItems: "center",
		gap: 20,
	},
	bagQuantityButtons: {
		width: "100%",
	},
	bagQuantityButton: {
		backgroundColor: "#e3f2fd",
		borderRadius: 12,
		padding: 16,
		alignItems: "center",
		borderWidth: 2,
		borderColor: "#007bff",
	},
	bagQuantityButtonText: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#007bff",
	},
	bagQuantityLabel: {
		fontSize: 12,
		color: "#007bff",
		marginTop: 4,
	},
	quantityInputContainer: {
		alignItems: "center",
		width: "100%",
	},
	quantityControls: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "white",
		borderRadius: 12,
		borderWidth: 2,
		borderColor: "#007bff",
		overflow: "hidden",
	},
	quantityButton: {
		width: 50,
		height: 60,
		backgroundColor: "#f8f9fa",
		justifyContent: "center",
		alignItems: "center",
		borderColor: "#007bff",
	},
	quantityInput: {
		flex: 1,
		textAlign: "center",
		fontSize: 24,
		fontWeight: "bold",
		color: "#1a1a1a",
		paddingVertical: 16,
		paddingHorizontal: 20,
		minWidth: 100,
		backgroundColor: "white",
	},
	quantityLabel: {
		fontSize: 12,
		color: "#6c757d",
		marginTop: 8,
	},
	filterSection: {
		backgroundColor: "white",
		marginBottom: 16,
		borderRadius: 12,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		overflow: "hidden",
	},
	filterHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		backgroundColor: "white",
	},
	headerRight: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	filterHeaderText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1a1a1a",
		flex: 1,
	},
	pillContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		padding: 16,
		paddingTop: 0,
		backgroundColor: "#f8f9fa",
	},
	pill: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: "#dee2e6",
		backgroundColor: "white",
		margin: 4,
	},
	pillSelected: {
		backgroundColor: "#007bff",
		borderColor: "#007bff",
	},
	pillText: {
		color: "#495057",
		fontSize: 14,
		fontWeight: "500",
	},
	pillTextSelected: {
		color: "white",
		fontWeight: "600",
	},
	errorContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 40,
	},
	errorText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#6c757d",
		textAlign: "center",
	},
});
