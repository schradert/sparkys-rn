import {
	EXTERNAL_FILTER_SECTIONS,
	FIELD_KEY_FOR_VIEW_MODE,
	formatCategoryTitle,
	getSheetNameForViewMode,
	INTERNAL_FILTER_SECTIONS,
	LABEL_FOR_VIEW_MODE,
	SHEET_NAME_FOR_VIEW_MODE,
	VIEW_OPTIONS,
} from "@/components/inventory/inventoryMaps";
import type { ViewMode } from "@/components/inventory/types";

describe("inventoryMaps — view option tables", () => {
	it("derives a label for every view option from VIEW_OPTIONS", () => {
		for (const option of VIEW_OPTIONS) {
			expect(LABEL_FOR_VIEW_MODE[option.key]).toBe(option.label);
		}
	});

	it("maps every metadata view mode to a non-empty field key", () => {
		const metadataModes = VIEW_OPTIONS.map((o) => o.key).filter(
			(key) => key !== "products",
		);
		for (const mode of metadataModes) {
			expect(
				FIELD_KEY_FOR_VIEW_MODE[mode as Exclude<ViewMode, "products">],
			).toBeTruthy();
		}
	});
});

describe("inventoryMaps — getSheetNameForViewMode", () => {
	it("returns the writable sheet name for a backed view mode", () => {
		expect(getSheetNameForViewMode("productTypes")).toBe("product_types");
		expect(getSheetNameForViewMode("occasions")).toBe("occasions");
	});

	it("returns null for a view mode with no writable sheet (Sizes)", () => {
		expect(SHEET_NAME_FOR_VIEW_MODE.sizes).toBeUndefined();
		expect(getSheetNameForViewMode("sizes")).toBeNull();
	});
});

describe("inventoryMaps — formatCategoryTitle", () => {
	it("maps each known filter category to its display title", () => {
		expect(formatCategoryTitle("product_type")).toBe("Type");
		expect(formatCategoryTitle("sparkys_color")).toBe("Sparky's Color");
		expect(formatCategoryTitle("manufacturer_color")).toBe(
			"Manufacturer Color",
		);
		expect(formatCategoryTitle("brand")).toBe("Brand");
		expect(formatCategoryTitle("size")).toBe("Size");
	});

	it("falls back to the raw category for an unmapped key", () => {
		expect(formatCategoryTitle("totally_unknown")).toBe("totally_unknown");
	});
});

describe("inventoryMaps — filter section tables", () => {
	it("references field keys that exist in PRODUCT_FIELD_OPTIONS shape", () => {
		// Each internal/external section pairs a filter category with the metadata
		// field key whose options populate it.
		expect(INTERNAL_FILTER_SECTIONS.map((s) => s.category)).toEqual([
			"product_type",
			"sparkys_color",
			"texture",
			"shape",
			"occasions",
		]);
		expect(EXTERNAL_FILTER_SECTIONS.map((s) => s.category)).toEqual([
			"manufacturer_color",
			"brand",
			"size",
			"distributors",
		]);
	});
});
