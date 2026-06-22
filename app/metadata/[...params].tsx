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
import { Colors } from "@/constants/Colors";
import {
	isMetadataItemArchived,
	PRODUCT_FIELD_OPTIONS,
} from "@/constants/Products";
import { getSheetNameForViewMode } from "@/hooks/sheetsData/mappings";
import { useSheetsData } from "@/hooks/useSheetsData";
import { useTheme } from "@/hooks/useTheme";
import { logger } from "@/services/logger";

export default function MetadataDetail() {
	const { params } = useLocalSearchParams<{ params: string[] }>();
	const { updateMetadata, archiveMetadata, unarchiveMetadata } =
		useSheetsData();
	const { theme } = useTheme();
	const colors = Colors[theme];

	const [viewMode, itemName] = params;
	const decodedItemName = decodeURIComponent(itemName);
	const [editedValue, setEditedValue] = useState(decodedItemName);
	const [isSaving, setIsSaving] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [isArchiving, setIsArchiving] = useState(false);

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
	const isArchived = fieldKey
		? isMetadataItemArchived(fieldKey, decodedItemName)
		: false;

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
			case "bagQuantities":
				return "bagQuantity";
			case "shapes":
				return "shape";
			case "distributors":
				return "distributor";
			default:
				return null;
		}
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

		const existingValues: readonly string[] =
			PRODUCT_FIELD_OPTIONS[fieldKey as keyof typeof PRODUCT_FIELD_OPTIONS] ??
			[];
		if (existingValues.includes(trimmedValue)) {
			Alert.alert("Error", "This value already exists");
			return;
		}

		const sheetName = getSheetNameForViewMode(viewMode);
		if (!sheetName) {
			Alert.alert("Error", "Cannot update this metadata type");
			return;
		}

		setIsSaving(true);
		try {
			const result = await updateMetadata(
				sheetName,
				decodedItemName,
				trimmedValue,
			);

			if (result.success) {
				Alert.alert("Success", `"${trimmedValue}" has been saved!`);
				router.back();
			} else {
				Alert.alert("Error", result.error || "Failed to save changes");
			}
		} catch (error) {
			logger.error("Metadata", "Failed to save changes", {
				error,
				sheetName,
				oldValue: decodedItemName,
				newValue: trimmedValue,
			});
			Alert.alert("Error", "Failed to save changes");
		} finally {
			setIsSaving(false);
		}
	}

	async function handleArchive() {
		const sheetName = getSheetNameForViewMode(viewMode);
		if (!sheetName) {
			Alert.alert("Error", "Cannot archive this metadata type");
			return;
		}

		Alert.alert(
			"Archive Value",
			`Are you sure you want to archive "${decodedItemName}"?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Archive",
					style: "default",
					onPress: async () => {
						setIsArchiving(true);
						try {
							const result = await archiveMetadata(sheetName, decodedItemName);
							if (result.success) {
								Alert.alert(
									"Success",
									`"${decodedItemName}" has been archived!`,
								);
								router.back();
							} else {
								Alert.alert("Error", result.error || "Failed to archive item");
							}
						} catch (error) {
							logger.error("Metadata", "Failed to archive item", {
								error,
								sheetName,
								value: decodedItemName,
							});
							Alert.alert("Error", "Failed to archive item");
						} finally {
							setIsArchiving(false);
						}
					},
				},
			],
		);
	}

	async function handleUnarchive() {
		const sheetName = getSheetNameForViewMode(viewMode);
		if (!sheetName) {
			Alert.alert("Error", "Cannot unarchive this metadata type");
			return;
		}

		Alert.alert(
			"Unarchive Value",
			`Are you sure you want to unarchive "${decodedItemName}"?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Unarchive",
					style: "default",
					onPress: async () => {
						setIsArchiving(true);
						try {
							const result = await unarchiveMetadata(
								sheetName,
								decodedItemName,
							);
							if (result.success) {
								Alert.alert(
									"Success",
									`"${decodedItemName}" has been unarchived!`,
								);
								router.back();
							} else {
								Alert.alert(
									"Error",
									result.error || "Failed to unarchive item",
								);
							}
						} catch (error) {
							logger.error("Metadata", "Failed to unarchive item", {
								error,
								sheetName,
								value: decodedItemName,
							});
							Alert.alert("Error", "Failed to unarchive item");
						} finally {
							setIsArchiving(false);
						}
					},
				},
			],
		);
	}

	function handleCancel() {
		setEditedValue(decodedItemName);
		setIsEditing(false);
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
					{categoryTitle.slice(0, -1)}
				</Text>
				<View style={styles.headerActions}>
					{!isEditing && !isArchived && (
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
								name={isArchiving ? "hourglass" : "archive-outline"}
								size={20}
								color="white"
							/>
						</Pressable>
					)}
					{!isEditing && isArchived && (
						<Pressable
							onPress={handleUnarchive}
							style={[
								styles.circleButton,
								{ backgroundColor: colors.primary },
								isArchiving && styles.disabledButton,
							]}
							disabled={isArchiving}
						>
							<Ionicons
								name={isArchiving ? "hourglass" : "refresh-outline"}
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
							name={
								isSaving
									? "hourglass-outline"
									: isEditing
										? "checkmark"
										: "pencil"
							}
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
				<View style={styles.content}>
					<View style={styles.section}>
						<Text style={[styles.sectionTitle, { color: colors.text }]}>
							{isEditing ? "Edit Value" : "Value Details"}
						</Text>

						{isEditing ? (
							<View style={styles.inputGroup}>
								<Text
									style={[styles.inputLabel, { color: colors.textSecondary }]}
								>
									{categoryTitle.slice(0, -1)} Name *
								</Text>
								<TextInput
									style={[
										styles.textInput,
										{
											backgroundColor: colors.cardBackground,
											color: colors.text,
											borderColor: colors.border,
										},
									]}
									value={editedValue}
									onChangeText={setEditedValue}
									placeholder={`Enter ${categoryTitle.slice(0, -1).toLowerCase()} name`}
									placeholderTextColor={colors.textMuted}
									autoFocus
								/>
							</View>
						) : (
							<View
								style={[
									styles.valueDisplay,
									{
										backgroundColor: colors.surface,
										borderColor: colors.border,
									},
								]}
							>
								<Text style={[styles.valueText, { color: colors.text }]}>
									{decodedItemName}
								</Text>
							</View>
						)}

						{isArchived && !isEditing && (
							<View
								style={[
									styles.archivedIndicator,
									{
										backgroundColor: colors.surface,
										borderColor: colors.border,
									},
								]}
							>
								<Ionicons
									name="archive"
									size={20}
									color={colors.textSecondary}
								/>
								<Text
									style={[styles.archivedText, { color: colors.textSecondary }]}
								>
									This {categoryTitle.slice(0, -1).toLowerCase()} is archived
								</Text>
							</View>
						)}
					</View>
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
	circleButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		justifyContent: "center",
		alignItems: "center",
	},
	disabledButton: {
		opacity: 0.7,
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
	headerActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	valueDisplay: {
		backgroundColor: "#f8f9fa",
		borderWidth: 1,
		borderColor: "#dee2e6",
		borderRadius: 8,
		padding: 16,
		marginBottom: 24,
	},
	valueText: {
		fontSize: 16,
		fontWeight: "500",
		color: "#1a1a1a",
	},
	unarchiveButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
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
	archiveButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#6c757d",
		borderRadius: 8,
		padding: 16,
		gap: 8,
	},
	archiveButtonText: {
		color: "white",
		fontSize: 16,
		fontWeight: "600",
	},
	archivedIndicator: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#f8f9fa",
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#dee2e6",
		padding: 16,
		gap: 8,
	},
	archivedText: {
		color: "#6c757d",
		fontSize: 16,
		fontWeight: "500",
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
