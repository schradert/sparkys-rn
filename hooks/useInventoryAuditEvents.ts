import { useEffect, useState } from "react";
import type { AuditEvent } from "@/services/googleSheets";
import { logger } from "@/services/logger";
import { subscribeToStoreChanges } from "@/store/products";

/**
 * Loads the audit events the inventory products view sorts by. Events reload on
 * mount, whenever the sheets refresh, and (debounced) whenever the product store
 * changes, so add/update operations elsewhere refresh the activity ordering.
 */
export function useInventoryAuditEvents(
	sheetsRefreshing: boolean,
	getAuditEvents:
		| ((limit?: number, offset?: number) => Promise<AuditEvent[]>)
		| undefined,
): AuditEvent[] {
	const [storeUpdateTrigger, setStoreUpdateTrigger] = useState(0);
	const [cachedEvents, setCachedEvents] = useState<AuditEvent[]>([]);

	// Debounce store-change notifications so rapid bursts trigger one reload.
	useEffect(() => {
		let timeoutId: ReturnType<typeof setTimeout>;
		const unsubscribe = subscribeToStoreChanges(() => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				setStoreUpdateTrigger((prev) => prev + 1);
			}, 100);
		});
		return () => {
			clearTimeout(timeoutId);
			unsubscribe();
		};
	}, []);

	useEffect(() => {
		const loadEvents = async () => {
			if (!getAuditEvents) return;
			try {
				const events = await getAuditEvents(1000, 0);
				setCachedEvents(events);
			} catch (error) {
				logger.error("Inventory", "Failed to load audit events", { error });
			}
		};
		loadEvents();
	}, [sheetsRefreshing, storeUpdateTrigger, getAuditEvents]);

	return cachedEvents;
}
