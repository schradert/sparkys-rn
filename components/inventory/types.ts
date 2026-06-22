/**
 * Shared types for the inventory screen and its extracted pieces. The view
 * modes, the per-product-kind filter shapes, and the add-form state all live
 * here so the screen shell, the modals, and the view-model hook agree on shapes.
 */

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

// Filter types for internal and external products
export type InternalFilters = {
	product_type: string[];
	texture: string[];
	shape: string[];
	occasions: string[];
	sparkys_color: string[];
	understocked: boolean;
	showArchived: boolean;
};

export type ExternalFilters = {
	manufacturer_color: string[];
	brand: string[];
	size: string[];
	distributors: string[];
	showArchived: boolean;
};

// Array-valued (multi-select) filter keys, excluding the boolean toggles.
export type InternalArrayFilterKey =
	| "product_type"
	| "texture"
	| "shape"
	| "occasions"
	| "sparkys_color";
export type ExternalArrayFilterKey =
	| "manufacturer_color"
	| "brand"
	| "size"
	| "distributors";

// Working copy of the internal-product add form.
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

// Working copy of the external-product add form.
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

export const defaultInternalFilters: InternalFilters = {
	product_type: [],
	texture: [],
	shape: [],
	occasions: [],
	sparkys_color: [],
	understocked: false,
	showArchived: false,
};

export const defaultExternalFilters: ExternalFilters = {
	manufacturer_color: [],
	brand: [],
	size: [],
	distributors: [],
	showArchived: false,
};

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
