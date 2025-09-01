import { useEffect, useState } from "react";
import { Alert } from "react-native";
import {
	convertExternalProductSheetToModel,
	convertInternalProductSheetToModel,
	type ExternalProduct,
	type InternalProduct,
	updateFieldOptions,
	updateMetadataItems,
} from "@/constants/Products";
import { GoogleSheetsService } from "@/services/googleSheets";
import { setExternalProducts, setInternalProducts } from "@/store/products";
import { useAuth } from "./useAuth";

interface SheetsDataState {
	internalProducts: InternalProduct[];
	externalProducts: ExternalProduct[];
	isLoading: boolean;
	isRefreshing: boolean;
	error: string | null;
	lastUpdated: Date | null;
}

let globalSheetsState: SheetsDataState = {
	internalProducts: [],
	externalProducts: [],
	isLoading: false,
	isRefreshing: false,
	error: null,
	lastUpdated: null,
};

let sheetsSubscribers: Array<() => void> = [];
let metadataChangeSubscribers: Array<
	(change: { fieldKey: string; oldValue: string; newValue: string }) => void
> = [];

function subscribeToSheetsData(callback: () => void) {
	sheetsSubscribers.push(callback);
	return () => {
		sheetsSubscribers = sheetsSubscribers.filter((sub) => sub !== callback);
	};
}

function subscribeToMetadataChanges(
	callback: (change: {
		fieldKey: string;
		oldValue: string;
		newValue: string;
	}) => void,
) {
	metadataChangeSubscribers.push(callback);
	return () => {
		metadataChangeSubscribers = metadataChangeSubscribers.filter(
			(sub) => sub !== callback,
		);
	};
}

function notifyMetadataChange(change: {
	fieldKey: string;
	oldValue: string;
	newValue: string;
}) {
	metadataChangeSubscribers.forEach((callback) => callback(change));
}

function updateSheetsState(newState: Partial<SheetsDataState>) {
	globalSheetsState = { ...globalSheetsState, ...newState };
	sheetsSubscribers.forEach((callback) => callback());
}

// FIXME make dynamic (why isn't eas.json passing it?)
// const SPREADSHEET_ID = process.env.EXPO_PUBLIC_SPREADSHEET_ID;
const SPREADSHEET_ID = "1V4r_IT3XQB5hxIkX0iO6p1ASqgtz4MrfAGXq0QW8pzE";

function getSheetNameForMetadata(viewMode: string): string | null {
	switch (viewMode) {
		case "productTypes":
			return "product_types";
		case "colors":
			return "colors";
		case "manufacturers":
			return "brands";
		case "sizes":
			return null; // No sizes sheet, generated from products
		case "textures":
			return "textures";
		case "bagQuantities":
			return "bag_quantities";
		case "shapes":
			return "shapes";
		case "distributors":
			return "distributors";
		case "occasions":
			return "occasions";
		default:
			return null;
	}
}

async function loadSheetsData(
	accessToken: string,
	isRefresh = false,
): Promise<{ success: boolean; error?: string }> {
	try {
		if (!SPREADSHEET_ID)
			throw new Error(
				"Please set EXPO_PUBLIC_SPREADSHEET_ID to database sheet ID.",
			);

		console.log("Loading sheets data with spreadsheet ID:", SPREADSHEET_ID);
		console.log("Access token length:", accessToken?.length);

		if (!isRefresh) {
			updateSheetsState({ isLoading: true, error: null });
		}

		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		console.log("Fetching data from sheets...");
		const data = await sheetsService.getAllSheetsData(accessToken);

		console.log("Received data:", {
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

		console.log("Converted products:", {
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
			isLoading: false,
			error: null,
			lastUpdated: new Date(),
		});

		console.log("Successfully loaded sheets data");
		return { success: true };
	} catch (error: any) {
		console.error("Error loading sheets data:", error);
		const errorMessage =
			error.message || "Failed to load data from spreadsheet";
		updateSheetsState({
			isLoading: false,
			error: errorMessage,
		});
		return { success: false, error: errorMessage };
	}
}

async function refreshSheetsData(accessToken: string): Promise<void> {
	updateSheetsState({ isRefreshing: true });
	const result = await loadSheetsData(accessToken, true);
	updateSheetsState({ isRefreshing: false });
	if (!result.success) {
		Alert.alert("Error", result.error || "Failed to refresh data");
	}
}

async function addMetadataToSheet(
	sheetName: string,
	name: string,
	accessToken: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.addMetadataItem(sheetName, name, accessToken);

		await refreshSheetsData(accessToken);

		return { success: true };
	} catch (error: any) {
		console.error("Error adding metadata to sheet:", error);
		return { success: false, error: error.message || "Failed to add item" };
	}
}

async function addProductToSheet(
	product: ProductSheet,
	accessToken: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.addProduct(product, accessToken);

		await refreshSheetsData(accessToken);

		return { success: true };
	} catch (error: any) {
		console.error("Error adding product to sheet:", error);
		return { success: false, error: error.message || "Failed to add product" };
	}
}

async function updateMetadataInSheet(
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

		await refreshSheetsData(accessToken);

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
	} catch (error: any) {
		console.error("Error updating metadata in sheet:", error);
		return {
			success: false,
			error: error.message || "Failed to update metadata",
		};
	}
}

function getFieldKeyForSheetName(sheetName: string): string | null {
	switch (sheetName) {
		case "product_types":
			return "productType";
		case "colors":
			return "color";
		case "brands":
			return "manufacturer";
		case "textures":
			return "texture";
		case "shapes":
			return "shape";
		case "distributors":
			return "distributor";
		case "occasions":
			return "occasion";
		case "bag_quantities":
			return "bagQuantity";
		default:
			return null;
	}
}

async function updateProductInSheet(
	product: ProductSheet,
	accessToken: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.updateProduct(product, accessToken);

		await refreshSheetsData(accessToken);

		return { success: true };
	} catch (error: any) {
		console.error("Error updating product in sheet:", error);
		return {
			success: false,
			error: error.message || "Failed to update product",
		};
	}
}

async function addExternalProductToSheet(
	product: any,
	accessToken: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.addExternalProduct(product, accessToken);

		await refreshSheetsData(accessToken);

		return { success: true };
	} catch (error: any) {
		console.error("Error adding external product to sheet:", error);
		return {
			success: false,
			error: error.message || "Failed to add external product",
		};
	}
}

async function updateInternalProductInSheet(
	product: any,
	accessToken: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.updateInternalProduct(product, accessToken);

		await refreshSheetsData(accessToken);

		return { success: true };
	} catch (error: any) {
		console.error("Error updating internal product in sheet:", error);
		return {
			success: false,
			error: error.message || "Failed to update internal product",
		};
	}
}

export function useSheetsData() {
	const [, forceUpdate] = useState({});
	const { getAccessToken, isSignedIn } = useAuth();

	useEffect(() => {
		return subscribeToSheetsData(() => forceUpdate({}));
	}, []);

	useEffect(() => {
		if (
			isSignedIn &&
			!globalSheetsState.lastUpdated &&
			!globalSheetsState.isLoading
		) {
			loadInitialData();
		}
	}, [isSignedIn]);

	const loadInitialData = async () => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			updateSheetsState({
				error: "No access token available",
				isLoading: false,
			});
			return;
		}

		await loadSheetsData(accessToken);
	};

	const refresh = async () => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			Alert.alert("Error", "No access token available");
			return;
		}

		await refreshSheetsData(accessToken);
	};

	const addMetadata = async (sheetName: string, name: string) => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			Alert.alert("Error", "No access token available");
			return { success: false, error: "No access token" };
		}

		return await addMetadataToSheet(sheetName, name, accessToken);
	};

	const addProduct = async (product: ProductSheet) => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			Alert.alert("Error", "No access token available");
			return { success: false, error: "No access token" };
		}

		return await addProductToSheet(product, accessToken);
	};

	const updateMetadata = async (
		sheetName: string,
		oldName: string,
		newName: string,
	) => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			Alert.alert("Error", "No access token available");
			return { success: false, error: "No access token" };
		}

		return await updateMetadataInSheet(
			sheetName,
			oldName,
			newName,
			accessToken,
		);
	};

	const updateProduct = async (product: ProductSheet) => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			Alert.alert("Error", "No access token available");
			return { success: false, error: "No access token" };
		}

		return await updateProductInSheet(product, accessToken);
	};

	const addExternalProduct = async (product: any) => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			Alert.alert("Error", "No access token available");
			return { success: false, error: "No access token" };
		}

		return await addExternalProductToSheet(product, accessToken);
	};

	const updateInternalProduct = async (product: any) => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			Alert.alert("Error", "No access token available");
			return { success: false, error: "No access token" };
		}

		try {
			const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
			await sheetsService.updateInternalProduct(product, accessToken);
			// Don't refresh - let the caller update the store directly
			return { success: true };
		} catch (error: any) {
			console.error("Error updating internal product in sheet:", error);
			return {
				success: false,
				error: error.message || "Failed to update internal product",
			};
		}
	};

	const updateExternalProduct = async (
		product: any,
		skipAuditLog: boolean = false,
	) => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			Alert.alert("Error", "No access token available");
			return { success: false, error: "No access token" };
		}

		try {
			const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
			await sheetsService.updateExternalProduct(
				product,
				accessToken,
				skipAuditLog,
			);
			// Don't refresh - let the caller update the store directly
			return { success: true };
		} catch (error: any) {
			console.error("Error updating external product in sheet:", error);
			return {
				success: false,
				error: error.message || "Failed to update external product",
			};
		}
	};

	const archiveMetadata = async (sheetName: string, name: string) => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			Alert.alert("Error", "No access token available");
			return { success: false, error: "No access token" };
		}

		try {
			const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
			await sheetsService.archiveMetadataItem(sheetName, name, accessToken);
			await refreshSheetsData(accessToken);
			return { success: true };
		} catch (error: any) {
			console.error("Error archiving metadata:", error);
			return {
				success: false,
				error: error.message || "Failed to archive metadata",
			};
		}
	};

	const unarchiveMetadata = async (sheetName: string, name: string) => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			Alert.alert("Error", "No access token available");
			return { success: false, error: "No access token" };
		}

		try {
			const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
			await sheetsService.unarchiveMetadataItem(sheetName, name, accessToken);
			await refreshSheetsData(accessToken);
			return { success: true };
		} catch (error: any) {
			console.error("Error unarchiving metadata:", error);
			return {
				success: false,
				error: error.message || "Failed to unarchive metadata",
			};
		}
	};

	const logAuditEvent = async (
		event: Omit<import("@/services/googleSheets").AuditEvent, "id">,
	) => {
		const accessToken = await getAccessToken();
		if (!accessToken) return;

		try {
			const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
			await sheetsService.logEvent(event, accessToken);
		} catch (error) {
			console.error("Failed to log audit event:", error);
		}
	};

	const getAuditEvents = async (limit = 50, offset = 0) => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			Alert.alert("Error", "No access token available");
			return [];
		}

		try {
			const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
			return await sheetsService.getAuditEvents(accessToken, limit, offset);
		} catch (error: any) {
			console.error("Error fetching audit events:", error);
			return [];
		}
	};

	const archiveExternalProduct = async (sku: string) => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			Alert.alert("Error", "No access token available");
			return { success: false, error: "No access token" };
		}

		try {
			const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
			await sheetsService.archiveExternalProduct(sku, accessToken);
			return { success: true };
		} catch (error: any) {
			console.error("Error archiving external product:", error);
			return {
				success: false,
				error: error.message || "Failed to archive external product",
			};
		}
	};

	const unarchiveExternalProduct = async (sku: string) => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			Alert.alert("Error", "No access token available");
			return { success: false, error: "No access token" };
		}

		try {
			const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
			await sheetsService.unarchiveExternalProduct(sku, accessToken);
			return { success: true };
		} catch (error: any) {
			console.error("Error unarchiving external product:", error);
			return {
				success: false,
				error: error.message || "Failed to unarchive external product",
			};
		}
	};

	const archiveInternalProduct = async (name: string) => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			Alert.alert("Error", "No access token available");
			return { success: false, error: "No access token" };
		}

		try {
			const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
			await sheetsService.archiveInternalProduct(name, accessToken);
			return { success: true };
		} catch (error: any) {
			console.error("Error archiving internal product:", error);
			return {
				success: false,
				error: error.message || "Failed to archive internal product",
			};
		}
	};

	const unarchiveInternalProduct = async (name: string) => {
		const accessToken = await getAccessToken();
		if (!accessToken) {
			Alert.alert("Error", "No access token available");
			return { success: false, error: "No access token" };
		}

		try {
			const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
			await sheetsService.unarchiveInternalProduct(name, accessToken);
			return { success: true };
		} catch (error: any) {
			console.error("Error unarchiving internal product:", error);
			return {
				success: false,
				error: error.message || "Failed to unarchive internal product",
			};
		}
	};

	return {
		...globalSheetsState,
		refresh,
		loadInitialData,
		addMetadata,
		addProduct,
		updateMetadata,
		updateProduct,
		addExternalProduct,
		updateInternalProduct,
		updateExternalProduct,
		archiveMetadata,
		unarchiveMetadata,
		archiveExternalProduct,
		unarchiveExternalProduct,
		archiveInternalProduct,
		unarchiveInternalProduct,
		subscribeToMetadataChanges,
		logAuditEvent,
		getAuditEvents,
	};
}
