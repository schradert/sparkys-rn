import { Alert } from "react-native";
import type {
	InternalProduct,
	InternalProductSheet,
} from "@/constants/Products";
import { logger } from "@/services/logger";
import { updateInternalProduct as updateInternalProductInStore } from "@/store/products";

type MutationResult = { success: boolean; error?: string };

function toInternalSheet(p: InternalProduct): InternalProductSheet {
	return {
		id: p.id,
		sparkys_product_name: p.sparkys_product_name,
		product_type: p.product_type,
		sparkys_color: p.sparkys_color,
		texture: p.texture,
		shape: p.shape,
		occasions: p.occasions.join(", "),
		products: p.products.join(", "),
		threshold_quantity: p.threshold_quantity,
		never_out: p.never_out,
		status: p.status,
	};
}

interface ReassignParams {
	sku: string;
	/** The internal product that currently groups the SKU (or null). */
	originalInternal: InternalProduct | null;
	/** The internal product the SKU is moving to. */
	target: InternalProduct;
	updateInternalInSheet: (
		sheet: InternalProductSheet,
	) => Promise<MutationResult>;
}

/**
 * Move a SKU from its old internal product to `target`: remove from old, add to
 * new. If the add fails, roll the remove back so the SKU is never orphaned
 * (removed from its old product but never added to the new one). Store writes
 * are deferred until both sheet writes succeed. Returns the persisted old/new
 * internal products on success, or null on failure (the caller aborts and the
 * appropriate error alert has already been raised).
 */
export async function reassignSkuAcrossInternals({
	sku,
	originalInternal,
	target,
	updateInternalInSheet,
}: ReassignParams): Promise<{
	updatedOldInternal: InternalProduct | null;
	updatedNewInternal: InternalProduct;
} | null> {
	const updatedOldInternal = originalInternal
		? {
				...originalInternal,
				products: originalInternal.products.filter((s) => s !== sku),
			}
		: null;
	const updatedNewInternal = { ...target, products: [...target.products, sku] };

	// Step A: remove the SKU from the old internal product.
	if (originalInternal && updatedOldInternal) {
		const removeResult = await updateInternalInSheet(
			toInternalSheet(updatedOldInternal),
		);
		if (!removeResult.success) {
			logger.error(
				"ExternalProduct",
				"Reassign: failed to remove SKU from old internal product",
				{ error: removeResult.error, sku, oldInternalId: originalInternal.id },
			);
			Alert.alert("Error", removeResult.error || "Failed to reassign product");
			return null; // nothing persisted yet — safe to abort
		}
	}

	// Step B: add the SKU to the new internal product; roll back A on failure.
	const addResult = await updateInternalInSheet(
		toInternalSheet(updatedNewInternal),
	);
	if (!addResult.success) {
		logger.error(
			"ExternalProduct",
			"Reassign: failed to add SKU to new internal product; rolling back",
			{ error: addResult.error, sku, newInternalId: target.id },
		);
		if (originalInternal) {
			const rollback = await updateInternalInSheet(
				toInternalSheet(originalInternal),
			);
			if (rollback.success) {
				logger.warn(
					"ExternalProduct",
					"Reassign rolled back: SKU restored to old internal product",
					{ sku, oldInternalId: originalInternal.id },
				);
			} else {
				logger.error(
					"ExternalProduct",
					"Reassign ROLLBACK FAILED: SKU orphaned from old internal product",
					{ error: rollback.error, sku, oldInternalId: originalInternal.id },
				);
			}
		}
		Alert.alert("Error", addResult.error || "Failed to reassign product");
		return null;
	}

	// Both sheet writes succeeded — persist to the store.
	if (originalInternal && updatedOldInternal) {
		updateInternalProductInStore(originalInternal.id, updatedOldInternal);
	}
	updateInternalProductInStore(target.id, updatedNewInternal);
	return { updatedOldInternal, updatedNewInternal };
}
