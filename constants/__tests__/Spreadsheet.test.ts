import {
	DEFAULT_SPREADSHEET_ID,
	resolveSpreadsheetId,
	SPREADSHEET_ID,
} from "@/constants/Spreadsheet";

describe("resolveSpreadsheetId", () => {
	it("uses the provided environment value", () => {
		expect(resolveSpreadsheetId("sheet-123")).toBe("sheet-123");
	});

	it("falls back to the development sheet when unset", () => {
		expect(resolveSpreadsheetId(undefined)).toBe(DEFAULT_SPREADSHEET_ID);
	});

	it("falls back to the development sheet when blank", () => {
		expect(resolveSpreadsheetId("   ")).toBe(DEFAULT_SPREADSHEET_ID);
	});

	it("trims surrounding whitespace", () => {
		expect(resolveSpreadsheetId("  sheet-xyz  ")).toBe("sheet-xyz");
	});
});

describe("SPREADSHEET_ID", () => {
	it("resolves to a non-empty id at import time", () => {
		expect(SPREADSHEET_ID).toBeTruthy();
	});
});
