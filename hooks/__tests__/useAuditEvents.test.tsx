import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren, ReactElement } from "react";
import { AUDIT_EVENTS_PAGE_SIZE, useAuditEvents } from "@/hooks/useAuditEvents";
import type { AuditEvent } from "@/services/googleSheets";

// `getAuditEvents` is the paginated data source the hook wraps.
const mockGetAuditEvents = jest.fn();
jest.mock("@/hooks/useSheetsData", () => ({
	useSheetsData: () => ({ getAuditEvents: mockGetAuditEvents }),
}));

function wrapper({ children }: PropsWithChildren): ReactElement {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** A minimal audit event with an overridable id/name. */
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
	mockGetAuditEvents.mockReset();
});

describe("useAuditEvents", () => {
	it("requests the first page with the page size and a zero offset", async () => {
		mockGetAuditEvents.mockResolvedValue([makeEvent({ id: 1 })]);
		const { result } = await renderHook(() => useAuditEvents(), { wrapper });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockGetAuditEvents).toHaveBeenCalledWith(AUDIT_EVENTS_PAGE_SIZE, 0);
	});

	it("flattens loaded pages into a single events array", async () => {
		mockGetAuditEvents.mockResolvedValue([
			makeEvent({ id: 1, object_name: "A" }),
			makeEvent({ id: 2, object_name: "B" }),
		]);
		const { result } = await renderHook(() => useAuditEvents(), { wrapper });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.events.map((e) => e.object_name)).toEqual(["A", "B"]);
	});

	it("defaults events to an empty array before data arrives", async () => {
		mockGetAuditEvents.mockImplementation(() => new Promise(() => {}));
		const { result } = await renderHook(() => useAuditEvents(), { wrapper });
		expect(result.current.events).toEqual([]);
	});

	it("stops paginating after a page shorter than the page size", async () => {
		mockGetAuditEvents.mockResolvedValue([makeEvent({ id: 1 })]);
		const { result } = await renderHook(() => useAuditEvents(), { wrapper });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		// A short first page yields getNextPageParam === undefined.
		expect(result.current.hasNextPage).toBe(false);
	});

	it("computes the next offset from accumulated page lengths on a full page", async () => {
		const fullPage = Array.from({ length: AUDIT_EVENTS_PAGE_SIZE }, (_, i) =>
			makeEvent({ id: i + 1 }),
		);
		const secondPage = [makeEvent({ id: 51, object_name: "Page Two" })];
		mockGetAuditEvents
			.mockResolvedValueOnce(fullPage)
			.mockResolvedValueOnce(secondPage);

		const { result } = await renderHook(() => useAuditEvents(), { wrapper });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		// A full first page makes another page available.
		expect(result.current.hasNextPage).toBe(true);

		await result.current.fetchNextPage();
		// The offset for page two equals the first page's length.
		await waitFor(() =>
			expect(mockGetAuditEvents).toHaveBeenCalledWith(
				AUDIT_EVENTS_PAGE_SIZE,
				AUDIT_EVENTS_PAGE_SIZE,
			),
		);
		await waitFor(() =>
			expect(result.current.events.map((e) => e.object_name)).toContain(
				"Page Two",
			),
		);
		// The short second page stops further pagination.
		await waitFor(() => expect(result.current.hasNextPage).toBe(false));
	});
});
