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
import {
	BALLOON_PRODUCTS,
	PRODUCT_FIELD_OPTIONS,
	type Product,
} from "@/constants/Products";

if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsibleRadioSectionProps {
	title: string;
	options: string[];
	selectedValue: string;
	onSelectionChange: (value: string) => void;
}

function CollapsibleRadioSection({
	title,
	options,
	selectedValue,
	onSelectionChange,
}: CollapsibleRadioSectionProps) {
	const [isExpanded, setIsExpanded] = useState<boolean>(false);

	function toggleExpansion(): void {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setIsExpanded(!isExpanded);
	}

	function handlePillPress(value: string): void {
		onSelectionChange(value);
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setIsExpanded(false);
	}

	const hasSelection = selectedValue !== "";

	return (
		<View style={styles.filterSection}>
			<Pressable style={styles.filterHeader} onPress={toggleExpansion}>
				<Text style={styles.filterHeaderText}>{title}</Text>
				<View style={styles.headerRight}>
					{!isExpanded && hasSelection && (
						<View style={[styles.pill, styles.pillSelected]}>
							<Text style={[styles.pillText, styles.pillTextSelected]}>
								{selectedValue}
							</Text>
						</View>
					)}
					<Ionicons
						name={isExpanded ? "chevron-down" : "chevron-forward"}
						size={16}
						color="#666"
					/>
				</View>
			</Pressable>

			{isExpanded && (
				<View style={styles.pillContainer}>
					{options.map((option) => (
						<Pressable
							key={option}
							style={[
								styles.pill,
								selectedValue === option && styles.pillSelected,
							]}
							onPress={() => handlePillPress(option)}
						>
							<Text
								style={[
									styles.pillText,
									selectedValue === option && styles.pillTextSelected,
								]}
							>
								{option}
							</Text>
						</Pressable>
					))}
				</View>
			)}
		</View>
	);
}

export default function ProductDetail() {
	const { id } = useLocalSearchParams<{ id: string }>();

	const product = BALLOON_PRODUCTS.find((p) => p.id === id);
	const [editedProduct, setEditedProduct] = useState<Product>(product);

	if (!product) {
		return (
			<View style={styles.container}>
				<View style={styles.header}>
					<Pressable onPress={() => router.back()} style={styles.backButton}>
						<Ionicons name="arrow-back" size={24} color="#007bff" />
					</Pressable>
					<Text style={styles.headerTitle}>Product Not Found</Text>
				</View>
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>Product not found</Text>
				</View>
			</View>
		);
	}

	function formatCategoryTitle(category: string): string {
		return (
			category.charAt(0).toUpperCase() +
			category.slice(1).replace(/([A-Z])/g, " $1")
		);
	}

	function handleSave() {
		Alert.alert("Save", "Product saved successfully!");
		router.back();
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
		<View style={styles.container}>
			<View style={styles.header}>
				<Pressable onPress={() => router.back()} style={styles.backButton}>
					<Ionicons name="arrow-back" size={24} color="#007bff" />
				</Pressable>
				<Text style={styles.headerTitle}>{product.name}</Text>
				<Pressable onPress={handleSave} style={styles.saveButton}>
					<Ionicons name="checkmark" size={24} color="white" />
				</Pressable>
			</View>

			<ScrollView
				style={styles.scrollView}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Basic Information</Text>

					<View style={styles.inputGroup}>
						<Text style={styles.inputLabel}>Product ID</Text>
						<TextInput
							style={[styles.textInput, styles.disabledInput]}
							value={editedProduct.id}
							editable={false}
						/>
					</View>

					<View style={styles.inputGroup}>
						<Text style={styles.inputLabel}>Product Name</Text>
						<TextInput
							style={[styles.textInput, styles.disabledInput]}
							value={editedProduct.name}
							editable={false}
						/>
					</View>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Quantity</Text>

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
							options={options}
							selectedValue={editedProduct[field as keyof Product] as string}
							onSelectionChange={(value) =>
								setEditedProduct((prev) => ({ ...prev, [field]: value }))
							}
						/>
					))}
				</View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		paddingTop: 60,
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
