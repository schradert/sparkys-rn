import type {
	ExternalFilters,
	InternalFilters,
} from "@/components/inventory/types";
import {
	type ExternalProduct,
	getInternalProductTotalQuantity,
	type InternalProduct,
} from "@/constants/Products";
import type { AuditEvent } from "@/services/googleSheets";

/**
 * Pure filtering and sorting helpers behind the inventory products view. These
 * were the `getCurrentData` filter pipeline and audit-event comparator inlined
 * in the screen; pulling them out keeps the shell thin and makes the branchy
 * predicate logic directly testable.
 */

/** Whether an external product passes the external filter set. */
export function externalProductMatchesFilters(
	externalProduct: ExternalProduct,
	externalFilters: ExternalFilters,
): boolean {
	return Object.entries(externalFilters).every(([key, selectedValues]) => {
		if (key === "showArchived") {
			const isProductArchived =
				(externalProduct.status || "active") === "archived";
			// When showing archived, everything passes; otherwise exclude archived.
			return selectedValues === true ? true : !isProductArchived;
		}
		if (!Array.isArray(selectedValues) || selectedValues.length === 0) {
			return true;
		}
		if (key === "distributors") {
			return selectedValues.some((selectedValue) =>
				externalProduct.distributors.includes(selectedValue),
			);
		}
		const productValue = externalProduct[
			key as keyof ExternalProduct
		] as string;
		return selectedValues.includes(productValue);
	});
}

/** The external products linked to an internal product that pass the filters. */
export function filteredExternalsForInternal(
	internalProduct: InternalProduct,
	externalProducts: ExternalProduct[],
	externalFilters: ExternalFilters,
): ExternalProduct[] {
	return externalProducts
		.filter((ext) => internalProduct.products.includes(ext.unique_id_sku))
		.filter((ext) => externalProductMatchesFilters(ext, externalFilters));
}

/** Whether any external filter is active (any array key has a selection). */
export function hasActiveExternalFilters(
	externalFilters: ExternalFilters,
): boolean {
	return Object.values(externalFilters).some(
		(arr) => Array.isArray(arr) && arr.length > 0,
	);
}

/** Whether an internal product passes the internal filter set. */
export function internalProductMatchesFilters(
	internalProduct: InternalProduct,
	internalFilters: InternalFilters,
	externalProducts: ExternalProduct[],
): boolean {
	return Object.entries(internalFilters).every(([key, selectedValues]) => {
		if (key === "understocked") {
			if (!selectedValues) return true;
			const totalQuantity = getInternalProductTotalQuantity(
				internalProduct,
				externalProducts,
			);
			return totalQuantity < internalProduct.threshold_quantity;
		}
		if (key === "showArchived") {
			const isProductArchived =
				(internalProduct.status || "active") === "archived";
			return selectedValues === true ? true : !isProductArchived;
		}
		if (!Array.isArray(selectedValues) || selectedValues.length === 0) {
			return true;
		}
		if (key === "occasions") {
			return selectedValues.some((selectedValue) =>
				(internalProduct.occasions || []).includes(selectedValue),
			);
		}
		const productValue = internalProduct[
			key as keyof InternalProduct
		] as string;
		return selectedValues.includes(productValue);
	});
}

/** Count of audit events for a product of a given kind. */
export function getEventCount(
	events: AuditEvent[],
	productId: string,
	productType: "internal_product" | "external_product",
): number {
	return events.filter(
		(event) =>
			event.object_type === productType && event.object_id === productId,
	).length;
}

/**
 * Timestamp of the most recent audit event for a product, or null if it has
 * none. Events arrive sorted by id descending (most recent first).
 */
export function getMostRecentEventTimestamp(
	events: AuditEvent[],
	productId: string,
	productType: "internal_product" | "external_product",
): string | null {
	const productEvents = events.filter(
		(event) =>
			event.object_type === productType && event.object_id === productId,
	);
	if (productEvents.length === 0) return null;
	return productEvents[0].timestamp;
}

/**
 * Comparator ordering internal products by: most frequently updated, then most
 * recently updated, then reverse-alphabetical. Equal event counts imply both
 * products have the same number of events, so either both have a most-recent
 * timestamp or neither does — there is no single-sided null case to handle.
 */
export function compareInternalProductsByActivity(
	a: InternalProduct,
	b: InternalProduct,
	events: AuditEvent[],
): number {
	const aEventCount = getEventCount(events, a.id, "internal_product");
	const bEventCount = getEventCount(events, b.id, "internal_product");
	if (aEventCount !== bEventCount) {
		return bEventCount - aEventCount;
	}

	const reverseAlpha = b.sparkys_product_name.localeCompare(
		a.sparkys_product_name,
	);

	const aTimestamp = getMostRecentEventTimestamp(
		events,
		a.id,
		"internal_product",
	);
	const bTimestamp = getMostRecentEventTimestamp(
		events,
		b.id,
		"internal_product",
	);

	// Equal counts of zero -> neither has events -> fall straight to reverse-alpha.
	if (!aTimestamp || !bTimestamp) {
		return reverseAlpha;
	}

	const timeDiff =
		new Date(bTimestamp).getTime() - new Date(aTimestamp).getTime();
	return timeDiff !== 0 ? timeDiff : reverseAlpha;
}

/**
 * The filtered, sorted internal products for the hierarchical products view:
 * apply the internal filters, then (if any external filter is active) keep only
 * internals that still have at least one matching linked external, then sort.
 */
export function filterAndSortInternalProducts(
	internalProducts: InternalProduct[] | undefined,
	externalProducts: ExternalProduct[],
	internalFilters: InternalFilters,
	externalFilters: ExternalFilters,
	events: AuditEvent[],
): InternalProduct[] {
	if (!internalProducts) return [];
	const externalActive = hasActiveExternalFilters(externalFilters);
	return internalProducts
		.filter((internalProduct) => {
			if (
				!internalProductMatchesFilters(
					internalProduct,
					internalFilters,
					externalProducts,
				)
			) {
				return false;
			}
			if (!externalActive) return true;
			return (
				filteredExternalsForInternal(
					internalProduct,
					externalProducts,
					externalFilters,
				).length > 0
			);
		})
		.sort((a, b) => compareInternalProductsByActivity(a, b, events));
}
