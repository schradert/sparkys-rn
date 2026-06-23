import type { ExternalProduct, InternalProduct } from "./types";

// Archive/unarchive product functions
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

export function isInternalProductArchived(
	productName: string,
	products: InternalProduct[],
): boolean {
	const product = products.find((p) => p.sparkys_product_name === productName);
	return product?.status === "archived";
}

export function isExternalProductArchived(
	sku: string,
	products: ExternalProduct[],
): boolean {
	const product = products.find((p) => p.unique_id_sku === sku);
	return product?.status === "archived";
}
