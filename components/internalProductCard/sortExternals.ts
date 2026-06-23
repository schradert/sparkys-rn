import type { ExternalProduct } from "@/constants/Products";
import type { AuditEvent } from "@/services/googleSheets";

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

	// Events are already sorted by ID descending (most recent first)
	return productEvents[0].timestamp;
}

// For display, respect the showArchived filter
export function filterRelatedExternals(
	allRelated: ExternalProduct[],
	showArchived: boolean,
): ExternalProduct[] {
	return showArchived
		? allRelated
		: allRelated.filter((ext) => (ext.status || "active") === "active");
}

// Sort external products by frequency, then recency, then reverse alphabetical
export function sortRelatedExternals(
	externals: ExternalProduct[],
	events: AuditEvent[],
): ExternalProduct[] {
	return externals.sort((a, b) => {
		// Sort by: 1) most frequently updated, 2) most recently updated, 3) reverse alphabetical
		const aEventCount = getEventCount(
			events,
			a.unique_id_sku,
			"external_product",
		);
		const bEventCount = getEventCount(
			events,
			b.unique_id_sku,
			"external_product",
		);

		// First sort by frequency (descending)
		if (aEventCount !== bEventCount) {
			return bEventCount - aEventCount;
		}

		const reverseAlpha = b.unique_id_sku.localeCompare(a.unique_id_sku);

		// Then sort by most recent activity
		const aTimestamp = getMostRecentEventTimestamp(
			events,
			a.unique_id_sku,
			"external_product",
		);
		const bTimestamp = getMostRecentEventTimestamp(
			events,
			b.unique_id_sku,
			"external_product",
		);

		// Equal event counts imply both timestamps are present or both absent, so a
		// missing timestamp means neither has events -> fall straight to reverse-alpha.
		if (!aTimestamp || !bTimestamp) {
			return reverseAlpha;
		}

		const timeDiff =
			new Date(bTimestamp).getTime() - new Date(aTimestamp).getTime();
		// If same timestamp, use reverse alphabetical
		return timeDiff !== 0 ? timeDiff : reverseAlpha;
	});
}
