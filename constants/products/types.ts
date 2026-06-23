// Updated field options that include the new color fields
export const INTERNAL_PRODUCT_FIELDS = [
	"product_type",
	"texture",
	"shape",
	"occasions",
	"sparkys_color",
] as const;

export const EXTERNAL_PRODUCT_FIELDS = [
	"manufacturer_color",
	"brand",
	"size",
	"bag_quantity",
	"distributors",
] as const;

export type InternalProductField = (typeof INTERNAL_PRODUCT_FIELDS)[number];
export type ExternalProductField = (typeof EXTERNAL_PRODUCT_FIELDS)[number];

export interface InternalProduct {
	id: string; // unique identifier
	sparkys_product_name: string;
	product_type: string;
	sparkys_color: string;
	texture: string;
	shape: string;
	occasions: string[]; // multiple occasions
	products: string[]; // comma-separated list of barcodes
	threshold_quantity: number; // minimum stock threshold
	never_out: boolean; // high priority marking for understocked items
	status?: "active" | "archived"; // archive status
}

export interface ExternalProduct {
	unique_id_sku: string; // barcode - unique identifier
	manufacturer_color: string;
	brand: string;
	size: string;
	bag_quantity: number;
	distributors: string[]; // multiple distributors
	quantity: number;
	status?: "active" | "archived"; // archive status
}
