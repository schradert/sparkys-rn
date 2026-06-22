import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AvatarDropdown from "@/components/AvatarDropdown";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";
import type { ViewMode } from "./types";

interface InventoryHeaderProps {
	currentView: ViewMode;
	currentViewLabel: string;
	isViewDropdownVisible: boolean;
	totalSelections: number;
	metadataShowArchived: boolean;
	onToggleViewDropdown: () => void;
	onAddInternalProduct: () => void;
	onAddButtonPress: () => void;
	onOpenFilterModal: () => void;
	onOpenMetadataFilterModal: () => void;
}

/**
 * The inventory screen header: the view-mode title toggle, the add/scan/filter
 * action buttons (which differ between the products and metadata views), and the
 * avatar menu. A badge on the filter button reflects the active selection count.
 */
export default function InventoryHeader({
	currentView,
	currentViewLabel,
	isViewDropdownVisible,
	totalSelections,
	metadataShowArchived,
	onToggleViewDropdown,
	onAddInternalProduct,
	onAddButtonPress,
	onOpenFilterModal,
	onOpenMetadataFilterModal,
}: InventoryHeaderProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];
	const isProducts = currentView === "products";

	return (
		<View
			style={[
				styles.headerContainer,
				{
					backgroundColor: colors.cardBackground,
					borderBottomColor: colors.borderLight,
				},
			]}
		>
			<Pressable onPress={onToggleViewDropdown} style={styles.titleButton}>
				<Text style={[styles.title, { color: colors.text }]}>
					{currentViewLabel}
				</Text>
				<Ionicons
					name={isViewDropdownVisible ? "chevron-up" : "chevron-down"}
					size={20}
					color={colors.text}
				/>
			</Pressable>
			<View style={styles.headerActions}>
				{isProducts && (
					<Pressable onPress={onAddInternalProduct} style={styles.addButton}>
						<Ionicons name="add" size={24} color="white" />
					</Pressable>
				)}
				<Pressable onPress={onAddButtonPress} style={styles.addButton}>
					<Ionicons
						name={isProducts ? "barcode-outline" : "add"}
						size={24}
						color="white"
					/>
				</Pressable>
				{isProducts && (
					<View style={styles.filterButtonContainer}>
						<Pressable onPress={onOpenFilterModal} style={styles.addButton}>
							<Ionicons name="options-outline" size={24} color="white" />
						</Pressable>
						{totalSelections > 0 && (
							<View style={styles.filterBadge}>
								<Text style={styles.filterBadgeText}>{totalSelections}</Text>
							</View>
						)}
					</View>
				)}
				{!isProducts && (
					<View style={styles.filterButtonContainer}>
						<Pressable
							onPress={onOpenMetadataFilterModal}
							style={styles.addButton}
						>
							<Ionicons name="options-outline" size={24} color="white" />
						</Pressable>
						{metadataShowArchived && (
							<View style={styles.filterBadge}>
								<Text style={styles.filterBadgeText}>1</Text>
							</View>
						)}
					</View>
				)}
				<AvatarDropdown />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	headerContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e5e9",
	},
	titleButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#1a1a1a",
	},
	headerActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	filterButtonContainer: {
		position: "relative",
	},
	addButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: "#007bff",
		justifyContent: "center",
		alignItems: "center",
	},
	filterBadge: {
		position: "absolute",
		top: -4,
		right: -4,
		backgroundColor: "#ff4757",
		borderRadius: 10,
		minWidth: 20,
		height: 20,
		justifyContent: "center",
		alignItems: "center",
		zIndex: 1,
	},
	filterBadgeText: {
		color: "white",
		fontSize: 12,
		fontWeight: "bold",
	},
});
