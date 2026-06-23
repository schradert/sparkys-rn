import { Alert } from "react-native";
import {
	type InternalProduct,
	type InternalProductSheet,
	PRODUCT_FIELD_OPTIONS,
} from "@/constants/Products";
import { logger } from "@/services/logger";
import {
	addExternalProduct as addExternalProductToStore,
	addInternalProduct as addInternalProductToStore,
	updateInternalProduct as updateInternalProductInStore,
} from "@/store/products";
import {
	FIELD_KEY_FOR_VIEW_MODE,
	getSheetNameForViewMode,
	type MetadataViewMode,
} from "./inventoryMaps";
import type { NewExternalProduct, NewInternalProduct } from "./types";

/**
 * The add-flow mutations for the inventory screen: adding a metadata value, an
 * internal product, or an external product (with its internal linkage). Each
 * validates its inputs, performs the sheet write and store update, surfaces the
 * outcome via Alert, and calls back into the screen to close/reset on success.
 * Kept pure (no hooks) so the view-model hook stays small and these stay
 * directly testable.
 */

type MutationResult = { success: boolean; error?: string };

interface SubmitMetadataArgs {
	view: MetadataViewMode;
	value: string;
	addMetadata: (sheetName: string, name: string) => Promise<MutationResult>;
	onSubmittingChange: (submitting: boolean) => void;
	onSuccess: () => void;
}

/**
 * Validate and add a metadata value to its sheet, rejecting blanks, duplicates,
 * and categories with no writable sheet; alerts on the outcome.
 */
export async function submitMetadata({
	view,
	value,
	addMetadata,
	onSubmittingChange,
	onSuccess,
}: SubmitMetadataArgs): Promise<void> {
	if (!value.trim()) {
		Alert.alert("Error", "Please enter a value");
		return;
	}
	const trimmedValue = value.trim();
	const fieldKey = FIELD_KEY_FOR_VIEW_MODE[view];
	const existingValues: readonly string[] =
		PRODUCT_FIELD_OPTIONS[fieldKey as keyof typeof PRODUCT_FIELD_OPTIONS] ?? [];
	if (existingValues.includes(trimmedValue)) {
		Alert.alert("Error", "This value already exists");
		return;
	}
	const sheetName = getSheetNameForViewMode(view);
	if (!sheetName) {
		Alert.alert("Error", "Cannot add items to this category");
		return;
	}
	onSubmittingChange(true);
	try {
		const result = await addMetadata(sheetName, trimmedValue);
		if (result.success) {
			onSuccess();
			Alert.alert("Success", `"${trimmedValue}" has been added!`);
		} else {
			Alert.alert("Error", result.error || "Failed to add item");
		}
	} catch (error) {
		logger.error("Inventory", "Failed to add metadata item", { error });
		Alert.alert("Error", "Failed to add item to spreadsheet");
	} finally {
		onSubmittingChange(false);
	}
}

interface SubmitInternalArgs {
	form: NewInternalProduct;
	internalProducts: InternalProduct[];
	addInternalProduct: (
		product: InternalProductSheet,
	) => Promise<MutationResult>;
	onSubmittingChange: (submitting: boolean) => void;
	onSuccess: () => void;
}

/**
 * Validate and create an internal product (required fields, unique name), write
 * it to the sheet and store, and alert on the outcome.
 */
export async function submitInternalProduct({
	form,
	internalProducts,
	addInternalProduct,
	onSubmittingChange,
	onSuccess,
}: SubmitInternalArgs): Promise<void> {
	if (!form.sparkys_product_name.trim()) {
		Alert.alert("Error", "Please enter a product name");
		return;
	}
	const existingProduct = internalProducts.find(
		(p) =>
			p.sparkys_product_name.toLowerCase().trim() ===
			form.sparkys_product_name.toLowerCase().trim(),
	);
	if (existingProduct) {
		Alert.alert("Error", "A product with this name already exists");
		return;
	}
	if (!form.product_type) {
		Alert.alert("Error", "Please select a product type");
		return;
	}
	if (!form.sparkys_color) {
		Alert.alert("Error", "Please select a color");
		return;
	}
	if (!form.texture) {
		Alert.alert("Error", "Please select a texture");
		return;
	}
	if (!form.shape) {
		Alert.alert("Error", "Please select a shape");
		return;
	}
	onSubmittingChange(true);
	try {
		const productForSheet: InternalProductSheet = {
			id: form.id,
			sparkys_product_name: form.sparkys_product_name,
			product_type: form.product_type,
			sparkys_color: form.sparkys_color,
			texture: form.texture,
			shape: form.shape,
			occasions: form.occasions.join(", "),
			products: form.products.join(", "),
			threshold_quantity: form.threshold_quantity,
			never_out: form.never_out,
			status: "active",
		};
		const result = await addInternalProduct(productForSheet);
		if (result.success) {
			addInternalProductToStore({ ...form, status: "active" });
			onSuccess();
			Alert.alert(
				"Success",
				`Internal product "${form.sparkys_product_name}" has been created!`,
			);
		} else {
			Alert.alert("Error", result.error || "Failed to add internal product");
		}
	} catch (error) {
		logger.error("Inventory", "Failed to add internal product", { error });
		Alert.alert("Error", "Failed to add internal product to spreadsheet");
	} finally {
		onSubmittingChange(false);
	}
}

interface SubmitExternalArgs {
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

/**
 * Validate and create an external product, then link it to its assigned internal
 * product; reports partial success when the product is added but linking fails.
 */
export async function submitExternalProduct({
	form,
	internalProducts,
	addExternalProduct,
	updateInternalProduct,
	onSubmittingChange,
	onSuccess,
}: SubmitExternalArgs): Promise<void> {
	if (!form.unique_id_sku.trim()) {
		Alert.alert("Error", "Please scan a barcode first");
		return;
	}
	if (!form.manufacturer_color) {
		Alert.alert("Error", "Please select a manufacturer color");
		return;
	}
	if (!form.brand) {
		Alert.alert("Error", "Please select a brand");
		return;
	}
	if (!form.size) {
		Alert.alert("Error", "Please select a size");
		return;
	}
	if (!form.assigned_internal_product) {
		Alert.alert(
			"Error",
			"Please assign this external product to an internal product",
		);
		return;
	}
	if (form.quantity < 0) {
		Alert.alert("Error", "Please enter a valid quantity");
		return;
	}
	onSubmittingChange(true);
	try {
		const externalProductForSheet = {
			unique_id_sku: form.unique_id_sku,
			manufacturer_color: form.manufacturer_color,
			brand: form.brand,
			size: form.size,
			bag_quantity: form.bag_quantity,
			distributors: form.distributors.join(", ") || "",
			quantity: form.quantity,
		};
		const addResult = await addExternalProduct(externalProductForSheet);
		if (!addResult.success) {
			Alert.alert("Error", addResult.error || "Failed to add external product");
			return;
		}
		const assignedInternalProduct = internalProducts.find(
			(p) => p.sparkys_product_name === form.assigned_internal_product,
		);
		let linkingSucceeded = false;
		let updatedInternalProduct: typeof assignedInternalProduct;
		if (assignedInternalProduct) {
			updatedInternalProduct = {
				...assignedInternalProduct,
				products: [...assignedInternalProduct.products, form.unique_id_sku],
			};
			const internalProductForSheet = {
				id: updatedInternalProduct.id,
				sparkys_product_name: updatedInternalProduct.sparkys_product_name,
				product_type: updatedInternalProduct.product_type,
				sparkys_color: updatedInternalProduct.sparkys_color,
				texture: updatedInternalProduct.texture,
				shape: updatedInternalProduct.shape,
				occasions: updatedInternalProduct.occasions.join(", "),
				products: updatedInternalProduct.products.join(", "),
				threshold_quantity: updatedInternalProduct.threshold_quantity,
				never_out: updatedInternalProduct.never_out,
				status: updatedInternalProduct.status,
			};
			const updateResult = await updateInternalProduct(internalProductForSheet);
			if (!updateResult.success) {
				logger.warn(
					"Inventory",
					"Failed to link external product to internal product:",
					updateResult.error,
				);
			} else {
				linkingSucceeded = true;
			}
		}
		addExternalProductToStore({
			unique_id_sku: form.unique_id_sku,
			manufacturer_color: form.manufacturer_color,
			brand: form.brand,
			size: form.size,
			bag_quantity: form.bag_quantity,
			distributors: form.distributors,
			quantity: form.quantity,
			status: "active" as const,
		});
		if (assignedInternalProduct && updatedInternalProduct) {
			updateInternalProductInStore(
				assignedInternalProduct.id,
				updatedInternalProduct,
			);
		}
		onSuccess();
		if (linkingSucceeded || !assignedInternalProduct) {
			Alert.alert(
				"Success",
				`External product "${form.unique_id_sku}" added and assigned to "${form.assigned_internal_product}"!`,
			);
		} else {
			Alert.alert(
				"Partial Success",
				`External product "${form.unique_id_sku}" was created but failed to link to "${form.assigned_internal_product}". You may need to link it manually.`,
			);
		}
	} catch (error) {
		logger.error("Inventory", "Failed to add external product", { error });
		Alert.alert("Error", "Failed to add external product to spreadsheet");
	} finally {
		onSubmittingChange(false);
	}
}
