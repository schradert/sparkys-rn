import { fireEvent, render, screen } from "@testing-library/react-native";
import CollapsibleRadioSection from "@/components/CollapsibleRadioSection";

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

const OPTIONS = ["Round", "Heart", "Star"] as const;

describe("CollapsibleRadioSection", () => {
	it("renders the title collapsed with no selection summary", async () => {
		await render(
			<CollapsibleRadioSection
				title="Shape"
				options={OPTIONS}
				selectedValue=""
				onSelectionChange={jest.fn()}
			/>,
		);
		expect(screen.getByText("Shape")).toBeOnTheScreen();
		expect(screen.queryByText("Heart")).toBeNull();
	});

	it("shows the selected value as a summary pill when collapsed", async () => {
		await render(
			<CollapsibleRadioSection
				title="Shape"
				options={OPTIONS}
				selectedValue="Round"
				onSelectionChange={jest.fn()}
			/>,
		);
		expect(screen.getByText("Round")).toBeOnTheScreen();
	});

	it("expands to reveal the options and search field on header press", async () => {
		await render(
			<CollapsibleRadioSection
				title="Shape"
				options={OPTIONS}
				selectedValue=""
				onSelectionChange={jest.fn()}
			/>,
		);
		await fireEvent.press(screen.getByText("Shape"));
		expect(screen.getByPlaceholderText("Search shape...")).toBeOnTheScreen();
		for (const option of OPTIONS) {
			expect(screen.getByText(option)).toBeOnTheScreen();
		}
	});

	it("collapses again on a second header press", async () => {
		await render(
			<CollapsibleRadioSection
				title="Shape"
				options={OPTIONS}
				selectedValue=""
				onSelectionChange={jest.fn()}
			/>,
		);
		const header = screen.getByText("Shape");
		await fireEvent.press(header);
		expect(screen.getByText("Heart")).toBeOnTheScreen();
		await fireEvent.press(header);
		expect(screen.queryByText("Heart")).toBeNull();
	});

	it("selects a value and collapses when a pill is pressed", async () => {
		const onSelectionChange = jest.fn();
		await render(
			<CollapsibleRadioSection
				title="Shape"
				options={OPTIONS}
				selectedValue=""
				onSelectionChange={onSelectionChange}
			/>,
		);
		await fireEvent.press(screen.getByText("Shape"));
		await fireEvent.press(screen.getByText("Heart"));
		expect(onSelectionChange).toHaveBeenCalledWith("Heart");
		// Pressing a pill collapses the section, hiding the search field.
		expect(screen.queryByPlaceholderText("Search shape...")).toBeNull();
	});

	it("filters options by the search query", async () => {
		await render(
			<CollapsibleRadioSection
				title="Shape"
				options={OPTIONS}
				selectedValue=""
				onSelectionChange={jest.fn()}
			/>,
		);
		await fireEvent.press(screen.getByText("Shape"));
		await fireEvent.changeText(
			screen.getByPlaceholderText("Search shape..."),
			"ar",
		);
		// "Heart" and "Star" match "ar"; "Round" does not.
		expect(screen.getByText("Heart")).toBeOnTheScreen();
		expect(screen.getByText("Star")).toBeOnTheScreen();
		expect(screen.queryByText("Round")).toBeNull();
	});

	it("shows a no-results message when the search matches nothing", async () => {
		await render(
			<CollapsibleRadioSection
				title="Shape"
				options={OPTIONS}
				selectedValue=""
				onSelectionChange={jest.fn()}
			/>,
		);
		await fireEvent.press(screen.getByText("Shape"));
		await fireEvent.changeText(
			screen.getByPlaceholderText("Search shape..."),
			"zzz",
		);
		expect(screen.getByText('No results found for "zzz"')).toBeOnTheScreen();
	});

	it("clears the search query via the clear button", async () => {
		await render(
			<CollapsibleRadioSection
				title="Shape"
				options={OPTIONS}
				selectedValue=""
				onSelectionChange={jest.fn()}
			/>,
		);
		await fireEvent.press(screen.getByText("Shape"));
		await fireEvent.changeText(
			screen.getByPlaceholderText("Search shape..."),
			"zzz",
		);
		expect(screen.getByText('No results found for "zzz"')).toBeOnTheScreen();
		// The "close-circle" glyph only renders while the query is non-empty.
		await fireEvent.press(screen.getByText("close-circle"));
		expect(screen.getByText("Heart")).toBeOnTheScreen();
		expect(screen.queryByText('No results found for "zzz"')).toBeNull();
	});

	it("clears the search query when re-expanding after a collapse", async () => {
		await render(
			<CollapsibleRadioSection
				title="Shape"
				options={OPTIONS}
				selectedValue=""
				onSelectionChange={jest.fn()}
			/>,
		);
		const header = screen.getByText("Shape");
		await fireEvent.press(header);
		await fireEvent.changeText(
			screen.getByPlaceholderText("Search shape..."),
			"ar",
		);
		await fireEvent.press(header); // collapse
		await fireEvent.press(header); // re-expand resets searchQuery to ""
		expect(screen.getByText("Round")).toBeOnTheScreen();
	});

	it("renders the search field with empty options when expanded", async () => {
		await render(
			<CollapsibleRadioSection
				title="Shape"
				options={[]}
				selectedValue=""
				onSelectionChange={jest.fn()}
			/>,
		);
		await fireEvent.press(screen.getByText("Shape"));
		expect(screen.getByPlaceholderText("Search shape...")).toBeOnTheScreen();
	});
});
