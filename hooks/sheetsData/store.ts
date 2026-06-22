import type { ExternalProduct, InternalProduct } from "@/constants/Products";
import { updateFieldOptions, updateMetadataItems } from "@/constants/Products";

export interface SheetsDataState {
	internalProducts: InternalProduct[];
	externalProducts: ExternalProduct[];
	metadata: Record<string, Array<{ name: string; status: string }>>;
	isLoading: boolean;
	isRefreshing: boolean;
	error: string | null;
	lastUpdated: Date | null;
}

export interface MetadataChange {
	fieldKey: string;
	oldValue: string;
	newValue: string;
}

/** Standard outcome shape returned by every sheets mutation operation. */
export interface OperationResult {
	success: boolean;
	error?: string;
}

let globalSheetsState: SheetsDataState = {
	internalProducts: [],
	externalProducts: [],
	metadata: {},
	isLoading: false,
	isRefreshing: false,
	error: null,
	lastUpdated: null,
};

let sheetsSubscribers: Array<() => void> = [];
let metadataChangeSubscribers: Array<(change: MetadataChange) => void> = [];

/** Read the current shared sheets state (the singleton the hook spreads). */
export function getSheetsState(): SheetsDataState {
	return globalSheetsState;
}

export function subscribeToSheetsData(callback: () => void) {
	sheetsSubscribers.push(callback);
	return () => {
		sheetsSubscribers = sheetsSubscribers.filter((sub) => sub !== callback);
	};
}

export function subscribeToMetadataChanges(
	callback: (change: MetadataChange) => void,
) {
	metadataChangeSubscribers.push(callback);
	return () => {
		metadataChangeSubscribers = metadataChangeSubscribers.filter(
			(sub) => sub !== callback,
		);
	};
}

export function notifyMetadataChange(change: MetadataChange) {
	metadataChangeSubscribers.forEach((callback) => {
		callback(change);
	});
}

export function updateSheetsState(newState: Partial<SheetsDataState>) {
	globalSheetsState = { ...globalSheetsState, ...newState };
	sheetsSubscribers.forEach((callback) => {
		callback();
	});
}

export function setMetadata(
	updater: (
		prev: Record<string, Array<{ name: string; status: string }>>,
	) => Record<string, Array<{ name: string; status: string }>>,
) {
	const newMetadata = updater(globalSheetsState.metadata);
	updateSheetsState({ metadata: newMetadata });

	// Update field options and metadata items so components see the changes immediately
	// Create filtered metadata for field options (active items only)
	const activeOnlyMetadata: Record<string, string[]> = {};
	for (const [key, items] of Object.entries(newMetadata)) {
		activeOnlyMetadata[key] = items
			.filter((item) => item.status === "active")
			.map((item) => item.name);
	}

	updateFieldOptions(activeOnlyMetadata);
	updateMetadataItems(newMetadata);
}
