/**
 * Pure archive/unarchive helpers over in-memory product lists. Each returns a
 * new array with the matched product's status flipped; non-matches pass through.
 */

import type { ExternalProduct, InternalProduct } from "./types";

/** Return the list with the named internal product marked archived. */
export function archiveInternalProduct(
	productName: string,
	products: InternalProduct[],
): InternalProduct[] {
	return products.map((product) =>
		product.sparkys_product_name === productName
			? { ...product, status: "archived" as const }
			: product,
	);
}

/** Return the list with the named internal product marked active. */
export function unarchiveInternalProduct(
	productName: string,
	products: InternalProduct[],
): InternalProduct[] {
	return products.map((product) =>
		product.sparkys_product_name === productName
			? { ...product, status: "active" as const }
			: product,
	);
}

/** Return the list with the SKU's external product marked archived. */
export function archiveExternalProduct(
	sku: string,
	products: ExternalProduct[],
): ExternalProduct[] {
	return products.map((product) =>
		product.unique_id_sku === sku
			? { ...product, status: "archived" as const }
			: product,
	);
}

/** Return the list with the SKU's external product marked active. */
export function unarchiveExternalProduct(
	sku: string,
	products: ExternalProduct[],
): ExternalProduct[] {
	return products.map((product) =>
		product.unique_id_sku === sku
			? { ...product, status: "active" as const }
			: product,
	);
}

/** Whether the named internal product is currently archived. */
export function isInternalProductArchived(
	productName: string,
	products: InternalProduct[],
): boolean {
	const product = products.find((p) => p.sparkys_product_name === productName);
	return product?.status === "archived";
}

/** Whether the SKU's external product is currently archived. */
export function isExternalProductArchived(
	sku: string,
	products: ExternalProduct[],
): boolean {
	const product = products.find((p) => p.unique_id_sku === sku);
	return product?.status === "archived";
}
