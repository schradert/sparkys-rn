import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
	Alert,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PRODUCT_FIELD_OPTIONS } from "@/constants/Products";

export default function MetadataDetail() {
	const { params } = useLocalSearchParams<{ params: string[] }>();

	const [viewMode, itemName] = params;
	const decodedItemName = decodeURIComponent(itemName);
	const [editedValue, setEditedValue] = useState(decodedItemName);

	if (!params || params.length < 2) {
		return (
			<SafeAreaView style={styles.container} edges={["top", "bottom"]}>
				<View style={styles.header}>
					<Pressable onPress={() => router.back()} style={styles.backButton}>
						<Ionicons name="arrow-back" size={24} color="#007bff" />
					</Pressable>
					<Text style={styles.headerTitle}>Invalid Route</Text>
				</View>
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>Invalid metadata route</Text>
				</View>
			</SafeAreaView>
		);
	}

	const fieldKey = getFieldKey(viewMode);
	const categoryTitle = formatCategoryTitle(viewMode);

	if (!fieldKey) {
		return (
			<SafeAreaView style={styles.container} edges={["top", "bottom"]}>
				<View style={styles.header}>
					<Pressable onPress={() => router.back()} style={styles.backButton}>
						<Ionicons name="arrow-back" size={24} color="#007bff" />
					</Pressable>
					<Text style={styles.headerTitle}>Invalid Category</Text>
				</View>
				<View style={styles.errorContainer}>
					<Text style={styles.errorText}>Invalid metadata category</Text>
				</View>
			</SafeAreaView>
		);
	}

	function getFieldKey(viewMode: string) {
		switch (viewMode) {
			case "productTypes":
				return "productType";
			case "occasions":
				return "occasion";
			case "colors":
				return "color";
			case "sizes":
				return "size";
			case "manufacturers":
				return "manufacturer";
			case "textures":
				return "texture";
			default:
				return null;
		}
	}

	function formatCategoryTitle(category: string): string {
		return (
			category.charAt(0).toUpperCase() +
			category.slice(1).replace(/([A-Z])/g, " $1")
		);
	}

	function handleSave() {
		if (!editedValue.trim()) {
			Alert.alert("Error", "Please enter a value");
			return;
		}

		const trimmedValue = editedValue.trim();

		if (trimmedValue === decodedItemName) {
			Alert.alert("Info", "No changes to save");
			router.back();
			return;
		}

		const existingValues =
			PRODUCT_FIELD_OPTIONS[fieldKey as keyof typeof PRODUCT_FIELD_OPTIONS];
		if (existingValues.includes(trimmedValue)) {
			Alert.alert("Error", "This value already exists");
			return;
		}

		const index = existingValues.indexOf(decodedItemName);
		if (index !== -1) {
			(existingValues as string[])[index] = trimmedValue;
		}

		Alert.alert("Success", `"${trimmedValue}" has been saved!`);
		router.back();
	}

	function handleDelete() {
		Alert.alert(
			"Delete Value",
			`Are you sure you want to delete "${decodedItemName}"?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: () => {
						const existingValues =
							PRODUCT_FIELD_OPTIONS[
								fieldKey as keyof typeof PRODUCT_FIELD_OPTIONS
							];
						const index = existingValues.indexOf(decodedItemName);
						if (index !== -1) {
							(existingValues as string[]).splice(index, 1);
						}
						Alert.alert("Success", `"${decodedItemName}" has been deleted!`);
						router.back();
					},
				},
			],
		);
	}

	return (
		<SafeAreaView style={styles.container} edges={["top", "bottom"]}>
			<View style={styles.header}>
				<Pressable onPress={() => router.back()} style={styles.backButton}>
					<Ionicons name="arrow-back" size={24} color="#007bff" />
				</Pressable>
				<Text style={styles.headerTitle}>
					Edit {categoryTitle.slice(0, -1)}
				</Text>
				<Pressable onPress={handleSave} style={styles.saveButton}>
					<Ionicons name="checkmark" size={24} color="white" />
				</Pressable>
			</View>

			<View style={styles.content}>
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Edit Value</Text>

					<View style={styles.inputGroup}>
						<Text style={styles.inputLabel}>
							{categoryTitle.slice(0, -1)} Name *
						</Text>
						<TextInput
							style={styles.textInput}
							value={editedValue}
							onChangeText={setEditedValue}
							placeholder={`Enter ${categoryTitle.slice(0, -1).toLowerCase()} name`}
							placeholderTextColor="#6c757d"
							autoFocus
						/>
					</View>

					<Pressable style={styles.deleteButton} onPress={handleDelete}>
						<Ionicons name="trash-outline" size={20} color="white" />
						<Text style={styles.deleteButtonText}>
							Delete {categoryTitle.slice(0, -1)}
						</Text>
					</Pressable>
				</View>
			</View>
		</SafeAreaView>
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
	content: {
		flex: 1,
		paddingHorizontal: 16,
		paddingTop: 24,
	},
	section: {
		marginBottom: 24,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#1a1a1a",
		marginBottom: 16,
	},
	inputGroup: {
		marginBottom: 24,
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
	deleteButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#dc3545",
		borderRadius: 8,
		padding: 16,
		gap: 8,
	},
	deleteButtonText: {
		color: "white",
		fontSize: 16,
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
