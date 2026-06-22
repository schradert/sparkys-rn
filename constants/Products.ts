import * as v from "valibot";

export const DEFAULT_FIELD_OPTIONS = {
	productType: [
		"Latex Balloons",
		"Foil Balloons",
		"Bubble Balloons",
		"Modeling Balloons",
	],
	// Separate color fields for internal vs external products
	manufacturer_color: [
		"Flaming Red",
		"Ocean Blue",
		"Rose Pink",
		"Metallic Gold",
		"Chrome Silver",
		"Forest Green",
		"Royal Purple",
		"Sunset Orange",
		"Jet Black",
		"Pearl White",
	],
	sparkys_color: [
		"Red",
		"Blue",
		"Pink",
		"Gold",
		"Silver",
		"Green",
		"Purple",
		"Orange",
		"Black",
		"White",
	],
	manufacturer: ["Qualatex", "Anagram", "Betallic", "CTI", "Convergram"],
	size: ['9"', '11"', '16"', '18"', '36"', '40"'],
	texture: ["Matte", "Pearl", "Chrome", "Metallic", "Transparent"],
	bagQuantity: ["50", "100", "20"],
	shape: ["Round", "Heart", "Star"],
	distributor: ["Default Distributor"],
	occasion: [
		"Birthday",
		"Wedding",
		"Baby Shower",
		"Anniversary",
		"Graduation",
		"Holiday",
	],
} as const;

export let PRODUCT_FIELD_OPTIONS = { ...DEFAULT_FIELD_OPTIONS };

// Archive management for metadata items
export const ARCHIVED_METADATA_ITEMS: Record<string, string[]> = {
	productType: [],
	manufacturer_color: [],
	sparkys_color: [],
	manufacturer: [],
	size: [],
	texture: [],
	bagQuantity: [],
	shape: [],
	distributor: [],
	occasion: [],
};

type FieldOptionInput = string | { name: string };

export function updateFieldOptions(
	newOptions: Record<string, FieldOptionInput[]>,
) {
	// Convert metadata objects to strings for existing compatibility
	const convertedOptions: Record<string, string[]> = {};
	for (const [key, items] of Object.entries(newOptions)) {
		convertedOptions[key] = items.map((item) =>
			typeof item === "object" ? item.name : item,
		);
	}
	PRODUCT_FIELD_OPTIONS = { ...PRODUCT_FIELD_OPTIONS, ...convertedOptions };
}

// Metadata storage with status
let METADATA_ITEMS: Record<
	string,
	Array<{ name: string; status: string }>
> = {};

export function updateMetadataItems(
	metadata: Record<string, Array<{ name: string; status: string }>>,
) {
	METADATA_ITEMS = { ...metadata };
}

export function getMetadataItems(
	fieldKey: string,
	includeArchived: boolean = false,
): Array<{ name: string; status: string }> {
	const items = METADATA_ITEMS[fieldKey] || [];
	return includeArchived
		? items
		: items.filter((item) => item.status === "active");
}

export function isMetadataItemArchived(
	fieldKey: string,
	value: string,
): boolean {
	const items = METADATA_ITEMS[fieldKey] || [];
	const item = items.find((item) => item.name === value);
	return item?.status === "archived" || false;
}

export function getAllMetadataItems(
	fieldKey: string,
	includeArchived: boolean = false,
): string[] {
	const activeItems: readonly string[] =
		PRODUCT_FIELD_OPTIONS[fieldKey as keyof typeof PRODUCT_FIELD_OPTIONS] ?? [];
	if (!includeArchived) {
		return [...activeItems];
	}
	const archivedItems = getMetadataItems(fieldKey, true)
		.filter((item) => item.status === "archived")
		.map((item) => item.name);
	return [...activeItems, ...archivedItems];
}

// Archive/unarchive product functions
export function archiveInternalProduct(
	productName: string,
	products: InternalProduct[],
): InternalProduct[] {
	return products.map((product) =>
		product.sparkys_product_name === productName
			? { ...product, status: "archived" as const }
			: product,
	);
}

export function unarchiveInternalProduct(
	productName: string,
	products: InternalProduct[],
): InternalProduct[] {
	return products.map((product) =>
		product.sparkys_product_name === productName
			? { ...product, status: "active" as const }
			: product,
	);
}

export function archiveExternalProduct(
	sku: string,
	products: ExternalProduct[],
): ExternalProduct[] {
	return products.map((product) =>
		product.unique_id_sku === sku
			? { ...product, status: "archived" as const }
			: product,
	);
}

export function unarchiveExternalProduct(
	sku: string,
	products: ExternalProduct[],
): ExternalProduct[] {
	return products.map((product) =>
		product.unique_id_sku === sku
			? { ...product, status: "active" as const }
			: product,
	);
}

export function isInternalProductArchived(
	productName: string,
	products: InternalProduct[],
): boolean {
	const product = products.find((p) => p.sparkys_product_name === productName);
	return product?.status === "archived";
}

export function isExternalProductArchived(
	sku: string,
	products: ExternalProduct[],
): boolean {
	const product = products.find((p) => p.unique_id_sku === sku);
	return product?.status === "archived";
}

export type FieldOptions = typeof PRODUCT_FIELD_OPTIONS;
export type Field = keyof FieldOptions;
export type FieldFilters = {
	[K in Field]: string[];
};

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

// Spreadsheet representations with comma-separated arrays.
// valibot schemas are the source of truth; the row types are inferred from
// them, and raw Google Sheets rows are validated at the boundary via the
// safeParse* helpers below.
const SheetStatusSchema = v.optional(v.picklist(["active", "archived"]));

export const InternalProductSheetSchema = v.object({
	id: v.string(),
	sparkys_product_name: v.string(),
	product_type: v.string(),
	sparkys_color: v.string(),
	texture: v.string(),
	shape: v.string(),
	occasions: v.string(), // comma-separated
	products: v.string(), // comma-separated barcodes
	threshold_quantity: v.number(),
	never_out: v.boolean(),
	status: SheetStatusSchema,
});

export const ExternalProductSheetSchema = v.object({
	unique_id_sku: v.string(),
	manufacturer_color: v.string(),
	brand: v.string(),
	size: v.string(),
	bag_quantity: v.number(),
	distributors: v.string(), // comma-separated
	quantity: v.number(),
	status: SheetStatusSchema,
});

export type InternalProductSheet = v.InferOutput<
	typeof InternalProductSheetSchema
>;
export type ExternalProductSheet = v.InferOutput<
	typeof ExternalProductSheetSchema
>;

// Boundary validation helpers — validate untrusted Google Sheets rows.
export function safeParseInternalProductSheet(raw: unknown) {
	return v.safeParse(InternalProductSheetSchema, raw);
}

export function safeParseExternalProductSheet(raw: unknown) {
	return v.safeParse(ExternalProductSheetSchema, raw);
}

// Model schema for the editable internal product (react-hook-form resolver).
// Inferred output matches the InternalProduct interface above; the refinements
// add form validation (required name, non-negative threshold).
export const InternalProductSchema = v.object({
	id: v.string(),
	sparkys_product_name: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(1, "Product name is required"),
	),
	product_type: v.string(),
	sparkys_color: v.string(),
	texture: v.string(),
	shape: v.string(),
	occasions: v.array(v.string()),
	products: v.array(v.string()),
	threshold_quantity: v.pipe(v.number(), v.minValue(0, "Must be 0 or more")),
	never_out: v.boolean(),
	status: SheetStatusSchema,
});

// Utility functions for parsing comma-separated values
export function parseCommaSeparated(value: string): string[] {
	if (!value || value.trim() === "") return [];
	return value.split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
}

export function formatCommaSeparated(values: string[]): string {
	return values
		.map((value) => (value.includes(",") ? `"${value}"` : value))
		.join(",");
}

// Convert between sheet and app models
export function convertInternalProductSheetToModel(
	sheet: InternalProductSheet,
): InternalProduct {
	if (!safeParseInternalProductSheet(sheet).success) {
		console.warn("Invalid internal product sheet row", sheet);
	}
	return {
		id: sheet.id,
		sparkys_product_name: sheet.sparkys_product_name,
		product_type: sheet.product_type,
		sparkys_color: sheet.sparkys_color,
		texture: sheet.texture,
		shape: sheet.shape,
		occasions: parseCommaSeparated(sheet.occasions),
		products: parseCommaSeparated(sheet.products),
		threshold_quantity: sheet.threshold_quantity,
		never_out: sheet.never_out || false, // Default to false if not specified
		status: sheet.status || "active", // Default to "active" if not specified
	};
}

export function convertInternalProductModelToSheet(
	internal: InternalProduct,
): InternalProductSheet {
	return {
		id: internal.id,
		sparkys_product_name: internal.sparkys_product_name,
		product_type: internal.product_type,
		sparkys_color: internal.sparkys_color,
		texture: internal.texture,
		shape: internal.shape,
		occasions: formatCommaSeparated(internal.occasions),
		products: formatCommaSeparated(internal.products),
		threshold_quantity: internal.threshold_quantity,
		never_out: internal.never_out || false, // Default to false if not specified
		status: internal.status || "active", // Default to "active" if not specified
	};
}

export function convertExternalProductSheetToModel(
	sheet: ExternalProductSheet,
): ExternalProduct {
	if (!safeParseExternalProductSheet(sheet).success) {
		console.warn("Invalid external product sheet row", sheet);
	}
	return {
		unique_id_sku: sheet.unique_id_sku,
		manufacturer_color: sheet.manufacturer_color,
		brand: sheet.brand,
		size: sheet.size,
		bag_quantity: sheet.bag_quantity,
		distributors: parseCommaSeparated(sheet.distributors),
		quantity: sheet.quantity,
		status: sheet.status || "active", // Default to "active" if not specified
	};
}

export function convertExternalProductModelToSheet(
	external: ExternalProduct,
): ExternalProductSheet {
	return {
		unique_id_sku: external.unique_id_sku,
		manufacturer_color: external.manufacturer_color,
		brand: external.brand,
		size: external.size,
		bag_quantity: external.bag_quantity,
		distributors: formatCommaSeparated(external.distributors),
		quantity: external.quantity,
		status: external.status || "active", // Default to "active" if not specified
	};
}

export function getInternalProductTotalQuantity(
	internalProduct: InternalProduct,
	externalProducts: ExternalProduct[],
): number {
	return externalProducts
		.filter((ext) => internalProduct.products.includes(ext.unique_id_sku))
		.reduce((total, ext) => total + ext.quantity, 0);
}

// Helper to get external products for an internal product
export function getExternalProductsForInternal(
	internalProduct: InternalProduct,
	externalProducts: ExternalProduct[],
): ExternalProduct[] {
	return externalProducts.filter((ext) =>
		internalProduct.products.includes(ext.unique_id_sku),
	);
}

// Helper to get quantity color based on threshold
export function getQuantityColor(
	quantity: number,
	thresholdQuantity: number,
): "red" | "blue" | "green" {
	if (quantity < thresholdQuantity) {
		return "red";
	} else if (quantity <= thresholdQuantity * 1.25) {
		return "blue";
	} else {
		return "green";
	}
}
