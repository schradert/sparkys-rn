/// <reference types="jest" />
import {
	archiveExternalProduct,
	archiveInternalProduct,
	convertExternalProductModelToSheet,
	convertExternalProductSheetToModel,
	convertInternalProductModelToSheet,
	convertInternalProductSheetToModel,
	type ExternalProduct,
	formatCommaSeparated,
	getExternalProductsForInternal,
	getInternalProductTotalQuantity,
	getQuantityColor,
	type InternalProduct,
	type InternalProductSheet,
	isExternalProductArchived,
	isInternalProductArchived,
	parseCommaSeparated,
	unarchiveInternalProduct,
} from "@/constants/Products";

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
		const products = [internal({ status: "active" })];
		const archived = archiveInternalProduct("Red Latex", products);
		expect(archived[0].status).toBe("archived");
		expect(products[0].status).toBe("active"); // original untouched
		expect(isInternalProductArchived("Red Latex", archived)).toBe(true);

		const restored = unarchiveInternalProduct("Red Latex", archived);
		expect(restored[0].status).toBe("active");
	});

	it("archives an external product by sku", () => {
		const products = [external({ unique_id_sku: "111", status: "active" })];
		const archived = archiveExternalProduct("111", products);
		expect(isExternalProductArchived("111", archived)).toBe(true);
	});
});
