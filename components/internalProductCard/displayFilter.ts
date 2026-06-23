import type { ExternalProduct } from "@/constants/Products";

type ExternalFilters = {
	manufacturer_color?: string[];
	brand?: string[];
	size?: string[];
	distributors?: string[];
	showArchived?: boolean;
};

export function matchesExternalDisplayFilter(
	externalProduct: ExternalProduct,
	externalFilters: ExternalFilters | undefined,
): boolean {
	// Apply external product filters only for display
	return Object.entries(externalFilters || {}).every(
		([key, selectedValues]) => {
			if (key === "showArchived") {
				// Handle showArchived filter (boolean)
				const isProductArchived =
					(externalProduct.status || "active") === "archived";
				if (selectedValues === true) {
					// Show all products (both active and archived)
					return true;
				} else {
					// Show only active products (exclude archived)
					return !isProductArchived;
				}
			}
			if (!Array.isArray(selectedValues) || selectedValues.length === 0)
				return true;
			if (key === "distributors") {
				return selectedValues.some((selectedValue) =>
					externalProduct.distributors.includes(selectedValue),
				);
			}
			const productValue = externalProduct[
				key as keyof ExternalProduct
			] as string;
			return selectedValues.includes(productValue);
		},
	);
}
