/**
 * Zustand store holding the in-memory internal/external product lists, plus a
 * backwards-compatible imperative API for non-React callers.
 */

import { create } from "zustand";
import type { ExternalProduct, InternalProduct } from "@/constants/Products";

/** Store state: the product lists and their mutators. */
interface ProductState {
	internalProducts: InternalProduct[];
	externalProducts: ExternalProduct[];
	setInternalProducts: (products: InternalProduct[]) => void;
	addInternalProduct: (product: InternalProduct) => void;
	updateInternalProduct: (id: string, product: InternalProduct) => void;
	updateInternalProductByName: (name: string, product: InternalProduct) => void;
	setExternalProducts: (products: ExternalProduct[]) => void;
	addExternalProduct: (product: ExternalProduct) => void;
	updateExternalProduct: (sku: string, product: ExternalProduct) => void;
}

/**
 * Reactive product store. Components should prefer this hook with a selector,
 * e.g. `const products = useProductStore((s) => s.internalProducts)`, which
 * subscribes them to just that slice. Non-React callers can use
 * `useProductStore.getState()` or the imperative helpers exported below.
 */
export const useProductStore = create<ProductState>((set) => ({
	internalProducts: [],
	externalProducts: [],
	setInternalProducts: (products) => set({ internalProducts: [...products] }),
	addInternalProduct: (product) =>
		set((s) => ({ internalProducts: [...s.internalProducts, product] })),
	updateInternalProduct: (id, product) =>
		set((s) => ({
			internalProducts: s.internalProducts.map((p) =>
				p.id === id ? product : p,
			),
		})),
	updateInternalProductByName: (name, product) =>
		set((s) => ({
			internalProducts: s.internalProducts.map((p) =>
				p.sparkys_product_name === name ? product : p,
			),
		})),
	setExternalProducts: (products) => set({ externalProducts: [...products] }),
	addExternalProduct: (product) =>
		set((s) => ({ externalProducts: [...s.externalProducts, product] })),
	updateExternalProduct: (sku, product) =>
		set((s) => ({
			externalProducts: s.externalProducts.map((p) =>
				p.unique_id_sku === sku ? product : p,
			),
		})),
}));

// ---------------------------------------------------------------------------
// Backwards-compatible imperative API.
// Wraps the Zustand store so existing (non-React) call sites keep working while
// components migrate to `useProductStore` selectors. Every mutation goes
// through the store's `set`, so all subscribers are notified automatically —
// no hand-rolled listener list needed.
// ---------------------------------------------------------------------------

// Internal products
/** Snapshot of all internal products. */
export function getAllInternalProducts(): InternalProduct[] {
	return useProductStore.getState().internalProducts;
}

/** Find an internal product by id. */
export function getInternalProductById(
	id: string,
): InternalProduct | undefined {
	return useProductStore.getState().internalProducts.find((p) => p.id === id);
}

/** Find an internal product by Sparky's product name. */
export function getInternalProductByName(
	name: string,
): InternalProduct | undefined {
	return useProductStore
		.getState()
		.internalProducts.find((p) => p.sparkys_product_name === name);
}

/** Append an internal product to the store. */
export function addInternalProduct(product: InternalProduct): void {
	useProductStore.getState().addInternalProduct(product);
}

/** Replace the internal product matching `id`. */
export function updateInternalProduct(
	id: string,
	updatedProduct: InternalProduct,
): void {
	useProductStore.getState().updateInternalProduct(id, updatedProduct);
}

/** Replace the internal product matching `name`. */
export function updateInternalProductByName(
	name: string,
	updatedProduct: InternalProduct,
): void {
	useProductStore.getState().updateInternalProductByName(name, updatedProduct);
}

/** Replace the entire internal product list. */
export function setInternalProducts(newProducts: InternalProduct[]): void {
	useProductStore.getState().setInternalProducts(newProducts);
}

// External products
/** Snapshot of all external products. */
export function getAllExternalProducts(): ExternalProduct[] {
	return useProductStore.getState().externalProducts;
}

/** Find an external product by SKU. */
export function getExternalProductBySku(
	sku: string,
): ExternalProduct | undefined {
	return useProductStore
		.getState()
		.externalProducts.find((p) => p.unique_id_sku === sku);
}

/** The store's external products belonging to an internal product. */
export function getExternalProductsForInternal(
	internalProduct: InternalProduct,
): ExternalProduct[] {
	return useProductStore
		.getState()
		.externalProducts.filter((p) =>
			internalProduct.products.includes(p.unique_id_sku),
		);
}

/** Append an external product to the store. */
export function addExternalProduct(product: ExternalProduct): void {
	useProductStore.getState().addExternalProduct(product);
}

/** Replace the external product matching `sku`. */
export function updateExternalProduct(
	sku: string,
	updatedProduct: ExternalProduct,
): void {
	useProductStore.getState().updateExternalProduct(sku, updatedProduct);
}

/** Replace the entire external product list. */
export function setExternalProducts(newProducts: ExternalProduct[]): void {
	useProductStore.getState().setExternalProducts(newProducts);
}

/**
 * Backwards-compatible subscription. Prefer `useProductStore` in components;
 * this wraps Zustand's `subscribe` for the few imperative callers.
 */
export function subscribeToStoreChanges(listener: () => void): () => void {
	return useProductStore.subscribe(() => listener());
}
