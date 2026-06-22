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
import FilterToggleRow from "./FilterToggleRow";
import type { ViewMode } from "./types";

interface MetadataFilterModalProps {
	visible: boolean;
	currentView: ViewMode;
	metadataShowArchived: boolean;
	onClose: () => void;
	onClearArchived: () => void;
	onToggleArchived: () => void;
}

/** The metadata-view filter modal: a single show-archived toggle. */
export default function MetadataFilterModal({
	visible,
	currentView,
	metadataShowArchived,
	onClose,
	onClearArchived,
	onToggleArchived,
}: MetadataFilterModalProps) {
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
						Filter {currentView.charAt(0).toUpperCase() + currentView.slice(1)}
					</Text>
					<View style={styles.modalHeaderActions}>
						{metadataShowArchived && (
							<Pressable
								onPress={onClearArchived}
								style={[styles.clearButton, { backgroundColor: colors.error }]}
							>
								<Text style={styles.clearText}>Clear All</Text>
							</Pressable>
						)}
						<Pressable
							onPress={onClose}
							style={[styles.closeButton, { backgroundColor: colors.surface }]}
						>
							<Ionicons name="close" size={24} color={colors.textSecondary} />
						</Pressable>
					</View>
				</View>

				<ScrollView
					style={styles.modalScrollView}
					showsVerticalScrollIndicator={false}
				>
					<FilterToggleRow
						label="Show Archived Items"
						icon="archive-outline"
						active={metadataShowArchived}
						onToggle={onToggleArchived}
						activeColor={colors.primary}
						thumbTranslateOn={20}
						thumbOffColor={colors.textSecondary}
					/>
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
	clearButton: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		backgroundColor: "#ff4757",
	},
	clearText: {
		color: "white",
		fontSize: 12,
		fontWeight: "600",
	},
	closeButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		justifyContent: "center",
		alignItems: "center",
	},
	modalScrollView: {
		flex: 1,
		paddingHorizontal: 16,
		paddingTop: 16,
		paddingBottom: 32,
	},
});
