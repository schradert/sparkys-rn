import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSheetsData } from "@/hooks/useSheetsData";
import type { AuditEvent } from "@/services/googleSheets";

/** Page size for the audit-event feed. */
export const AUDIT_EVENTS_PAGE_SIZE = 50;

/**
 * Server-state for the paginated audit-event feed.
 *
 * Wraps `getAuditEvents` in an infinite query keyed on `["auditEvents"]`. The
 * next-page offset is the running total of all loaded rows; a page shorter than
 * {@link AUDIT_EVENTS_PAGE_SIZE} signals the end. Pages are flattened into a
 * single `events` array for the list.
 */
export function useAuditEvents() {
	const { getAuditEvents } = useSheetsData();

	const query = useInfiniteQuery({
		queryKey: ["auditEvents"],
		queryFn: ({ pageParam }) =>
			getAuditEvents(AUDIT_EVENTS_PAGE_SIZE, pageParam),
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) =>
			lastPage.length === AUDIT_EVENTS_PAGE_SIZE
				? allPages.reduce((count, page) => count + page.length, 0)
				: undefined,
	});

	const events = useMemo<AuditEvent[]>(
		() => query.data?.pages.flat() ?? [],
		[query.data],
	);

	return { ...query, events };
}
