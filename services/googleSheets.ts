import type {
	ExternalProductSheet,
	InternalProductSheet,
} from "@/constants/Products";
import { getAllSheetsData } from "@/services/sheets/aggregate";
import { getAuditEvents, logEvent } from "@/services/sheets/audit";
import { SheetsClient } from "@/services/sheets/client";
import {
	addMetadataItem,
	archiveMetadataItem,
	getMetadataValues,
	unarchiveMetadataItem,
	updateMetadataItem,
	updateProductsWithMetadataChange,
} from "@/services/sheets/metadata";
import {
	addExternalProduct,
	addInternalProduct,
	archiveExternalProduct,
	archiveInternalProduct,
	getExternalProductData,
	getInternalProductData,
	unarchiveExternalProduct,
	unarchiveInternalProduct,
	updateExternalProduct,
	updateInternalProduct,
} from "@/services/sheets/products";
import type { AuditEvent } from "@/services/sheets/types";

export type { AuditEvent, AuditEventSheet } from "@/services/sheets/types";

/**
 * Facade over the Google Sheets resource modules.
 *
 * Holds a single {@link SheetsClient} and delegates each operation to the
 * focused per-resource module. The public method surface is unchanged from the
 * original monolith, so existing callers keep working as-is.
 */
export class GoogleSheetsService {
	private client: SheetsClient;

	/** Construct the facade and its underlying client for the spreadsheet. */
	constructor(spreadsheetId: string) {
		this.client = new SheetsClient(spreadsheetId);
	}

	// --- Client primitives ---------------------------------------------------

	/** Read a whole sheet as a row/column string grid. */
	getSheetData(sheetName: string, accessToken: string): Promise<string[][]> {
		return this.client.getSheetData(sheetName, accessToken);
	}

	/** Append rows to a sheet. */
	appendToSheet(
		sheetName: string,
		values: string[][],
		accessToken: string,
	): Promise<void> {
		return this.client.appendToSheet(sheetName, values, accessToken);
	}

	/** Next integer id for a sheet. */
	getNextId(sheetName: string, accessToken: string): Promise<number> {
		return this.client.getNextId(sheetName, accessToken);
	}

	/** 1-based row number of the first row whose column equals `value`, else null. */
	findRowByValue(
		sheetName: string,
		columnName: string,
		value: string,
		accessToken: string,
	): Promise<number | null> {
		return this.client.findRowByValue(
			sheetName,
			columnName,
			value,
			accessToken,
		);
	}

	/** Overwrite a 1-based row's cells with `values`. */
	updateRow(
		sheetName: string,
		rowNumber: number,
		values: string[],
		accessToken: string,
	): Promise<void> {
		return this.client.updateRow(sheetName, rowNumber, values, accessToken);
	}

	// --- Products ------------------------------------------------------------

	/** Read the internal products sheet into typed rows. */
	getInternalProductData(accessToken: string): Promise<InternalProductSheet[]> {
		return getInternalProductData(this.client, accessToken);
	}

	/** Read the external products sheet into typed rows. */
	getExternalProductData(accessToken: string): Promise<ExternalProductSheet[]> {
		return getExternalProductData(this.client, accessToken);
	}

	/** Append an internal product and log a create event. */
	addInternalProduct(
		product: InternalProductSheet,
		accessToken: string,
	): Promise<void> {
		return addInternalProduct(this.client, product, accessToken);
	}

	/** Append an external product and log a create event. */
	addExternalProduct(
		product: ExternalProductSheet,
		accessToken: string,
	): Promise<void> {
		return addExternalProduct(this.client, product, accessToken);
	}

	/** Update an internal product, logging an edit event for changes. */
	updateInternalProduct(
		product: InternalProductSheet,
		accessToken: string,
	): Promise<void> {
		return updateInternalProduct(this.client, product, accessToken);
	}

	/** Update an external product, optionally skipping the audit log. */
	updateExternalProduct(
		product: ExternalProductSheet,
		accessToken: string,
		skipAuditLog: boolean = false,
	): Promise<void> {
		return updateExternalProduct(
			this.client,
			product,
			accessToken,
			skipAuditLog,
		);
	}

	/** Archive an external product by SKU. */
	archiveExternalProduct(sku: string, accessToken: string): Promise<void> {
		return archiveExternalProduct(this.client, sku, accessToken);
	}

	/** Unarchive an external product by SKU. */
	unarchiveExternalProduct(sku: string, accessToken: string): Promise<void> {
		return unarchiveExternalProduct(this.client, sku, accessToken);
	}

	/** Archive an internal product by id. */
	archiveInternalProduct(id: string, accessToken: string): Promise<void> {
		return archiveInternalProduct(this.client, id, accessToken);
	}

	/** Unarchive an internal product by id. */
	unarchiveInternalProduct(id: string, accessToken: string): Promise<void> {
		return unarchiveInternalProduct(this.client, id, accessToken);
	}

	// --- Metadata ------------------------------------------------------------

	/** Read `{ name, status }` pairs from a metadata sheet. */
	getMetadataValues(
		sheetName: string,
		accessToken: string,
	): Promise<Array<{ name: string; status: string }>> {
		return getMetadataValues(this.client, sheetName, accessToken);
	}

	/** Append a metadata item and log a create event. */
	addMetadataItem(
		sheetName: string,
		name: string,
		accessToken: string,
	): Promise<void> {
		return addMetadataItem(this.client, sheetName, name, accessToken);
	}

	/** Rename a metadata item, log the edit, and cascade into product sheets. */
	updateMetadataItem(
		sheetName: string,
		oldName: string,
		newName: string,
		accessToken: string,
	): Promise<void> {
		return updateMetadataItem(
			this.client,
			sheetName,
			oldName,
			newName,
			accessToken,
		);
	}

	/** Cascade a metadata rename through every product sheet that references it. */
	updateProductsWithMetadataChange(
		metadataSheetName: string,
		oldValue: string,
		newValue: string,
		accessToken: string,
	): Promise<void> {
		return updateProductsWithMetadataChange(
			this.client,
			metadataSheetName,
			oldValue,
			newValue,
			accessToken,
		);
	}

	/** Archive a metadata item and log an archive event. */
	archiveMetadataItem(
		sheetName: string,
		name: string,
		accessToken: string,
	): Promise<void> {
		return archiveMetadataItem(this.client, sheetName, name, accessToken);
	}

	/** Unarchive a metadata item and log an unarchive event. */
	unarchiveMetadataItem(
		sheetName: string,
		name: string,
		accessToken: string,
	): Promise<void> {
		return unarchiveMetadataItem(this.client, sheetName, name, accessToken);
	}

	// --- Aggregate -----------------------------------------------------------

	/** Fetch all metadata + product sheets and assemble the combined app view. */
	getAllSheetsData(accessToken: string) {
		return getAllSheetsData(this.client, accessToken);
	}

	// --- Audit ---------------------------------------------------------------

	/** Append an audit event row. */
	logEvent(
		event: Omit<AuditEvent, "id" | "user_email">,
		accessToken: string,
	): Promise<void> {
		return logEvent(this.client, event, accessToken);
	}

	/** Read audit events, most-recent first, with pagination. */
	getAuditEvents(
		accessToken: string,
		limit: number = 50,
		offset: number = 0,
	): Promise<AuditEvent[]> {
		return getAuditEvents(this.client, accessToken, limit, offset);
	}
}
