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

	constructor(spreadsheetId: string) {
		this.client = new SheetsClient(spreadsheetId);
	}

	// --- Client primitives ---------------------------------------------------

	getSheetData(sheetName: string, accessToken: string): Promise<string[][]> {
		return this.client.getSheetData(sheetName, accessToken);
	}

	appendToSheet(
		sheetName: string,
		values: string[][],
		accessToken: string,
	): Promise<void> {
		return this.client.appendToSheet(sheetName, values, accessToken);
	}

	getNextId(sheetName: string, accessToken: string): Promise<number> {
		return this.client.getNextId(sheetName, accessToken);
	}

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

	updateRow(
		sheetName: string,
		rowNumber: number,
		values: string[],
		accessToken: string,
	): Promise<void> {
		return this.client.updateRow(sheetName, rowNumber, values, accessToken);
	}

	// --- Products ------------------------------------------------------------

	getInternalProductData(accessToken: string): Promise<InternalProductSheet[]> {
		return getInternalProductData(this.client, accessToken);
	}

	getExternalProductData(accessToken: string): Promise<ExternalProductSheet[]> {
		return getExternalProductData(this.client, accessToken);
	}

	addInternalProduct(
		product: InternalProductSheet,
		accessToken: string,
	): Promise<void> {
		return addInternalProduct(this.client, product, accessToken);
	}

	addExternalProduct(
		product: ExternalProductSheet,
		accessToken: string,
	): Promise<void> {
		return addExternalProduct(this.client, product, accessToken);
	}

	updateInternalProduct(
		product: InternalProductSheet,
		accessToken: string,
	): Promise<void> {
		return updateInternalProduct(this.client, product, accessToken);
	}

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

	archiveExternalProduct(sku: string, accessToken: string): Promise<void> {
		return archiveExternalProduct(this.client, sku, accessToken);
	}

	unarchiveExternalProduct(sku: string, accessToken: string): Promise<void> {
		return unarchiveExternalProduct(this.client, sku, accessToken);
	}

	archiveInternalProduct(id: string, accessToken: string): Promise<void> {
		return archiveInternalProduct(this.client, id, accessToken);
	}

	unarchiveInternalProduct(id: string, accessToken: string): Promise<void> {
		return unarchiveInternalProduct(this.client, id, accessToken);
	}

	// --- Metadata ------------------------------------------------------------

	getMetadataValues(
		sheetName: string,
		accessToken: string,
	): Promise<Array<{ name: string; status: string }>> {
		return getMetadataValues(this.client, sheetName, accessToken);
	}

	addMetadataItem(
		sheetName: string,
		name: string,
		accessToken: string,
	): Promise<void> {
		return addMetadataItem(this.client, sheetName, name, accessToken);
	}

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

	archiveMetadataItem(
		sheetName: string,
		name: string,
		accessToken: string,
	): Promise<void> {
		return archiveMetadataItem(this.client, sheetName, name, accessToken);
	}

	unarchiveMetadataItem(
		sheetName: string,
		name: string,
		accessToken: string,
	): Promise<void> {
		return unarchiveMetadataItem(this.client, sheetName, name, accessToken);
	}

	// --- Aggregate -----------------------------------------------------------

	getAllSheetsData(accessToken: string) {
		return getAllSheetsData(this.client, accessToken);
	}

	// --- Audit ---------------------------------------------------------------

	logEvent(
		event: Omit<AuditEvent, "id" | "user_email">,
		accessToken: string,
	): Promise<void> {
		return logEvent(this.client, event, accessToken);
	}

	getAuditEvents(
		accessToken: string,
		limit: number = 50,
		offset: number = 0,
	): Promise<AuditEvent[]> {
		return getAuditEvents(this.client, accessToken, limit, offset);
	}
}
