import { fireEvent, render, screen } from "@testing-library/react-native";
import CollapsibleMultiSelectSection from "@/components/CollapsibleMultiSelectSection";

jest.mock("@/hooks/useTheme", () => ({
	useTheme: () => ({ theme: "light" }),
}));

// Render icons as plain text of their `name` so glyphs (e.g. the search
// "close-circle" clear button) are queryable in tests.
jest.mock("@expo/vector-icons", () => {
	const { Text } = require("react-native");
	return {
		Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
	};
});

const OPTIONS = ["Red", "Blue", "Green", "Pink"] as const;

describe("CollapsibleMultiSelectSection", () => {
	it("renders the title collapsed with no selection count", async () => {
		await render(
			<CollapsibleMultiSelectSection
				title="Color"
				options={OPTIONS}
				selectedValues={[]}
				onSelectionChange={jest.fn()}
			/>,
		);
		expect(screen.getByText("Color")).toBeOnTheScreen();
		// Collapsed: options are not rendered yet.
		expect(screen.queryByText("Blue")).toBeNull();
	});

	it("shows the selection count and selected pill summary when collapsed", async () => {
		await render(
			<CollapsibleMultiSelectSection
				title="Color"
				options={OPTIONS}
				selectedValues={["Red"]}
				onSelectionChange={jest.fn()}
			/>,
		);
		expect(screen.getByText("Color (1)")).toBeOnTheScreen();
		// Summary pill in the collapsed header.
		expect(screen.getByText("Red")).toBeOnTheScreen();
	});

	it("shows a '+N more' summary when more than two values are selected", async () => {
		await render(
			<CollapsibleMultiSelectSection
				title="Color"
				options={OPTIONS}
				selectedValues={["Red", "Blue", "Green", "Pink"]}
				onSelectionChange={jest.fn()}
			/>,
		);
		expect(screen.getByText("Color (4)")).toBeOnTheScreen();
		expect(screen.getByText("+2 more")).toBeOnTheScreen();
	});

	it("expands to reveal the options and search field on header press", async () => {
		await render(
			<CollapsibleMultiSelectSection
				title="Color"
				options={OPTIONS}
				selectedValues={[]}
				onSelectionChange={jest.fn()}
			/>,
		);
		await fireEvent.press(screen.getByText("Color"));
		expect(screen.getByPlaceholderText("Search color...")).toBeOnTheScreen();
		for (const option of OPTIONS) {
			expect(screen.getByText(option)).toBeOnTheScreen();
		}
	});

	it("collapses again on a second header press", async () => {
		await render(
			<CollapsibleMultiSelectSection
				title="Color"
				options={OPTIONS}
				selectedValues={[]}
				onSelectionChange={jest.fn()}
			/>,
		);
		const header = screen.getByText("Color");
		await fireEvent.press(header);
		expect(screen.getByText("Blue")).toBeOnTheScreen();
		await fireEvent.press(header);
		expect(screen.queryByText("Blue")).toBeNull();
	});

	it("adds an unselected value when its pill is pressed", async () => {
		const onSelectionChange = jest.fn();
		await render(
			<CollapsibleMultiSelectSection
				title="Color"
				options={OPTIONS}
				selectedValues={["Red"]}
				onSelectionChange={onSelectionChange}
			/>,
		);
		await fireEvent.press(screen.getByText("Color (1)"));
		await fireEvent.press(screen.getByText("Blue"));
		expect(onSelectionChange).toHaveBeenCalledWith(["Red", "Blue"]);
	});

	it("removes an already-selected value when its pill is pressed", async () => {
		const onSelectionChange = jest.fn();
		await render(
			<CollapsibleMultiSelectSection
				title="Color"
				options={OPTIONS}
				selectedValues={["Red", "Blue"]}
				onSelectionChange={onSelectionChange}
			/>,
		);
		await fireEvent.press(screen.getByText("Color (2)"));
		// Two "Red" texts exist (header summary + pill); press the pill (last).
		const reds = screen.getAllByText("Red");
		await fireEvent.press(reds[reds.length - 1]);
		expect(onSelectionChange).toHaveBeenCalledWith(["Blue"]);
	});

	it("filters options by the search query", async () => {
		await render(
			<CollapsibleMultiSelectSection
				title="Color"
				options={OPTIONS}
				selectedValues={[]}
				onSelectionChange={jest.fn()}
			/>,
		);
		await fireEvent.press(screen.getByText("Color"));
		await fireEvent.changeText(
			screen.getByPlaceholderText("Search color..."),
			"re",
		);
		// "Red" and "Green" match "re"; "Blue" and "Pink" do not.
		expect(screen.getByText("Red")).toBeOnTheScreen();
		expect(screen.getByText("Green")).toBeOnTheScreen();
		expect(screen.queryByText("Blue")).toBeNull();
		expect(screen.queryByText("Pink")).toBeNull();
	});

	it("shows a no-results message when the search matches nothing", async () => {
		await render(
			<CollapsibleMultiSelectSection
				title="Color"
				options={OPTIONS}
				selectedValues={[]}
				onSelectionChange={jest.fn()}
			/>,
		);
		await fireEvent.press(screen.getByText("Color"));
		await fireEvent.changeText(
			screen.getByPlaceholderText("Search color..."),
			"zzz",
		);
		expect(screen.getByText('No results found for "zzz"')).toBeOnTheScreen();
	});

	it("clears the search query via the clear button", async () => {
		await render(
			<CollapsibleMultiSelectSection
				title="Color"
				options={OPTIONS}
				selectedValues={[]}
				onSelectionChange={jest.fn()}
			/>,
		);
		await fireEvent.press(screen.getByText("Color"));
		const input = screen.getByPlaceholderText("Search color...");
		await fireEvent.changeText(input, "zzz");
		expect(screen.getByText('No results found for "zzz"')).toBeOnTheScreen();
		// The "close-circle" glyph only renders while the query is non-empty.
		await fireEvent.press(screen.getByText("close-circle"));
		// After clearing, options return and the no-results message is gone.
		expect(screen.getByText("Blue")).toBeOnTheScreen();
		expect(screen.queryByText('No results found for "zzz"')).toBeNull();
	});

	it("clears the search query when re-expanding after a collapse", async () => {
		await render(
			<CollapsibleMultiSelectSection
				title="Color"
				options={OPTIONS}
				selectedValues={[]}
				onSelectionChange={jest.fn()}
			/>,
		);
		const header = screen.getByText("Color");
		await fireEvent.press(header);
		await fireEvent.changeText(
			screen.getByPlaceholderText("Search color..."),
			"re",
		);
		await fireEvent.press(header); // collapse
		await fireEvent.press(header); // re-expand resets searchQuery to ""
		// All options visible again because the query was cleared on expand.
		expect(screen.getByText("Pink")).toBeOnTheScreen();
	});

	it("renders nothing-special with empty options when expanded", async () => {
		await render(
			<CollapsibleMultiSelectSection
				title="Color"
				options={[]}
				selectedValues={[]}
				onSelectionChange={jest.fn()}
			/>,
		);
		await fireEvent.press(screen.getByText("Color"));
		expect(screen.getByPlaceholderText("Search color...")).toBeOnTheScreen();
	});
});
