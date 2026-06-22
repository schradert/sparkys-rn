import {
	defaultExternalFilters,
	defaultInternalFilters,
	type ExternalFilters,
	type InternalFilters,
} from "@/components/inventory/types";
import type { ExternalProduct, InternalProduct } from "@/constants/Products";
import {
	compareInternalProductsByActivity,
	externalProductMatchesFilters,
	filterAndSortInternalProducts,
	filteredExternalsForInternal,
	getEventCount,
	getMostRecentEventTimestamp,
	hasActiveExternalFilters,
	internalProductMatchesFilters,
} from "@/hooks/useInventoryFilters";
import type { AuditEvent } from "@/services/googleSheets";

function makeInternal(
	overrides: Partial<InternalProduct> = {},
): InternalProduct {
	return {
		id: "1",
		sparkys_product_name: "Red Round",
		product_type: "Latex Balloons",
		sparkys_color: "Red",
		texture: "Matte",
		shape: "Round",
		occasions: ["Birthday"],
		products: ["SKU-A"],
		threshold_quantity: 10,
		never_out: false,
		status: "active",
		...overrides,
	};
}

function makeExternal(
	overrides: Partial<ExternalProduct> = {},
): ExternalProduct {
	return {
		unique_id_sku: "SKU-A",
		manufacturer_color: "Flaming Red",
		brand: "Qualatex",
		size: '11"',
		bag_quantity: 100,
		distributors: ["Default Distributor"],
		quantity: 5,
		status: "active",
		...overrides,
	};
}

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
	return {
		id: 1,
		timestamp: "2026-01-01T00:00:00.000Z",
		event_type: "quantity_update",
		object_type: "internal_product",
		object_id: "1",
		object_name: "Red Round",
		changes: "{}",
		before_state: "{}",
		sheet_name: "internal",
		user_email: "t@example.com",
		...overrides,
	};
}

describe("externalProductMatchesFilters", () => {
	it("passes everything when no filter is selected", () => {
		expect(
			externalProductMatchesFilters(makeExternal(), defaultExternalFilters),
		).toBe(true);
	});

	it("excludes archived externals unless show-archived is on", () => {
		const archived = makeExternal({ status: "archived" });
		expect(
			externalProductMatchesFilters(archived, defaultExternalFilters),
		).toBe(false);
		expect(
			externalProductMatchesFilters(archived, {
				...defaultExternalFilters,
				showArchived: true,
			}),
		).toBe(true);
	});

	it("matches a brand selection and a distributors selection", () => {
		const filters: ExternalFilters = {
			...defaultExternalFilters,
			brand: ["Qualatex"],
			distributors: ["Default Distributor"],
		};
		expect(externalProductMatchesFilters(makeExternal(), filters)).toBe(true);
		expect(
			externalProductMatchesFilters(
				makeExternal({ brand: "Anagram" }),
				filters,
			),
		).toBe(false);
	});

	it("defaults a missing status to active", () => {
		const noStatus = makeExternal();
		delete (noStatus as { status?: string }).status;
		expect(
			externalProductMatchesFilters(noStatus, defaultExternalFilters),
		).toBe(true);
	});
});

describe("internalProductMatchesFilters", () => {
	it("passes everything when no filter is selected", () => {
		expect(
			internalProductMatchesFilters(makeInternal(), defaultInternalFilters, [
				makeExternal(),
			]),
		).toBe(true);
	});

	it("applies the understocked toggle against linked external quantity", () => {
		const filters: InternalFilters = {
			...defaultInternalFilters,
			understocked: true,
		};
		const understocked = makeInternal({ threshold_quantity: 10 });
		const stocked = makeInternal({ threshold_quantity: 1 });
		expect(
			internalProductMatchesFilters(understocked, filters, [
				makeExternal({ quantity: 2 }),
			]),
		).toBe(true);
		expect(
			internalProductMatchesFilters(stocked, filters, [
				makeExternal({ quantity: 50 }),
			]),
		).toBe(false);
	});

	it("matches an occasions selection and defaults missing occasions", () => {
		const filters: InternalFilters = {
			...defaultInternalFilters,
			occasions: ["Birthday"],
		};
		expect(internalProductMatchesFilters(makeInternal(), filters, [])).toBe(
			true,
		);
		const noOccasions = makeInternal();
		delete (noOccasions as { occasions?: string[] }).occasions;
		expect(internalProductMatchesFilters(noOccasions, filters, [])).toBe(false);
	});

	it("excludes archived internals unless show-archived is on", () => {
		const archived = makeInternal({ status: "archived" });
		expect(
			internalProductMatchesFilters(archived, defaultInternalFilters, []),
		).toBe(false);
		expect(
			internalProductMatchesFilters(
				archived,
				{ ...defaultInternalFilters, showArchived: true },
				[],
			),
		).toBe(true);
	});
});

describe("hasActiveExternalFilters / filteredExternalsForInternal", () => {
	it("detects an active external filter", () => {
		expect(hasActiveExternalFilters(defaultExternalFilters)).toBe(false);
		expect(
			hasActiveExternalFilters({
				...defaultExternalFilters,
				brand: ["Qualatex"],
			}),
		).toBe(true);
	});

	it("returns only linked, matching externals for an internal", () => {
		const internal = makeInternal({ products: ["SKU-A", "SKU-B"] });
		const externals = [
			makeExternal({ unique_id_sku: "SKU-A", brand: "Qualatex" }),
			makeExternal({ unique_id_sku: "SKU-B", brand: "Anagram" }),
			makeExternal({ unique_id_sku: "SKU-C", brand: "Qualatex" }),
		];
		const result = filteredExternalsForInternal(internal, externals, {
			...defaultExternalFilters,
			brand: ["Qualatex"],
		});
		expect(result.map((e) => e.unique_id_sku)).toEqual(["SKU-A"]);
	});
});

describe("audit-event helpers", () => {
	const events = [
		makeEvent({ id: 3, object_id: "1", timestamp: "2026-03-01T00:00:00Z" }),
		makeEvent({ id: 2, object_id: "1", timestamp: "2026-02-01T00:00:00Z" }),
		makeEvent({ id: 1, object_id: "2", timestamp: "2026-01-01T00:00:00Z" }),
	];

	it("counts events for a product of a kind", () => {
		expect(getEventCount(events, "1", "internal_product")).toBe(2);
		expect(getEventCount(events, "9", "internal_product")).toBe(0);
	});

	it("returns the most recent timestamp or null", () => {
		expect(getMostRecentEventTimestamp(events, "1", "internal_product")).toBe(
			"2026-03-01T00:00:00Z",
		);
		expect(
			getMostRecentEventTimestamp(events, "9", "internal_product"),
		).toBeNull();
	});
});

describe("compareInternalProductsByActivity", () => {
	const a = makeInternal({ id: "1", sparkys_product_name: "Alpha" });
	const b = makeInternal({ id: "2", sparkys_product_name: "Bravo" });

	it("orders the more frequently updated product first", () => {
		const events = [
			makeEvent({ id: 1, object_id: "1" }),
			makeEvent({ id: 2, object_id: "1" }),
			makeEvent({ id: 3, object_id: "2" }),
		];
		expect(compareInternalProductsByActivity(a, b, events)).toBeLessThan(0);
	});

	it("falls back to reverse alphabetical when neither has events", () => {
		// No events -> reverse alpha: Bravo before Alpha -> positive for (a, b).
		expect(compareInternalProductsByActivity(a, b, [])).toBeGreaterThan(0);
	});

	it("orders by recency when event counts tie", () => {
		const events = [
			makeEvent({ id: 1, object_id: "1", timestamp: "2026-01-01T00:00:00Z" }),
			makeEvent({ id: 2, object_id: "2", timestamp: "2026-05-01T00:00:00Z" }),
		];
		// b is more recent -> b first -> positive for (a, b).
		expect(compareInternalProductsByActivity(a, b, events)).toBeGreaterThan(0);
	});

	it("breaks an identical timestamp with reverse alphabetical order", () => {
		const same = "2026-04-01T00:00:00Z";
		const events = [
			makeEvent({ id: 1, object_id: "1", timestamp: same }),
			makeEvent({ id: 2, object_id: "2", timestamp: same }),
		];
		expect(compareInternalProductsByActivity(a, b, events)).toBeGreaterThan(0);
	});
});

describe("filterAndSortInternalProducts", () => {
	it("returns an empty array for an undefined product slice", () => {
		expect(
			filterAndSortInternalProducts(
				undefined,
				[],
				defaultInternalFilters,
				defaultExternalFilters,
				[],
			),
		).toEqual([]);
	});

	it("keeps internals only when a linked external matches an active external filter", () => {
		const internals = [
			makeInternal({
				id: "1",
				sparkys_product_name: "Has Q",
				products: ["SKU-A"],
			}),
			makeInternal({
				id: "2",
				sparkys_product_name: "Has A",
				products: ["SKU-B"],
			}),
		];
		const externals = [
			makeExternal({ unique_id_sku: "SKU-A", brand: "Qualatex" }),
			makeExternal({ unique_id_sku: "SKU-B", brand: "Anagram" }),
		];
		const result = filterAndSortInternalProducts(
			internals,
			externals,
			defaultInternalFilters,
			{ ...defaultExternalFilters, brand: ["Qualatex"] },
			[],
		);
		expect(result.map((p) => p.sparkys_product_name)).toEqual(["Has Q"]);
	});
});
