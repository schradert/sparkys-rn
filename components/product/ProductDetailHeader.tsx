import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";

interface ProductDetailHeaderProps {
	title: string;
	isEditing: boolean;
	isSaving: boolean;
	isArchiving: boolean;
	isArchived: boolean;
	onArchive: () => void;
	onEdit: () => void;
	onSave: () => void;
	onCancel: () => void;
}

/**
 * Shared detail-screen header: back navigation, the screen title, an
 * archive/unarchive button (read-only mode only), and the edit/save/cancel
 * controls. Identical chrome across the internal and external product screens.
 */
export default function ProductDetailHeader({
	title,
	isEditing,
	isSaving,
	isArchiving,
	isArchived,
	onArchive,
	onEdit,
	onSave,
	onCancel,
}: ProductDetailHeaderProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<View
			style={[
				styles.header,
				{
					backgroundColor: colors.cardBackground,
					borderBottomColor: colors.borderLight,
				},
			]}
		>
			<Pressable onPress={() => router.back()}>
				<Ionicons name="arrow-back" size={24} color={colors.text} />
			</Pressable>
			<Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
			<View style={styles.headerActions}>
				{!isEditing && (
					<Pressable
						onPress={onArchive}
						style={[
							styles.circleButton,
							{ backgroundColor: colors.primary },
							isArchiving && styles.disabledButton,
						]}
						disabled={isArchiving}
					>
						<Ionicons
							name={
								isArchiving
									? "hourglass"
									: isArchived
										? "refresh-outline"
										: "archive-outline"
							}
							size={20}
							color="white"
						/>
					</Pressable>
				)}
				<Pressable
					onPress={isEditing ? onSave : onEdit}
					style={[
						styles.circleButton,
						{ backgroundColor: colors.primary },
						isSaving && styles.disabledButton,
					]}
					disabled={isSaving}
				>
					<Ionicons
						name={isSaving ? "hourglass" : isEditing ? "checkmark" : "pencil"}
						size={20}
						color="white"
					/>
				</Pressable>
				{isEditing && (
					<Pressable
						onPress={onCancel}
						style={[styles.circleButton, { backgroundColor: colors.error }]}
					>
						<Ionicons name="close" size={20} color="white" />
					</Pressable>
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e5e9",
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#1a1a1a",
		flex: 1,
		textAlign: "center",
	},
	headerActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	circleButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		justifyContent: "center",
		alignItems: "center",
		marginLeft: 8,
	},
	disabledButton: {
		opacity: 0.7,
	},
});
