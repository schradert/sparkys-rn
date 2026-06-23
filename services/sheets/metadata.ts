/** CRUD + archive for metadata sheets, with audit logging and rename cascade. */

import { logger } from "@/services/logger";
import { logEvent } from "./audit";
import type { SheetsClient } from "./client";
import { updateProductsWithMetadataChange } from "./metadata.cascade";

export { updateProductsWithMetadataChange } from "./metadata.cascade";

/** Read `{ name, status }` pairs from a metadata sheet, skipping blank names. */
export async function getMetadataValues(
	client: SheetsClient,
	sheetName: string,
	accessToken: string,
): Promise<Array<{ name: string; status: string }>> {
	const values = await client.getSheetData(sheetName, accessToken);

	if (values.length === 0) return [];

	const headerRow = values[0];
	const nameColumnIndex = headerRow.findIndex(
		(header) => header.toLowerCase() === "name",
	);
	const statusColumnIndex = headerRow.findIndex(
		(header) => header.toLowerCase() === "status",
	);

	if (nameColumnIndex === -1) {
		throw new Error(`No 'name' column found in ${sheetName} sheet`);
	}

	return values
		.slice(1)
		.map((row) => ({
			name: row[nameColumnIndex] || "",
			status:
				statusColumnIndex !== -1
					? row[statusColumnIndex] || "active"
					: "active",
		}))
		.filter((item) => item.name && item.name.trim() !== "");
}

/** Append a metadata item (auto-assigned id, active) and log a create event. */
export async function addMetadataItem(
	client: SheetsClient,
	sheetName: string,
	name: string,
	accessToken: string,
): Promise<void> {
	const nextId = await client.getNextId(sheetName, accessToken);
	const newRow = [name, nextId.toString(), "active"];

	await client.appendToSheet(sheetName, [newRow], accessToken);
	logger.debug(
		"Sheets",
		`Added metadata item: ${name} with id ${nextId} to ${sheetName}`,
	);

	// Log audit event
	await logEvent(
		client,
		{
			timestamp: new Date().toISOString(),
			event_type: "create",
			object_type: "metadata",
			object_id: nextId.toString(),
			object_name: name,
			changes: JSON.stringify({ name }),
			before_state: "",
			sheet_name: sheetName,
		},
		accessToken,
	);
}

/** Rename a metadata item, log the edit, and cascade into product sheets. */
export async function updateMetadataItem(
	client: SheetsClient,
	sheetName: string,
	oldName: string,
	newName: string,
	accessToken: string,
): Promise<void> {
	const rowNumber = await client.findRowByValue(
		sheetName,
		"name",
		oldName,
		accessToken,
	);
	if (!rowNumber) {
		throw new Error(`Metadata item "${oldName}" not found in ${sheetName}`);
	}

	// Get the existing row to preserve the ID
	const values = await client.getSheetData(sheetName, accessToken);
	const existingRow = values[rowNumber - 1]; // Convert to 0-based index
	const id = existingRow[1]; // ID is in second column

	// Update the metadata sheet (preserve status if it exists)
	const status = existingRow[2] || "active"; // status is in third column
	const updatedRow = [newName, id, status];
	await client.updateRow(sheetName, rowNumber, updatedRow, accessToken);
	logger.debug(
		"Sheets",
		`Updated metadata item from "${oldName}" to "${newName}" in ${sheetName}`,
	);

	// Log audit event
	await logEvent(
		client,
		{
			timestamp: new Date().toISOString(),
			event_type: "edit",
			object_type: "metadata",
			object_id: id,
			object_name: newName,
			changes: JSON.stringify({ name: newName }),
			before_state: JSON.stringify({ name: oldName }),
			sheet_name: sheetName,
		},
		accessToken,
	);

	// Update all products that use this metadata value
	await updateProductsWithMetadataChange(
		client,
		sheetName,
		oldName,
		newName,
		accessToken,
	);
}

/** Mark a metadata item archived (preserving id) and log an archive event. */
export async function archiveMetadataItem(
	client: SheetsClient,
	sheetName: string,
	name: string,
	accessToken: string,
): Promise<void> {
	const rowNumber = await client.findRowByValue(
		sheetName,
		"name",
		name,
		accessToken,
	);
	if (!rowNumber) {
		throw new Error(`Metadata item "${name}" not found in ${sheetName}`);
	}

	// Get the existing row to preserve the ID
	const values = await client.getSheetData(sheetName, accessToken);
	const existingRow = values[rowNumber - 1]; // Convert to 0-based index
	const id = existingRow[1]; // ID is in second column

	// Update the metadata sheet with archived status
	const updatedRow = [name, id, "archived"];
	await client.updateRow(sheetName, rowNumber, updatedRow, accessToken);
	logger.debug("Sheets", `Archived metadata item "${name}" in ${sheetName}`);

	// Log audit event
	await logEvent(
		client,
		{
			timestamp: new Date().toISOString(),
			event_type: "archive",
			object_type: "metadata",
			object_id: id,
			object_name: name,
			changes: JSON.stringify({ status: "archived" }),
			before_state: JSON.stringify({ status: "active" }),
			sheet_name: sheetName,
		},
		accessToken,
	);
}

/** Mark a metadata item active (preserving id) and log an unarchive event. */
export async function unarchiveMetadataItem(
	client: SheetsClient,
	sheetName: string,
	name: string,
	accessToken: string,
): Promise<void> {
	const rowNumber = await client.findRowByValue(
		sheetName,
		"name",
		name,
		accessToken,
	);
	if (!rowNumber) {
		throw new Error(`Metadata item "${name}" not found in ${sheetName}`);
	}

	// Get the existing row to preserve the ID
	const values = await client.getSheetData(sheetName, accessToken);
	const existingRow = values[rowNumber - 1]; // Convert to 0-based index
	const id = existingRow[1]; // ID is in second column

	// Update the metadata sheet with active status
	const updatedRow = [name, id, "active"];
	await client.updateRow(sheetName, rowNumber, updatedRow, accessToken);
	logger.debug("Sheets", `Unarchived metadata item "${name}" in ${sheetName}`);

	// Log audit event
	await logEvent(
		client,
		{
			timestamp: new Date().toISOString(),
			event_type: "unarchive",
			object_type: "metadata",
			object_id: id,
			object_name: name,
			changes: JSON.stringify({ status: "active" }),
			before_state: JSON.stringify({ status: "archived" }),
			sheet_name: sheetName,
		},
		accessToken,
	);
}
