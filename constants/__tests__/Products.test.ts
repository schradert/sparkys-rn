/// <reference types="jest" />

import {
	archiveExternalProduct,
	archiveInternalProduct,
	convertExternalProductModelToSheet,
	convertExternalProductSheetToModel,
	convertInternalProductModelToSheet,
	convertInternalProductSheetToModel,
	DEFAULT_FIELD_OPTIONS,
	type ExternalProduct,
	type ExternalProductSheet,
	formatCommaSeparated,
	getAllMetadataItems,
	getExternalProductsForInternal,
	getInternalProductTotalQuantity,
	getMetadataItems,
	getQuantityColor,
	type InternalProduct,
	type InternalProductSheet,
	isExternalProductArchived,
	isInternalProductArchived,
	isMetadataItemArchived,
	PRODUCT_FIELD_OPTIONS,
	parseCommaSeparated,
	unarchiveExternalProduct,
	unarchiveInternalProduct,
	updateFieldOptions,
	updateMetadataItems,
} from "@/constants/Products";
import { logger } from "@/services/logger";

const internal = (over: Partial<InternalProduct> = {}): InternalProduct => ({
	id: "1",
	sparkys_product_name: "Red Latex",
	product_type: "Latex",
	sparkys_color: "Red",
	texture: "Matte",
	shape: "Round",
	occasions: ["Birthday"],
	products: [],
	threshold_quantity: 5,
	never_out: false,
	...over,
});

const external = (over: Partial<ExternalProduct> = {}): ExternalProduct => ({
	unique_id_sku: "111",
	manufacturer_color: "Flaming Red",
	brand: "Qualatex",
	size: '11"',
	bag_quantity: 100,
	distributors: [],
	quantity: 0,
	...over,
});

describe("parse/format comma-separated", () => {
	it("parses, trimming whitespace and surrounding quotes", () => {
		expect(parseCommaSeparated('a, b ,"c"')).toEqual(["a", "b", "c"]);
	});

	it("returns [] for empty or blank input", () => {
		expect(parseCommaSeparated("")).toEqual([]);
		expect(parseCommaSeparated("   ")).toEqual([]);
	});

	it("quotes values that contain a comma when formatting", () => {
		expect(formatCommaSeparated(["a", "b,c"])).toBe('a,"b,c"');
	});

	it("round-trips comma-free values", () => {
		expect(parseCommaSeparated(formatCommaSeparated(["x", "y"]))).toEqual([
			"x",
			"y",
		]);
	});
});

describe("sheet <-> model conversion", () => {
	const sheet: InternalProductSheet = {
		id: "7",
		sparkys_product_name: "Gold Foil",
		product_type: "Foil",
		sparkys_color: "Gold",
		texture: "Metallic",
		shape: "Star",
		occasions: "Birthday, Wedding",
		products: "111,222",
		threshold_quantity: 3,
		never_out: true,
		status: "active",
	};

	it("splits comma fields when converting a sheet row to a model", () => {
		const model = convertInternalProductSheetToModel(sheet);
		expect(model.occasions).toEqual(["Birthday", "Wedding"]);
		expect(model.products).toEqual(["111", "222"]);
		expect(model.never_out).toBe(true);
	});

	it("round-trips internal model -> sheet -> model", () => {
		const model = convertInternalProductSheetToModel(sheet);
		const back = convertInternalProductSheetToModel(
			convertInternalProductModelToSheet(model),
		);
		expect(back).toEqual(model);
	});

	it("round-trips external model -> sheet -> model", () => {
		const model = convertExternalProductSheetToModel({
			unique_id_sku: "9",
			manufacturer_color: "Ocean Blue",
			brand: "Anagram",
			size: '18"',
			bag_quantity: 50,
			distributors: "Acme, Globex",
			quantity: 12,
			status: "active",
		});
		const back = convertExternalProductSheetToModel(
			convertExternalProductModelToSheet(model),
		);
		expect(back).toEqual(model);
	});

	it("defaults never_out and status when converting a model to a sheet", () => {
		// internal() has never_out: false and no status -> exercises || fallbacks
		const sheet = convertInternalProductModelToSheet(internal());
		expect(sheet.never_out).toBe(false);
		expect(sheet.status).toBe("active");

		const extSheet = convertExternalProductModelToSheet(external());
		expect(extSheet.status).toBe("active");
	});
});

describe("stock helpers", () => {
	const members = [
		external({ unique_id_sku: "111", quantity: 10 }),
		external({ unique_id_sku: "222", quantity: 7 }),
		external({ unique_id_sku: "999", quantity: 3 }),
	];
	const grouped = internal({ products: ["111", "222"] });

	it("sums quantities of member external products only", () => {
		expect(getInternalProductTotalQuantity(grouped, members)).toBe(17);
	});

	it("returns only the externals belonging to the internal product", () => {
		expect(
			getExternalProductsForInternal(grouped, members).map(
				(e) => e.unique_id_sku,
			),
		).toEqual(["111", "222"]);
	});

	it.each([
		[4, 5, "red"],
		[5, 5, "blue"],
		[6, 5, "blue"],
		[100, 5, "green"],
	])("getQuantityColor(%i, %i) -> %s", (qty, threshold, expected) => {
		expect(getQuantityColor(qty, threshold)).toBe(expected);
	});
});

describe("archive helpers", () => {
	it("archives and unarchives an internal product by name immutably", () => {
		const products = [
			internal({
				id: "1",
				sparkys_product_name: "Red Latex",
				status: "active",
			}),
			internal({
				id: "2",
				sparkys_product_name: "Blue Foil",
				status: "active",
			}),
		];
		const archived = archiveInternalProduct("Red Latex", products);
		expect(archived[0].status).toBe("archived");
		expect(archived[1].status).toBe("active"); // non-matching untouched
		expect(products[0].status).toBe("active"); // original untouched
		expect(isInternalProductArchived("Red Latex", archived)).toBe(true);
		expect(isInternalProductArchived("missing", archived)).toBe(false);

		const restored = unarchiveInternalProduct("Red Latex", archived);
		expect(restored[0].status).toBe("active");
		expect(restored[1].status).toBe("active"); // non-matching untouched
	});

	it("archives an external product by sku, leaving others untouched", () => {
		const products = [
			external({ unique_id_sku: "111", status: "active" }),
			external({ unique_id_sku: "222", status: "active" }),
		];
		const archived = archiveExternalProduct("111", products);
		expect(isExternalProductArchived("111", archived)).toBe(true);
		expect(archived[1].status).toBe("active"); // non-matching untouched
	});

	it("unarchives an external product by sku and leaves others untouched", () => {
		const products = [
			external({ unique_id_sku: "111", status: "archived" }),
			external({ unique_id_sku: "222", status: "archived" }),
		];
		const restored = unarchiveExternalProduct("111", products);
		expect(restored[0].status).toBe("active");
		expect(restored[1].status).toBe("archived");
		expect(isExternalProductArchived("111", restored)).toBe(false);
	});

	it("reports false when an external sku is unknown", () => {
		expect(isExternalProductArchived("missing", [external()])).toBe(false);
	});
});

describe("conversion validation warnings", () => {
	it("warns on an invalid internal sheet row but still converts", () => {
		const warn = jest.spyOn(logger, "warn").mockImplementation(() => {});
		// threshold_quantity is required to be a number; a string fails validation.
		const bad = {
			id: "1",
			sparkys_product_name: "Bad",
			product_type: "",
			sparkys_color: "",
			texture: "",
			shape: "",
			occasions: "Birthday",
			products: "111",
			threshold_quantity: "oops",
			never_out: false,
		} as unknown as InternalProductSheet;
		const model = convertInternalProductSheetToModel(bad);
		expect(warn).toHaveBeenCalledWith(
			"Products",
			"Invalid internal product sheet row",
			{ sheet: bad },
		);
		expect(model.occasions).toEqual(["Birthday"]);
		warn.mockRestore();
	});

	it("warns on an invalid external sheet row but still converts", () => {
		const warn = jest.spyOn(logger, "warn").mockImplementation(() => {});
		// quantity is required to be a number; a string fails validation.
		const bad = {
			unique_id_sku: "9",
			manufacturer_color: "",
			brand: "",
			size: "",
			bag_quantity: 50,
			distributors: "Acme",
			quantity: "oops",
		} as unknown as ExternalProductSheet;
		const model = convertExternalProductSheetToModel(bad);
		expect(warn).toHaveBeenCalledWith(
			"Products",
			"Invalid external product sheet row",
			{ sheet: bad },
		);
		expect(model.distributors).toEqual(["Acme"]);
		warn.mockRestore();
	});

	it("defaults missing never_out and status when converting", () => {
		const model = convertInternalProductSheetToModel({
			id: "1",
			sparkys_product_name: "Defaults",
			product_type: "",
			sparkys_color: "",
			texture: "",
			shape: "",
			occasions: "",
			products: "",
			threshold_quantity: 0,
			never_out: false,
		} as InternalProductSheet);
		expect(model.never_out).toBe(false);
		expect(model.status).toBe("active");

		const ext = convertExternalProductSheetToModel({
			unique_id_sku: "9",
			manufacturer_color: "",
			brand: "",
			size: "",
			bag_quantity: 0,
			distributors: "",
			quantity: 0,
		} as ExternalProductSheet);
		expect(ext.status).toBe("active");
	});
});

describe("field options", () => {
	// updateFieldOptions mutates module-level PRODUCT_FIELD_OPTIONS; restore it.
	// DEFAULT_FIELD_OPTIONS is `as const`, so copy each field into a mutable
	// string[] to satisfy the (mutable) updateFieldOptions signature.
	afterEach(() => {
		const defaults: Record<string, string[]> = {};
		for (const [key, items] of Object.entries(DEFAULT_FIELD_OPTIONS)) {
			defaults[key] = [...items];
		}
		updateFieldOptions(defaults);
	});

	it("merges new options, flattening metadata objects to names", () => {
		updateFieldOptions({
			shape: [{ name: "Oval" }, "Round"],
		});
		expect(PRODUCT_FIELD_OPTIONS.shape).toEqual(["Oval", "Round"]);
		// untouched fields are preserved
		expect(PRODUCT_FIELD_OPTIONS.manufacturer).toEqual(
			DEFAULT_FIELD_OPTIONS.manufacturer,
		);
	});
});

describe("metadata items", () => {
	beforeEach(() => {
		updateMetadataItems({
			occasion: [
				{ name: "Birthday", status: "active" },
				{ name: "Retired Party", status: "archived" },
			],
		});
	});

	afterEach(() => {
		updateMetadataItems({});
	});

	it("returns only active items by default and all when requested", () => {
		expect(getMetadataItems("occasion").map((i) => i.name)).toEqual([
			"Birthday",
		]);
		expect(getMetadataItems("occasion", true)).toHaveLength(2);
	});

	it("returns [] for an unknown field key", () => {
		expect(getMetadataItems("unknown")).toEqual([]);
	});

	it("reports archived status for a metadata item", () => {
		expect(isMetadataItemArchived("occasion", "Retired Party")).toBe(true);
		expect(isMetadataItemArchived("occasion", "Birthday")).toBe(false);
		expect(isMetadataItemArchived("occasion", "Missing")).toBe(false);
		expect(isMetadataItemArchived("unknown", "x")).toBe(false);
	});

	it("lists active field options, optionally appending archived metadata", () => {
		// active-only returns the field option list from PRODUCT_FIELD_OPTIONS
		expect(getAllMetadataItems("occasion")).toEqual([
			...PRODUCT_FIELD_OPTIONS.occasion,
		]);
		// including archived appends archived metadata names
		expect(getAllMetadataItems("occasion", true)).toEqual([
			...PRODUCT_FIELD_OPTIONS.occasion,
			"Retired Party",
		]);
	});

	it("falls back to [] active options for an unknown field key", () => {
		expect(getAllMetadataItems("unknown")).toEqual([]);
		expect(getAllMetadataItems("unknown", true)).toEqual([]);
	});
});
