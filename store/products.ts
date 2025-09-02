import type { ExternalProduct, InternalProduct } from "@/constants/Products";

// Store for internal products (user-defined groupings)
let internalProducts: InternalProduct[] = [];

// Store for external products (manufacturer products with barcodes)
let externalProducts: ExternalProduct[] = [];

// Store change notification
let storeChangeListeners: Array<() => void> = [];

function notifyStoreChange() {
	storeChangeListeners.forEach((listener) => listener());
}

export function subscribeToStoreChanges(listener: () => void) {
	storeChangeListeners.push(listener);
	return () => {
		storeChangeListeners = storeChangeListeners.filter((l) => l !== listener);
	};
}

// Internal Products Management
export function getAllInternalProducts(): InternalProduct[] {
	return internalProducts;
}

export function getInternalProductByName(
	name: string,
): InternalProduct | undefined {
	return internalProducts.find((p) => p.sparkys_product_name === name);
}

export function addInternalProduct(product: InternalProduct): void {
	internalProducts = [...internalProducts, product];
}

export function updateInternalProduct(
	name: string,
	updatedProduct: InternalProduct,
): void {
	const index = internalProducts.findIndex(
		(p) => p.sparkys_product_name === name,
	);
	if (index !== -1) {
		internalProducts[index] = updatedProduct;
		notifyStoreChange();
	}
}

export function setInternalProducts(newProducts: InternalProduct[]): void {
	console.log("Setting internal products:", newProducts);
	internalProducts = [...newProducts];
	notifyStoreChange();
}

// External Products Management
export function getAllExternalProducts(): ExternalProduct[] {
	return externalProducts;
}

export function getExternalProductBySku(
	sku: string,
): ExternalProduct | undefined {
	return externalProducts.find((p) => p.unique_id_sku === sku);
}

export function getExternalProductsForInternal(
	internalProduct: InternalProduct,
): ExternalProduct[] {
	return externalProducts.filter((p) =>
		internalProduct.products.includes(p.unique_id_sku),
	);
}

export function addExternalProduct(product: ExternalProduct): void {
	externalProducts = [...externalProducts, product];
}

export function updateExternalProduct(
	sku: string,
	updatedProduct: ExternalProduct,
): void {
	const index = externalProducts.findIndex((p) => p.unique_id_sku === sku);
	if (index !== -1) {
		externalProducts[index] = updatedProduct;
		notifyStoreChange();
	}
}

export function setExternalProducts(newProducts: ExternalProduct[]): void {
	console.log("Setting external products:", newProducts);
	externalProducts = [...newProducts];
	notifyStoreChange();
}
