/** Create + update for external products, with per-dimension audit diffing. */

import type { ExternalProductSheet } from "@/constants/Products";
import { logger } from "@/services/logger";
import { logEvent } from "./audit";
import type { SheetsClient } from "./client";

/** Append an external product row and log a create event. */
export async function addExternalProduct(
	client: SheetsClient,
	product: ExternalProductSheet,
	accessToken: string,
): Promise<void> {
	const newRow = [
		product.unique_id_sku,
		product.manufacturer_color,
		product.brand,
		product.size,
		product.bag_quantity.toString(),
		product.distributors,
		product.quantity.toString(),
		product.status || "active",
	];

	await client.appendToSheet("external_products", [newRow], accessToken);
	logger.debug(
		"Sheets",
		`Added external product: ${product.unique_id_sku} to external_products sheet`,
	);

	// Log audit event
	await logEvent(
		client,
		{
			timestamp: new Date().toISOString(),
			event_type: "create",
			object_type: "external_product",
			object_id: product.unique_id_sku,
			object_name: product.unique_id_sku,
			changes: JSON.stringify(product),
			before_state: "",
			sheet_name: "external_products",
		},
		accessToken,
	);
}

/** Capture the persisted external-product row as a before-state snapshot. */
function captureExternalBeforeState(
	currentRow: string[],
): Record<string, unknown> {
	return {
		unique_id_sku: currentRow[0] || "",
		manufacturer_color: currentRow[1] || "",
		brand: currentRow[2] || "",
		size: currentRow[3] || "",
		bag_quantity: parseInt(currentRow[4] || "0", 10),
		distributors: currentRow[5] || "",
		quantity: parseInt(currentRow[6] || "0", 10),
		status: currentRow[7] || "active",
	};
}

/** Categorized diff of an external product: quantity, status, and other fields. */
interface ExternalDiff {
	changes: Record<string, unknown>;
	before: Record<string, unknown>;
	fieldChanges: Record<string, unknown>;
	fieldBefore: Record<string, unknown>;
	hasQuantityChange: boolean;
	hasStatusChange: boolean;
	hasOtherChanges: boolean;
}

/**
 * Diff an external product against its before-state, splitting changes into the
 * three audit dimensions: quantity, status (archive/unarchive), and other
 * fields. `fieldChanges` mirrors `hasOtherChanges`, so callers can emit an edit
 * event whenever `hasOtherChanges` is set without re-stripping quantity/status.
 */
function diffExternalProduct(
	beforeState: Record<string, unknown>,
	product: ExternalProductSheet,
): ExternalDiff {
	const changes: Record<string, unknown> = {};
	const before: Record<string, unknown> = {};
	const fieldChanges: Record<string, unknown> = {};
	const fieldBefore: Record<string, unknown> = {};

	let hasQuantityChange = false;
	let hasStatusChange = false;
	let hasOtherChanges = false;

	// Check for quantity changes
	if (beforeState.quantity !== product.quantity) {
		hasQuantityChange = true;
		changes.quantity = product.quantity;
		before.quantity = beforeState.quantity;
	}

	// Check for status changes (archive/unarchive)
	if (beforeState.status !== (product.status || "active")) {
		hasStatusChange = true;
		changes.status = product.status || "active";
		before.status = beforeState.status;
	}

	// Check for other field changes
	const otherFields: Array<keyof ExternalProductSheet> = [
		"manufacturer_color",
		"brand",
		"size",
		"bag_quantity",
		"distributors",
	];
	for (const field of otherFields) {
		if (beforeState[field] !== product[field]) {
			hasOtherChanges = true;
			changes[field] = product[field];
			before[field] = beforeState[field];
			fieldChanges[field] = product[field];
			fieldBefore[field] = beforeState[field];
		}
	}

	return {
		changes,
		before,
		fieldChanges,
		fieldBefore,
		hasQuantityChange,
		hasStatusChange,
		hasOtherChanges,
	};
}

/** Emit a status (archive/unarchive) audit event for an external product. */
function logExternalStatusEvent(
	client: SheetsClient,
	product: ExternalProductSheet,
	diff: ExternalDiff,
	accessToken: string,
): Promise<void> {
	const eventType =
		(product.status || "active") === "archived" ? "archive" : "unarchive";
	return logEvent(
		client,
		{
			timestamp: new Date().toISOString(),
			event_type: eventType,
			object_type: "external_product",
			object_id: product.unique_id_sku,
			object_name: product.unique_id_sku,
			changes: JSON.stringify({ status: diff.changes.status }),
			before_state: JSON.stringify({ status: diff.before.status }),
			sheet_name: "external_products",
		},
		accessToken,
	);
}

/** Emit a quantity_update audit event for an external product. */
function logExternalQuantityEvent(
	client: SheetsClient,
	product: ExternalProductSheet,
	diff: ExternalDiff,
	accessToken: string,
): Promise<void> {
	return logEvent(
		client,
		{
			timestamp: new Date().toISOString(),
			event_type: "quantity_update",
			object_type: "external_product",
			object_id: product.unique_id_sku,
			object_name: product.unique_id_sku,
			changes: JSON.stringify({ quantity: diff.changes.quantity }),
			before_state: JSON.stringify({ quantity: diff.before.quantity }),
			sheet_name: "external_products",
		},
		accessToken,
	);
}

/** Emit an edit audit event for an external product's non-quantity/status fields. */
function logExternalEditEvent(
	client: SheetsClient,
	product: ExternalProductSheet,
	diff: ExternalDiff,
	accessToken: string,
): Promise<void> {
	return logEvent(
		client,
		{
			timestamp: new Date().toISOString(),
			event_type: "edit",
			object_type: "external_product",
			object_id: product.unique_id_sku,
			object_name: product.unique_id_sku,
			changes: JSON.stringify(diff.fieldChanges),
			before_state: JSON.stringify(diff.fieldBefore),
			sheet_name: "external_products",
		},
		accessToken,
	);
}

/**
 * Translate an external-product diff into audit events. A change isolated to a
 * single dimension yields one event; a mixed change yields one event per
 * affected dimension (status, then quantity, then fields).
 */
async function logExternalProductChanges(
	client: SheetsClient,
	product: ExternalProductSheet,
	diff: ExternalDiff,
	accessToken: string,
): Promise<void> {
	const { hasQuantityChange, hasStatusChange, hasOtherChanges } = diff;

	if (hasStatusChange && !hasQuantityChange && !hasOtherChanges) {
		// Pure archive/unarchive
		await logExternalStatusEvent(client, product, diff, accessToken);
	} else if (hasQuantityChange && !hasStatusChange && !hasOtherChanges) {
		// Pure quantity update
		await logExternalQuantityEvent(client, product, diff, accessToken);
	} else if (hasOtherChanges && !hasStatusChange && !hasQuantityChange) {
		// Pure field update
		await logExternalEditEvent(client, product, diff, accessToken);
	} else {
		// Mixed update - log one event per affected dimension
		if (hasStatusChange) {
			await logExternalStatusEvent(client, product, diff, accessToken);
		}
		if (hasQuantityChange) {
			await logExternalQuantityEvent(client, product, diff, accessToken);
		}
		if (hasOtherChanges) {
			await logExternalEditEvent(client, product, diff, accessToken);
		}
	}
}

/** Update an external product row, logging audit events for what changed. */
export async function updateExternalProduct(
	client: SheetsClient,
	product: ExternalProductSheet,
	accessToken: string,
	skipAuditLog: boolean = false,
): Promise<void> {
	// Get the current state before updating for audit log
	const currentData = await client.getSheetData(
		"external_products",
		accessToken,
	);
	const rowNumber = await client.findRowByValue(
		"external_products",
		"unique_id_sku",
		product.unique_id_sku,
		accessToken,
	);
	if (!rowNumber) {
		throw new Error(`External product "${product.unique_id_sku}" not found`);
	}

	let beforeState: Record<string, unknown> = {};
	if (!skipAuditLog && currentData.length > rowNumber - 1) {
		beforeState = captureExternalBeforeState(currentData[rowNumber - 1]);
	}

	const updatedRow = [
		product.unique_id_sku,
		product.manufacturer_color,
		product.brand,
		product.size,
		product.bag_quantity.toString(),
		product.distributors,
		product.quantity.toString(),
		product.status || "active",
	];

	await client.updateRow(
		"external_products",
		rowNumber,
		updatedRow,
		accessToken,
	);
	logger.debug("Sheets", `Updated external product: ${product.unique_id_sku}`);

	// Log audit event only if not skipped
	if (!skipAuditLog && Object.keys(beforeState).length > 0) {
		const diff = diffExternalProduct(beforeState, product);
		await logExternalProductChanges(client, product, diff, accessToken);
	}
}
