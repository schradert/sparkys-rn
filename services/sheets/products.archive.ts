import { logger } from "@/services/logger";
import { logEvent } from "./audit";
import type { SheetsClient } from "./client";

/** Flip an internal product's status cell, logging an archive/unarchive event. */
async function setInternalProductStatus(
	client: SheetsClient,
	id: string,
	status: "archived" | "active",
	accessToken: string,
): Promise<void> {
	const currentData = await client.getSheetData(
		"internal_products",
		accessToken,
	);
	const rowNumber = await client.findRowByValue(
		"internal_products",
		"id",
		id,
		accessToken,
	);
	if (!rowNumber) {
		throw new Error(`Internal product with ID "${id}" not found`);
	}

	const currentRow = currentData[rowNumber - 1];
	const updatedRow = [...currentRow];
	updatedRow[10] = status; // status column

	await client.updateRow(
		"internal_products",
		rowNumber,
		updatedRow,
		accessToken,
	);
	const verb = status === "archived" ? "Archived" : "Unarchived";
	logger.debug("Sheets", `${verb} internal product: ${id}`);

	await logEvent(
		client,
		{
			timestamp: new Date().toISOString(),
			event_type: status === "archived" ? "archive" : "unarchive",
			object_type: "internal_product",
			object_id: id,
			object_name: currentRow[1] || id,
			changes: JSON.stringify({ status }),
			before_state: JSON.stringify({
				status: status === "archived" ? "active" : "archived",
			}),
			sheet_name: "internal_products",
		},
		accessToken,
	);
}

/** Archive an internal product by id. */
export function archiveInternalProduct(
	client: SheetsClient,
	id: string,
	accessToken: string,
): Promise<void> {
	return setInternalProductStatus(client, id, "archived", accessToken);
}

/** Unarchive an internal product by id. */
export function unarchiveInternalProduct(
	client: SheetsClient,
	id: string,
	accessToken: string,
): Promise<void> {
	return setInternalProductStatus(client, id, "active", accessToken);
}

/** Flip an external product's status cell, logging an archive/unarchive event. */
async function setExternalProductStatus(
	client: SheetsClient,
	sku: string,
	status: "archived" | "active",
	accessToken: string,
): Promise<void> {
	const currentData = await client.getSheetData(
		"external_products",
		accessToken,
	);
	const rowNumber = await client.findRowByValue(
		"external_products",
		"unique_id_sku",
		sku,
		accessToken,
	);
	if (!rowNumber) {
		throw new Error(`External product "${sku}" not found`);
	}

	const currentRow = currentData[rowNumber - 1];
	const updatedRow = [...currentRow];
	updatedRow[7] = status; // status column

	await client.updateRow(
		"external_products",
		rowNumber,
		updatedRow,
		accessToken,
	);
	const verb = status === "archived" ? "Archived" : "Unarchived";
	logger.debug("Sheets", `${verb} external product: ${sku}`);

	await logEvent(
		client,
		{
			timestamp: new Date().toISOString(),
			event_type: status === "archived" ? "archive" : "unarchive",
			object_type: "external_product",
			object_id: sku,
			object_name: sku,
			changes: JSON.stringify({ status }),
			before_state: JSON.stringify({
				status: status === "archived" ? "active" : "archived",
			}),
			sheet_name: "external_products",
		},
		accessToken,
	);
}

/** Archive an external product by SKU. */
export function archiveExternalProduct(
	client: SheetsClient,
	sku: string,
	accessToken: string,
): Promise<void> {
	return setExternalProductStatus(client, sku, "archived", accessToken);
}

/** Unarchive an external product by SKU. */
export function unarchiveExternalProduct(
	client: SheetsClient,
	sku: string,
	accessToken: string,
): Promise<void> {
	return setExternalProductStatus(client, sku, "active", accessToken);
}
