/**
 * Pure helpers for the metadata detail route: mapping a view-mode segment to its
 * product field key, and formatting a category segment into a display title.
 */

export function getFieldKey(viewMode: string) {
	switch (viewMode) {
		case "productTypes":
			return "productType";
		case "occasions":
			return "occasion";
		case "colors":
			return "color";
		case "sizes":
			return "size";
		case "manufacturers":
			return "manufacturer";
		case "textures":
			return "texture";
		case "bagQuantities":
			return "bagQuantity";
		case "shapes":
			return "shape";
		case "distributors":
			return "distributor";
		default:
			return null;
	}
}

export function formatCategoryTitle(category: string): string {
	if (category === "manufacturer") return "Brand";
	if (category === "bagQuantity") return "Bag Quantity";
	if (category === "productType") return "Product Type";

	return (
		category.charAt(0).toUpperCase() +
		category.slice(1).replace(/([A-Z])/g, " $1")
	);
}
