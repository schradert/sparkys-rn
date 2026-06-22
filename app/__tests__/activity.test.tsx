import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import type { ReactElement } from "react";
import type { AuditEvent } from "@/services/googleSheets";
import { logger } from "@/services/logger";

// The rendered-tree node type, derived from RNTL's `screen.root` so no extra
// type dependency is needed.
type TestNode = NonNullable<typeof screen.root>;

/** Find the first host node carrying a given prop (e.g. the FlatList). */
function findByProp(root: TestNode | null, prop: string): TestNode {
	if (!root) {
		throw new Error("Rendered tree has no root");
	}
	const queue: TestNode[] = [root];
	while (queue.length > 0) {
		// biome-ignore lint/style/noNonNullAssertion: queue is non-empty in the loop
		const current = queue.shift()!;
		if (current.props && prop in current.props) {
			return current;
		}
		for (const child of current.children) {
			if (typeof child !== "string") {
				queue.push(child);
			}
		}
	}
	throw new Error(`No node found carrying prop "${prop}"`);
}

/** Count host nodes of a given type (e.g. "ActivityIndicator") in the tree. */
function countByType(root: TestNode | null, typeName: string): number {
	if (!root) {
		return 0;
	}
	let count = 0;
	const queue: TestNode[] = [root];
	while (queue.length > 0) {
		// biome-ignore lint/style/noNonNullAssertion: queue is non-empty in the loop
		const current = queue.shift()!;
		if (current.type === typeName) {
			count += 1;
		}
		for (const child of current.children) {
			if (typeof child !== "string") {
				queue.push(child);
			}
		}
	}
	return count;
}

// --- Mock surface -----------------------------------------------------------
// expo-router's `router` drives every navigation side effect on this screen.
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
	router: {
		push: (...args: unknown[]) => mockPush(...args),
		back: (...args: unknown[]) => mockBack(...args),
	},
}));

// `useTheme` only supplies the palette key (Colors[theme]).
let mockTheme: "light" | "dark" = "light";
jest.mock("@/hooks/useTheme", () => ({
	useTheme: () => ({ theme: mockTheme }),
}));

// `getAuditEvents` is the paginated data source backing useInfiniteQuery.
const mockGetAuditEvents = jest.fn();
jest.mock("@/hooks/useSheetsData", () => ({
	useSheetsData: () => ({ getAuditEvents: mockGetAuditEvents }),
}));

// The internal_product change row resolves a product id by name from the store.
const mockGetAllInternalProducts = jest.fn();
jest.mock("@/store/products", () => ({
	getAllInternalProducts: () => mockGetAllInternalProducts(),
}));

// Render each Ionicon as its glyph name so icons are queryable by text.
jest.mock("@expo/vector-icons", () => {
	const { Text } = require("react-native") as typeof import("react-native");
	return {
		Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text>,
	};
});

import Activity from "@/app/activity";

/** A realistic AuditEvent with overridable fields. */
function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
	return {
		id: 1,
		timestamp: "2026-01-02T03:04:05.000Z",
		event_type: "edit",
		object_type: "external_product",
		object_id: "SKU-A",
		object_name: "Flaming Red 11in",
		changes: "{}",
		before_state: "{}",
		sheet_name: "external_products",
		user_email: "tester@example.com",
		...overrides,
	};
}

/** Render the screen inside a fresh QueryClient (retry disabled). */
async function renderActivity(): Promise<ReturnType<typeof render>> {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const ui = (
		<QueryClientProvider client={queryClient}>
			<Activity />
		</QueryClientProvider>
	) as ReactElement;
	const result = await render(ui);
	// Let the initial query settle out of its loading state before asserting.
	await waitFor(() =>
		expect(screen.queryByText("icon:arrow-back")).toBeOnTheScreen(),
	);
	return result;
}

beforeEach(() => {
	mockPush.mockReset();
	mockBack.mockReset();
	mockGetAuditEvents.mockReset();
	mockGetAllInternalProducts.mockReset().mockReturnValue([]);
	mockTheme = "light";
	(logger.debug as jest.Mock).mockClear();
});

describe("Activity screen", () => {
	describe("query lifecycle", () => {
		it("shows the loading spinner while the first page is in flight", async () => {
			// A never-resolving query keeps isLoading true so the loading branch renders.
			mockGetAuditEvents.mockImplementation(() => new Promise(() => {}));
			const queryClient = new QueryClient({
				defaultOptions: { queries: { retry: false } },
			});
			await render(
				<QueryClientProvider client={queryClient}>
					<Activity />
				</QueryClientProvider>,
			);
			// Loading header still shows the back button + title, plus the spinner.
			expect(screen.getByText("icon:arrow-back")).toBeOnTheScreen();
			expect(screen.getByText("Activity")).toBeOnTheScreen();
			// The events FlatList (carrying onEndReached) is not mounted yet.
			expect(() => findByProp(screen.root, "onEndReached")).toThrow();
		});

		it("navigates back from the loading header", async () => {
			mockGetAuditEvents.mockImplementation(() => new Promise(() => {}));
			const queryClient = new QueryClient({
				defaultOptions: { queries: { retry: false } },
			});
			await render(
				<QueryClientProvider client={queryClient}>
					<Activity />
				</QueryClientProvider>,
			);
			await fireEvent.press(screen.getByText("icon:arrow-back"));
			expect(mockBack).toHaveBeenCalledTimes(1);
		});

		it("renders the empty state when no events are returned", async () => {
			mockGetAuditEvents.mockResolvedValue([]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("No activity events found")).toBeOnTheScreen(),
			);
			expect(screen.getByText("icon:time-outline")).toBeOnTheScreen();
		});

		it("navigates back from the main header", async () => {
			mockGetAuditEvents.mockResolvedValue([]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("No activity events found")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("icon:arrow-back"));
			expect(mockBack).toHaveBeenCalledTimes(1);
		});

		it("renders a single page that is shorter than PAGE_SIZE without a next page", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({ id: 1, object_name: "First Item" }),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("First Item")).toBeOnTheScreen(),
			);
			// getAuditEvents called once for the only page (offset 0).
			expect(mockGetAuditEvents).toHaveBeenCalledWith(50, 0);

			// hasNextPage is false (page < PAGE_SIZE) so load-more is a no-op.
			const list = findByProp(screen.root, "onEndReached");
			await act(async () => {
				list.props.onEndReached();
			});
			expect(mockGetAuditEvents).toHaveBeenCalledTimes(1);
		});

		it("fetches the next page when the end is reached on a full first page", async () => {
			// A full first page (length === PAGE_SIZE) makes hasNextPage true; the
			// second page is short so pagination then stops. getNextPageParam's
			// reduce computes the offset from the accumulated page lengths.
			const fullPage = Array.from({ length: 50 }, (_, i) =>
				makeEvent({ id: i + 1, object_name: `Item ${i + 1}` }),
			);
			const secondPage = [makeEvent({ id: 51, object_name: "Page Two Item" })];
			mockGetAuditEvents
				.mockResolvedValueOnce(fullPage)
				.mockResolvedValueOnce(secondPage);

			await renderActivity();
			await waitFor(() => expect(screen.getByText("Item 1")).toBeOnTheScreen());
			expect(mockGetAuditEvents).toHaveBeenCalledWith(50, 0);

			const list = findByProp(screen.root, "onEndReached");
			await act(async () => {
				list.props.onEndReached();
			});

			// Second page requested with offset === total of the first page (50).
			await waitFor(() =>
				expect(mockGetAuditEvents).toHaveBeenCalledWith(50, 50),
			);
			// The second page is now part of the data set (its events flatten in).
			expect(mockGetAuditEvents).toHaveBeenCalledTimes(2);
		});

		it("shows the loading footer while the next page is being fetched", async () => {
			// First page is full (hasNextPage true). The second fetch hangs so
			// isFetchingNextPage stays true and renderFooter shows its spinner.
			const fullPage = Array.from({ length: 50 }, (_, i) =>
				makeEvent({ id: i + 1, object_name: `Item ${i + 1}` }),
			);
			mockGetAuditEvents
				.mockResolvedValueOnce(fullPage)
				.mockImplementationOnce(() => new Promise(() => {}));

			await renderActivity();
			await waitFor(() => expect(screen.getByText("Item 1")).toBeOnTheScreen());

			const list = findByProp(screen.root, "onEndReached");
			await act(async () => {
				list.props.onEndReached();
			});

			// renderFooter returns its spinner View while a next page is fetching,
			// adding an ActivityIndicator to the tree.
			await waitFor(() =>
				expect(countByType(screen.root, "ActivityIndicator")).toBeGreaterThan(
					0,
				),
			);
			// load-more is guarded against re-entry while a fetch is in flight.
			mockGetAuditEvents.mockClear();
			await act(async () => {
				list.props.onEndReached();
			});
			expect(mockGetAuditEvents).not.toHaveBeenCalled();
		});

		it("pull-to-refresh refetches the current pages", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({ id: 1, object_name: "Refreshable" }),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Refreshable")).toBeOnTheScreen(),
			);
			expect(mockGetAuditEvents).toHaveBeenCalledTimes(1);

			const list = findByProp(screen.root, "refreshControl");
			await act(async () => {
				list.props.refreshControl.props.onRefresh();
			});
			// Refetch re-runs the query function for the first page.
			await waitFor(() => expect(mockGetAuditEvents).toHaveBeenCalledTimes(2));
		});
	});

	describe("event icon, color, and label logic", () => {
		it("renders a create event with its icon and 'Created' label", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({ id: 1, event_type: "create", object_name: "New Thing" }),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("New Thing")).toBeOnTheScreen(),
			);
			expect(screen.getByText("icon:add-circle-outline")).toBeOnTheScreen();
			expect(screen.getByText("Created")).toBeOnTheScreen();
		});

		it("renders an edit event with its icon and 'Edited' label", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({ id: 1, event_type: "edit", object_name: "Edited Thing" }),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Edited Thing")).toBeOnTheScreen(),
			);
			expect(screen.getByText("icon:pencil-outline")).toBeOnTheScreen();
			expect(screen.getByText("Edited")).toBeOnTheScreen();
		});

		it("renders an archive event with its icon and 'Archived' label", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({ id: 1, event_type: "archive", object_name: "Old Thing" }),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Old Thing")).toBeOnTheScreen(),
			);
			expect(screen.getByText("icon:archive-outline")).toBeOnTheScreen();
			expect(screen.getByText("Archived")).toBeOnTheScreen();
		});

		it("renders an unarchive event with its icon and 'Unarchived' label", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "unarchive",
					object_name: "Back Thing",
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Back Thing")).toBeOnTheScreen(),
			);
			expect(screen.getByText("icon:refresh-outline")).toBeOnTheScreen();
			expect(screen.getByText("Unarchived")).toBeOnTheScreen();
		});

		it("renders an unknown event type with the default icon and label", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					// A value outside the union exercises the default switch arms.
					event_type: "imported" as AuditEvent["event_type"],
					object_name: "Mystery Thing",
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Mystery Thing")).toBeOnTheScreen(),
			);
			expect(
				screen.getByText("icon:information-circle-outline"),
			).toBeOnTheScreen();
			// Default label path: capitalized type + "d" suffix.
			expect(screen.getByText("Importedd")).toBeOnTheScreen();
		});

		it("labels a quantity increase as 'Deposited' with an up arrow", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "quantity_update",
					object_name: "Stock Up",
					changes: JSON.stringify({ quantity: 20 }),
					before_state: JSON.stringify({ quantity: 5 }),
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Stock Up")).toBeOnTheScreen(),
			);
			expect(screen.getByText("icon:arrow-up")).toBeOnTheScreen();
			expect(screen.getByText("Deposited")).toBeOnTheScreen();
		});

		it("labels a quantity decrease as 'Withdrew' with a down arrow", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "quantity_update",
					object_name: "Stock Down",
					changes: JSON.stringify({ quantity: 2 }),
					before_state: JSON.stringify({ quantity: 9 }),
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Stock Down")).toBeOnTheScreen(),
			);
			expect(screen.getByText("icon:arrow-down")).toBeOnTheScreen();
			expect(screen.getByText("Withdrew")).toBeOnTheScreen();
		});

		it("falls back to 'Withdrew' and a down arrow when quantity JSON is malformed", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "quantity_update",
					object_name: "Broken JSON",
					// Non-empty (so the detail changes block is also entered) but invalid.
					changes: "not-json",
					before_state: "also-not-json",
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Broken JSON")).toBeOnTheScreen(),
			);
			expect(screen.getByText("icon:arrow-down")).toBeOnTheScreen();
			expect(screen.getByText("Withdrew")).toBeOnTheScreen();
			// The icon/label/color catch branches log a debug line.
			expect(logger.debug).toHaveBeenCalled();
		});

		it("falls back to a down arrow when quantity fields are absent from the JSON", async () => {
			// Valid JSON without a `quantity` key skips the up/down comparison and
			// uses the default arrow/label/color, with no parse error logged.
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "quantity_update",
					object_name: "No Quantity Key",
					changes: JSON.stringify({ note: "x" }),
					before_state: JSON.stringify({ note: "y" }),
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("No Quantity Key")).toBeOnTheScreen(),
			);
			expect(screen.getByText("icon:arrow-down")).toBeOnTheScreen();
			expect(screen.getByText("Withdrew")).toBeOnTheScreen();
		});

		it("falls back to a down arrow when a quantity event has empty-object payloads", async () => {
			// "{}" is truthy, so the icon/color guards enter the try, parse the empty
			// objects, find no quantity key, and use the default arrow/label.
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "quantity_update",
					object_name: "Empty Payload",
					changes: "{}",
					before_state: "{}",
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Empty Payload")).toBeOnTheScreen(),
			);
			expect(screen.getByText("icon:arrow-down")).toBeOnTheScreen();
			expect(screen.getByText("Withdrew")).toBeOnTheScreen();
		});

		it("skips the quantity comparison entirely when the changes payload is an empty string", async () => {
			// Empty-string changes/before_state are falsy, so `changes && beforeState`
			// short-circuits and the icon/color guards never enter the try block.
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "quantity_update",
					object_name: "Falsy Payload",
					changes: "",
					before_state: "",
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Falsy Payload")).toBeOnTheScreen(),
			);
			// Default arrow/label since the guard skipped the comparison.
			expect(screen.getByText("icon:arrow-down")).toBeOnTheScreen();
			// The card label's own JSON.parse("") throws -> caught -> "Withdrew".
			expect(screen.getByText("Withdrew")).toBeOnTheScreen();
		});

		it("applies the dark palette without error", async () => {
			mockTheme = "dark";
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({ id: 1, event_type: "create", object_name: "Dark Item" }),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Dark Item")).toBeOnTheScreen(),
			);
			expect(screen.getByText("Created")).toBeOnTheScreen();
		});
	});

	describe("timestamp formatting", () => {
		it("formats a valid ISO timestamp via toLocaleString", async () => {
			const ev = makeEvent({
				id: 1,
				object_name: "Timestamped",
				timestamp: "2026-01-02T03:04:05.000Z",
			});
			mockGetAuditEvents.mockResolvedValue([ev]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Timestamped")).toBeOnTheScreen(),
			);
			// The card line is "<formatted> • <email>".
			const expected = `${new Date(ev.timestamp).toLocaleString()} • ${ev.user_email}`;
			expect(screen.getByText(expected)).toBeOnTheScreen();
		});

		it("renders an invalid timestamp without crashing", async () => {
			// new Date("invalid").toLocaleString() yields "Invalid Date" rather than
			// throwing, so the try path runs; the screen must still render.
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					object_name: "Bad Timestamp",
					timestamp: "definitely-not-a-date",
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Bad Timestamp")).toBeOnTheScreen(),
			);
			expect(
				screen.getByText(/Invalid Date • tester@example.com/),
			).toBeOnTheScreen();
		});
	});

	describe("detail modal", () => {
		it("opens the detail modal when an event card is pressed and closes via the X", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "create",
					object_name: "Detail Target",
					object_type: "internal_product",
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Detail Target")).toBeOnTheScreen(),
			);

			await fireEvent.press(screen.getByText("Detail Target"));
			// Modal header + detail content now visible.
			expect(screen.getByText("Event Details")).toBeOnTheScreen();
			// object_type rendered uppercased with the underscore replaced.
			expect(screen.getByText("INTERNAL PRODUCT")).toBeOnTheScreen();
			expect(screen.getByText("by tester@example.com")).toBeOnTheScreen();

			// Closing via the X icon hides the detail body.
			await fireEvent.press(screen.getByText("icon:close"));
			await waitFor(() =>
				expect(screen.queryByText("by tester@example.com")).toBeNull(),
			);
		});

		it("shows the quantity label inside the detail modal", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "quantity_update",
					object_name: "Quantity Detail",
					object_type: "external_product",
					changes: JSON.stringify({ quantity: 30 }),
					before_state: JSON.stringify({ quantity: 10 }),
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Quantity Detail")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Quantity Detail"));
			// Both the card and detail label read "Deposited".
			expect(screen.getAllByText("Deposited").length).toBeGreaterThanOrEqual(2);
		});

		it("shows the 'Withdrew' detail label for a quantity decrease", async () => {
			// A decrease drives the detail label ternary's false ("Withdrew") arm.
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "quantity_update",
					object_name: "Detail Decrease",
					object_type: "external_product",
					changes: JSON.stringify({ quantity: 3 }),
					before_state: JSON.stringify({ quantity: 12 }),
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Detail Decrease")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Detail Decrease"));
			// Both the card and detail label read "Withdrew".
			expect(screen.getAllByText("Withdrew").length).toBeGreaterThanOrEqual(2);
		});

		it("falls back to 'Withdrew' in the detail label when quantity JSON is malformed", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "quantity_update",
					object_name: "Detail Broken",
					object_type: "external_product",
					changes: "broken",
					before_state: "broken",
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Detail Broken")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Detail Broken"));
			expect(screen.getAllByText("Withdrew").length).toBeGreaterThanOrEqual(2);
		});

		it("falls back to 'Withdrew' in the detail label when the parsed JSON has no quantity key", async () => {
			// Valid JSON without a quantity field exercises the detail label's
			// `quantity !== undefined` guard on its false branch (no parse error).
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "quantity_update",
					object_name: "Detail No Quantity",
					object_type: "external_product",
					changes: JSON.stringify({ note: "a" }),
					before_state: JSON.stringify({ note: "b" }),
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Detail No Quantity")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Detail No Quantity"));
			expect(screen.getAllByText("Withdrew").length).toBeGreaterThanOrEqual(2);
		});

		it("renders the default detail label for a non-quantity event", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "edit",
					object_name: "Edit Detail",
					object_type: "external_product",
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Edit Detail")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Edit Detail"));
			// "Edited" shows in both the card and the detail header.
			expect(screen.getAllByText("Edited").length).toBeGreaterThanOrEqual(2);
		});

		it("closes the modal via the hardware back request handler", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({ id: 1, object_name: "Hardware Close" }),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Hardware Close")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Hardware Close"));
			expect(screen.getByText("Event Details")).toBeOnTheScreen();

			// Modal.onRequestClose drives the same close handler.
			const modal = findByProp(screen.root, "onRequestClose");
			await act(async () => {
				modal.props.onRequestClose();
			});
			await waitFor(() =>
				expect(screen.queryByText("by tester@example.com")).toBeNull(),
			);
		});
	});

	describe("navigateToItem", () => {
		it("navigates to the internal product route", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					object_type: "internal_product",
					object_id: "int 1/x",
					object_name: "Internal Nav",
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Internal Nav")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Internal Nav"));
			await fireEvent.press(screen.getByText("View Item"));
			expect(mockPush).toHaveBeenCalledWith("/internal-product/int%201%2Fx");
		});

		it("navigates to the external product route", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					object_type: "external_product",
					object_id: "SKU 5/z",
					object_name: "External Nav",
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("External Nav")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("External Nav"));
			await fireEvent.press(screen.getByText("View Item"));
			expect(mockPush).toHaveBeenCalledWith("/external-product/SKU%205%2Fz");
		});

		it("navigates to the metadata route using the sheet name", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					object_type: "metadata",
					object_name: "Metadata Nav",
					sheet_name: "colors",
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Metadata Nav")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Metadata Nav"));
			await fireEvent.press(screen.getByText("View Item"));
			expect(mockPush).toHaveBeenCalledWith("/metadata/colors");
		});
	});

	describe("changes section in the detail modal", () => {
		it("renders scalar, clickable, and non-clickable change rows with metadata routing", async () => {
			// `brand` is clickable -> manufacturers route; `status` is a scalar
			// non-clickable row; both old/new values are present (no "—" fallback).
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "edit",
					object_name: "Field Rows",
					object_type: "external_product",
					changes: JSON.stringify({ brand: "Qualatex", status: "active" }),
					before_state: JSON.stringify({
						brand: "Betallic",
						status: "archived",
					}),
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Field Rows")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Field Rows"));

			expect(screen.getByText("Changes:")).toBeOnTheScreen();
			// Field labels render underscore-free + uppercased.
			expect(screen.getByText("BRAND")).toBeOnTheScreen();
			expect(screen.getByText("STATUS")).toBeOnTheScreen();
			// Old/new values for each field.
			expect(screen.getByText("Betallic")).toBeOnTheScreen();
			expect(screen.getByText("Qualatex")).toBeOnTheScreen();
			expect(screen.getByText("archived")).toBeOnTheScreen();
			expect(screen.getByText("active")).toBeOnTheScreen();
			// Field icons: brand -> business, status -> flag.
			expect(screen.getByText("icon:business-outline")).toBeOnTheScreen();
			expect(screen.getByText("icon:flag-outline")).toBeOnTheScreen();

			// Pressing the clickable brand arrow navigates to its metadata route
			// and closes the modal.
			await fireEvent.press(screen.getByText("Qualatex"));
			expect(mockPush).toHaveBeenCalledWith("/metadata/manufacturers/Qualatex");
			await waitFor(() => expect(screen.queryByText("Changes:")).toBeNull());
		});

		it("renders the distributors badge diff (constant, removed, added)", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "edit",
					object_name: "Distributor Diff",
					object_type: "external_product",
					// Keep "Keep Co", drop "Drop Co", add "Add Co".
					before_state: JSON.stringify({ distributors: "Keep Co, Drop Co" }),
					changes: JSON.stringify({ distributors: "Keep Co, Add Co" }),
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Distributor Diff")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Distributor Diff"));

			expect(screen.getByText("DISTRIBUTORS")).toBeOnTheScreen();
			// Constant, removed, and added badges all render their labels.
			expect(screen.getByText("Keep Co")).toBeOnTheScreen();
			expect(screen.getByText("Drop Co")).toBeOnTheScreen();
			expect(screen.getByText("Add Co")).toBeOnTheScreen();
			// The storefront field icon for distributors is shown.
			expect(screen.getByText("icon:storefront-outline")).toBeOnTheScreen();
		});

		it("treats empty distributor/occasion strings as empty badge lists", async () => {
			// Empty strings exercise the `?.toString() ? ... : []` false branches for
			// both old and new badge item parsing.
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "edit",
					object_name: "Empty Badges",
					object_type: "external_product",
					before_state: JSON.stringify({ occasions: "" }),
					changes: JSON.stringify({ occasions: "" }),
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Empty Badges")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Empty Badges"));
			// The occasions row renders (calendar icon) with no badge text.
			expect(screen.getByText("OCCASIONS")).toBeOnTheScreen();
			expect(screen.getByText("icon:calendar-outline")).toBeOnTheScreen();
		});

		it("navigates to the resolved internal_product route when the product exists", async () => {
			mockGetAllInternalProducts.mockReturnValue([
				{ id: "prod-99", sparkys_product_name: "Linked Product" },
			]);
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "edit",
					object_name: "Internal Link",
					object_type: "external_product",
					before_state: JSON.stringify({ internal_product: "Old Product" }),
					changes: JSON.stringify({ internal_product: "Linked Product" }),
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Internal Link")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Internal Link"));
			// internal_product is clickable and resolves the link icon.
			expect(screen.getByText("icon:link-outline")).toBeOnTheScreen();

			await fireEvent.press(screen.getByText("Linked Product"));
			expect(mockPush).toHaveBeenCalledWith("/internal-product/prod-99");
		});

		it("does not navigate when the internal_product name cannot be resolved", async () => {
			// No matching product -> getMetadataRoute returns null -> the press is a
			// no-op (the `if (route)` guard's false branch).
			mockGetAllInternalProducts.mockReturnValue([
				{ id: "prod-1", sparkys_product_name: "Some Other Product" },
			]);
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "edit",
					object_name: "Unresolved Link",
					object_type: "external_product",
					before_state: JSON.stringify({ internal_product: "Old" }),
					changes: JSON.stringify({ internal_product: "Missing Product" }),
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Unresolved Link")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Unresolved Link"));
			await fireEvent.press(screen.getByText("Missing Product"));
			// Modal stays open and no metadata navigation happened.
			expect(screen.getByText("Changes:")).toBeOnTheScreen();
			expect(mockPush).not.toHaveBeenCalledWith(
				expect.stringContaining("/internal-product/"),
			);
		});

		it("covers every clickable metadata field route and field icon", async () => {
			// One event whose changes touch each clickable scalar field exercises
			// each getMetadataRoute arm and each getFieldIcon arm in one render.
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "edit",
					object_name: "All Fields",
					object_type: "external_product",
					before_state: JSON.stringify({
						manufacturer_color: "Old MC",
						sparkys_color: "Old SC",
						size: "Old Size",
						bag_quantity: "Old BQ",
						product_type: "Old PT",
						texture: "Old TX",
						shape: "Old SH",
					}),
					changes: JSON.stringify({
						manufacturer_color: "New MC",
						sparkys_color: "New SC",
						size: "New Size",
						bag_quantity: "New BQ",
						product_type: "New PT",
						texture: "New TX",
						shape: "New SH",
					}),
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("All Fields")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("All Fields"));

			// Field icons (color-palette appears twice: manufacturer + sparkys color).
			expect(
				screen.getAllByText("icon:color-palette-outline").length,
			).toBeGreaterThanOrEqual(2);
			expect(screen.getByText("icon:resize-outline")).toBeOnTheScreen();
			expect(screen.getByText("icon:bag-outline")).toBeOnTheScreen();
			expect(screen.getByText("icon:shapes-outline")).toBeOnTheScreen();
			expect(screen.getByText("icon:hand-left-outline")).toBeOnTheScreen();
			expect(screen.getByText("icon:diamond-outline")).toBeOnTheScreen();

			// Each clickable new-value navigates to the matching metadata route.
			await fireEvent.press(screen.getByText("New MC"));
			expect(mockPush).toHaveBeenCalledWith("/metadata/colors/New%20MC");

			await fireEvent.press(screen.getByText("All Fields"));
			await fireEvent.press(screen.getByText("New SC"));
			expect(mockPush).toHaveBeenCalledWith("/metadata/colors/New%20SC");

			await fireEvent.press(screen.getByText("All Fields"));
			await fireEvent.press(screen.getByText("New Size"));
			expect(mockPush).toHaveBeenCalledWith("/metadata/sizes/New%20Size");

			await fireEvent.press(screen.getByText("All Fields"));
			await fireEvent.press(screen.getByText("New BQ"));
			expect(mockPush).toHaveBeenCalledWith("/metadata/bagQuantities/New%20BQ");

			await fireEvent.press(screen.getByText("All Fields"));
			await fireEvent.press(screen.getByText("New PT"));
			expect(mockPush).toHaveBeenCalledWith("/metadata/productTypes/New%20PT");

			await fireEvent.press(screen.getByText("All Fields"));
			await fireEvent.press(screen.getByText("New TX"));
			expect(mockPush).toHaveBeenCalledWith("/metadata/textures/New%20TX");

			await fireEvent.press(screen.getByText("All Fields"));
			await fireEvent.press(screen.getByText("New SH"));
			expect(mockPush).toHaveBeenCalledWith("/metadata/shapes/New%20SH");
		});

		it("uses the em-dash fallback for a clickable field whose new value is null", async () => {
			// A clickable field (brand) with a null new value exercises the
			// `newValue?.toString() || ""` route input and the `|| "—"` display
			// fallback on the clickable-arrow branch. The route then becomes
			// `/metadata/manufacturers/` (empty-encoded value).
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "edit",
					object_name: "Null Clickable",
					object_type: "external_product",
					before_state: JSON.stringify({ brand: "Old Brand" }),
					changes: JSON.stringify({ brand: null }),
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Null Clickable")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Null Clickable"));
			// The clickable new-value renders the em-dash fallback.
			expect(screen.getByText("—")).toBeOnTheScreen();

			// Pressing it still navigates, with an empty encoded value.
			await fireEvent.press(screen.getByText("—"));
			expect(mockPush).toHaveBeenCalledWith("/metadata/manufacturers/");
		});

		it("renders the field-icon and value fallbacks for an unknown, empty-valued field", async () => {
			// `name` is non-clickable (default field icon is overridden to pricetag),
			// and an unknown field exercises both the default getFieldIcon and the
			// "—" old/new value fallbacks.
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "edit",
					object_name: "Fallback Fields",
					object_type: "external_product",
					before_state: JSON.stringify({ never_out: "no", mystery: null }),
					changes: JSON.stringify({ never_out: "yes", mystery: null }),
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Fallback Fields")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Fallback Fields"));

			// never_out -> star icon (non-clickable scalar with real values).
			expect(screen.getByText("icon:star-outline")).toBeOnTheScreen();
			expect(screen.getByText("no")).toBeOnTheScreen();
			expect(screen.getByText("yes")).toBeOnTheScreen();
			// Unknown "mystery" field -> default info icon and "—" fallbacks for
			// both the old (scalar) and new (arrow) values.
			expect(
				screen.getByText("icon:information-circle-outline"),
			).toBeOnTheScreen();
			expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
		});

		it("renders the name field with its pricetag icon", async () => {
			// `name` has a dedicated icon and is non-clickable.
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "edit",
					object_name: "Name Field",
					object_type: "external_product",
					before_state: JSON.stringify({ name: "Old Name" }),
					changes: JSON.stringify({ name: "New Name" }),
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Name Field")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Name Field"));
			expect(screen.getByText("icon:pricetag-outline")).toBeOnTheScreen();
			expect(screen.getByText("Old Name")).toBeOnTheScreen();
			expect(screen.getByText("New Name")).toBeOnTheScreen();
		});

		it("renders the quantity field with its calculator icon", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "quantity_update",
					object_name: "Quantity Field",
					object_type: "external_product",
					before_state: JSON.stringify({ quantity: 5 }),
					changes: JSON.stringify({ quantity: 8 }),
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Quantity Field")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Quantity Field"));
			expect(screen.getByText("icon:calculator-outline")).toBeOnTheScreen();
			// Old/new quantity values render as their string forms.
			expect(screen.getByText("5")).toBeOnTheScreen();
			expect(screen.getByText("8")).toBeOnTheScreen();
		});

		it("renders raw changes text when the changes JSON cannot be parsed", async () => {
			// Non-empty, non-"{}" but invalid JSON for both states: the outer guard
			// passes, the inner JSON.parse throws, and the raw string is shown.
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "edit",
					object_name: "Raw Changes",
					object_type: "external_product",
					changes: "totally invalid json",
					before_state: "also invalid",
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("Raw Changes")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("Raw Changes"));
			expect(screen.getByText("Changes:")).toBeOnTheScreen();
			// The catch branch renders the raw changes string verbatim.
			expect(screen.getByText("totally invalid json")).toBeOnTheScreen();
		});

		it("omits the changes section when changes/before_state are empty objects", async () => {
			mockGetAuditEvents.mockResolvedValue([
				makeEvent({
					id: 1,
					event_type: "create",
					object_name: "No Changes",
					object_type: "external_product",
					changes: "{}",
					before_state: "{}",
				}),
			]);
			await renderActivity();
			await waitFor(() =>
				expect(screen.getByText("No Changes")).toBeOnTheScreen(),
			);
			await fireEvent.press(screen.getByText("No Changes"));
			expect(screen.getByText("Event Details")).toBeOnTheScreen();
			// The changes block is gated out for empty payloads.
			expect(screen.queryByText("Changes:")).toBeNull();
		});
	});
});
