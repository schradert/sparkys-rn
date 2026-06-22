import { logger } from "@/services/logger";
import type { SheetsResponse } from "./types";

/**
 * Resource-agnostic Google Sheets transport.
 *
 * Owns the spreadsheet id and the low-level read/write primitives every
 * resource API builds on. Inject it into the resource modules so they stay
 * focused on their domain and remain independently testable.
 */
export class SheetsClient {
	private baseUrl = "https://sheets.googleapis.com/v4/spreadsheets";
	private spreadsheetId: string;

	constructor(spreadsheetId: string) {
		this.spreadsheetId = spreadsheetId;
	}

	async getUserEmail(accessToken: string): Promise<string> {
		try {
			const response = await fetch(
				"https://www.googleapis.com/oauth2/v2/userinfo",
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
				},
			);

			if (!response.ok) {
				logger.error("Sheets", "Failed to fetch user info:", response.status);
				return "unknown";
			}

			const userInfo = await response.json();
			return userInfo.email || "unknown";
		} catch (error) {
			logger.error("Sheets", "Error fetching user email:", error);
			return "unknown";
		}
	}

	async makeRequest(endpoint: string, accessToken: string): Promise<unknown> {
		const url = `${this.baseUrl}/${this.spreadsheetId}/${endpoint}`;

		logger.debug("Sheets", "Making request to:", url);

		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			logger.error("Sheets", "Sheets API error:", {
				status: response.status,
				statusText: response.statusText,
				url,
				error: errorText,
			});
			throw new Error(
				`Sheets API error: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}

		return response.json();
	}

	async getSheetData(
		sheetName: string,
		accessToken: string,
	): Promise<string[][]> {
		const range = `${sheetName}!A:Z`;
		const endpoint = `values/${encodeURIComponent(range)}`;
		const data = (await this.makeRequest(
			endpoint,
			accessToken,
		)) as SheetsResponse;

		return data.values || [];
	}

	async appendToSheet(
		sheetName: string,
		values: string[][],
		accessToken: string,
	): Promise<void> {
		const endpoint = `values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED`;

		const body = {
			values: values,
		};

		const response = await fetch(
			`${this.baseUrl}/${this.spreadsheetId}/${endpoint}`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			logger.error("Sheets", "Sheets append error:", {
				status: response.status,
				statusText: response.statusText,
				error: errorText,
			});
			throw new Error(
				`Failed to append to sheet: ${response.status} ${response.statusText}`,
			);
		}

		logger.debug(
			"Sheets",
			`Successfully appended ${values.length} rows to ${sheetName}`,
		);
	}

	async getNextId(sheetName: string, accessToken: string): Promise<number> {
		const values = await this.getSheetData(sheetName, accessToken);

		if (values.length <= 1) return 1;

		const headerRow = values[0];
		const idColumnIndex = headerRow.findIndex(
			(header) => header.toLowerCase() === "id",
		);

		if (idColumnIndex === -1) return 1;

		let maxId = 0;
		for (let i = 1; i < values.length; i++) {
			const row = values[i];
			const id = parseInt(row[idColumnIndex] || "0", 10);
			if (id > maxId) {
				maxId = id;
			}
		}

		return maxId + 1;
	}

	async findRowByValue(
		sheetName: string,
		columnName: string,
		value: string,
		accessToken: string,
	): Promise<number | null> {
		const values = await this.getSheetData(sheetName, accessToken);

		if (values.length === 0) return null;

		const headerRow = values[0];
		const columnIndex = headerRow.findIndex(
			(header) => header.toLowerCase() === columnName.toLowerCase(),
		);

		if (columnIndex === -1) return null;

		for (let i = 1; i < values.length; i++) {
			if (values[i][columnIndex] === value) {
				return i + 1; // Return 1-based row number for sheets API
			}
		}

		return null;
	}

	async updateRow(
		sheetName: string,
		rowNumber: number,
		values: string[],
		accessToken: string,
	): Promise<void> {
		const range = `${sheetName}!A${rowNumber}:Z${rowNumber}`;
		const endpoint = `values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

		const body = {
			values: [values],
		};

		const response = await fetch(
			`${this.baseUrl}/${this.spreadsheetId}/${endpoint}`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			logger.error("Sheets", "Sheets update error:", {
				status: response.status,
				statusText: response.statusText,
				error: errorText,
			});
			throw new Error(
				`Failed to update sheet: ${response.status} ${response.statusText}`,
			);
		}

		logger.debug(
			"Sheets",
			`Successfully updated row ${rowNumber} in ${sheetName}`,
		);
	}
}
