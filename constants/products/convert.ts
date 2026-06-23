import { logger } from "@/services/logger";
import {
	type ExternalProductSheet,
	type InternalProductSheet,
	safeParseExternalProductSheet,
	safeParseInternalProductSheet,
} from "./schema";
/**
 * Maps between the flat, string-typed sheet rows and the app's product models.
 * Multi-value fields (occasions, distributors, products) are stored as
 * comma-separated strings on the sheet and parsed into arrays for the app.
 */

import type { ExternalProduct, InternalProduct } from "./types";

/** Split a comma-separated cell into trimmed, unquoted items ([] when empty). */
export function parseCommaSeparated(value: string): string[] {
	if (!value || value.trim() === "") return [];
	return value.split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
}

/** Join items into a comma-separated cell, quoting any that contain a comma. */
export function formatCommaSeparated(values: string[]): string {
	return values
		.map((value) => (value.includes(",") ? `"${value}"` : value))
		.join(",");
}

/** Build the app's internal-product model from a sheet row (warns if invalid). */
export function convertInternalProductSheetToModel(
	sheet: InternalProductSheet,
): InternalProduct {
	if (!safeParseInternalProductSheet(sheet).success) {
		logger.warn("Products", "Invalid internal product sheet row", { sheet });
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

/** Flatten an internal-product model back into a sheet row for persistence. */
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

/** Build the app's external-product model from a sheet row (warns if invalid). */
export function convertExternalProductSheetToModel(
	sheet: ExternalProductSheet,
): ExternalProduct {
	if (!safeParseExternalProductSheet(sheet).success) {
		logger.warn("Products", "Invalid external product sheet row", { sheet });
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

/** Flatten an external-product model back into a sheet row for persistence. */
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
