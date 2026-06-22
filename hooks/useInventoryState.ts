import { useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import {
	FIELD_KEY_FOR_VIEW_MODE,
	LABEL_FOR_VIEW_MODE,
	type MetadataViewMode,
} from "@/components/inventory/inventoryMaps";
import {
	submitExternalProduct,
	submitInternalProduct,
	submitMetadata,
} from "@/components/inventory/inventoryMutations";
import {
	emptyNewExternalProduct,
	emptyNewInternalProduct,
	type ViewMode,
} from "@/components/inventory/types";
import { getMetadataItems } from "@/constants/Products";
import { useInventoryAuditEvents } from "@/hooks/useInventoryAuditEvents";
import { useInventoryFilterState } from "@/hooks/useInventoryFilterState";
import { filterAndSortInternalProducts } from "@/hooks/useInventoryFilters";
import { useSheetsData } from "@/hooks/useSheetsData";
import { logger } from "@/services/logger";
import { getExternalProductBySku, useProductStore } from "@/store/products";

/**
 * View-model for the inventory screen: owns all of the screen's state, the
 * store/metadata/audit subscriptions, the derived products list, and every
 * action handler. The route shell wires the returned values into presentational
 * components, keeping JSX out of this hook.
 */
export function useInventoryState() {
	const {
		isRefreshing: sheetsRefreshing,
		error: sheetsError,
		refresh,
		addMetadata,
		addInternalProduct,
		addExternalProduct,
		updateInternalProduct,
		subscribeToMetadataChanges,
		getAuditEvents,
	} = useSheetsData();

	const [permission, requestPermission] = useCameraPermissions();

	const {
		internalFilters,
		externalFilters,
		setInternalFilters,
		setExternalFilters,
		totalSelections,
		clearAllFilters,
		handleInternalFilterChange,
		handleExternalFilterChange,
		handleMetadataPress,
	} = useInventoryFilterState(subscribeToMetadataChanges);
	const [metadataShowArchived, setMetadataShowArchived] = useState(false);
	const internalProducts = useProductStore((s) => s.internalProducts);
	const externalProducts = useProductStore((s) => s.externalProducts);
	const cachedEvents = useInventoryAuditEvents(
		sheetsRefreshing,
		getAuditEvents,
	);

	const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
	const [isMetadataFilterModalVisible, setIsMetadataFilterModalVisible] =
		useState(false);
	const [isAddModalVisible, setIsAddModalVisible] = useState(false);
	const [isScannerVisible, setIsScannerVisible] = useState(false);
	const [isViewDropdownVisible, setIsViewDropdownVisible] = useState(false);
	const [currentView, setCurrentView] = useState<ViewMode>("products");
	const [scannedBarcode, setScannedBarcode] = useState("");
	const [newMetadataValue, setNewMetadataValue] = useState("");
	const [isSubmittingMetadata, setIsSubmittingMetadata] = useState(false);
	const [isSubmittingInternal, setIsSubmittingInternal] = useState(false);
	const [newInternalProduct, setNewInternalProduct] = useState(
		emptyNewInternalProduct,
	);
	const [newExternalProduct, setNewExternalProduct] = useState(
		emptyNewExternalProduct,
	);
	const [isSubmittingExternal, setIsSubmittingExternal] = useState(false);

	function generateUniqueId(): string {
		const existingIds = (internalProducts || [])
			.map((p) => parseInt(p?.id || "0", 10))
			.filter((id) => !Number.isNaN(id));
		const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
		return (maxId + 1).toString();
	}

	function resetNewProductForm(): void {
		setScannedBarcode("");
		setNewMetadataValue("");
		setIsSubmittingExternal(false);
		setIsSubmittingMetadata(false);
		setNewInternalProduct({
			...emptyNewInternalProduct,
			id: generateUniqueId(),
		});
		setNewExternalProduct(emptyNewExternalProduct);
	}

	// Close the add modal and reset its form; the shared success path for adds.
	function closeAddModalAndReset(): void {
		setIsAddModalVisible(false);
		resetNewProductForm();
	}

	function handleAddMetadata(): Promise<void> {
		// handleAddMetadata is only invoked from a metadata view, so currentView is
		// always a metadata view mode.
		return submitMetadata({
			view: currentView as MetadataViewMode,
			value: newMetadataValue,
			addMetadata,
			onSubmittingChange: setIsSubmittingMetadata,
			onSuccess: closeAddModalAndReset,
		});
	}

	function handleBarcodeScanned(data: string): void {
		setScannedBarcode(data);
		setIsScannerVisible(false);
		const existingExternal = getExternalProductBySku(data);
		logger.info("Inventory", "Barcode scanned", {
			data,
			known: !!existingExternal,
		});
		if (existingExternal) {
			router.push(`/external-product/${data}`);
		} else {
			setNewExternalProduct((prev) => ({ ...prev, unique_id_sku: data }));
			setIsAddModalVisible(true);
		}
	}

	function handleAddButtonPress(): void {
		if (currentView === "products") {
			if (!permission) {
				requestPermission();
				return;
			}
			if (!permission.granted) {
				Alert.alert(
					"Camera Permission",
					"We need camera permission to scan barcodes",
					[{ text: "Cancel" }, { text: "Grant", onPress: requestPermission }],
				);
				return;
			}
			setIsScannerVisible(true);
		} else {
			setIsAddModalVisible(true);
		}
	}

	function handleAddInternalProduct(): void {
		setNewInternalProduct((prev) => ({ ...prev, id: generateUniqueId() }));
		setIsAddModalVisible(true);
	}

	function handleViewChange(viewMode: ViewMode): void {
		setCurrentView(viewMode);
		setIsViewDropdownVisible(false);
	}

	const currentViewLabel = LABEL_FOR_VIEW_MODE[currentView];

	function handleAddInternalProductSubmit(): Promise<void> {
		return submitInternalProduct({
			form: newInternalProduct,
			internalProducts,
			addInternalProduct,
			onSubmittingChange: setIsSubmittingInternal,
			onSuccess: closeAddModalAndReset,
		});
	}

	function handleAddExternalProductSubmit(): Promise<void> {
		return submitExternalProduct({
			form: newExternalProduct,
			internalProducts,
			addExternalProduct,
			updateInternalProduct,
			onSubmittingChange: setIsSubmittingExternal,
			onSuccess: closeAddModalAndReset,
		});
	}

	function handleAddModalSave(): void {
		if (currentView === "products") {
			if (scannedBarcode) {
				handleAddExternalProductSubmit();
			} else {
				handleAddInternalProductSubmit();
			}
		} else {
			handleAddMetadata();
		}
	}

	const isAddSubmitting =
		(!!scannedBarcode && isSubmittingExternal) ||
		(currentView !== "products" && isSubmittingMetadata) ||
		(!scannedBarcode && currentView === "products" && isSubmittingInternal);

	const filteredInternalProducts = filterAndSortInternalProducts(
		internalProducts,
		externalProducts,
		internalFilters,
		externalFilters,
		cachedEvents,
	);

	// The metadata value names for the current metadata view (empty in the
	// products view, where the shell uses filteredInternalProducts instead).
	const metadataItems =
		currentView === "products"
			? []
			: getMetadataItems(
					FIELD_KEY_FOR_VIEW_MODE[currentView as MetadataViewMode],
					metadataShowArchived,
				).map((item) => item.name);

	// Data/derived values, modal visibility flags, the setters the shell wires to
	// component callbacks, and the action handlers.
	return {
		currentView,
		currentViewLabel,
		internalProducts,
		externalProducts,
		filteredInternalProducts,
		metadataItems,
		cachedEvents,
		internalFilters,
		externalFilters,
		metadataShowArchived,
		totalSelections,
		isAddSubmitting,
		scannedBarcode,
		newMetadataValue,
		newInternalProduct,
		newExternalProduct,
		sheetsRefreshing,
		sheetsError,
		refresh,
		isFilterModalVisible,
		isMetadataFilterModalVisible,
		isAddModalVisible,
		isScannerVisible,
		isViewDropdownVisible,
		setIsFilterModalVisible,
		setIsMetadataFilterModalVisible,
		setIsAddModalVisible,
		setIsScannerVisible,
		setIsViewDropdownVisible,
		setInternalFilters,
		setExternalFilters,
		setMetadataShowArchived,
		setNewMetadataValue,
		setNewInternalProduct,
		setNewExternalProduct,
		clearAllFilters,
		handleInternalFilterChange,
		handleExternalFilterChange,
		handleMetadataPress,
		handleAddMetadata,
		handleBarcodeScanned,
		handleAddButtonPress,
		handleAddInternalProduct,
		handleViewChange,
		resetNewProductForm,
		handleAddModalSave,
	};
}
