/// <reference types="jest" />
import type {
	ExternalProductSheet,
	InternalProductSheet,
} from "@/constants/Products";
import { GoogleSheetsService } from "@/services/googleSheets";

const SPREADSHEET_ID = "sheet-123";
const TOKEN = "tok-abc";
const BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

type FetchMock = jest.MockedFunction<typeof fetch>;

const fetchMock = jest.fn() as FetchMock;

beforeEach(() => {
	fetchMock.mockReset();
	globalThis.fetch = fetchMock;
});

/** Build a Response-like object with the bits the service reads. */
function res(
	ok: boolean,
	body: unknown,
	opts: { status?: number; statusText?: string; text?: string } = {},
): Response {
	const { status = ok ? 200 : 500, statusText = "", text = "" } = opts;
	return {
		ok,
		status,
		statusText,
		json: async () => body,
		text: async () => text,
	} as unknown as Response;
}

/** Resolve a JSON values payload as the Sheets API would for a GET range. */
function valuesRes(values: string[][] | undefined): Response {
	return res(true, { range: "x", majorDimension: "ROWS", values });
}

/** Pull the parsed JSON body that was POST/PUT-ed in the Nth fetch call. */
function bodyOf(callIndex: number): Record<string, unknown> {
	const init = fetchMock.mock.calls[callIndex][1] as RequestInit;
	return JSON.parse(init.body as string);
}

function urlOf(callIndex: number): string {
	return fetchMock.mock.calls[callIndex][0] as string;
}

function methodOf(callIndex: number): string | undefined {
	const init = fetchMock.mock.calls[callIndex][1] as RequestInit | undefined;
	return init?.method;
}

const svc = () => new GoogleSheetsService(SPREADSHEET_ID);

const internalSheet = (
	over: Partial<InternalProductSheet> = {},
): InternalProductSheet => ({
	id: "1",
	sparkys_product_name: "Red Latex",
	product_type: "Latex Balloons",
	sparkys_color: "Red",
	texture: "Matte",
	shape: "Round",
	occasions: "Birthday",
	products: "111",
	threshold_quantity: 5,
	never_out: false,
	status: "active",
	...over,
});

const externalSheet = (
	over: Partial<ExternalProductSheet> = {},
): ExternalProductSheet => ({
	unique_id_sku: "111",
	manufacturer_color: "Flaming Red",
	brand: "Qualatex",
	size: '11"',
	bag_quantity: 50,
	distributors: "Default Distributor",
	quantity: 10,
	status: "active",
	...over,
});

// Header rows matching the layouts documented in googleSheets.ts.
const INTERNAL_HEADER = [
	"id",
	"sparkys_product_name",
	"product_type",
	"sparkys_color",
	"texture",
	"shape",
	"occasions",
	"products",
	"threshold_quantity",
	"never_out",
	"status",
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

describe("GoogleSheetsService.getSheetData", () => {
	it("requests the A:Z range and returns parsed values", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes([["a"], ["b"]]));

		const data = await svc().getSheetData("internal_products", TOKEN);

		expect(data).toEqual([["a"], ["b"]]);
		expect(urlOf(0)).toBe(
			`${BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(
				"internal_products!A:Z",
			)}`,
		);
		const init = fetchMock.mock.calls[0][1] as RequestInit;
		expect((init.headers as Record<string, string>).Authorization).toBe(
			`Bearer ${TOKEN}`,
		);
	});

	it("defaults to an empty array when values are absent", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes(undefined));

		expect(await svc().getSheetData("x", TOKEN)).toEqual([]);
	});

	it("throws with the API error details on a non-OK response", async () => {
		fetchMock.mockResolvedValueOnce(
			res(false, null, {
				status: 403,
				statusText: "Forbidden",
				text: "denied",
			}),
		);

		await expect(svc().getSheetData("x", TOKEN)).rejects.toThrow(
			"Sheets API error: 403 Forbidden - denied",
		);
	});
});

describe("GoogleSheetsService.getMetadataValues", () => {
	it("returns an empty array when the sheet is empty", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes([]));

		expect(await svc().getMetadataValues("brands", TOKEN)).toEqual([]);
	});

	it("parses name/status, defaulting status to active and skipping blank names", async () => {
		fetchMock.mockResolvedValueOnce(
			valuesRes([
				["Name", "Status"],
				["Qualatex", "archived"],
				["Anagram", ""],
				["", "active"],
				["   ", "active"],
			]),
		);

		const result = await svc().getMetadataValues("brands", TOKEN);

		expect(result).toEqual([
			{ name: "Qualatex", status: "archived" },
			{ name: "Anagram", status: "active" },
		]);
	});

	it("defaults status to active when there is no status column", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes([["name"], ["Qualatex"]]));

		expect(await svc().getMetadataValues("brands", TOKEN)).toEqual([
			{ name: "Qualatex", status: "active" },
		]);
	});

	it("throws when no name column exists", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes([["foo", "bar"], ["x"]]));

		await expect(svc().getMetadataValues("brands", TOKEN)).rejects.toThrow(
			"No 'name' column found in brands sheet",
		);
	});
});

describe("GoogleSheetsService.getInternalProductData", () => {
	it("returns [] when fewer than two rows are present", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes([INTERNAL_HEADER]));

		expect(await svc().getInternalProductData(TOKEN)).toEqual([]);
	});

	it("parses rows, skips blank ids, and coerces never_out/threshold/status", async () => {
		fetchMock.mockResolvedValueOnce(
			valuesRes([
				INTERNAL_HEADER,
				[
					"1",
					"Red Latex",
					"Latex Balloons",
					"Red",
					"Matte",
					"Round",
					"Birthday",
					"111",
					"5",
					"TRUE",
					"active",
				],
				// Falsy/empty cells: every field falls back to its default,
				// including the empty status -> "active".
				["2", "", "", "", "", "", "", "", "", "", ""],
				// Blank id row is skipped.
				["   "],
			]),
		);

		const products = await svc().getInternalProductData(TOKEN);

		expect(products).toEqual([
			{
				id: "1",
				sparkys_product_name: "Red Latex",
				product_type: "Latex Balloons",
				sparkys_color: "Red",
				texture: "Matte",
				shape: "Round",
				occasions: "Birthday",
				products: "111",
				threshold_quantity: 5,
				never_out: true,
				status: "active",
			},
			{
				id: "2",
				sparkys_product_name: "",
				product_type: "",
				sparkys_color: "",
				texture: "",
				shape: "",
				occasions: "",
				products: "",
				threshold_quantity: 0,
				never_out: false,
				status: "active",
			},
		]);
	});
});

describe("GoogleSheetsService.getExternalProductData", () => {
	it("returns [] when fewer than two rows are present", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes([EXTERNAL_HEADER]));

		expect(await svc().getExternalProductData(TOKEN)).toEqual([]);
	});

	it("parses rows, skips blank ids, and coerces numbers/status", async () => {
		fetchMock.mockResolvedValueOnce(
			valuesRes([
				EXTERNAL_HEADER,
				[
					"111",
					"Flaming Red",
					"Qualatex",
					'11"',
					"50",
					"Default Distributor",
					"10",
					"archived",
				],
				// Falsy/empty cells: every field falls back to its default,
				// including the empty status -> "active".
				["222", "", "", "", "", "", "", ""],
				[""],
			]),
		);

		const products = await svc().getExternalProductData(TOKEN);

		expect(products).toEqual([
			{
				unique_id_sku: "111",
				manufacturer_color: "Flaming Red",
				brand: "Qualatex",
				size: '11"',
				bag_quantity: 50,
				distributors: "Default Distributor",
				quantity: 10,
				status: "archived",
			},
			{
				unique_id_sku: "222",
				manufacturer_color: "",
				brand: "",
				size: "",
				bag_quantity: 0,
				distributors: "",
				quantity: 0,
				status: "active",
			},
		]);
	});
});

describe("GoogleSheetsService.getAllSheetsData", () => {
	it("aggregates metadata + products and derives unique sizes", async () => {
		// 9 metadata sheets, then internal, then external. Promise.all preserves
		// argument order regardless of resolution order, so queue in that order.
		const metadata = (name: string, status = "active") =>
			valuesRes([
				["name", "status"],
				[name, status],
			]);

		fetchMock
			.mockResolvedValueOnce(metadata("Latex Balloons")) // product_types
			.mockResolvedValueOnce(metadata("Birthday")) // occasions
			.mockResolvedValueOnce(metadata("Flaming Red")) // manufacturer_colors
			.mockResolvedValueOnce(metadata("Red")) // sparkys_colors
			// brands: one active (kept) + one archived (filtered out of metadata).
			.mockResolvedValueOnce(
				valuesRes([
					["name", "status"],
					["Qualatex", "active"],
					["Anagram", "archived"],
				]),
			)
			.mockResolvedValueOnce(metadata("Round")) // shapes
			.mockResolvedValueOnce(metadata("Matte")) // textures
			.mockResolvedValueOnce(metadata("Default Distributor")) // distributors
			.mockResolvedValueOnce(metadata("50")) // bag_quantities
			.mockResolvedValueOnce(
				valuesRes([
					INTERNAL_HEADER,
					[
						"1",
						"Red Latex",
						"Latex Balloons",
						"Red",
						"Matte",
						"Round",
						"Birthday",
						"111",
						"5",
						"FALSE",
						"active",
					],
				]),
			)
			.mockResolvedValueOnce(
				valuesRes([
					EXTERNAL_HEADER,
					[
						"111",
						"Flaming Red",
						"Qualatex",
						'18"',
						"50",
						"Default Distributor",
						"10",
						"active",
					],
					[
						"222",
						"Ocean Blue",
						"Anagram",
						'11"',
						"50",
						"Default Distributor",
						"3",
						"active",
					],
					// Blank size contributes nothing to uniqueSizes (filter Boolean).
					[
						"333",
						"Rose Pink",
						"Betallic",
						"",
						"20",
						"Default Distributor",
						"1",
						"active",
					],
				]),
			);

		const result = await svc().getAllSheetsData(TOKEN);

		expect(result.metadata.productType).toEqual(["Latex Balloons"]);
		// Active brand kept; archived brand filtered out of the active list.
		expect(result.metadata.manufacturer).toEqual(["Qualatex"]);
		expect(result.metadata.size).toEqual(['11"', '18"']);
		expect(result.fullMetadata.manufacturer).toEqual([
			{ name: "Qualatex", status: "active" },
			{ name: "Anagram", status: "archived" },
		]);
		expect(result.fullMetadata.size).toEqual([
			{ name: '11"', status: "active" },
			{ name: '18"', status: "active" },
		]);
		expect(result.internalProducts).toHaveLength(1);
		expect(result.externalProducts).toHaveLength(3);
	});

	it("rethrows when an underlying fetch fails", async () => {
		fetchMock.mockRejectedValue(new Error("network down"));

		await expect(svc().getAllSheetsData(TOKEN)).rejects.toThrow("network down");
	});
});

describe("GoogleSheetsService.appendToSheet", () => {
	it("POSTs the values with USER_ENTERED option", async () => {
		fetchMock.mockResolvedValueOnce(res(true, {}));

		await svc().appendToSheet("events", [["a", "b"]], TOKEN);

		expect(urlOf(0)).toBe(
			`${BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(
				"events",
			)}:append?valueInputOption=USER_ENTERED`,
		);
		expect(methodOf(0)).toBe("POST");
		expect(bodyOf(0)).toEqual({ values: [["a", "b"]] });
	});

	it("throws on a non-OK response", async () => {
		fetchMock.mockResolvedValueOnce(
			res(false, null, { status: 400, statusText: "Bad", text: "nope" }),
		);

		await expect(svc().appendToSheet("events", [["a"]], TOKEN)).rejects.toThrow(
			"Failed to append to sheet: 400 Bad",
		);
	});
});

describe("GoogleSheetsService.getNextId", () => {
	it("returns 1 when the sheet has at most a header row", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes([["id"]]));

		expect(await svc().getNextId("events", TOKEN)).toBe(1);
	});

	it("returns 1 when there is no id column", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes([["foo"], ["7"]]));

		expect(await svc().getNextId("events", TOKEN)).toBe(1);
	});

	it("returns max id + 1, treating missing cells as zero", async () => {
		fetchMock.mockResolvedValueOnce(
			valuesRes([["id", "x"], ["3", "a"], [], ["7", "b"], ["2", "c"]]),
		);

		expect(await svc().getNextId("events", TOKEN)).toBe(8);
	});
});

describe("GoogleSheetsService.addMetadataItem", () => {
	it("appends a new row and logs a create audit event", async () => {
		// getNextId (events) -> append (metadata) -> logEvent[getNextId events, getUserEmail] -> append (events)
		fetchMock
			.mockResolvedValueOnce(valuesRes([["id"], ["1"]])) // getNextId for the metadata sheet
			.mockResolvedValueOnce(res(true, {})) // append metadata row
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // logEvent getNextId(events)
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" })) // getUserEmail
			.mockResolvedValueOnce(res(true, {})); // append events row

		await svc().addMetadataItem("brands", "NewBrand", TOKEN);

		// Appended metadata row: [name, id, status]
		expect(bodyOf(1)).toEqual({ values: [["NewBrand", "2", "active"]] });
		// Audit row reflects the create event.
		const auditRow = (bodyOf(4).values as string[][])[0];
		expect(auditRow[2]).toBe("create");
		expect(auditRow[3]).toBe("metadata");
		expect(auditRow[5]).toBe("NewBrand");
		expect(auditRow[9]).toBe("u@mill.com");
	});
});

describe("GoogleSheetsService.addInternalProduct", () => {
	it("appends the row (never_out TRUE) and logs a create event", async () => {
		fetchMock
			.mockResolvedValueOnce(res(true, {})) // append internal_products
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // logEvent getNextId
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" })) // getUserEmail
			.mockResolvedValueOnce(res(true, {})); // append events

		await svc().addInternalProduct(
			internalSheet({ never_out: true, threshold_quantity: 9 }),
			TOKEN,
		);

		expect(bodyOf(0)).toEqual({
			values: [
				[
					"1",
					"Red Latex",
					"Latex Balloons",
					"Red",
					"Matte",
					"Round",
					"Birthday",
					"111",
					"9",
					"TRUE",
					"active",
				],
			],
		});
		expect((bodyOf(3).values as string[][])[0][2]).toBe("create");
	});

	it("defaults threshold/never_out/status when fields are falsy", async () => {
		fetchMock
			.mockResolvedValueOnce(res(true, {}))
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().addInternalProduct(
			internalSheet({
				threshold_quantity: 0,
				never_out: false,
				status: undefined,
			}),
			TOKEN,
		);

		const row = (bodyOf(0).values as string[][])[0];
		expect(row[8]).toBe("0");
		expect(row[9]).toBe("FALSE");
		expect(row[10]).toBe("active");
	});
});

describe("GoogleSheetsService.addExternalProduct", () => {
	it("appends the row and logs a create event", async () => {
		fetchMock
			.mockResolvedValueOnce(res(true, {})) // append external_products
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().addExternalProduct(externalSheet({ status: undefined }), TOKEN);

		const row = (bodyOf(0).values as string[][])[0];
		expect(row).toEqual([
			"111",
			"Flaming Red",
			"Qualatex",
			'11"',
			"50",
			"Default Distributor",
			"10",
			"active",
		]);
		expect((bodyOf(3).values as string[][])[0][3]).toBe("external_product");
	});
});

describe("GoogleSheetsService.findRowByValue", () => {
	it("returns null for an empty sheet", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes([]));

		expect(await svc().findRowByValue("brands", "name", "x", TOKEN)).toBeNull();
	});

	it("returns null when the column does not exist", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes([["foo"], ["bar"]]));

		expect(await svc().findRowByValue("brands", "name", "x", TOKEN)).toBeNull();
	});

	it("returns a 1-based row number when found (case-insensitive header)", async () => {
		fetchMock.mockResolvedValueOnce(
			valuesRes([["Name"], ["a"], ["target"], ["c"]]),
		);

		expect(await svc().findRowByValue("brands", "name", "target", TOKEN)).toBe(
			3,
		);
	});

	it("returns null when the value is not present", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes([["name"], ["a"]]));

		expect(
			await svc().findRowByValue("brands", "name", "missing", TOKEN),
		).toBeNull();
	});
});

describe("GoogleSheetsService.updateRow", () => {
	it("PUTs the row to the correct range", async () => {
		fetchMock.mockResolvedValueOnce(res(true, {}));

		await svc().updateRow("brands", 4, ["a", "b"], TOKEN);

		expect(urlOf(0)).toBe(
			`${BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(
				"brands!A4:Z4",
			)}?valueInputOption=USER_ENTERED`,
		);
		expect(methodOf(0)).toBe("PUT");
		expect(bodyOf(0)).toEqual({ values: [["a", "b"]] });
	});

	it("throws on a non-OK response", async () => {
		fetchMock.mockResolvedValueOnce(
			res(false, null, { status: 500, statusText: "Err", text: "boom" }),
		);

		await expect(svc().updateRow("brands", 1, ["a"], TOKEN)).rejects.toThrow(
			"Failed to update sheet: 500 Err",
		);
	});
});

describe("GoogleSheetsService.logEvent", () => {
	it("appends an events row with the resolved id and email", async () => {
		fetchMock
			.mockResolvedValueOnce(
				valuesRes([EVENTS_HEADER, EVENTS_HEADER.map(() => "")]),
			)
			.mockResolvedValueOnce(res(true, { email: "person@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().logEvent(
			{
				timestamp: "2026-01-01T00:00:00.000Z",
				event_type: "create",
				object_type: "metadata",
				object_id: "5",
				object_name: "Foo",
				changes: '{"name":"Foo"}',
				before_state: "",
				sheet_name: "brands",
			},
			TOKEN,
		);

		const row = (bodyOf(2).values as string[][])[0];
		expect(row[1]).toBe("2026-01-01T00:00:00.000Z");
		expect(row[7]).toBe(""); // before_state || ""
		expect(row[9]).toBe("person@mill.com");
	});

	it("uses the provided before_state when present", async () => {
		fetchMock
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "person@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().logEvent(
			{
				timestamp: "t",
				event_type: "edit",
				object_type: "metadata",
				object_id: "5",
				object_name: "Foo",
				changes: "{}",
				before_state: '{"name":"Old"}',
				sheet_name: "brands",
			},
			TOKEN,
		);

		expect((bodyOf(2).values as string[][])[0][7]).toBe('{"name":"Old"}');
	});

	it("swallows errors thrown while logging", async () => {
		// getNextId(events) rejects -> Promise.all rejects -> caught, no throw.
		fetchMock.mockRejectedValue(new Error("boom"));

		await expect(
			svc().logEvent(
				{
					timestamp: "t",
					event_type: "create",
					object_type: "metadata",
					object_id: "1",
					object_name: "x",
					changes: "{}",
					before_state: "",
					sheet_name: "brands",
				},
				TOKEN,
			),
		).resolves.toBeUndefined();
	});
});

describe("GoogleSheetsService.getUserEmail (via logEvent)", () => {
	it("falls back to 'unknown' when userinfo omits an email", async () => {
		fetchMock
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // getNextId
			.mockResolvedValueOnce(res(true, {})) // userinfo without email
			.mockResolvedValueOnce(res(true, {})); // append events

		await svc().logEvent(
			{
				timestamp: "t",
				event_type: "create",
				object_type: "metadata",
				object_id: "1",
				object_name: "x",
				changes: "{}",
				before_state: "",
				sheet_name: "brands",
			},
			TOKEN,
		);

		expect(urlOf(1)).toBe(USERINFO_URL);
		expect((bodyOf(2).values as string[][])[0][9]).toBe("unknown");
	});

	it("falls back to 'unknown' when userinfo is non-OK", async () => {
		fetchMock
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(false, null, { status: 401 }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().logEvent(
			{
				timestamp: "t",
				event_type: "create",
				object_type: "metadata",
				object_id: "1",
				object_name: "x",
				changes: "{}",
				before_state: "",
				sheet_name: "brands",
			},
			TOKEN,
		);

		expect((bodyOf(2).values as string[][])[0][9]).toBe("unknown");
	});

	it("falls back to 'unknown' when the userinfo fetch throws", async () => {
		// getNextId resolves; getUserEmail's fetch rejects but is caught -> "unknown".
		let call = 0;
		fetchMock.mockImplementation((input: RequestInfo | URL) => {
			const url = String(input);
			if (url === USERINFO_URL) {
				return Promise.reject(new Error("net"));
			}
			call += 1;
			if (call === 1) {
				return Promise.resolve(valuesRes([EVENTS_HEADER]));
			}
			return Promise.resolve(res(true, {}));
		});

		await svc().logEvent(
			{
				timestamp: "t",
				event_type: "create",
				object_type: "metadata",
				object_id: "1",
				object_name: "x",
				changes: "{}",
				before_state: "",
				sheet_name: "brands",
			},
			TOKEN,
		);

		const appendCall = fetchMock.mock.calls.findIndex(
			(c) => (c[1] as RequestInit | undefined)?.method === "POST",
		);
		expect((bodyOf(appendCall).values as string[][])[0][9]).toBe("unknown");
	});
});

describe("GoogleSheetsService.getAuditEvents", () => {
	it("returns [] when only a header row exists", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]));

		expect(await svc().getAuditEvents(TOKEN)).toEqual([]);
	});

	it("parses rows, skips short rows, sorts desc, and paginates", async () => {
		fetchMock.mockResolvedValueOnce(
			valuesRes([
				EVENTS_HEADER,
				["1", "t1", "create", "metadata", "a", "A", "{}", "", "brands", "u1"],
				// Short row (length < 10) is skipped.
				["2", "t2", "edit"],
				["3", "t3", "edit", "metadata", "c", "C", "{}", "", "brands", "u3"],
				// Missing trailing cells fall back to defaults.
				["5", "", "", "", "", "", "", "", "", ""],
			]),
		);

		const events = await svc().getAuditEvents(TOKEN, 2, 1);

		// Sorted desc by id: [5, 3, 1]; offset 1, limit 2 -> [3, 1].
		expect(events.map((e) => e.id)).toEqual([3, 1]);
		expect(events[1].user_email).toBe("u1");
	});

	it("defaults id and user_email when cells are blank", async () => {
		fetchMock.mockResolvedValueOnce(
			valuesRes([
				EVENTS_HEADER,
				["", "", "create", "metadata", "", "", "", "", "", ""],
			]),
		);

		const events = await svc().getAuditEvents(TOKEN);

		expect(events[0].id).toBe(0);
		expect(events[0].user_email).toBe("unknown");
		expect(events[0].timestamp).toBe("");
	});

	it("returns [] when fetching events throws", async () => {
		fetchMock.mockRejectedValue(new Error("boom"));

		expect(await svc().getAuditEvents(TOKEN)).toEqual([]);
	});
});

describe("GoogleSheetsService.archiveExternalProduct", () => {
	it("throws when the SKU is not found", async () => {
		// getSheetData (currentData) + findRowByValue both read the sheet.
		fetchMock
			.mockResolvedValueOnce(valuesRes([EXTERNAL_HEADER]))
			.mockResolvedValueOnce(valuesRes([EXTERNAL_HEADER]));

		await expect(svc().archiveExternalProduct("999", TOKEN)).rejects.toThrow(
			'External product "999" not found',
		);
	});

	it("sets the status cell to archived and logs an archive event", async () => {
		const sheet = [
			EXTERNAL_HEADER,
			[
				"111",
				"Flaming Red",
				"Qualatex",
				'11"',
				"50",
				"Default Distributor",
				"10",
				"active",
			],
		];
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheet)) // getSheetData
			.mockResolvedValueOnce(valuesRes(sheet)) // findRowByValue
			.mockResolvedValueOnce(res(true, {})) // updateRow
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // logEvent getNextId
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" })) // getUserEmail
			.mockResolvedValueOnce(res(true, {})); // append events

		await svc().archiveExternalProduct("111", TOKEN);

		// updateRow body has the archived status in column index 7.
		expect((bodyOf(2).values as string[][])[0][7]).toBe("archived");
		expect((bodyOf(5).values as string[][])[0][2]).toBe("archive");
	});
});

describe("GoogleSheetsService.unarchiveExternalProduct", () => {
	it("throws when the SKU is not found", async () => {
		fetchMock
			.mockResolvedValueOnce(valuesRes([EXTERNAL_HEADER]))
			.mockResolvedValueOnce(valuesRes([EXTERNAL_HEADER]));

		await expect(svc().unarchiveExternalProduct("999", TOKEN)).rejects.toThrow(
			'External product "999" not found',
		);
	});

	it("sets the status cell to active and logs an unarchive event", async () => {
		const sheet = [
			EXTERNAL_HEADER,
			[
				"111",
				"Flaming Red",
				"Qualatex",
				'11"',
				"50",
				"Default Distributor",
				"10",
				"archived",
			],
		];
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheet))
			.mockResolvedValueOnce(valuesRes(sheet))
			.mockResolvedValueOnce(res(true, {}))
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().unarchiveExternalProduct("111", TOKEN);

		expect((bodyOf(2).values as string[][])[0][7]).toBe("active");
		expect((bodyOf(5).values as string[][])[0][2]).toBe("unarchive");
	});
});

describe("GoogleSheetsService.archiveInternalProduct", () => {
	it("throws when the id is not found", async () => {
		fetchMock
			.mockResolvedValueOnce(valuesRes([INTERNAL_HEADER]))
			.mockResolvedValueOnce(valuesRes([INTERNAL_HEADER]));

		await expect(svc().archiveInternalProduct("999", TOKEN)).rejects.toThrow(
			'Internal product with ID "999" not found',
		);
	});

	it("sets the status cell to archived and logs using the product name", async () => {
		const sheet = [
			INTERNAL_HEADER,
			[
				"1",
				"Red Latex",
				"Latex Balloons",
				"Red",
				"Matte",
				"Round",
				"Birthday",
				"111",
				"5",
				"FALSE",
				"active",
			],
		];
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheet))
			.mockResolvedValueOnce(valuesRes(sheet))
			.mockResolvedValueOnce(res(true, {}))
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().archiveInternalProduct("1", TOKEN);

		expect((bodyOf(2).values as string[][])[0][10]).toBe("archived");
		const auditRow = (bodyOf(5).values as string[][])[0];
		expect(auditRow[2]).toBe("archive");
		expect(auditRow[5]).toBe("Red Latex"); // object_name from currentRow[1]
	});

	it("falls back to the id for object_name when the name cell is blank", async () => {
		const sheet = [
			INTERNAL_HEADER,
			["7", "", "", "", "", "", "", "", "", "", "active"],
		];
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheet))
			.mockResolvedValueOnce(valuesRes(sheet))
			.mockResolvedValueOnce(res(true, {}))
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().archiveInternalProduct("7", TOKEN);

		expect((bodyOf(5).values as string[][])[0][5]).toBe("7");
	});
});

describe("GoogleSheetsService.unarchiveInternalProduct", () => {
	it("throws when the id is not found", async () => {
		fetchMock
			.mockResolvedValueOnce(valuesRes([INTERNAL_HEADER]))
			.mockResolvedValueOnce(valuesRes([INTERNAL_HEADER]));

		await expect(svc().unarchiveInternalProduct("999", TOKEN)).rejects.toThrow(
			'Internal product with ID "999" not found',
		);
	});

	it("sets the status cell to active and logs an unarchive event", async () => {
		const sheet = [
			INTERNAL_HEADER,
			[
				"1",
				"Red Latex",
				"Latex Balloons",
				"Red",
				"Matte",
				"Round",
				"Birthday",
				"111",
				"5",
				"FALSE",
				"archived",
			],
		];
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheet))
			.mockResolvedValueOnce(valuesRes(sheet))
			.mockResolvedValueOnce(res(true, {}))
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().unarchiveInternalProduct("1", TOKEN);

		expect((bodyOf(2).values as string[][])[0][10]).toBe("active");
		expect((bodyOf(5).values as string[][])[0][2]).toBe("unarchive");
	});

	it("falls back to the id for object_name when the name cell is blank", async () => {
		const sheet = [
			INTERNAL_HEADER,
			["7", "", "", "", "", "", "", "", "", "", "archived"],
		];
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheet))
			.mockResolvedValueOnce(valuesRes(sheet))
			.mockResolvedValueOnce(res(true, {}))
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().unarchiveInternalProduct("7", TOKEN);

		expect((bodyOf(5).values as string[][])[0][5]).toBe("7");
	});
});

describe("GoogleSheetsService.updateExternalProduct", () => {
	const sheetWith = (row: string[]) => [EXTERNAL_HEADER, row];
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

	it("throws when the SKU is not found", async () => {
		fetchMock
			.mockResolvedValueOnce(valuesRes([EXTERNAL_HEADER])) // getSheetData
			.mockResolvedValueOnce(valuesRes([EXTERNAL_HEADER])); // findRowByValue

		await expect(
			svc().updateExternalProduct(externalSheet(), TOKEN),
		).rejects.toThrow('External product "111" not found');
	});

	it("updates the row without auditing when skipAuditLog is true", async () => {
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow))) // getSheetData
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow))) // findRowByValue
			.mockResolvedValueOnce(res(true, {})); // updateRow

		await svc().updateExternalProduct(
			externalSheet({ quantity: 99 }),
			TOKEN,
			true,
		);

		// Only the three reads/writes above — no audit append.
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect((bodyOf(2).values as string[][])[0][6]).toBe("99");
	});

	it("does not audit when the current row is missing from currentData", async () => {
		// findRowByValue finds row 2, but currentData only has the header, so
		// currentData.length (1) is not > rowNumber-1 (1): beforeState stays {}.
		fetchMock
			.mockResolvedValueOnce(valuesRes([EXTERNAL_HEADER])) // getSheetData (no data row)
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow))) // findRowByValue -> row 2
			.mockResolvedValueOnce(res(true, {})); // updateRow

		await svc().updateExternalProduct(externalSheet({ quantity: 99 }), TOKEN);

		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("logs a pure quantity_update event", async () => {
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow)))
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow)))
			.mockResolvedValueOnce(res(true, {})) // updateRow
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // logEvent getNextId
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" })) // getUserEmail
			.mockResolvedValueOnce(res(true, {})); // append events

		await svc().updateExternalProduct(externalSheet({ quantity: 42 }), TOKEN);

		const auditRow = (bodyOf(5).values as string[][])[0];
		expect(auditRow[2]).toBe("quantity_update");
		expect(auditRow[6]).toBe(JSON.stringify({ quantity: 42 }));
		expect(auditRow[7]).toBe(JSON.stringify({ quantity: 10 }));
	});

	it("logs a pure archive event when only status changes to archived", async () => {
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow)))
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow)))
			.mockResolvedValueOnce(res(true, {}))
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().updateExternalProduct(
			externalSheet({ status: "archived" }),
			TOKEN,
		);

		expect((bodyOf(5).values as string[][])[0][2]).toBe("archive");
	});

	it("logs a pure unarchive event when status changes from archived to active", async () => {
		const archivedRow = [...baseRow];
		archivedRow[7] = "archived";
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(archivedRow)))
			.mockResolvedValueOnce(valuesRes(sheetWith(archivedRow)))
			.mockResolvedValueOnce(res(true, {}))
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		// status defaults to "active" (undefined) to exercise the `|| "active"` path.
		await svc().updateExternalProduct(
			externalSheet({ status: undefined }),
			TOKEN,
		);

		expect((bodyOf(5).values as string[][])[0][2]).toBe("unarchive");
	});

	it("logs a pure edit event when only non-status/quantity fields change", async () => {
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow)))
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow)))
			.mockResolvedValueOnce(res(true, {}))
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().updateExternalProduct(
			externalSheet({
				manufacturer_color: "Ocean Blue",
				brand: "Anagram",
				size: '18"',
				bag_quantity: 100,
				distributors: "Other",
			}),
			TOKEN,
		);

		const auditRow = (bodyOf(5).values as string[][])[0];
		expect(auditRow[2]).toBe("edit");
		const changes = JSON.parse(auditRow[6]);
		expect(changes).toEqual({
			manufacturer_color: "Ocean Blue",
			brand: "Anagram",
			size: '18"',
			bag_quantity: 100,
			distributors: "Other",
		});
		// quantity/status are stripped from the edit payload.
		expect(changes.quantity).toBeUndefined();
		expect(changes.status).toBeUndefined();
	});

	it("logs separate archive, quantity_update and edit events for a mixed change", async () => {
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow)))
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow)))
			.mockResolvedValueOnce(res(true, {})) // updateRow
			// Event 1 (archive): getNextId, getUserEmail, append
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}))
			// Event 2 (quantity_update)
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}))
			// Event 3 (edit)
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().updateExternalProduct(
			externalSheet({
				status: "archived",
				quantity: 99,
				brand: "Anagram",
			}),
			TOKEN,
		);

		const eventTypes = fetchMock.mock.calls
			.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST")
			.map((_, i, arr) => arr[i])
			.map((c) => JSON.parse((c[1] as RequestInit).body as string))
			.map((b) => (b.values as string[][])[0][2]);

		expect(eventTypes).toEqual(["archive", "quantity_update", "edit"]);
	});

	it("logs only archive + quantity_update for a mixed status/quantity change (no edit)", async () => {
		// hasOtherChanges is false, so the trailing edit block is skipped.
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow)))
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow)))
			.mockResolvedValueOnce(res(true, {}))
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}))
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().updateExternalProduct(
			externalSheet({ status: "archived", quantity: 99 }),
			TOKEN,
		);

		const eventTypes = fetchMock.mock.calls
			.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST")
			.map((c) => JSON.parse((c[1] as RequestInit).body as string))
			.map((b) => (b.values as string[][])[0][2]);

		expect(eventTypes).toEqual(["archive", "quantity_update"]);
	});

	it("logs unarchive within a mixed change when status goes archived -> active", async () => {
		// Drives the mixed-branch ternary's "unarchive" outcome (status default).
		const archivedRow = [...baseRow];
		archivedRow[7] = "archived";
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(archivedRow)))
			.mockResolvedValueOnce(valuesRes(sheetWith(archivedRow)))
			.mockResolvedValueOnce(res(true, {})) // updateRow
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // event 1: unarchive
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}))
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // event 2: quantity_update
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}))
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // event 3: edit
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().updateExternalProduct(
			externalSheet({ status: undefined, quantity: 99, brand: "Anagram" }),
			TOKEN,
		);

		const eventTypes = fetchMock.mock.calls
			.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST")
			.map((c) => JSON.parse((c[1] as RequestInit).body as string))
			.map((b) => (b.values as string[][])[0][2]);

		expect(eventTypes).toEqual(["unarchive", "quantity_update", "edit"]);
	});

	it("logs quantity_update + edit (no status) for a mixed quantity/field change", async () => {
		// Enters the mixed branch with hasStatusChange === false, exercising the
		// implicit else of the `if (hasStatusChange)` guard.
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow)))
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow)))
			.mockResolvedValueOnce(res(true, {})) // updateRow
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // event 1: quantity_update
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}))
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // event 2: edit
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().updateExternalProduct(
			externalSheet({ quantity: 99, brand: "Anagram" }),
			TOKEN,
		);

		const eventTypes = fetchMock.mock.calls
			.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST")
			.map((c) => JSON.parse((c[1] as RequestInit).body as string))
			.map((b) => (b.values as string[][])[0][2]);

		expect(eventTypes).toEqual(["quantity_update", "edit"]);
	});

	it("logs archive + edit (no quantity) for a mixed status/field change", async () => {
		// Enters the mixed branch with hasQuantityChange === false, exercising the
		// implicit else of the `if (hasQuantityChange)` guard.
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow)))
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow)))
			.mockResolvedValueOnce(res(true, {})) // updateRow
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // event 1: archive
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}))
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // event 2: edit
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().updateExternalProduct(
			externalSheet({ status: "archived", brand: "Anagram" }),
			TOKEN,
		);

		const eventTypes = fetchMock.mock.calls
			.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST")
			.map((c) => JSON.parse((c[1] as RequestInit).body as string))
			.map((b) => (b.values as string[][])[0][2]);

		expect(eventTypes).toEqual(["archive", "edit"]);
	});

	it("captures a blank-celled before state via the default fallbacks", async () => {
		// Sparse current row (only the SKU set) forces every beforeState default:
		// `currentRow[n] || ""` and `parseInt(currentRow[n] || "0")`.
		const sparseRow = ["111", "", "", "", "", "", "", ""];
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(sparseRow))) // getSheetData
			.mockResolvedValueOnce(valuesRes(sheetWith(sparseRow))) // findRowByValue
			.mockResolvedValueOnce(res(true, {})) // updateRow
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // logEvent getNextId
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		// Only a non-status/non-quantity field differs from the blank baseline,
		// yielding a single edit event (everything else matches the defaults).
		await svc().updateExternalProduct(
			externalSheet({
				brand: "Anagram",
				manufacturer_color: "",
				size: "",
				bag_quantity: 0,
				distributors: "",
				quantity: 0,
				status: undefined,
			}),
			TOKEN,
		);

		const auditRow = (bodyOf(5).values as string[][])[0];
		expect(auditRow[2]).toBe("edit");
		const before = JSON.parse(auditRow[7]);
		expect(before).toEqual({ brand: "" });
	});

	it("defaults the before-state sku to '' when the matched cell is empty", async () => {
		// Looking up an empty SKU matches a row whose id cell is blank, driving the
		// `currentRow[0] || ""` default in the before-state capture.
		const emptyIdRow = [
			"",
			"Flaming Red",
			"Qualatex",
			'11"',
			"50",
			"Default Distributor",
			"10",
			"active",
		];
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(emptyIdRow))) // getSheetData
			.mockResolvedValueOnce(valuesRes(sheetWith(emptyIdRow))) // findRowByValue
			.mockResolvedValueOnce(res(true, {})) // updateRow
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // logEvent getNextId
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().updateExternalProduct(
			externalSheet({ unique_id_sku: "", quantity: 42 }),
			TOKEN,
		);

		expect((bodyOf(5).values as string[][])[0][2]).toBe("quantity_update");
	});
});

describe("GoogleSheetsService.updateInternalProduct", () => {
	const sheetWith = (row: string[]) => [INTERNAL_HEADER, row];
	const baseRow = [
		"1",
		"Red Latex",
		"Latex Balloons",
		"Red",
		"Matte",
		"Round",
		"Birthday",
		"111",
		"5",
		"FALSE",
		"active",
	];

	it("throws when the id is not found", async () => {
		fetchMock
			.mockResolvedValueOnce(valuesRes([INTERNAL_HEADER]))
			.mockResolvedValueOnce(valuesRes([INTERNAL_HEADER]));

		await expect(
			svc().updateInternalProduct(internalSheet(), TOKEN),
		).rejects.toThrow('Internal product with ID "1" not found');
	});

	it("does not audit when no fields changed", async () => {
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow))) // getSheetData
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow))) // findRowByValue
			.mockResolvedValueOnce(res(true, {})); // updateRow

		// internalSheet() matches baseRow exactly -> changes object stays empty.
		await svc().updateInternalProduct(internalSheet(), TOKEN);

		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("does not audit when the current row is missing from currentData", async () => {
		fetchMock
			.mockResolvedValueOnce(valuesRes([INTERNAL_HEADER])) // header only
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow))) // findRowByValue -> row 2
			.mockResolvedValueOnce(res(true, {}));

		await svc().updateInternalProduct(
			internalSheet({ sparkys_product_name: "Changed" }),
			TOKEN,
		);

		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("logs an edit event capturing every changed field", async () => {
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow)))
			.mockResolvedValueOnce(valuesRes(sheetWith(baseRow)))
			.mockResolvedValueOnce(res(true, {})) // updateRow
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // logEvent getNextId
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().updateInternalProduct(
			internalSheet({
				sparkys_product_name: "Blue Latex",
				product_type: "Foil Balloons",
				sparkys_color: "Blue",
				texture: "Pearl",
				shape: "Heart",
				occasions: "Wedding",
				threshold_quantity: 9,
				never_out: true,
				status: "archived",
			}),
			TOKEN,
		);

		const auditRow = (bodyOf(5).values as string[][])[0];
		expect(auditRow[2]).toBe("edit");
		const changes = JSON.parse(auditRow[6]);
		expect(changes).toEqual({
			sparkys_product_name: "Blue Latex",
			product_type: "Foil Balloons",
			sparkys_color: "Blue",
			texture: "Pearl",
			shape: "Heart",
			occasions: "Wedding",
			threshold_quantity: 9,
			never_out: true,
			status: "archived",
		});
	});

	it("captures a blank-celled before state via the default fallbacks", async () => {
		// Sparse current row (only the id set) forces every beforeState default.
		const sparseRow = ["1", "", "", "", "", "", "", "", "", "", ""];
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(sparseRow))) // getSheetData
			.mockResolvedValueOnce(valuesRes(sheetWith(sparseRow))) // findRowByValue
			.mockResolvedValueOnce(res(true, {})) // updateRow
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // logEvent getNextId
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		// Change a single field against the blank baseline (threshold 0, never_out
		// false, status "active" all match the defaults) -> one edit event.
		await svc().updateInternalProduct(
			internalSheet({
				sparkys_product_name: "Changed",
				product_type: "",
				sparkys_color: "",
				texture: "",
				shape: "",
				occasions: "",
				products: "",
				threshold_quantity: 0,
				never_out: false,
				status: undefined,
			}),
			TOKEN,
		);

		const auditRow = (bodyOf(5).values as string[][])[0];
		const changes = JSON.parse(auditRow[6]);
		const before = JSON.parse(auditRow[7]);
		expect(changes).toEqual({ sparkys_product_name: "Changed" });
		expect(before).toEqual({ sparkys_product_name: "" });
	});

	it("treats an undefined status as 'active' when comparing", async () => {
		const archivedRow = [...baseRow];
		archivedRow[10] = "archived";
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(archivedRow)))
			.mockResolvedValueOnce(valuesRes(sheetWith(archivedRow)))
			.mockResolvedValueOnce(res(true, {}))
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		// Only status differs (archived -> active via undefined default).
		await svc().updateInternalProduct(
			internalSheet({ status: undefined }),
			TOKEN,
		);

		const changes = JSON.parse((bodyOf(5).values as string[][])[0][6]);
		expect(changes).toEqual({ status: "active" });
	});

	it("defaults the before-state id to '' when the matched cell is empty", async () => {
		// Looking up an empty id matches a row whose id cell is blank, driving the
		// `currentRow[0] || ""` default in the before-state capture.
		const emptyIdRow = [
			"",
			"Red Latex",
			"Latex Balloons",
			"Red",
			"Matte",
			"Round",
			"Birthday",
			"111",
			"5",
			"FALSE",
			"active",
		];
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheetWith(emptyIdRow))) // getSheetData
			.mockResolvedValueOnce(valuesRes(sheetWith(emptyIdRow))) // findRowByValue
			.mockResolvedValueOnce(res(true, {})) // updateRow
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // logEvent getNextId
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().updateInternalProduct(
			internalSheet({ id: "", sparkys_product_name: "Renamed" }),
			TOKEN,
		);

		const changes = JSON.parse((bodyOf(5).values as string[][])[0][6]);
		expect(changes).toEqual({ sparkys_product_name: "Renamed" });
	});
});

describe("GoogleSheetsService.updateMetadataItem", () => {
	const metaSheet = [
		["name", "id", "status"],
		["OldName", "5", "active"],
	];

	it("throws when the item is not found", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes([["name", "id", "status"]])); // findRowByValue

		await expect(
			svc().updateMetadataItem("brands", "OldName", "NewName", TOKEN),
		).rejects.toThrow('Metadata item "OldName" not found in brands');
	});

	it("updates the row, logs an edit, and cascades (no product sheets for 'brands' branch handled separately)", async () => {
		// brands -> external_products.brand cascade. Sequence:
		// findRowByValue(brands) read
		// getSheetData(brands) read
		// updateRow(brands)
		// logEvent: getNextId(events), getUserEmail, append(events)
		// cascade: updateProductSheetWithMetadataChange -> getSheetData(external_products)
		const externalData = [
			EXTERNAL_HEADER,
			[
				"111",
				"Flaming Red",
				"OldName",
				'11"',
				"50",
				"Default Distributor",
				"10",
				"active",
			],
		];
		fetchMock
			.mockResolvedValueOnce(valuesRes(metaSheet)) // findRowByValue(brands)
			.mockResolvedValueOnce(valuesRes(metaSheet)) // getSheetData(brands)
			.mockResolvedValueOnce(res(true, {})) // updateRow(brands)
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // logEvent getNextId
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" })) // getUserEmail
			.mockResolvedValueOnce(res(true, {})) // append(events)
			.mockResolvedValueOnce(valuesRes(externalData)) // cascade getSheetData(external_products)
			.mockResolvedValueOnce(res(true, {})); // cascade updateRow(external_products)

		await svc().updateMetadataItem("brands", "OldName", "NewName", TOKEN);

		// Metadata row preserves id, updates name + keeps status.
		expect(bodyOf(2).values as string[][]).toEqual([
			["NewName", "5", "active"],
		]);
		// Audit edit event.
		expect((bodyOf(5).values as string[][])[0][2]).toBe("edit");
		// Cascade updated the external_products brand cell (index 2).
		expect((bodyOf(7).values as string[][])[0][2]).toBe("NewName");
	});

	it("defaults the preserved status to 'active' when the cell is blank", async () => {
		const noStatusSheet = [
			["name", "id"],
			["OldName", "5"],
		];
		fetchMock
			.mockResolvedValueOnce(valuesRes(noStatusSheet)) // findRowByValue
			.mockResolvedValueOnce(valuesRes(noStatusSheet)) // getSheetData
			.mockResolvedValueOnce(res(true, {})) // updateRow
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}))
			// cascade for brands -> external_products, header-only sheet returns early
			.mockResolvedValueOnce(valuesRes([EXTERNAL_HEADER]));

		await svc().updateMetadataItem("brands", "OldName", "NewName", TOKEN);

		expect(bodyOf(2).values as string[][]).toEqual([
			["NewName", "5", "active"],
		]);
	});
});

describe("GoogleSheetsService.updateProductsWithMetadataChange", () => {
	it("returns early for a metadata sheet with no associated product sheets", async () => {
		await svc().updateProductsWithMetadataChange(
			"unknown_sheet",
			"a",
			"b",
			TOKEN,
		);

		// default case -> sheetsToUpdate empty -> no fetches at all.
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns early when the target product sheet is empty", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes([])); // getSheetData(internal_products)

		await svc().updateProductsWithMetadataChange(
			"product_types",
			"a",
			"b",
			TOKEN,
		);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("returns early when the target column is absent from the product sheet", async () => {
		fetchMock.mockResolvedValueOnce(
			valuesRes([
				["id", "sparkys_product_name"],
				["1", "x"],
			]),
		);

		await svc().updateProductsWithMetadataChange(
			"product_types",
			"a",
			"b",
			TOKEN,
		);

		// Only the read; no updateRow because the product_type column is missing.
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("updates a direct-match column value", async () => {
		fetchMock
			.mockResolvedValueOnce(
				valuesRes([
					INTERNAL_HEADER,
					[
						"1",
						"Red",
						"Latex Balloons",
						"Red",
						"Matte",
						"Round",
						"Birthday",
						"111",
						"5",
						"FALSE",
						"active",
					],
					// Non-matching product_type: left untouched.
					[
						"2",
						"Blue",
						"Foil Balloons",
						"Blue",
						"Pearl",
						"Heart",
						"Wedding",
						"222",
						"5",
						"FALSE",
						"active",
					],
				]),
			)
			.mockResolvedValueOnce(res(true, {})); // updateRow for the one match

		await svc().updateProductsWithMetadataChange(
			"product_types",
			"Latex Balloons",
			"Latex",
			TOKEN,
		);

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect((bodyOf(1).values as string[][])[0][2]).toBe("Latex");
	});

	it("updates comma-separated occasions, replacing only the matching value", async () => {
		fetchMock
			.mockResolvedValueOnce(
				valuesRes([
					INTERNAL_HEADER,
					[
						"1",
						"Red",
						"Latex Balloons",
						"Red",
						"Matte",
						"Round",
						"Birthday, Wedding",
						"111",
						"5",
						"FALSE",
						"active",
					],
					// occasions cell without the target value -> not updated.
					[
						"2",
						"Blue",
						"Foil Balloons",
						"Blue",
						"Pearl",
						"Heart",
						"Graduation",
						"222",
						"5",
						"FALSE",
						"active",
					],
					// empty occasions -> values=[] -> not updated.
					[
						"3",
						"Green",
						"Foil Balloons",
						"Green",
						"Pearl",
						"Star",
						"",
						"333",
						"5",
						"FALSE",
						"active",
					],
				]),
			)
			.mockResolvedValueOnce(res(true, {})); // updateRow for the single match

		await svc().updateProductsWithMetadataChange(
			"occasions",
			"Birthday",
			"Bday",
			TOKEN,
		);

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect((bodyOf(1).values as string[][])[0][6]).toBe("Bday, Wedding");
	});
});

describe("GoogleSheetsService metadata sheet -> product sheet mapping", () => {
	// Exercises every case of the private getProductSheetsForMetadata switch via
	// updateProductsWithMetadataChange. Each maps to a single product sheet read.
	const cases: Array<{ meta: string; column: number; sample: string[] }> = [
		{
			meta: "product_types",
			column: 2,
			sample: [
				"1",
				"n",
				"OLD",
				"c",
				"t",
				"s",
				"o",
				"p",
				"0",
				"FALSE",
				"active",
			],
		},
		{
			meta: "sparkys_colors",
			column: 3,
			sample: [
				"1",
				"n",
				"pt",
				"OLD",
				"t",
				"s",
				"o",
				"p",
				"0",
				"FALSE",
				"active",
			],
		},
		{
			meta: "textures",
			column: 4,
			sample: [
				"1",
				"n",
				"pt",
				"c",
				"OLD",
				"s",
				"o",
				"p",
				"0",
				"FALSE",
				"active",
			],
		},
		{
			meta: "shapes",
			column: 5,
			sample: [
				"1",
				"n",
				"pt",
				"c",
				"t",
				"OLD",
				"o",
				"p",
				"0",
				"FALSE",
				"active",
			],
		},
	];

	it.each(
		cases,
	)("maps internal metadata '$meta' to its product column", async ({
		meta,
		column,
		sample,
	}) => {
		fetchMock
			.mockResolvedValueOnce(valuesRes([INTERNAL_HEADER, sample]))
			.mockResolvedValueOnce(res(true, {}));

		await svc().updateProductsWithMetadataChange(meta, "OLD", "NEW", TOKEN);

		expect((bodyOf(1).values as string[][])[0][column]).toBe("NEW");
	});

	it("maps external metadata sheets to external_products columns", async () => {
		const externalCases: Array<{ meta: string; column: number }> = [
			{ meta: "manufacturer_colors", column: 1 },
			{ meta: "brands", column: 2 },
			{ meta: "bag_quantities", column: 4 },
		];

		for (const { meta, column } of externalCases) {
			fetchMock.mockReset();
			const row = [
				"111",
				"OLD",
				"OLD",
				'11"',
				"OLD",
				"Default Distributor",
				"10",
				"active",
			];
			fetchMock
				.mockResolvedValueOnce(valuesRes([EXTERNAL_HEADER, row]))
				.mockResolvedValueOnce(res(true, {}));

			await svc().updateProductsWithMetadataChange(meta, "OLD", "NEW", TOKEN);

			expect((bodyOf(1).values as string[][])[0][column]).toBe("NEW");
		}
	});

	it("maps 'distributors' to the external_products comma-separated column", async () => {
		fetchMock
			.mockResolvedValueOnce(
				valuesRes([
					EXTERNAL_HEADER,
					[
						"111",
						"Flaming Red",
						"Qualatex",
						'11"',
						"50",
						"OLD, Other",
						"10",
						"active",
					],
				]),
			)
			.mockResolvedValueOnce(res(true, {}));

		await svc().updateProductsWithMetadataChange(
			"distributors",
			"OLD",
			"NEW",
			TOKEN,
		);

		expect((bodyOf(1).values as string[][])[0][5]).toBe("NEW, Other");
	});
});

describe("GoogleSheetsService.archiveMetadataItem", () => {
	it("throws when the item is not found", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes([["name", "id", "status"]]));

		await expect(
			svc().archiveMetadataItem("brands", "Foo", TOKEN),
		).rejects.toThrow('Metadata item "Foo" not found in brands');
	});

	it("writes an archived row and logs an archive event", async () => {
		const sheet = [
			["name", "id", "status"],
			["Foo", "5", "active"],
		];
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheet)) // findRowByValue
			.mockResolvedValueOnce(valuesRes(sheet)) // getSheetData
			.mockResolvedValueOnce(res(true, {})) // updateRow
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER])) // logEvent getNextId
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().archiveMetadataItem("brands", "Foo", TOKEN);

		expect(bodyOf(2).values as string[][]).toEqual([["Foo", "5", "archived"]]);
		expect((bodyOf(5).values as string[][])[0][2]).toBe("archive");
	});
});

describe("GoogleSheetsService.unarchiveMetadataItem", () => {
	it("throws when the item is not found", async () => {
		fetchMock.mockResolvedValueOnce(valuesRes([["name", "id", "status"]]));

		await expect(
			svc().unarchiveMetadataItem("brands", "Foo", TOKEN),
		).rejects.toThrow('Metadata item "Foo" not found in brands');
	});

	it("writes an active row and logs an unarchive event", async () => {
		const sheet = [
			["name", "id", "status"],
			["Foo", "5", "archived"],
		];
		fetchMock
			.mockResolvedValueOnce(valuesRes(sheet)) // findRowByValue
			.mockResolvedValueOnce(valuesRes(sheet)) // getSheetData
			.mockResolvedValueOnce(res(true, {})) // updateRow
			.mockResolvedValueOnce(valuesRes([EVENTS_HEADER]))
			.mockResolvedValueOnce(res(true, { email: "u@mill.com" }))
			.mockResolvedValueOnce(res(true, {}));

		await svc().unarchiveMetadataItem("brands", "Foo", TOKEN);

		expect(bodyOf(2).values as string[][]).toEqual([["Foo", "5", "active"]]);
		expect((bodyOf(5).values as string[][])[0][2]).toBe("unarchive");
	});
});
