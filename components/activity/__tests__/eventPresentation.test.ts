import { Colors } from "@/constants/Colors";
import type { AuditEvent } from "@/services/googleSheets";
import { logger } from "@/services/logger";
import {
	formatTimestamp,
	getBadgeDiff,
	getEventColor,
	getEventIcon,
	getEventLabel,
	getFieldIcon,
	getItemRoute,
	getMetadataRoute,
	getQuantityDirection,
	isBadgeField,
	isClickableField,
} from "../eventPresentation";

const colors = Colors.light;

/** A minimal audit event with overridable fields. */
function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
	return {
		id: 1,
		timestamp: "2026-01-02T03:04:05.000Z",
		event_type: "edit",
		object_type: "external_product",
		object_id: "SKU-A",
		object_name: "Thing",
		changes: "{}",
		before_state: "{}",
		sheet_name: "external_products",
		user_email: "tester@example.com",
		...overrides,
	};
}

beforeEach(() => {
	(logger.debug as jest.Mock).mockClear();
});

describe("getQuantityDirection", () => {
	it("returns 'up' when the quantity increased", () => {
		expect(
			getQuantityDirection(
				JSON.stringify({ quantity: 9 }),
				JSON.stringify({ quantity: 2 }),
			),
		).toBe("up");
	});

	it("returns 'down' when the quantity decreased", () => {
		expect(
			getQuantityDirection(
				JSON.stringify({ quantity: 1 }),
				JSON.stringify({ quantity: 8 }),
			),
		).toBe("down");
	});

	it("returns null when a quantity key is absent (no log)", () => {
		expect(
			getQuantityDirection(
				JSON.stringify({ note: "x" }),
				JSON.stringify({ note: "y" }),
			),
		).toBeNull();
		expect(logger.debug).not.toHaveBeenCalled();
	});

	it("returns null and logs when the JSON is malformed", () => {
		expect(getQuantityDirection("nope", "also-nope")).toBeNull();
		expect(logger.debug).toHaveBeenCalled();
	});

	it("returns null and logs when the payloads are undefined", () => {
		// JSON.parse("") on the nullish coalesced default throws -> caught -> null.
		expect(getQuantityDirection()).toBeNull();
		expect(logger.debug).toHaveBeenCalled();
	});

	it("returns null and logs when only beforeState is undefined", () => {
		// changes parses fine; beforeState falls back to "" and JSON.parse throws,
		// exercising the `beforeState ?? ""` nullish-coalescing branch.
		expect(getQuantityDirection(JSON.stringify({ quantity: 1 }))).toBeNull();
		expect(logger.debug).toHaveBeenCalled();
	});
});

describe("getEventIcon", () => {
	it.each([
		["create", "add-circle-outline"],
		["edit", "pencil-outline"],
		["archive", "archive-outline"],
		["unarchive", "refresh-outline"],
	] as const)("maps %s to %s", (event_type, icon) => {
		expect(getEventIcon(makeEvent({ event_type }))).toBe(icon);
	});

	it("falls back to the info glyph for an unknown type", () => {
		expect(
			getEventIcon(
				makeEvent({ event_type: "weird" as AuditEvent["event_type"] }),
			),
		).toBe("information-circle-outline");
	});

	it("uses an up arrow for a quantity increase and a down arrow otherwise", () => {
		expect(
			getEventIcon(
				makeEvent({
					event_type: "quantity_update",
					changes: JSON.stringify({ quantity: 5 }),
					before_state: JSON.stringify({ quantity: 1 }),
				}),
			),
		).toBe("arrow-up");
		expect(
			getEventIcon(makeEvent({ event_type: "quantity_update", changes: "x" })),
		).toBe("arrow-down");
	});
});

describe("getEventColor", () => {
	it.each([
		["create", colors.success],
		["edit", colors.primary],
		["archive", "#ff6b35"],
		["unarchive", "#ffc107"],
	] as const)("maps %s to its color", (event_type, color) => {
		expect(getEventColor(makeEvent({ event_type }), colors)).toBe(color);
	});

	it("falls back to textSecondary for an unknown type", () => {
		expect(
			getEventColor(
				makeEvent({ event_type: "weird" as AuditEvent["event_type"] }),
				colors,
			),
		).toBe(colors.textSecondary);
	});

	it("uses success for a quantity increase and error otherwise", () => {
		expect(
			getEventColor(
				makeEvent({
					event_type: "quantity_update",
					changes: JSON.stringify({ quantity: 5 }),
					before_state: JSON.stringify({ quantity: 1 }),
				}),
				colors,
			),
		).toBe(colors.success);
		expect(
			getEventColor(
				makeEvent({ event_type: "quantity_update", changes: "x" }),
				colors,
			),
		).toBe(colors.error);
	});
});

describe("getEventLabel", () => {
	it("labels a quantity increase 'Deposited' and a decrease 'Withdrew'", () => {
		expect(
			getEventLabel(
				makeEvent({
					event_type: "quantity_update",
					changes: JSON.stringify({ quantity: 5 }),
					before_state: JSON.stringify({ quantity: 1 }),
				}),
			),
		).toBe("Deposited");
		expect(
			getEventLabel(makeEvent({ event_type: "quantity_update", changes: "" })),
		).toBe("Withdrew");
	});

	it("appends 'ed' for edit and 'd' for other types", () => {
		expect(getEventLabel(makeEvent({ event_type: "edit" }))).toBe("Edited");
		expect(getEventLabel(makeEvent({ event_type: "create" }))).toBe("Created");
		expect(
			getEventLabel(
				makeEvent({ event_type: "imported" as AuditEvent["event_type"] }),
			),
		).toBe("Importedd");
	});
});

describe("formatTimestamp", () => {
	it("formats a valid ISO timestamp via toLocaleString", () => {
		const ts = "2026-01-02T03:04:05.000Z";
		expect(formatTimestamp(ts)).toBe(new Date(ts).toLocaleString());
	});

	it("yields 'Invalid Date' for an unparsable timestamp", () => {
		expect(formatTimestamp("not-a-date")).toBe("Invalid Date");
	});
});

describe("getItemRoute", () => {
	it.each([
		["internal_product", "/internal-product/SKU%201"],
		["external_product", "/external-product/SKU%201"],
	] as const)("builds the %s route with an encoded id", (object_type, route) => {
		expect(getItemRoute(makeEvent({ object_type, object_id: "SKU 1" }))).toBe(
			route,
		);
	});

	it("builds the metadata route from the sheet name", () => {
		expect(
			getItemRoute(
				makeEvent({ object_type: "metadata", sheet_name: "colors" }),
			),
		).toBe("/metadata/colors");
	});

	it("returns null for an unknown object type", () => {
		expect(
			getItemRoute(
				makeEvent({
					object_type: "mystery" as AuditEvent["object_type"],
				}),
			),
		).toBeNull();
	});
});

describe("getFieldIcon", () => {
	it("maps a known field to its icon", () => {
		expect(getFieldIcon("quantity")).toBe("calculator-outline");
		expect(getFieldIcon("brand")).toBe("business-outline");
	});

	it("falls back to the info glyph for an unknown field", () => {
		expect(getFieldIcon("mystery")).toBe("information-circle-outline");
	});
});

describe("isBadgeField", () => {
	it("is true only for distributors and occasions", () => {
		expect(isBadgeField("distributors")).toBe(true);
		expect(isBadgeField("occasions")).toBe(true);
		expect(isBadgeField("brand")).toBe(false);
	});
});

describe("isClickableField / getMetadataRoute", () => {
	it("treats every mapped scalar field as clickable", () => {
		for (const field of [
			"manufacturer_color",
			"sparkys_color",
			"brand",
			"size",
			"bag_quantity",
			"product_type",
			"texture",
			"shape",
			"internal_product",
		]) {
			expect(isClickableField(field)).toBe(true);
		}
	});

	it("treats unmapped and badge fields as non-clickable", () => {
		expect(isClickableField("distributors")).toBe(false);
		expect(isClickableField("status")).toBe(false);
		expect(isClickableField("mystery")).toBe(false);
	});

	it.each([
		["manufacturer_color", "Red", "/metadata/colors/Red"],
		["sparkys_color", "Blue", "/metadata/colors/Blue"],
		["brand", "Acme", "/metadata/manufacturers/Acme"],
		["size", "11in", "/metadata/sizes/11in"],
		["bag_quantity", "12", "/metadata/bagQuantities/12"],
		["product_type", "Latex", "/metadata/productTypes/Latex"],
		["texture", "Matte", "/metadata/textures/Matte"],
		["shape", "Round", "/metadata/shapes/Round"],
	] as const)("routes %s to its metadata page", (field, value, route) => {
		expect(getMetadataRoute(field, value, [])).toBe(route);
	});

	it("resolves internal_product by name to its product route", () => {
		expect(
			getMetadataRoute("internal_product", "Linked", [
				{ id: "p 9", sparkys_product_name: "Linked" },
			]),
		).toBe("/internal-product/p%209");
	});

	it("returns null when internal_product cannot be resolved", () => {
		expect(
			getMetadataRoute("internal_product", "Missing", [
				{ id: "p1", sparkys_product_name: "Other" },
			]),
		).toBeNull();
	});

	it("returns null for a non-clickable field", () => {
		expect(getMetadataRoute("status", "active", [])).toBeNull();
	});
});

describe("getBadgeDiff", () => {
	it("splits items into constant, removed, and added sets", () => {
		expect(getBadgeDiff("Keep, Drop", "Keep, Add")).toEqual({
			constant: ["Keep"],
			removed: ["Drop"],
			added: ["Add"],
		});
	});

	it("treats empty/nullish values as empty lists", () => {
		expect(getBadgeDiff("", null)).toEqual({
			constant: [],
			removed: [],
			added: [],
		});
	});
});
