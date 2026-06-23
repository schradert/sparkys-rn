import type {
	InternalProduct,
	InternalProductSheet,
} from "@/constants/Products";
import type { MetadataViewMode } from "./inventoryMaps";
import type { NewExternalProduct, NewInternalProduct } from "./types";

/** The outcome of a sheet + store mutation: success, or `success: false` with an error. */
export type MutationResult = { success: boolean; error?: string };

/** Inputs for `submitMetadata`. */
export interface SubmitMetadataArgs {
	view: MetadataViewMode;
	value: string;
	addMetadata: (sheetName: string, name: string) => Promise<MutationResult>;
	onSubmittingChange: (submitting: boolean) => void;
	onSuccess: () => void;
}

/** Inputs for `submitInternalProduct`. */
export interface SubmitInternalArgs {
	form: NewInternalProduct;
	internalProducts: InternalProduct[];
	addInternalProduct: (
		product: InternalProductSheet,
	) => Promise<MutationResult>;
	onSubmittingChange: (submitting: boolean) => void;
	onSuccess: () => void;
}

/** Inputs for `submitExternalProduct`. */
export interface SubmitExternalArgs {
	form: NewExternalProduct;
	internalProducts: InternalProduct[];
	addExternalProduct: (product: {
		unique_id_sku: string;
		manufacturer_color: string;
		brand: string;
		size: string;
		bag_quantity: number;
		distributors: string;
		quantity: number;
	}) => Promise<MutationResult>;
	updateInternalProduct: (
		product: InternalProductSheet,
	) => Promise<MutationResult>;
	onSubmittingChange: (submitting: boolean) => void;
	onSuccess: () => void;
}
