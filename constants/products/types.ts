/**
 * Core product domain models and the field-name lists that drive metadata-backed
 * editing. Internal products are Sparky's catalog entries; external products are
 * the manufacturer SKUs they roll up.
 */

/** Internal-product fields backed by editable metadata. */
export const INTERNAL_PRODUCT_FIELDS = [
	"product_type",
	"texture",
	"shape",
	"occasions",
	"sparkys_color",
] as const;

/** External-product fields backed by editable metadata. */
export const EXTERNAL_PRODUCT_FIELDS = [
	"manufacturer_color",
	"brand",
	"size",
	"bag_quantity",
	"distributors",
] as const;

/** One of the internal-product metadata field names. */
export type InternalProductField = (typeof INTERNAL_PRODUCT_FIELDS)[number];
/** One of the external-product metadata field names. */
export type ExternalProductField = (typeof EXTERNAL_PRODUCT_FIELDS)[number];

/** A Sparky's catalog product that rolls up one or more external SKUs. */
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

/** A manufacturer SKU (barcode-identified) tracked for stock. */
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
