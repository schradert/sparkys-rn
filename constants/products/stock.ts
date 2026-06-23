/**
 * Stock helpers relating an internal product to its external SKUs: the SKUs it
 * rolls up, their combined on-hand quantity, and a threshold-based status color.
 */

import type { ExternalProduct, InternalProduct } from "./types";

/** Sum the on-hand quantity across the internal product's external SKUs. */
export function getInternalProductTotalQuantity(
	internalProduct: InternalProduct,
	externalProducts: ExternalProduct[],
): number {
	return externalProducts
		.filter((ext) => internalProduct.products.includes(ext.unique_id_sku))
		.reduce((total, ext) => total + ext.quantity, 0);
}

/** The external SKUs belonging to an internal product. */
export function getExternalProductsForInternal(
	internalProduct: InternalProduct,
	externalProducts: ExternalProduct[],
): ExternalProduct[] {
	return externalProducts.filter((ext) =>
		internalProduct.products.includes(ext.unique_id_sku),
	);
}

/**
 * Stock-level color: red below threshold, blue up to 1.25× threshold, otherwise
 * green.
 */
export function getQuantityColor(
	quantity: number,
	thresholdQuantity: number,
): "red" | "blue" | "green" {
	if (quantity < thresholdQuantity) {
		return "red";
	} else if (quantity <= thresholdQuantity * 1.25) {
		return "blue";
	} else {
		return "green";
	}
}
