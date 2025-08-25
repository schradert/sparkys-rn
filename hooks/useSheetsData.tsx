import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { SHEETS_CONFIG } from "@/config/sheets";
import {
	convertSheetToProduct,
	type Product,
	type ProductSheet,
	updateFieldOptions,
} from "@/constants/Products";
import { GoogleSheetsService } from "@/services/googleSheets";
import { setProducts } from "@/store/products";
import { useAuth } from "./useAuth";

interface SheetsDataState {
	products: Product[];
	isLoading: boolean;
	error: string | null;
	lastUpdated: Date | null;
}

let globalSheetsState: SheetsDataState = {
	products: [],
	isLoading: false,
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

const { SPREADSHEET_ID } = SHEETS_CONFIG;

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
): Promise<{ success: boolean; error?: string }> {
	try {
		if (SPREADSHEET_ID === "1YourSpreadsheetIdHere" || !SPREADSHEET_ID) {
			throw new Error(
				"Please configure your spreadsheet ID in config/sheets.ts",
			);
		}

		console.log("Loading sheets data with spreadsheet ID:", SPREADSHEET_ID);
		console.log("Access token length:", accessToken?.length);

		updateSheetsState({ isLoading: true, error: null });

		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		console.log("Fetching data from sheets...");
		const data = await sheetsService.getAllSheetsData(accessToken);

		console.log("Received data:", {
			productCount: data.products.length,
			metadata: Object.keys(data.metadata),
		});

		updateFieldOptions(data.metadata);

		const products = data.products.map(convertSheetToProduct);

		setProducts(products);

		updateSheetsState({
			products,
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
	const result = await loadSheetsData(accessToken);
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

	return {
		...globalSheetsState,
		refresh,
		loadInitialData,
		addMetadata,
		addProduct,
		updateMetadata,
		updateProduct,
		subscribeToMetadataChanges,
	};
}
