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
import { getAllMetadataItems } from "@/constants/Products";
import { useTheme } from "@/hooks/useTheme";
import CollapsibleFilterSection from "./CollapsibleFilterSection";
import FilterToggleRow from "./FilterToggleRow";
import {
	EXTERNAL_FILTER_SECTIONS,
	formatCategoryTitle,
	INTERNAL_FILTER_SECTIONS,
} from "./inventoryMaps";
import type {
	ExternalArrayFilterKey,
	ExternalFilters,
	InternalArrayFilterKey,
	InternalFilters,
} from "./types";

interface InventoryFilterModalProps {
	visible: boolean;
	internalFilters: InternalFilters;
	externalFilters: ExternalFilters;
	totalSelections: number;
	onClose: () => void;
	onClearAll: () => void;
	onToggleUnderstocked: () => void;
	onToggleInternalArchived: () => void;
	onToggleExternalArchived: () => void;
	onInternalFilterChange: (
		category: keyof InternalFilters,
		values: string[],
	) => void;
	onExternalFilterChange: (
		category: keyof ExternalFilters,
		values: string[],
	) => void;
}

/**
 * The products-view filter modal: the understocked and show-archived toggles,
 * plus a collapsible multi-select section per internal and external metadata
 * category. The category sections are driven by the inventory section tables.
 */
export default function InventoryFilterModal({
	visible,
	internalFilters,
	externalFilters,
	totalSelections,
	onClose,
	onClearAll,
	onToggleUnderstocked,
	onToggleInternalArchived,
	onToggleExternalArchived,
	onInternalFilterChange,
	onExternalFilterChange,
}: InventoryFilterModalProps) {
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
						Filter Inventory
					</Text>
					<View style={styles.modalHeaderActions}>
						{totalSelections > 0 && (
							<Pressable
								onPress={onClearAll}
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
					<Text style={[styles.filterSectionTitle, { color: colors.text }]}>
						Sparky's
					</Text>

					<FilterToggleRow
						label="Understocked Items"
						icon="alert-circle-outline"
						active={internalFilters.understocked}
						onToggle={onToggleUnderstocked}
						activeColor={colors.error}
					/>

					<FilterToggleRow
						label="Show Archived Items"
						icon="archive-outline"
						active={internalFilters.showArchived}
						onToggle={onToggleInternalArchived}
						activeColor={colors.primary}
					/>

					{INTERNAL_FILTER_SECTIONS.map(({ category, fieldKey }) => (
						<CollapsibleFilterSection
							key={category}
							title={formatCategoryTitle(category)}
							options={getAllMetadataItems(
								fieldKey,
								internalFilters.showArchived,
							)}
							selectedValues={
								internalFilters[category as InternalArrayFilterKey]
							}
							onSelectionChange={(values) =>
								onInternalFilterChange(
									category as keyof InternalFilters,
									values,
								)
							}
						/>
					))}

					<Text style={[styles.filterSectionTitle, { color: colors.text }]}>
						Manufacturers'
					</Text>

					<FilterToggleRow
						label="Show Archived Items"
						icon="archive-outline"
						active={externalFilters.showArchived}
						onToggle={onToggleExternalArchived}
						activeColor={colors.primary}
					/>

					{EXTERNAL_FILTER_SECTIONS.map(({ category, fieldKey }) => (
						<CollapsibleFilterSection
							key={category}
							title={formatCategoryTitle(category)}
							options={getAllMetadataItems(
								fieldKey,
								externalFilters.showArchived,
							)}
							selectedValues={
								externalFilters[category as ExternalArrayFilterKey]
							}
							onSelectionChange={(values) =>
								onExternalFilterChange(
									category as keyof ExternalFilters,
									values,
								)
							}
						/>
					))}
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
	filterSectionTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#1a1a1a",
		marginTop: 16,
		marginBottom: 16,
		marginLeft: 16,
	},
});
