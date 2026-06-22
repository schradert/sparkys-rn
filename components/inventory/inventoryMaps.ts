import type { ViewMode } from "./types";

/**
 * Data-driven lookup tables for the inventory screen, replacing the per-concern
 * `switch` ladders that used to live in the screen. Every table is keyed only by
 * the real values that occur, so a lookup returns `undefined` for anything else
 * instead of falling through a dead `default` arm — there are no unreachable
 * branches to ignore.
 */

/** The view selector options, in display order. */
export const VIEW_OPTIONS: { key: ViewMode; label: string }[] = [
	{ key: "products", label: "Products" },
	{ key: "productTypes", label: "Product Types" },
	{ key: "manufacturerColors", label: "External Colors" },
	{ key: "sparkysColors", label: "Internal Colors" },
	{ key: "manufacturers", label: "Brands" },
	{ key: "sizes", label: "Sizes" },
	{ key: "textures", label: "Textures" },
	{ key: "bagQuantities", label: "Bag Quantities" },
	{ key: "shapes", label: "Shapes" },
	{ key: "distributors", label: "Distributors" },
	{ key: "occasions", label: "Occasions" },
];

/** View mode → its display label, derived from VIEW_OPTIONS. */
export const LABEL_FOR_VIEW_MODE = Object.fromEntries(
	VIEW_OPTIONS.map((option) => [option.key, option.label]),
) as Record<ViewMode, string>;

/** The metadata view modes (every view mode except the hierarchical products view). */
export type MetadataViewMode = Exclude<ViewMode, "products">;

/**
 * Metadata view mode → the `PRODUCT_FIELD_OPTIONS`/metadata fieldKey it reads.
 * Drives the metadata list, the archive check in MetadataCard, and the
 * add-metadata fieldKey resolution.
 */
export const FIELD_KEY_FOR_VIEW_MODE: Record<MetadataViewMode, string> = {
	productTypes: "productType",
	manufacturerColors: "manufacturer_color",
	sparkysColors: "sparkys_color",
	manufacturers: "manufacturer",
	sizes: "size",
	textures: "texture",
	bagQuantities: "bagQuantity",
	shapes: "shape",
	distributors: "distributor",
	occasions: "occasion",
};

/**
 * Metadata view mode → the spreadsheet sheet that backs it. Sizes has no
 * writable sheet, so adding to it is rejected; its absence here is the rejection.
 */
export const SHEET_NAME_FOR_VIEW_MODE: Partial<
	Record<MetadataViewMode, string>
> = {
	productTypes: "product_types",
	manufacturerColors: "manufacturer_colors",
	sparkysColors: "sparkys_colors",
	manufacturers: "brands",
	textures: "textures",
	bagQuantities: "bag_quantities",
	shapes: "shapes",
	distributors: "distributors",
	occasions: "occasions",
};

/**
 * Resolve the writable sheet name for a metadata view mode, or null when the
 * category has no writable sheet (e.g. Sizes).
 */
export function getSheetNameForViewMode(
	viewMode: MetadataViewMode,
): string | null {
	return SHEET_NAME_FOR_VIEW_MODE[viewMode] ?? null;
}

/** Filter category (as used in the filter modal) → its display title. */
export const FILTER_CATEGORY_TITLES: Record<string, string> = {
	product_type: "Type",
	sparkys_color: "Sparky's Color",
	manufacturer_color: "Manufacturer Color",
	brand: "Brand",
	occasions: "Occasions",
	distributors: "Distributors",
	texture: "Texture",
	shape: "Shape",
	size: "Size",
};

/** Title for a filter category; every category rendered in the modal is mapped. */
export function formatCategoryTitle(category: string): string {
	return FILTER_CATEGORY_TITLES[category] ?? category;
}

/**
 * The internal filter sections rendered in the inventory filter modal, in order:
 * the filter key on `InternalFilters` and the metadata fieldKey whose options
 * populate the section.
 */
export const INTERNAL_FILTER_SECTIONS: {
	category: string;
	fieldKey: string;
}[] = [
	{ category: "product_type", fieldKey: "productType" },
	{ category: "sparkys_color", fieldKey: "sparkys_color" },
	{ category: "texture", fieldKey: "texture" },
	{ category: "shape", fieldKey: "shape" },
	{ category: "occasions", fieldKey: "occasion" },
];

/** The external filter sections rendered in the inventory filter modal, in order. */
export const EXTERNAL_FILTER_SECTIONS: {
	category: string;
	fieldKey: string;
}[] = [
	{ category: "manufacturer_color", fieldKey: "manufacturer_color" },
	{ category: "brand", fieldKey: "manufacturer" },
	{ category: "size", fieldKey: "size" },
	{ category: "distributors", fieldKey: "distributor" },
];
