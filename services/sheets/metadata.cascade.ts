import { logger } from "@/services/logger";
import type { SheetsClient } from "./client";

/** Cascade a metadata rename through every product sheet that references it. */
export async function updateProductsWithMetadataChange(
	client: SheetsClient,
	metadataSheetName: string,
	oldValue: string,
	newValue: string,
	accessToken: string,
): Promise<void> {
	logger.debug(
		"Sheets",
		`DEBUG: Starting cascade update for ${metadataSheetName}: "${oldValue}" -> "${newValue}"`,
	);

	// Determine which product sheets need updating based on metadata type
	const sheetsToUpdate = getProductSheetsForMetadata(metadataSheetName);
	if (sheetsToUpdate.length === 0) {
		logger.debug(
			"Sheets",
			`No product sheets to update for metadata sheet: ${metadataSheetName}`,
		);
		return;
	}

	// Update each relevant product sheet
	for (const sheetInfo of sheetsToUpdate) {
		await updateProductSheetWithMetadataChange(
			client,
			sheetInfo.sheetName,
			sheetInfo.columnName,
			oldValue,
			newValue,
			accessToken,
		);
	}
}

/** Map a metadata sheet to the product sheet/column(s) that mirror its values. */
export function getProductSheetsForMetadata(metadataSheetName: string): Array<{
	sheetName: string;
	columnName: string;
}> {
	switch (metadataSheetName) {
		case "product_types":
			return [{ sheetName: "internal_products", columnName: "product_type" }];
		case "sparkys_colors":
			return [{ sheetName: "internal_products", columnName: "sparkys_color" }];
		case "textures":
			return [{ sheetName: "internal_products", columnName: "texture" }];
		case "shapes":
			return [{ sheetName: "internal_products", columnName: "shape" }];
		case "occasions":
			return [{ sheetName: "internal_products", columnName: "occasions" }];
		case "manufacturer_colors":
			return [
				{ sheetName: "external_products", columnName: "manufacturer_color" },
			];
		case "brands":
			return [{ sheetName: "external_products", columnName: "brand" }];
		case "bag_quantities":
			return [{ sheetName: "external_products", columnName: "bag_quantity" }];
		case "distributors":
			return [{ sheetName: "external_products", columnName: "distributors" }];
		default:
			return [];
	}
}

/** Rewrite a single product sheet column, honoring comma-separated fields. */
export async function updateProductSheetWithMetadataChange(
	client: SheetsClient,
	sheetName: string,
	columnName: string,
	oldValue: string,
	newValue: string,
	accessToken: string,
): Promise<void> {
	logger.debug(
		"Sheets",
		`DEBUG: Updating ${sheetName} sheet, column ${columnName}`,
	);

	const products = await client.getSheetData(sheetName, accessToken);
	if (products.length === 0) {
		logger.debug("Sheets", `DEBUG: No products found in ${sheetName}`);
		return;
	}

	const headerRow = products[0];
	const columnIndex = headerRow.findIndex(
		(header) => header.toLowerCase() === columnName.toLowerCase(),
	);

	if (columnIndex === -1) {
		logger.debug(
			"Sheets",
			`DEBUG: Column ${columnName} not found in ${sheetName}. Available columns:`,
			headerRow,
		);
		return;
	}

	// Find all products that need updating
	const rowsToUpdate: { rowNumber: number; values: string[] }[] = [];

	for (let i = 1; i < products.length; i++) {
		const row = products[i];
		const currentValue = row[columnIndex];

		// Handle comma-separated values (for occasions, distributors)
		if (columnName === "occasions" || columnName === "distributors") {
			const values = currentValue
				? currentValue.split(",").map((v) => v.trim())
				: [];
			if (values.includes(oldValue)) {
				const updatedValues = values.map((v) =>
					v === oldValue ? newValue : v,
				);
				const updatedRow = [...row];
				updatedRow[columnIndex] = updatedValues.join(", ");
				rowsToUpdate.push({
					rowNumber: i + 1,
					values: updatedRow,
				});
			}
		} else if (currentValue === oldValue) {
			const updatedRow = [...row];
			updatedRow[columnIndex] = newValue;
			rowsToUpdate.push({
				rowNumber: i + 1,
				values: updatedRow,
			});
		}
	}

	logger.debug(
		"Sheets",
		`DEBUG: Found ${rowsToUpdate.length} products to update in ${sheetName}`,
	);

	// Update all rows that need changing
	for (const update of rowsToUpdate) {
		await client.updateRow(
			sheetName,
			update.rowNumber,
			update.values,
			accessToken,
		);
	}

	logger.debug(
		"Sheets",
		`Updated ${rowsToUpdate.length} products in ${sheetName} with metadata change from "${oldValue}" to "${newValue}"`,
	);
}
