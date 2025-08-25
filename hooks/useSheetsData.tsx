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

function subscribeToSheetsData(callback: () => void) {
	sheetsSubscribers.push(callback);
	return () => {
		sheetsSubscribers = sheetsSubscribers.filter((sub) => sub !== callback);
	};
}

function updateSheetsState(newState: Partial<SheetsDataState>) {
	globalSheetsState = { ...globalSheetsState, ...newState };
	sheetsSubscribers.forEach((callback) => callback());
}

const { SPREADSHEET_ID } = SHEETS_CONFIG;

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

	return {
		...globalSheetsState,
		refresh,
		loadInitialData,
	};
}
