/// <reference types="jest" />

import { getAuditEvents } from "@/services/sheets/audit";
import type { SheetsClient } from "@/services/sheets/client";
import { updateExternalProduct } from "@/services/sheets/products";
import type {
	AuditEvent,
	AuditEventSheet,
	SheetsResponse,
} from "@/services/sheets/types";

const TOKEN = "tok-abc";

const EVENTS_HEADER = [
	"id",
	"timestamp",
	"event_type",
	"object_type",
	"object_id",
	"object_name",
	"changes",
	"before_state",
	"sheet_name",
	"user_email",
];

const EXTERNAL_HEADER = [
	"unique_id_sku",
	"manufacturer_color",
	"brand",
	"size",
	"bag_quantity",
	"distributors",
	"quantity",
	"status",
];

/**
 * The resource modules accept optional trailing parameters (audit pagination,
 * `skipAuditLog`) that the facade always forwards explicitly. These tests call
 * the module functions directly with those arguments omitted so the default
 * values are exercised.
 */
describe("sheets module default parameters", () => {
	it("getAuditEvents applies the default limit and offset", async () => {
		const rows = Array.from({ length: 60 }, (_, i) => [
			String(i + 1),
			`t${i + 1}`,
			"create",
			"metadata",
			"a",
			"A",
			"{}",
			"",
			"brands",
			"u",
		]);
		const client = {
			getSheetData: jest.fn().mockResolvedValue([EVENTS_HEADER, ...rows]),
		} as unknown as SheetsClient;

		// No limit/offset -> defaults (50, 0): newest 50 of the 60 rows.
		const events = await getAuditEvents(client, TOKEN);

		expect(events).toHaveLength(50);
		expect(events[0].id).toBe(60); // sorted desc, offset 0
		expect(events[49].id).toBe(11); // 60 down to 11 == 50 entries
	});

	it("updateExternalProduct audits by default (skipAuditLog omitted)", async () => {
		const baseRow = [
			"111",
			"Flaming Red",
			"Qualatex",
			'11"',
			"50",
			"Default Distributor",
			"10",
			"active",
		];
		const sheet = [EXTERNAL_HEADER, baseRow];

		const getSheetData = jest
			.fn()
			.mockResolvedValueOnce(sheet) // currentData
			.mockResolvedValueOnce(sheet) // findRowByValue
			.mockResolvedValue([EVENTS_HEADER]); // logEvent getNextId
		const client = {
			getSheetData,
			findRowByValue: jest.fn().mockResolvedValue(2),
			updateRow: jest.fn().mockResolvedValue(undefined),
			getNextId: jest.fn().mockResolvedValue(1),
			getUserEmail: jest.fn().mockResolvedValue("u@mill.com"),
			appendToSheet: jest.fn().mockResolvedValue(undefined),
		} as unknown as SheetsClient;

		// Omit skipAuditLog -> default false -> quantity change is audited.
		await updateExternalProduct(
			client,
			{
				unique_id_sku: "111",
				manufacturer_color: "Flaming Red",
				brand: "Qualatex",
				size: '11"',
				bag_quantity: 50,
				distributors: "Default Distributor",
				quantity: 42,
				status: "active",
			},
			TOKEN,
		);

		const appendMock = client.appendToSheet as jest.Mock;
		expect(appendMock).toHaveBeenCalledTimes(1);
		const auditRow = (appendMock.mock.calls[0][1] as string[][])[0];
		expect(auditRow[2]).toBe("quantity_update");
	});

	it("exposes the audit type shapes", () => {
		// Touch the re-exported types so the module compiles against them.
		const response: SheetsResponse = {
			range: "x",
			majorDimension: "ROWS",
			values: [],
		};
		const event: AuditEvent = {
			id: 1,
			timestamp: "t",
			event_type: "create",
			object_type: "metadata",
			object_id: "1",
			object_name: "n",
			changes: "{}",
			before_state: "",
			sheet_name: "brands",
			user_email: "u",
		};
		const raw: AuditEventSheet = { ...event, event_type: "create" };

		expect(response.values).toEqual([]);
		expect(event.id).toBe(1);
		expect(raw.object_id).toBe("1");
	});
});
