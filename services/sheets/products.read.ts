import type {
	ExternalProductSheet,
	InternalProductSheet,
} from "@/constants/Products";
import { logger } from "@/services/logger";
import type { SheetsClient } from "./client";

/** Parse the `internal_products` sheet into typed rows, skipping blank ids. */
export async function getInternalProductData(
	client: SheetsClient,
	accessToken: string,
): Promise<InternalProductSheet[]> {
	logger.debug("Sheets", "Fetching internal_products sheet...");
	const data = await client.getSheetData("internal_products", accessToken);
	logger.debug("Sheets", "Internal products sheet data:", data);
	if (!data || data.length < 2) {
		logger.debug(
			"Sheets",
			"No internal products data found or insufficient rows",
		);
		return [];
	}

	const values = data;

	const products: InternalProductSheet[] = [];

	// Header: id, sparkys_product_name, product_type, sparkys_color, texture, shape, occasions, products, threshold_quantity, never_out, status
	for (let i = 1; i < values.length; i++) {
		const row = values[i];
		if (!row[0] || row[0].trim() === "") continue;

		const product: InternalProductSheet = {
			id: row[0],
			sparkys_product_name: row[1] || "",
			product_type: row[2] || "",
			sparkys_color: row[3] || "",
			texture: row[4] || "",
			shape: row[5] || "",
			occasions: row[6] || "", // comma-separated
			products: row[7] || "", // comma-separated barcodes
			threshold_quantity: parseInt(row[8] || "0", 10), // Parse as integer
			never_out: row[9] === "TRUE", // Parse boolean
			status: (row[10] || "active") as InternalProductSheet["status"], // status field
		};
		logger.debug("Sheets", "Parsed internal product:", product);

		products.push(product);
	}

	logger.debug("Sheets", `Returning ${products.length} internal products`);
	return products;
}

/** Parse the `external_products` sheet into typed rows, skipping blank ids. */
export async function getExternalProductData(
	client: SheetsClient,
	accessToken: string,
): Promise<ExternalProductSheet[]> {
	logger.debug("Sheets", "Fetching external_products sheet...");
	const data = await client.getSheetData("external_products", accessToken);
	logger.debug("Sheets", "External products sheet data:", data);
	if (!data || data.length < 2) {
		logger.debug(
			"Sheets",
			"No external products data found or insufficient rows",
		);
		return [];
	}

	const values = data;

	const products: ExternalProductSheet[] = [];

	// Header: unique_id_sku, manufacturer_color, brand, size, bag_quantity, distributors, quantity
	for (let i = 1; i < values.length; i++) {
		const row = values[i];
		if (!row[0] || row[0].trim() === "") continue;

		const product: ExternalProductSheet = {
			unique_id_sku: row[0],
			manufacturer_color: row[1] || "",
			brand: row[2] || "",
			size: row[3] || "",
			bag_quantity: parseInt(row[4] || "0", 10),
			distributors: row[5] || "", // comma-separated
			quantity: parseInt(row[6] || "0", 10),
			status: (row[7] || "active") as ExternalProductSheet["status"], // status field
		};
		logger.debug("Sheets", "Parsed external product:", product);

		products.push(product);
	}

	logger.debug("Sheets", `Returning ${products.length} external products`);
	return products;
}
