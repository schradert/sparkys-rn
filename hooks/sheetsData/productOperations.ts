import type {
	ExternalProductSheet,
	InternalProductSheet,
} from "@/constants/Products";
import { SPREADSHEET_ID } from "@/constants/Spreadsheet";
import { getErrorMessage } from "@/services/errors";
import type { AuditEvent } from "@/services/googleSheets";
import { GoogleSheetsService } from "@/services/googleSheets";
import { logger } from "@/services/logger";
import type { OperationResult } from "./store";

export async function addInternalProductToSheet(
	product: InternalProductSheet,
	accessToken: string,
): Promise<OperationResult> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.addInternalProduct(product, accessToken);

		// Note: Product store updates happen via subscribeToStoreChanges
		// No need for full refresh

		return { success: true };
	} catch (error) {
		logger.error("Sheets", "Error adding internal product to sheet:", error);
		return {
			success: false,
			error: String(error) || "Failed to add internal product",
		};
	}
}

export async function addExternalProductToSheet(
	product: ExternalProductSheet,
	accessToken: string,
): Promise<OperationResult> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.addExternalProduct(product, accessToken);

		// Note: Product store updates happen via subscribeToStoreChanges
		// No need for full refresh

		return { success: true };
	} catch (error) {
		logger.error("Sheets", "Error adding external product to sheet:", error);
		return {
			success: false,
			error: getErrorMessage(error) || "Failed to add external product",
		};
	}
}

export async function updateInternalProductInSheet(
	product: InternalProductSheet,
	accessToken: string,
): Promise<OperationResult> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.updateInternalProduct(product, accessToken);
		// Don't refresh - let the caller update the store directly
		return { success: true };
	} catch (error) {
		logger.error("Sheets", "Error updating internal product in sheet:", error);
		return {
			success: false,
			error: getErrorMessage(error) || "Failed to update internal product",
		};
	}
}

export async function updateExternalProductInSheet(
	product: ExternalProductSheet,
	accessToken: string,
	skipAuditLog: boolean,
): Promise<OperationResult> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.updateExternalProduct(
			product,
			accessToken,
			skipAuditLog,
		);
		// Don't refresh - let the caller update the store directly
		return { success: true };
	} catch (error) {
		logger.error("Sheets", "Error updating external product in sheet:", error);
		return {
			success: false,
			error: getErrorMessage(error) || "Failed to update external product",
		};
	}
}

export async function archiveExternalProductInSheet(
	sku: string,
	accessToken: string,
): Promise<OperationResult> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.archiveExternalProduct(sku, accessToken);
		return { success: true };
	} catch (error) {
		logger.error("Sheets", "Error archiving external product:", error);
		return {
			success: false,
			error: getErrorMessage(error) || "Failed to archive external product",
		};
	}
}

export async function unarchiveExternalProductInSheet(
	sku: string,
	accessToken: string,
): Promise<OperationResult> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.unarchiveExternalProduct(sku, accessToken);
		return { success: true };
	} catch (error) {
		logger.error("Sheets", "Error unarchiving external product:", error);
		return {
			success: false,
			error: getErrorMessage(error) || "Failed to unarchive external product",
		};
	}
}

export async function archiveInternalProductInSheet(
	name: string,
	accessToken: string,
): Promise<OperationResult> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.archiveInternalProduct(name, accessToken);
		return { success: true };
	} catch (error) {
		logger.error("Sheets", "Error archiving internal product:", error);
		return {
			success: false,
			error: getErrorMessage(error) || "Failed to archive internal product",
		};
	}
}

export async function unarchiveInternalProductInSheet(
	name: string,
	accessToken: string,
): Promise<OperationResult> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.unarchiveInternalProduct(name, accessToken);
		return { success: true };
	} catch (error) {
		logger.error("Sheets", "Error unarchiving internal product:", error);
		return {
			success: false,
			error: getErrorMessage(error) || "Failed to unarchive internal product",
		};
	}
}

export async function logAuditEvent(
	event: Omit<AuditEvent, "id" | "user_email">,
	accessToken: string,
): Promise<void> {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		await sheetsService.logEvent(event, accessToken);
	} catch (error) {
		logger.error("Sheets", "Failed to log audit event:", error);
	}
}

export async function getAuditEvents(
	accessToken: string,
	limit: number,
	offset: number,
) {
	try {
		const sheetsService = new GoogleSheetsService(SPREADSHEET_ID);
		return await sheetsService.getAuditEvents(accessToken, limit, offset);
	} catch (error) {
		logger.error("Sheets", "Error fetching audit events:", error);
		return [];
	}
}
