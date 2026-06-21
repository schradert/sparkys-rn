import { create } from "zustand";
import type { ExternalProduct, InternalProduct } from "@/constants/Products";

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
export function getAllInternalProducts(): InternalProduct[] {
	return useProductStore.getState().internalProducts;
}

export function getInternalProductById(
	id: string,
): InternalProduct | undefined {
	return useProductStore.getState().internalProducts.find((p) => p.id === id);
}

export function getInternalProductByName(
	name: string,
): InternalProduct | undefined {
	return useProductStore
		.getState()
		.internalProducts.find((p) => p.sparkys_product_name === name);
}

export function addInternalProduct(product: InternalProduct): void {
	useProductStore.getState().addInternalProduct(product);
}

export function updateInternalProduct(
	id: string,
	updatedProduct: InternalProduct,
): void {
	useProductStore.getState().updateInternalProduct(id, updatedProduct);
}

export function updateInternalProductByName(
	name: string,
	updatedProduct: InternalProduct,
): void {
	useProductStore.getState().updateInternalProductByName(name, updatedProduct);
}

export function setInternalProducts(newProducts: InternalProduct[]): void {
	useProductStore.getState().setInternalProducts(newProducts);
}

// External products
export function getAllExternalProducts(): ExternalProduct[] {
	return useProductStore.getState().externalProducts;
}

export function getExternalProductBySku(
	sku: string,
): ExternalProduct | undefined {
	return useProductStore
		.getState()
		.externalProducts.find((p) => p.unique_id_sku === sku);
}

export function getExternalProductsForInternal(
	internalProduct: InternalProduct,
): ExternalProduct[] {
	return useProductStore
		.getState()
		.externalProducts.filter((p) =>
			internalProduct.products.includes(p.unique_id_sku),
		);
}

export function addExternalProduct(product: ExternalProduct): void {
	useProductStore.getState().addExternalProduct(product);
}

export function updateExternalProduct(
	sku: string,
	updatedProduct: ExternalProduct,
): void {
	useProductStore.getState().updateExternalProduct(sku, updatedProduct);
}

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
