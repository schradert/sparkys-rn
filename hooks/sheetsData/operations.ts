import { Alert } from "react-native";
import {
	convertExternalProductSheetToModel,
	convertInternalProductSheetToModel,
	updateFieldOptions,
	updateMetadataItems,
} from "@/constants/Products";
import { SPREADSHEET_ID } from "@/constants/Spreadsheet";
import { getErrorMessage } from "@/services/errors";
import { GoogleSheetsService } from "@/services/googleSheets";
import { logger } from "@/services/logger";
import { setExternalProducts, setInternalProducts } from "@/store/products";
import { getFieldKeyForSheetName } from "./mappings";
import {
	notifyMetadataChange,
	type OperationResult,
	setMetadata,
	updateSheetsState,
} from "./store";

export async function loadSheetsData(
	accessToken: string,
	isRefresh = false,
): Promise<OperationResult> {
	try {
		if (!SPREADSHEET_ID)
			throw new Error(
				"Please set EXPO_PUBLIC_SPREADSHEET_ID to database sheet ID.",
			);

		logger.debug(
			"Sheets",
			"Loading sheets data with spreadsheet ID:",
			SPREADSHEET_ID,
		);
		logger.debug("Sheets", "Access token length:", accessToken?.length);

		if (!isRefresh) {
			updateSheetsState({ isLoading: true, error: null });
		}

		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		logger.debug("Sheets", "Fetching data from sheets...");
		const data = await sheetsService.getAllSheetsData(accessToken);

		logger.debug("Sheets", "Received data:", {
			internalProductCount: data.internalProducts?.length || 0,
			externalProductCount: data.externalProducts?.length || 0,
			metadata: Object.keys(data.metadata),
			data,
		});

		updateFieldOptions(data.metadata);
		if (data.fullMetadata) {
			updateMetadataItems(data.fullMetadata);
		}

		// Convert raw sheet data to app models
		const internalProducts = (data.internalProducts || []).map(
			convertInternalProductSheetToModel,
		);
		const externalProducts = (data.externalProducts || []).map(
			convertExternalProductSheetToModel,
		);

		logger.debug("Sheets", "Converted products:", {
			internalProducts,
			externalProducts,
			internalProductsWithBarcodes: internalProducts.map((ip) => ({
				name: ip.sparkys_product_name,
				barcodes: ip.products,
			})),
			externalProductSkus: externalProducts.map((ep) => ep.unique_id_sku),
		});

		setInternalProducts(internalProducts);
		setExternalProducts(externalProducts);

		updateSheetsState({
			internalProducts,
			externalProducts,
			metadata: data.fullMetadata || {},
			isLoading: false,
			error: null,
			lastUpdated: new Date(),
		});

		logger.debug("Sheets", "Successfully loaded sheets data");
		return { success: true };
	} catch (error) {
		logger.error("Sheets", "Error loading sheets data:", error);
		const errorMessage =
			getErrorMessage(error) || "Failed to load data from spreadsheet";
		updateSheetsState({
			isLoading: false,
			error: errorMessage,
		});
		return { success: false, error: errorMessage };
	}
}

export async function refreshSheetsData(accessToken: string): Promise<void> {
	updateSheetsState({ isRefreshing: true });
	const result = await loadSheetsData(accessToken, true);
	updateSheetsState({ isRefreshing: false });
	if (!result.success) {
		// loadSheetsData always supplies a non-empty error on failure.
		Alert.alert("Error", result.error);
	}
}

export async function addMetadataToSheet(
	sheetName: string,
	name: string,
	accessToken: string,
): Promise<OperationResult> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.addMetadataItem(sheetName, name, accessToken);

		// Update local store instead of full refresh
		setMetadata((prevMetadata) => {
			const fieldKey = getFieldKeyForSheetName(sheetName);
			if (fieldKey) {
				return {
					...prevMetadata,
					[fieldKey]: [
						...(prevMetadata[fieldKey] || []),
						{ name, status: "active" },
					],
				};
			}
			return prevMetadata;
		});

		return { success: true };
	} catch (error) {
		logger.error("Sheets", "Error adding metadata to sheet:", error);
		return {
			success: false,
			error: getErrorMessage(error) || "Failed to add item",
		};
	}
}

export async function updateMetadataInSheet(
	sheetName: string,
	oldName: string,
	newName: string,
	accessToken: string,
): Promise<{
	success: boolean;
	error?: string;
	metadataChangeInfo?: { fieldKey: string; oldValue: string; newValue: string };
}> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.updateMetadataItem(
			sheetName,
			oldName,
			newName,
			accessToken,
		);

		// Update local store instead of full refresh
		setMetadata((prevMetadata) => {
			const fieldKey = getFieldKeyForSheetName(sheetName);
			if (fieldKey && prevMetadata[fieldKey]) {
				return {
					...prevMetadata,
					[fieldKey]: prevMetadata[fieldKey].map((item) =>
						item.name === oldName ? { ...item, name: newName } : item,
					),
				};
			}
			return prevMetadata;
		});

		// Notify subscribers of the metadata change
		const fieldKey = getFieldKeyForSheetName(sheetName);
		if (fieldKey) {
			notifyMetadataChange({
				fieldKey,
				oldValue: oldName,
				newValue: newName,
			});
		}

		return {
			success: true,
			metadataChangeInfo: {
				fieldKey: fieldKey || "",
				oldValue: oldName,
				newValue: newName,
			},
		};
	} catch (error) {
		logger.error("Sheets", "Error updating metadata in sheet:", error);
		return {
			success: false,
			error: getErrorMessage(error) || "Failed to update metadata",
		};
	}
}

export async function archiveMetadataInSheet(
	sheetName: string,
	name: string,
	accessToken: string,
): Promise<OperationResult> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.archiveMetadataItem(sheetName, name, accessToken);

		// Update local store instead of full refresh
		setMetadata((prevMetadata) => {
			const fieldKey = getFieldKeyForSheetName(sheetName);
			if (fieldKey && prevMetadata[fieldKey]) {
				return {
					...prevMetadata,
					[fieldKey]: prevMetadata[fieldKey].map((item) =>
						item.name === name ? { ...item, status: "archived" } : item,
					),
				};
			}
			return prevMetadata;
		});

		return { success: true };
	} catch (error) {
		logger.error("Sheets", "Error archiving metadata:", error);
		return {
			success: false,
			error: getErrorMessage(error) || "Failed to archive metadata",
		};
	}
}

export async function unarchiveMetadataInSheet(
	sheetName: string,
	name: string,
	accessToken: string,
): Promise<OperationResult> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.unarchiveMetadataItem(sheetName, name, accessToken);

		// Update local store instead of full refresh
		setMetadata((prevMetadata) => {
			const fieldKey = getFieldKeyForSheetName(sheetName);
			if (fieldKey && prevMetadata[fieldKey]) {
				return {
					...prevMetadata,
					[fieldKey]: prevMetadata[fieldKey].map((item) =>
						item.name === name ? { ...item, status: "active" } : item,
					),
				};
			}
			return prevMetadata;
		});

		return { success: true };
	} catch (error) {
		logger.error("Sheets", "Error unarchiving metadata:", error);
		return {
			success: false,
			error: getErrorMessage(error) || "Failed to unarchive metadata",
		};
	}
}
