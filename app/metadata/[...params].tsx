/** Route `/metadata/[...params]` — view/edit a single metadata value. */
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
	formatCategoryTitle,
	getFieldKey,
} from "@/components/metadata/metadataFields";
import { styles } from "@/components/metadata/styles";
import { Colors } from "@/constants/Colors";
import { isMetadataItemArchived } from "@/constants/Products";
import { useMetadataActions } from "@/hooks/useMetadataActions";
import { useTheme } from "@/hooks/useTheme";

/**
 * Route `/metadata/[...params]` — resolves a `[viewMode, itemName]` catch-all
 * into a metadata category and value, then renders that value with archive and
 * inline-edit actions; shows an invalid-route guard for malformed params.
 */
export default function MetadataDetail() {
	const { params } = useLocalSearchParams<{ params: string[] }>();
	const { theme } = useTheme();
	const colors = Colors[theme];

	const [viewMode, itemName] = params;
	const decodedItemName = decodeURIComponent(itemName);
	const [editedValue, setEditedValue] = useState(decodedItemName);

	const fieldKey = getFieldKey(viewMode);

	const {
		isSaving,
		isEditing,
		setIsEditing,
		isArchiving,
		handleSave,
		handleArchive,
		handleUnarchive,
		handleCancel,
	} = useMetadataActions({
		viewMode,
		decodedItemName,
		fieldKey,
		editedValue,
		setEditedValue,
	});

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
