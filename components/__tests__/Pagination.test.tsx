import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import Pagination from "@/components/Pagination";

// `useTheme` requires a ThemeProvider at runtime; mock it so the component can
// resolve a palette in isolation. See CONTRIBUTING.md for the async RNTL flow.
jest.mock("@/hooks/useTheme", () => ({
	useTheme: jest.fn(() => ({ theme: "light", toggleTheme: jest.fn() })),
}));

type Row = { id: string };

const rows = (n: number): Row[] =>
	Array.from({ length: n }, (_, i) => ({ id: String(i + 1) }));

const renderItem = ({ item }: { item: Row }) => <Text>{`row ${item.id}`}</Text>;
const keyExtractor = (item: Row) => item.id;

// The prev/next controls are icon-only `Pressable`s with no text or testID, so
// locate them structurally: pressables render as host `View`s carrying a press
// responder. The first is "previous", the last is "next".
const pressables = () =>
	screen.root?.queryAll(
		(node) =>
			node.type === "View" &&
			typeof node.props.onStartShouldSetResponder !== "undefined",
	) ?? [];
const prevButton = () => {
	const all = pressables();
	return all[0];
};
const nextButton = () => {
	const all = pressables();
	return all[all.length - 1];
};

describe("Pagination", () => {
	it("renders the default empty message for an empty data set", async () => {
		await render(
			<Pagination
				data={[]}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
			/>,
		);
		expect(screen.getByText("No items")).toBeOnTheScreen();
	});

	it("renders a custom empty message", async () => {
		await render(
			<Pagination
				data={[]}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				emptyText="Nothing here"
			/>,
		);
		expect(screen.getByText("Nothing here")).toBeOnTheScreen();
	});

	it("renders only the first page worth of items", async () => {
		await render(
			<Pagination
				data={rows(25)}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				itemsPerPage={10}
			/>,
		);
		expect(screen.getByText("row 1")).toBeOnTheScreen();
		expect(screen.getByText("row 10")).toBeOnTheScreen();
		expect(screen.queryByText("row 11")).not.toBeOnTheScreen();
	});

	it("renders a contiguous page list when total pages fit in maxVisiblePages", async () => {
		await render(
			<Pagination
				data={rows(25)}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				itemsPerPage={10}
			/>,
		);
		// 3 pages, all shown, no ellipsis.
		expect(screen.getByText("1")).toBeOnTheScreen();
		expect(screen.getByText("2")).toBeOnTheScreen();
		expect(screen.getByText("3")).toBeOnTheScreen();
		expect(screen.queryByText("...")).not.toBeOnTheScreen();
	});

	it("advances to the next page via a page number and updates the items", async () => {
		await render(
			<Pagination
				data={rows(25)}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				itemsPerPage={10}
			/>,
		);
		await fireEvent.press(screen.getByText("2"));
		expect(screen.getByText("row 11")).toBeOnTheScreen();
		expect(screen.queryByText("row 1")).not.toBeOnTheScreen();
	});

	it("advances to the next page via the next control", async () => {
		await render(
			<Pagination
				data={rows(25)}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				itemsPerPage={10}
			/>,
		);
		await fireEvent.press(nextButton());
		expect(screen.getByText("row 11")).toBeOnTheScreen();
	});

	it("does not page before the first page when prev is pressed on page 1", async () => {
		await render(
			<Pagination
				data={rows(25)}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				itemsPerPage={10}
			/>,
		);
		// The prev control is disabled on page 1; pressing it is a no-op.
		await fireEvent.press(prevButton());
		expect(screen.getByText("row 1")).toBeOnTheScreen();
	});

	it("renders a trailing ellipsis on the first page when there are many pages", async () => {
		await render(
			<Pagination
				data={rows(100)}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				itemsPerPage={10}
				maxVisiblePages={5}
			/>,
		);
		// page 1 of 10: [1, 2, "...", 10]
		expect(screen.getByText("1")).toBeOnTheScreen();
		expect(screen.getByText("10")).toBeOnTheScreen();
		expect(screen.getByText("...")).toBeOnTheScreen();
	});

	it("renders both leading and trailing ellipses on a middle page", async () => {
		await render(
			<Pagination
				data={rows(100)}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				itemsPerPage={10}
				maxVisiblePages={5}
			/>,
		);
		// Step to the middle: page 5 of 10 -> [1, "...", 4, 5, 6, "...", 10].
		// Reach it via the next control so the page list is always present.
		for (let i = 0; i < 4; i++) {
			await fireEvent.press(nextButton());
		}
		expect(screen.getByText("row 41")).toBeOnTheScreen();
		expect(screen.getAllByText("...")).toHaveLength(2);
		expect(screen.getByText("4")).toBeOnTheScreen();
		expect(screen.getByText("6")).toBeOnTheScreen();
	});

	it("disables next and drops the trailing ellipsis on the last page", async () => {
		await render(
			<Pagination
				data={rows(100)}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				itemsPerPage={10}
				maxVisiblePages={5}
			/>,
		);
		// Navigate to the last page -> [1, "...", 9, 10]
		await fireEvent.press(screen.getByText("10"));
		expect(screen.getByText("row 91")).toBeOnTheScreen();
		expect(screen.getByText("9")).toBeOnTheScreen();
		expect(screen.getAllByText("...")).toHaveLength(1);

		// next is disabled on the last page; pressing it is a no-op.
		await fireEvent.press(nextButton());
		expect(screen.getByText("row 91")).toBeOnTheScreen();
	});

	it("navigates backward with the prev control", async () => {
		await render(
			<Pagination
				data={rows(100)}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				itemsPerPage={10}
				maxVisiblePages={5}
			/>,
		);
		await fireEvent.press(screen.getByText("10")); // -> last page
		await fireEvent.press(prevButton()); // -> page 9
		expect(screen.getByText("row 81")).toBeOnTheScreen();
	});

	it("resets to the first page when the data length changes", async () => {
		const view = await render(
			<Pagination
				data={rows(100)}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				itemsPerPage={10}
				maxVisiblePages={5}
			/>,
		);
		await fireEvent.press(screen.getByText("10"));
		expect(screen.getByText("row 91")).toBeOnTheScreen();

		// Changing data.length triggers the reset effect -> back to page 1.
		await view.rerender(
			<Pagination
				data={rows(50)}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				itemsPerPage={10}
				maxVisiblePages={5}
			/>,
		);
		expect(screen.getByText("row 1")).toBeOnTheScreen();
	});

	it("renders a single page button when maxVisiblePages forces the ellipsis branch with one page", async () => {
		// maxVisiblePages=0 pushes a 1-page data set into the windowed branch,
		// where the trailing-page guard (totalPages > 1) is false.
		await render(
			<Pagination
				data={rows(5)}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				itemsPerPage={10}
				maxVisiblePages={0}
			/>,
		);
		expect(screen.getByText("row 1")).toBeOnTheScreen();
		expect(screen.getByText("1")).toBeOnTheScreen();
		expect(screen.queryByText("...")).not.toBeOnTheScreen();
		// Only one page number is rendered (no duplicate last-page entry).
		expect(screen.getAllByText("1")).toHaveLength(1);
	});

	it("wires up pull-to-refresh when onRefresh is provided", async () => {
		const onRefresh = jest.fn();
		await render(
			<Pagination
				data={rows(25)}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				itemsPerPage={10}
				onRefresh={onRefresh}
				refreshing={false}
			/>,
		);
		// The FlatList renders to a host scroll view carrying the RefreshControl
		// element; invoking its onRefresh exercises the wired callback.
		const scrollView = screen.root?.queryAll(
			(node) => node.type === "RCTScrollView",
		)[0];
		scrollView?.props.refreshControl.props.onRefresh();
		expect(onRefresh).toHaveBeenCalledTimes(1);
	});
});
