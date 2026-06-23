/** Route `/inventory` — the product/metadata inventory list. */
import { Platform, StyleSheet, UIManager } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AddProductModal from "@/components/inventory/AddProductModal";
import BarcodeScannerModal from "@/components/inventory/BarcodeScannerModal";
import InventoryContent from "@/components/inventory/InventoryContent";
import InventoryFilterModal from "@/components/inventory/InventoryFilterModal";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import InventoryListItem from "@/components/inventory/InventoryListItem";
import MetadataFilterModal from "@/components/inventory/MetadataFilterModal";
import ViewModeDropdown from "@/components/inventory/ViewModeDropdown";
import { Colors } from "@/constants/Colors";
import type { InternalProduct } from "@/constants/Products";
import { useInventoryState } from "@/hooks/useInventoryState";
import { useTheme } from "@/hooks/useTheme";

// Enable LayoutAnimation on Android
if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * The inventory route shell. All state, derived data, and action handlers live
 * in `useInventoryState`; this component composes the header, view dropdown,
 * list, and the filter/add/scanner modals from `components/inventory`.
 */
export default function Inventory() {
	const { theme } = useTheme();
	const colors = Colors[theme];
	const inv = useInventoryState();

	const isProducts = inv.currentView === "products";

	// Data, the row renderer, and the key extractor are view-correlated (products
	// vs. metadata), which TypeScript can't express as one generic. Unify them on
	// the `InternalProduct | string` item type the list actually carries.
	const currentData = (
		isProducts ? inv.filteredInternalProducts : inv.metadataItems
	) as (InternalProduct | string)[];

	const keyExtractor = (item: InternalProduct | string): string =>
		isProducts
			? (item as InternalProduct).sparkys_product_name
			: (item as string);

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.cardBackground }]}
			edges={["top", "bottom"]}
		>
			<InventoryHeader
				currentView={inv.currentView}
				currentViewLabel={inv.currentViewLabel}
				isViewDropdownVisible={inv.isViewDropdownVisible}
				totalSelections={inv.totalSelections}
				metadataShowArchived={inv.metadataShowArchived}
				onToggleViewDropdown={() =>
					inv.setIsViewDropdownVisible(!inv.isViewDropdownVisible)
				}
				onAddInternalProduct={inv.handleAddInternalProduct}
				onAddButtonPress={inv.handleAddButtonPress}
				onOpenFilterModal={() => inv.setIsFilterModalVisible(true)}
				onOpenMetadataFilterModal={() =>
					inv.setIsMetadataFilterModalVisible(true)
				}
			/>

			{inv.isViewDropdownVisible && (
				<ViewModeDropdown
					currentView={inv.currentView}
					onSelect={inv.handleViewChange}
				/>
			)}

			<InventoryContent
				data={currentData}
				renderItem={({ item }) => (
					<InventoryListItem
						item={item}
						currentView={inv.currentView}
						externalProducts={inv.externalProducts}
						internalFilters={inv.internalFilters}
						externalFilters={inv.externalFilters}
						events={inv.cachedEvents}
						onMetadataPress={inv.handleMetadataPress}
					/>
				)}
				keyExtractor={keyExtractor}
				refreshing={inv.sheetsRefreshing}
				error={inv.sheetsError}
				onRefresh={inv.refresh}
			/>

			<InventoryFilterModal
				visible={inv.isFilterModalVisible}
				internalFilters={inv.internalFilters}
				externalFilters={inv.externalFilters}
				totalSelections={inv.totalSelections}
				onClose={() => inv.setIsFilterModalVisible(false)}
				onClearAll={inv.clearAllFilters}
				onToggleUnderstocked={() =>
					inv.setInternalFilters((prev) => ({
						...prev,
						understocked: !prev.understocked,
					}))
				}
				onToggleInternalArchived={() =>
					inv.setInternalFilters((prev) => ({
						...prev,
						showArchived: !prev.showArchived,
					}))
				}
				onToggleExternalArchived={() =>
					inv.setExternalFilters((prev) => ({
						...prev,
						showArchived: !prev.showArchived,
					}))
				}
				onInternalFilterChange={inv.handleInternalFilterChange}
				onExternalFilterChange={inv.handleExternalFilterChange}
			/>

			<AddProductModal
				visible={inv.isAddModalVisible}
				currentView={inv.currentView}
				currentViewLabel={inv.currentViewLabel}
				scannedBarcode={inv.scannedBarcode}
				isSubmitting={inv.isAddSubmitting}
				newInternalProduct={inv.newInternalProduct}
				newExternalProduct={inv.newExternalProduct}
				internalProductNames={(inv.internalProducts || []).map(
					(p) => p.sparkys_product_name,
				)}
				newMetadataValue={inv.newMetadataValue}
				onSave={inv.handleAddModalSave}
				onClose={() => {
					inv.setIsAddModalVisible(false);
					inv.resetNewProductForm();
				}}
				onInternalChange={(update) =>
					inv.setNewInternalProduct((prev) => ({ ...prev, ...update }))
				}
				onExternalChange={(update) =>
					inv.setNewExternalProduct((prev) => ({ ...prev, ...update }))
				}
				onMetadataValueChange={inv.setNewMetadataValue}
			/>

			<MetadataFilterModal
				visible={inv.isMetadataFilterModalVisible}
				currentView={inv.currentView}
				metadataShowArchived={inv.metadataShowArchived}
				onClose={() => inv.setIsMetadataFilterModalVisible(false)}
				onClearArchived={() => inv.setMetadataShowArchived(false)}
				onToggleArchived={() =>
					inv.setMetadataShowArchived(!inv.metadataShowArchived)
				}
			/>

			<BarcodeScannerModal
				visible={inv.isScannerVisible}
				onClose={() => inv.setIsScannerVisible(false)}
				onBarcodeScanned={inv.handleBarcodeScanned}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
});
