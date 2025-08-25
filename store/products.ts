import { BALLOON_PRODUCTS, type Product } from "@/constants/Products";

let products: Product[] = [...BALLOON_PRODUCTS];

export function getAllProducts(): Product[] {
	return products;
}

export function getProductById(id: string): Product | undefined {
	return products.find((p) => p.id === id);
}

export function addProduct(product: Product): void {
	products = [...products, product];
}

export function updateProduct(id: string, updatedProduct: Product): void {
	const index = products.findIndex((p) => p.id === id);
	if (index !== -1) {
		products[index] = updatedProduct;
	}
}

export function setProducts(newProducts: Product[]): void {
	products = [...newProducts];
}
