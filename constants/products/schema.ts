/**
 * valibot schemas for the flat sheet representations of products (multi-value
 * fields stored as comma-separated strings). The schemas are the source of
 * truth: row types are inferred from them, and raw Google Sheets rows are
 * validated at the boundary via the `safeParse*` helpers below.
 */

import * as v from "valibot";

const SheetStatusSchema = v.optional(v.picklist(["active", "archived"]));

/** Schema for an internal-product sheet row. */
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

/** Schema for an external-product sheet row. */
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

/** An internal-product row, inferred from its schema. */
export type InternalProductSheet = v.InferOutput<
	typeof InternalProductSheetSchema
>;
/** An external-product row, inferred from its schema. */
export type ExternalProductSheet = v.InferOutput<
	typeof ExternalProductSheetSchema
>;

/** Validate an untrusted internal-product sheet row. */
export function safeParseInternalProductSheet(raw: unknown) {
	return v.safeParse(InternalProductSheetSchema, raw);
}

/** Validate an untrusted external-product sheet row. */
export function safeParseExternalProductSheet(raw: unknown) {
	return v.safeParse(ExternalProductSheetSchema, raw);
}
