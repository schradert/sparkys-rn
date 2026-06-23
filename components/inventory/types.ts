/**
 * Shared types for the inventory screen and its extracted pieces. The view
 * modes, the per-product-kind filter shapes, and the add-form state all live
 * here so the screen shell, the modals, and the view-model hook agree on shapes.
 */

/** The inventory list mode: the hierarchical products view or a metadata category. */
export type ViewMode =
	| "products" // Internal products (hierarchical view)
	| "productTypes"
	| "manufacturerColors"
	| "sparkysColors"
	| "manufacturers"
	| "sizes"
	| "textures"
	| "bagQuantities"
	| "shapes"
	| "distributors"
	| "occasions";

/** Active filter selections for internal products, including the boolean toggles. */
export type InternalFilters = {
	product_type: string[];
	texture: string[];
	shape: string[];
	occasions: string[];
	sparkys_color: string[];
	understocked: boolean;
	showArchived: boolean;
};

/** Active filter selections for external products. */
export type ExternalFilters = {
	manufacturer_color: string[];
	brand: string[];
	size: string[];
	distributors: string[];
	showArchived: boolean;
};

/** Multi-select (array-valued) internal filter keys, excluding boolean toggles. */
export type InternalArrayFilterKey =
	| "product_type"
	| "texture"
	| "shape"
	| "occasions"
	| "sparkys_color";
/** Multi-select (array-valued) external filter keys, excluding boolean toggles. */
export type ExternalArrayFilterKey =
	| "manufacturer_color"
	| "brand"
	| "size"
	| "distributors";

/** Working draft of the internal-product add form. */
export type NewInternalProduct = {
	id: string;
	sparkys_product_name: string;
	product_type: string;
	sparkys_color: string;
	texture: string;
	shape: string;
	occasions: string[];
	products: string[];
	threshold_quantity: number;
	never_out: boolean;
};

/** Working draft of the external-product add form. */
export type NewExternalProduct = {
	unique_id_sku: string;
	manufacturer_color: string;
	brand: string;
	size: string;
	bag_quantity: number;
	distributors: string[];
	quantity: number;
	assigned_internal_product: string;
};

/** Initial internal filter state: nothing selected, toggles off. */
export const defaultInternalFilters: InternalFilters = {
	product_type: [],
	texture: [],
	shape: [],
	occasions: [],
	sparkys_color: [],
	understocked: false,
	showArchived: false,
};

/** Initial external filter state: nothing selected, archived hidden. */
export const defaultExternalFilters: ExternalFilters = {
	manufacturer_color: [],
	brand: [],
	size: [],
	distributors: [],
	showArchived: false,
};

/** Blank internal-product form draft used to reset the add flow. */
export const emptyNewInternalProduct: NewInternalProduct = {
	id: "",
	sparkys_product_name: "",
	product_type: "",
	sparkys_color: "",
	texture: "",
	shape: "",
	occasions: [],
	products: [],
	threshold_quantity: 0,
	never_out: false,
};

/** Blank external-product form draft (defaults bag quantity to 50). */
export const emptyNewExternalProduct: NewExternalProduct = {
	unique_id_sku: "",
	manufacturer_color: "",
	brand: "",
	size: "",
	bag_quantity: 50,
	distributors: [],
	quantity: 0,
	assigned_internal_product: "",
};
