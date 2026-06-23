import type { ExternalProduct, InternalProduct } from "./types";

export function getInternalProductTotalQuantity(
	internalProduct: InternalProduct,
	externalProducts: ExternalProduct[],
): number {
	return externalProducts
		.filter((ext) => internalProduct.products.includes(ext.unique_id_sku))
		.reduce((total, ext) => total + ext.quantity, 0);
}

// Helper to get external products for an internal product
export function getExternalProductsForInternal(
	internalProduct: InternalProduct,
	externalProducts: ExternalProduct[],
): ExternalProduct[] {
	return externalProducts.filter((ext) =>
		internalProduct.products.includes(ext.unique_id_sku),
	);
}

// Helper to get quantity color based on threshold
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
