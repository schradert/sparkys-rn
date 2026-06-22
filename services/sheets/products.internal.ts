import type { InternalProductSheet } from "@/constants/Products";
import { logger } from "@/services/logger";
import { logEvent } from "./audit";
import type { SheetsClient } from "./client";

/** Append an internal product row and log a create event. */
export async function addInternalProduct(
	client: SheetsClient,
	product: InternalProductSheet,
	accessToken: string,
): Promise<void> {
	const newRow = [
		product.id,
		product.sparkys_product_name,
		product.product_type,
		product.sparkys_color,
		product.texture,
		product.shape,
		product.occasions,
		product.products,
		(product.threshold_quantity || 0).toString(),
		product.never_out ? "TRUE" : "FALSE",
		product.status || "active",
	];

	await client.appendToSheet("internal_products", [newRow], accessToken);
	logger.debug(
		"Sheets",
		`Added internal product: ${product.sparkys_product_name} (${product.id}) to internal_products sheet`,
	);

	// Log audit event for creation
	await logEvent(
		client,
		{
			timestamp: new Date().toISOString(),
			event_type: "create",
			object_type: "internal_product",
			object_id: product.id,
			object_name: product.sparkys_product_name,
			changes: JSON.stringify({
				sparkys_product_name: product.sparkys_product_name,
				product_type: product.product_type,
				sparkys_color: product.sparkys_color,
				texture: product.texture,
				shape: product.shape,
				occasions: product.occasions,
				threshold_quantity: product.threshold_quantity,
				never_out: product.never_out,
			}),
			before_state: "",
			sheet_name: "internal_products",
		},
		accessToken,
	);
}

/** Capture the persisted internal-product row as a before-state snapshot. */
function captureInternalBeforeState(
	currentRow: string[],
): Record<string, unknown> {
	return {
		id: currentRow[0] || "",
		sparkys_product_name: currentRow[1] || "",
		product_type: currentRow[2] || "",
		sparkys_color: currentRow[3] || "",
		texture: currentRow[4] || "",
		shape: currentRow[5] || "",
		occasions: currentRow[6] || "",
		products: currentRow[7] || "",
		threshold_quantity: parseInt(currentRow[8] || "0", 10),
		never_out: currentRow[9] === "TRUE",
		status: currentRow[10] || "active",
	};
}

/** Diff an internal product against its before-state, collecting real changes. */
function diffInternalProduct(
	beforeState: Record<string, unknown>,
	product: InternalProductSheet,
): { changes: Record<string, unknown>; before: Record<string, unknown> } {
	const changes: Record<string, unknown> = {};
	const before: Record<string, unknown> = {};

	// Compare fields and only include actual changes
	if (beforeState.sparkys_product_name !== product.sparkys_product_name) {
		changes.sparkys_product_name = product.sparkys_product_name;
		before.sparkys_product_name = beforeState.sparkys_product_name;
	}
	if (beforeState.product_type !== product.product_type) {
		changes.product_type = product.product_type;
		before.product_type = beforeState.product_type;
	}
	if (beforeState.sparkys_color !== product.sparkys_color) {
		changes.sparkys_color = product.sparkys_color;
		before.sparkys_color = beforeState.sparkys_color;
	}
	if (beforeState.texture !== product.texture) {
		changes.texture = product.texture;
		before.texture = beforeState.texture;
	}
	if (beforeState.shape !== product.shape) {
		changes.shape = product.shape;
		before.shape = beforeState.shape;
	}
	if (beforeState.occasions !== product.occasions) {
		changes.occasions = product.occasions;
		before.occasions = beforeState.occasions;
	}
	if (beforeState.threshold_quantity !== product.threshold_quantity) {
		changes.threshold_quantity = product.threshold_quantity;
		before.threshold_quantity = beforeState.threshold_quantity;
	}
	if (beforeState.never_out !== product.never_out) {
		changes.never_out = product.never_out;
		before.never_out = beforeState.never_out;
	}
	if (beforeState.status !== (product.status || "active")) {
		changes.status = product.status || "active";
		before.status = beforeState.status;
	}

	return { changes, before };
}

/** Update an internal product row, logging a single edit event for changes. */
export async function updateInternalProduct(
	client: SheetsClient,
	product: InternalProductSheet,
	accessToken: string,
): Promise<void> {
	// First, get the current row data for this specific product
	const currentData = await client.getSheetData(
		"internal_products",
		accessToken,
	);
	const rowNumber = await client.findRowByValue(
		"internal_products",
		"id",
		product.id,
		accessToken,
	);
	if (!rowNumber) {
		throw new Error(`Internal product with ID "${product.id}" not found`);
	}

	// Capture current state for audit log
	let beforeState: Record<string, unknown> = {};
	if (currentData.length > rowNumber - 1) {
		beforeState = captureInternalBeforeState(currentData[rowNumber - 1]);
	}

	const updatedRow = [
		product.id,
		product.sparkys_product_name,
		product.product_type,
		product.sparkys_color,
		product.texture,
		product.shape,
		product.occasions,
		product.products,
		product.threshold_quantity.toString(),
		product.never_out ? "TRUE" : "FALSE",
		product.status || "active",
	];

	await client.updateRow(
		"internal_products",
		rowNumber,
		updatedRow,
		accessToken,
	);
	logger.debug(
		"Sheets",
		`Updated internal product: ${product.sparkys_product_name}`,
	);

	// Log audit event with actual changes only
	if (Object.keys(beforeState).length > 0) {
		const { changes, before } = diffInternalProduct(beforeState, product);

		// Only log if there are actual changes
		if (Object.keys(changes).length > 0) {
			await logEvent(
				client,
				{
					timestamp: new Date().toISOString(),
					event_type: "edit",
					object_type: "internal_product",
					object_id: product.id,
					object_name: product.sparkys_product_name,
					changes: JSON.stringify(changes),
					before_state: JSON.stringify(before),
					sheet_name: "internal_products",
				},
				accessToken,
			);
		}
	}
}
