import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Animated, FlatList, Text } from "react-native";

// The rendered-tree node type, derived from RNTL's `screen.root` so no extra
// type dependency is needed.
type TestNode = NonNullable<typeof screen.root>;

// `useTheme` only supplies the palette key here.
let mockTheme: "light" | "dark" = "light";
jest.mock("@/hooks/useTheme", () => ({
	useTheme: () => ({ theme: mockTheme }),
}));

// Render each Ionicon as its glyph name so the jump buttons are queryable.
jest.mock("@expo/vector-icons", () => {
	const { Text: RNText } =
		require("react-native") as typeof import("react-native");
	return {
		Ionicons: ({ name }: { name: string }) => <RNText>{`icon:${name}`}</RNText>,
	};
});

import InfiniteScroll from "@/components/InfiniteScroll";

/** Find the first host node carrying a given prop (e.g. the inner ScrollView). */
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

const scrollEvent = {
	nativeEvent: {
		contentOffset: { x: 0, y: 100 },
		contentSize: { width: 0, height: 1000 },
		layoutMeasurement: { width: 0, height: 500 },
	},
};

function makeData(n: number) {
	return Array.from({ length: n }, (_, i) => `item-${i}`);
}

const renderRow = ({ item }: { item: string }) => <Text>{`row-${item}`}</Text>;
const keyExtractor = (item: string) => item;

beforeEach(() => {
	mockTheme = "light";
});

afterEach(() => {
	jest.useRealTimers();
});

describe("InfiniteScroll", () => {
	it("renders the empty state when there is no data", async () => {
		await render(
			<InfiniteScroll
				data={[]}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
				emptyText="Nothing here"
			/>,
		);
		expect(screen.getByText("Nothing here")).toBeOnTheScreen();
	});

	it("uses the default empty text when none is provided", async () => {
		await render(
			<InfiniteScroll
				data={[]}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
			/>,
		);
		expect(screen.getByText("No items")).toBeOnTheScreen();
	});

	it("renders only the first page and a loading footer when more remain", async () => {
		await render(
			<InfiniteScroll
				data={makeData(5)}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
				itemsPerLoad={2}
			/>,
		);
		// Page size 2: first two rows shown, third not yet, footer visible.
		expect(screen.getByText("row-item-0")).toBeOnTheScreen();
		expect(screen.getByText("row-item-1")).toBeOnTheScreen();
		expect(screen.queryByText("row-item-2")).toBeNull();
		expect(screen.getByText("Loading more items...")).toBeOnTheScreen();
	});

	it("does not render a footer once everything is visible", async () => {
		await render(
			<InfiniteScroll
				data={makeData(2)}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
				itemsPerLoad={2}
			/>,
		);
		expect(screen.queryByText("Loading more items...")).toBeNull();
	});

	it("loads the next page when the end is reached", async () => {
		await render(
			<InfiniteScroll
				data={makeData(5)}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
				itemsPerLoad={2}
			/>,
		);
		const list = findByProp(screen.root, "onEndReached");

		await act(async () => {
			list.props.onEndReached();
		});
		expect(screen.getByText("row-item-2")).toBeOnTheScreen();
		expect(screen.getByText("row-item-3")).toBeOnTheScreen();
		// Page 3 still hidden (only 4 of 5 visible after one more load).
		expect(screen.queryByText("row-item-4")).toBeNull();
	});

	it("clamps the final page to the data length", async () => {
		await render(
			<InfiniteScroll
				data={makeData(3)}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
				itemsPerLoad={2}
			/>,
		);
		const list = findByProp(screen.root, "onEndReached");

		await act(async () => {
			list.props.onEndReached();
		});
		// Loading the next page would reach 4, clamped to 3; all rows visible.
		expect(screen.getByText("row-item-2")).toBeOnTheScreen();
		expect(screen.queryByText("Loading more items...")).toBeNull();
	});

	it("is a no-op at the end when nothing more remains", async () => {
		await render(
			<InfiniteScroll
				data={makeData(2)}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
				itemsPerLoad={2}
			/>,
		);
		const list = findByProp(screen.root, "onEndReached");

		await act(async () => {
			list.props.onEndReached();
		});
		// Still exactly the two rows, no footer.
		expect(screen.getByText("row-item-0")).toBeOnTheScreen();
		expect(screen.getByText("row-item-1")).toBeOnTheScreen();
		expect(screen.queryByText("Loading more items...")).toBeNull();
	});

	it("shows the scroll overlay on scroll and hides it after the timeout", async () => {
		jest.useFakeTimers();
		const timingSpy = jest.spyOn(Animated, "timing");

		await render(
			<InfiniteScroll
				data={makeData(5)}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
				itemsPerLoad={2}
			/>,
		);
		const list = findByProp(screen.root, "onScroll");

		await act(async () => {
			fireEvent.scroll(list, scrollEvent);
		});
		// Overlay is now visible: position text + both jump chevrons.
		expect(screen.getByText("1 / 5")).toBeOnTheScreen();
		expect(screen.getByText("icon:chevron-up-outline")).toBeOnTheScreen();
		expect(screen.getByText("icon:chevron-down-outline")).toBeOnTheScreen();

		// Advance past the 1s hide delay; the fade animation then completes and
		// its start-callback unmounts the overlay.
		await act(async () => {
			jest.advanceTimersByTime(1000);
		});
		expect(timingSpy).toHaveBeenCalled();
		await act(async () => {
			jest.runAllTimers();
		});
		expect(screen.queryByText("1 / 5")).toBeNull();
		timingSpy.mockRestore();
	});

	it("clears a pending hide timeout when scrolled again", async () => {
		jest.useFakeTimers();
		const clearSpy = jest.spyOn(globalThis, "clearTimeout");

		await render(
			<InfiniteScroll
				data={makeData(5)}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
				itemsPerLoad={2}
			/>,
		);
		const list = findByProp(screen.root, "onScroll");

		// First scroll arms a hide timeout; the second scroll must clear it.
		await act(async () => {
			fireEvent.scroll(list, scrollEvent);
		});
		clearSpy.mockClear();
		await act(async () => {
			fireEvent.scroll(list, scrollEvent);
		});
		expect(clearSpy).toHaveBeenCalled();
		clearSpy.mockRestore();
	});

	it("jumps to the start and to the end via the overlay buttons", async () => {
		jest.useFakeTimers();
		// The jump buttons drive the FlatList ref's imperative scroll methods;
		// stub them on the prototype so the ref the component holds is covered.
		const scrollToOffset = jest
			.spyOn(FlatList.prototype, "scrollToOffset")
			.mockImplementation(() => {});
		const scrollToEnd = jest
			.spyOn(FlatList.prototype, "scrollToEnd")
			.mockImplementation(() => {});

		await render(
			<InfiniteScroll
				data={makeData(5)}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
				itemsPerLoad={2}
			/>,
		);
		const list = findByProp(screen.root, "onScroll");

		// Reveal the overlay so the buttons are mounted.
		await act(async () => {
			fireEvent.scroll(list, scrollEvent);
		});

		await act(async () => {
			fireEvent.press(screen.getByText("icon:chevron-up-outline"));
		});
		expect(scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: true });

		await act(async () => {
			fireEvent.press(screen.getByText("icon:chevron-down-outline"));
		});
		expect(scrollToEnd).toHaveBeenCalledWith({ animated: true });

		scrollToOffset.mockRestore();
		scrollToEnd.mockRestore();
	});

	it("updates the position indicator from viewable items", async () => {
		jest.useFakeTimers();
		await render(
			<InfiniteScroll
				data={makeData(5)}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
				itemsPerLoad={5}
			/>,
		);
		const list = findByProp(screen.root, "onViewableItemsChanged");

		// Reveal the overlay (starts at "1 / 5").
		await act(async () => {
			fireEvent.scroll(list, scrollEvent);
		});
		expect(screen.getByText("1 / 5")).toBeOnTheScreen();

		// A viewable change to index 2 moves the indicator to "3 / 5".
		await act(async () => {
			list.props.onViewableItemsChanged({
				viewableItems: [{ index: 2, key: "item-2", isViewable: true }],
			});
		});
		expect(screen.getByText("3 / 5")).toBeOnTheScreen();
	});

	it("treats a null viewable index as the first item", async () => {
		jest.useFakeTimers();
		await render(
			<InfiniteScroll
				data={makeData(5)}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
				itemsPerLoad={5}
			/>,
		);
		const list = findByProp(screen.root, "onViewableItemsChanged");
		await act(async () => {
			fireEvent.scroll(list, scrollEvent);
		});

		await act(async () => {
			list.props.onViewableItemsChanged({
				viewableItems: [{ index: null, key: "item-x", isViewable: true }],
			});
		});
		// index ?? 0 -> 0, so the indicator reads "1 / 5".
		expect(screen.getByText("1 / 5")).toBeOnTheScreen();
	});

	it("ignores an empty viewable-items batch", async () => {
		jest.useFakeTimers();
		await render(
			<InfiniteScroll
				data={makeData(5)}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
				itemsPerLoad={5}
			/>,
		);
		const list = findByProp(screen.root, "onViewableItemsChanged");
		await act(async () => {
			fireEvent.scroll(list, scrollEvent);
		});

		await act(async () => {
			list.props.onViewableItemsChanged({ viewableItems: [] });
		});
		// Indicator unchanged.
		expect(screen.getByText("1 / 5")).toBeOnTheScreen();
	});

	it("wires a RefreshControl and resets paging + forwards onRefresh", async () => {
		const onRefresh = jest.fn();
		await render(
			<InfiniteScroll
				data={makeData(5)}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
				itemsPerLoad={2}
				onRefresh={onRefresh}
				refreshing={false}
			/>,
		);
		const list = findByProp(screen.root, "refreshControl");

		// Advance paging so the reset is observable.
		await act(async () => {
			list.props.onEndReached();
		});
		expect(screen.getByText("row-item-2")).toBeOnTheScreen();

		// Pull-to-refresh resets the visible window to one page and notifies.
		await act(async () => {
			list.props.refreshControl.props.onRefresh();
		});
		expect(onRefresh).toHaveBeenCalledTimes(1);
		expect(screen.queryByText("row-item-2")).toBeNull();
		expect(screen.getByText("row-item-1")).toBeOnTheScreen();
	});

	it("omits the RefreshControl when no onRefresh is provided", async () => {
		await render(
			<InfiniteScroll
				data={makeData(2)}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
				itemsPerLoad={2}
			/>,
		);
		const list = findByProp(screen.root, "onScroll");
		expect(list.props.refreshControl).toBeUndefined();
	});

	it("clears the hide timeout on unmount", async () => {
		jest.useFakeTimers();
		const clearSpy = jest.spyOn(globalThis, "clearTimeout");
		const { unmount } = await render(
			<InfiniteScroll
				data={makeData(5)}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
				itemsPerLoad={2}
			/>,
		);
		const list = findByProp(screen.root, "onScroll");
		// Arm a hide timeout so the cleanup branch has something to clear.
		await act(async () => {
			fireEvent.scroll(list, scrollEvent);
		});
		clearSpy.mockClear();

		await act(async () => {
			unmount();
		});
		expect(clearSpy).toHaveBeenCalled();
		clearSpy.mockRestore();
	});

	it("applies the dark palette without error", async () => {
		mockTheme = "dark";
		await render(
			<InfiniteScroll
				data={makeData(3)}
				renderItem={renderRow}
				keyExtractor={keyExtractor}
				itemsPerLoad={2}
			/>,
		);
		expect(screen.getByText("Loading more items...")).toBeOnTheScreen();
	});
});
