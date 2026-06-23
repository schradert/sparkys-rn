import * as v from "valibot";

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
