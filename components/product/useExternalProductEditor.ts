/** Hook owning the external-product edit lifecycle, save, and reassignment. */
import { useState } from "react";
import { Alert } from "react-native";
import type {
	ExternalProduct,
	ExternalProductSheet,
	InternalProduct,
	InternalProductSheet,
} from "@/constants/Products";
import type { AuditEvent } from "@/services/googleSheets";
import { logger } from "@/services/logger";
import { updateExternalProduct } from "@/store/products";
import { reassignSkuAcrossInternals } from "./reassignInternalProduct";

type MutationResult = { success: boolean; error?: string };

/** The audit-event payload callers pass to `logAuditEvent` (id/user added there). */
export type AuditEventInput = Omit<AuditEvent, "id" | "user_email">;

interface UseExternalProductEditorOptions {
	/** The current external product; the working copy seeds from it on edit. */
	product: ExternalProduct;
	/** The internal product that originally groups this SKU (or null). */
	originalInternal: InternalProduct | null;
	updateExternalInSheet: (
		sheet: ExternalProductSheet,
	) => Promise<MutationResult>;
	updateInternalInSheet: (
		sheet: InternalProductSheet,
	) => Promise<MutationResult>;
	logAuditEvent: (event: AuditEventInput) => Promise<void>;
	/** Apply a successful external-field save to the parent screen state. */
	onExternalSaved: (saved: ExternalProduct) => void;
	/** Apply a successful reassignment to the parent screen state. */
	onReassigned: (target: InternalProduct) => void;
}

interface UseExternalProductEditorResult {
	isEditing: boolean;
	editedProduct: ExternalProduct;
	setEditedProduct: (product: ExternalProduct) => void;
	selectedInternal: InternalProduct | null;
	setSelectedInternal: (internal: InternalProduct) => void;
	isSaving: boolean;
	beginEdit: () => void;
	cancelEdit: () => void;
	incrementStock: () => void;
	decrementStock: () => void;
	handleSave: () => Promise<void>;
}

function hasExternalChanges(
	edited: ExternalProduct,
	original: ExternalProduct,
): boolean {
	return (
		edited.manufacturer_color !== original.manufacturer_color ||
		edited.brand !== original.brand ||
		edited.size !== original.size ||
		edited.bag_quantity !== original.bag_quantity ||
		JSON.stringify(edited.distributors) !==
			JSON.stringify(original.distributors) ||
		edited.quantity !== original.quantity
	);
}

/**
 * Owns the editable copy of an external product plus its currently-selected
 * internal-product assignment, the edit lifecycle, and the multi-step save:
 * external-field write, then internal reassignment (remove from old, add to
 * new, roll back on failure) with an audit event. Entering edit reseeds the
 * working copy, so `editedProduct` is always concrete.
 */
export function useExternalProductEditor({
	product,
	originalInternal,
	updateExternalInSheet,
	updateInternalInSheet,
	logAuditEvent,
	onExternalSaved,
	onReassigned,
}: UseExternalProductEditorOptions): UseExternalProductEditorResult {
	const [isEditing, setIsEditing] = useState(false);
	const [editedProduct, setEditedProduct] = useState<ExternalProduct>(product);
	const [selectedInternal, setSelectedInternal] =
		useState<InternalProduct | null>(originalInternal);
	const [isSaving, setIsSaving] = useState(false);

	const beginEdit = () => {
		setEditedProduct(product);
		setSelectedInternal(originalInternal);
		setIsEditing(true);
	};

	const cancelEdit = () => {
		setEditedProduct(product);
		setSelectedInternal(originalInternal);
		setIsEditing(false);
	};

	const incrementStock = () => {
		setEditedProduct({
			...editedProduct,
			quantity: editedProduct.quantity + product.bag_quantity,
		});
	};

	const decrementStock = () => {
		setEditedProduct({
			...editedProduct,
			quantity: Math.max(0, editedProduct.quantity - 1),
		});
	};

	// Step 1: persist external-field edits. Returns false if the write failed
	// (the caller aborts), true otherwise.
	const saveExternalFields = async (): Promise<boolean> => {
		const productForSheet: ExternalProductSheet = {
			unique_id_sku: editedProduct.unique_id_sku,
			manufacturer_color: editedProduct.manufacturer_color,
			brand: editedProduct.brand,
			size: editedProduct.size,
			bag_quantity: editedProduct.bag_quantity,
			distributors: editedProduct.distributors.join(", "),
			quantity: editedProduct.quantity,
			status: editedProduct.status || "active",
		};

		const result = await updateExternalInSheet(productForSheet);
		if (!result.success) {
			logger.error("ExternalProduct", "Failed to update external fields", {
				error: result.error,
				sku: editedProduct.unique_id_sku,
			});
			Alert.alert("Error", result.error || "Failed to update product");
			return false;
		}
		// Keep the store in lockstep with the sheet, so a later reassignment
		// failure can't leave the store showing stale external fields.
		updateExternalProduct(product.unique_id_sku, editedProduct);
		onExternalSaved(editedProduct);
		return true;
	};

	// Step 2: move the SKU to `target` (remove from old, add to new, rolling
	// back on failure — see reassignSkuAcrossInternals), then write the audit
	// event. Returns false on failure so the caller aborts.
	const reassignInternal = async (
		target: InternalProduct,
	): Promise<boolean> => {
		const sku = product.unique_id_sku;
		const result = await reassignSkuAcrossInternals({
			sku,
			originalInternal,
			target,
			updateInternalInSheet,
		});
		if (!result) return false;

		await logAuditEvent({
			timestamp: new Date().toISOString(),
			event_type: "edit",
			object_type: "external_product",
			object_id: sku,
			object_name: sku,
			changes: JSON.stringify({
				internal_product: target.sparkys_product_name,
			}),
			before_state: JSON.stringify({
				internal_product:
					originalInternal?.sparkys_product_name || "Unassigned",
			}),
			sheet_name: "external_products",
		});
		onReassigned(target);
		return true;
	};

	const handleSave = async () => {
		const externalChanged = hasExternalChanges(editedProduct, product);
		// A reassignment is detected only when the selection differs from the
		// original; selection can only be set to a concrete active product, so
		// `selectedInternal` is non-null whenever the assignment changed.
		const reassignTarget =
			selectedInternal && selectedInternal.id !== originalInternal?.id
				? selectedInternal
				: null;

		if (!externalChanged && !reassignTarget) {
			setIsEditing(false);
			return;
		}

		setIsSaving(true);
		try {
			if (externalChanged) {
				const ok = await saveExternalFields();
				if (!ok) return;
			}

			if (reassignTarget) {
				const ok = await reassignInternal(reassignTarget);
				if (!ok) return;
			}

			setIsEditing(false);
			Alert.alert("Success", "Product updated successfully");
		} catch (error) {
			logger.error("ExternalProduct", "Failed to update product", {
				error,
				sku: product.unique_id_sku,
			});
			Alert.alert("Error", "Failed to update product");
		} finally {
			setIsSaving(false);
		}
	};

	return {
		isEditing,
		editedProduct,
		setEditedProduct,
		selectedInternal,
		setSelectedInternal,
		isSaving,
		beginEdit,
		cancelEdit,
		incrementStock,
		decrementStock,
		handleSave,
	};
}
