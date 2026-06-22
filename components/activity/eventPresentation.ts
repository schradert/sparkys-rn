import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { ThemeColors } from "@/constants/Colors";
import type { AuditEvent } from "@/services/googleSheets";
import { logger } from "@/services/logger";

/** An Ionicons glyph name. */
export type IoniconName = ComponentProps<typeof Ionicons>["name"];

/** Whether a quantity change went up, down, or could not be determined. */
export type QuantityDirection = "up" | "down" | null;

/**
 * Resolve the direction of a `quantity_update` event from its JSON payloads.
 *
 * Returns `"up"`/`"down"` when both payloads parse and carry a numeric
 * `quantity`, otherwise `null` (missing key, falsy payload, or malformed JSON —
 * the latter is logged). Callers treat `null` as the "withdrew"/down default.
 */
export function getQuantityDirection(
	changes?: string,
	beforeState?: string,
): QuantityDirection {
	try {
		const changesObj = JSON.parse(changes ?? "");
		const beforeObj = JSON.parse(beforeState ?? "");
		if (changesObj.quantity !== undefined && beforeObj.quantity !== undefined) {
			return changesObj.quantity > beforeObj.quantity ? "up" : "down";
		}
	} catch (e) {
		logger.debug("Activity", "Failed to parse quantity changes", {
			error: e,
			changes,
			beforeState,
		});
	}
	return null;
}

/** Static icon per event type; `quantity_update` is resolved by direction. */
const EVENT_ICONS: Record<string, IoniconName> = {
	create: "add-circle-outline",
	edit: "pencil-outline",
	archive: "archive-outline",
	unarchive: "refresh-outline",
};

/** The list/detail icon for an event. */
export function getEventIcon(event: AuditEvent): IoniconName {
	if (event.event_type === "quantity_update") {
		return getQuantityDirection(event.changes, event.before_state) === "up"
			? "arrow-up"
			: "arrow-down";
	}
	return EVENT_ICONS[event.event_type] ?? "information-circle-outline";
}

/** The list/detail accent color for an event. */
export function getEventColor(event: AuditEvent, colors: ThemeColors): string {
	switch (event.event_type) {
		case "create":
			return colors.success;
		case "edit":
			return colors.primary;
		case "quantity_update":
			return getQuantityDirection(event.changes, event.before_state) === "up"
				? colors.success
				: colors.error;
		case "archive":
			return "#ff6b35"; // Orange
		case "unarchive":
			return "#ffc107"; // Yellow
		default:
			return colors.textSecondary;
	}
}

/** The human-readable label shown for an event ("Deposited", "Edited", …). */
export function getEventLabel(event: AuditEvent): string {
	if (event.event_type === "quantity_update") {
		return getQuantityDirection(event.changes, event.before_state) === "up"
			? "Deposited"
			: "Withdrew";
	}
	return (
		event.event_type.charAt(0).toUpperCase() +
		event.event_type.slice(1) +
		(event.event_type === "edit" ? "ed" : "d")
	);
}

/** Format an ISO timestamp for display. */
export function formatTimestamp(timestamp: string): string {
	return new Date(timestamp).toLocaleString();
}

/** The per-route navigation target for an event's "View Item" action. */
export function getItemRoute(event: AuditEvent): string | null {
	switch (event.object_type) {
		case "internal_product":
			return `/internal-product/${encodeURIComponent(event.object_id)}`;
		case "external_product":
			return `/external-product/${encodeURIComponent(event.object_id)}`;
		case "metadata":
			return `/metadata/${event.sheet_name}`;
		default:
			return null;
	}
}

/** Icon per change-field name; unknown fields fall back to the info glyph. */
const FIELD_ICONS: Record<string, IoniconName> = {
	quantity: "calculator-outline",
	manufacturer_color: "color-palette-outline",
	brand: "business-outline",
	size: "resize-outline",
	bag_quantity: "bag-outline",
	distributors: "storefront-outline",
	product_type: "shapes-outline",
	sparkys_color: "color-palette-outline",
	texture: "hand-left-outline",
	shape: "diamond-outline",
	occasions: "calendar-outline",
	status: "flag-outline",
	name: "pricetag-outline",
	never_out: "star-outline",
	internal_product: "link-outline",
};

/** The icon for a change-field row in the detail modal. */
export function getFieldIcon(field: string): IoniconName {
	return FIELD_ICONS[field] ?? "information-circle-outline";
}

/** Fields rendered as a comma-split badge diff rather than a scalar value. */
const BADGE_FIELDS = new Set(["distributors", "occasions"]);

/** Whether a field renders as a badge diff (distributors/occasions). */
export function isBadgeField(field: string): boolean {
	return BADGE_FIELDS.has(field);
}

/**
 * Builders for the metadata routes of clickable scalar fields. A field absent
 * from this map is not clickable; `internal_product` resolves an id by name and
 * may yield `null` when no product matches.
 */
const METADATA_ROUTES: Record<
	string,
	(newValue: string, internalProducts: InternalProductLike[]) => string | null
> = {
	manufacturer_color: (v) => `/metadata/colors/${encodeURIComponent(v)}`,
	sparkys_color: (v) => `/metadata/colors/${encodeURIComponent(v)}`,
	brand: (v) => `/metadata/manufacturers/${encodeURIComponent(v)}`,
	size: (v) => `/metadata/sizes/${encodeURIComponent(v)}`,
	bag_quantity: (v) => `/metadata/bagQuantities/${encodeURIComponent(v)}`,
	product_type: (v) => `/metadata/productTypes/${encodeURIComponent(v)}`,
	texture: (v) => `/metadata/textures/${encodeURIComponent(v)}`,
	shape: (v) => `/metadata/shapes/${encodeURIComponent(v)}`,
	internal_product: (v, internalProducts) => {
		const product = internalProducts.find((p) => p.sparkys_product_name === v);
		return product
			? `/internal-product/${encodeURIComponent(product.id)}`
			: null;
	},
};

/** The minimal internal-product shape the `internal_product` route needs. */
export interface InternalProductLike {
	id: string;
	sparkys_product_name: string;
}

/** Whether a change-field row links to a metadata route. */
export function isClickableField(field: string): boolean {
	return field in METADATA_ROUTES;
}

/**
 * The metadata route for a clickable field's new value, or `null` when the
 * field is not clickable or its target cannot be resolved.
 */
export function getMetadataRoute(
	field: string,
	newValue: string,
	internalProducts: InternalProductLike[],
): string | null {
	return METADATA_ROUTES[field]?.(newValue, internalProducts) ?? null;
}

/** A distributors/occasions diff split into constant, removed, and added sets. */
export interface BadgeDiff {
	constant: string[];
	removed: string[];
	added: string[];
}

/** Parse a comma-separated badge value into trimmed, non-empty items. */
function parseBadgeItems(value: unknown): string[] {
	return value?.toString()
		? value
				.toString()
				.split(",")
				.map((s: string) => s.trim())
				.filter(Boolean)
		: [];
}

/** Diff old vs new comma-separated badge values into kept/removed/added sets. */
export function getBadgeDiff(oldValue: unknown, newValue: unknown): BadgeDiff {
	const oldItems = parseBadgeItems(oldValue);
	const newItems = parseBadgeItems(newValue);
	return {
		constant: oldItems.filter((item) => newItems.includes(item)),
		removed: oldItems.filter((item) => !newItems.includes(item)),
		added: newItems.filter((item) => !oldItems.includes(item)),
	};
}
