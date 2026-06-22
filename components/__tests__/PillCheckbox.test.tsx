import { fireEvent, render, screen } from "@testing-library/react-native";
import PillCheckbox from "@/components/PillCheckbox";

// `useTheme` requires a ThemeProvider at runtime; mock it so the component can
// resolve a palette in isolation. See CONTRIBUTING.md for the async RNTL flow.
jest.mock("@/hooks/useTheme", () => ({
	useTheme: jest.fn(() => ({ theme: "light", toggleTheme: jest.fn() })),
}));

describe("PillCheckbox", () => {
	it("renders the plain label when not archived", async () => {
		await render(
			<PillCheckbox label="Fruit" selected={false} onPress={jest.fn()} />,
		);
		expect(screen.getByText("Fruit")).toBeOnTheScreen();
	});

	it("appends an archived suffix when archived", async () => {
		await render(
			<PillCheckbox
				label="Fruit"
				selected={false}
				onPress={jest.fn()}
				archived
			/>,
		);
		expect(screen.getByText("Fruit (archived)")).toBeOnTheScreen();
		expect(screen.queryByText("Fruit")).not.toBeOnTheScreen();
	});

	it("styles the label as selected (white, no strike-through) when selected", async () => {
		await render(
			<PillCheckbox label="Fruit" selected={true} onPress={jest.fn()} />,
		);
		const text = screen.getByText("Fruit");
		expect(text).toHaveStyle({ color: "white", textDecorationLine: "none" });
	});

	it("styles the label as unselected and struck-through when archived", async () => {
		await render(
			<PillCheckbox
				label="Fruit"
				selected={false}
				onPress={jest.fn()}
				archived
			/>,
		);
		const text = screen.getByText("Fruit (archived)");
		expect(text).toHaveStyle({
			color: "#495057",
			textDecorationLine: "line-through",
		});
	});

	it("invokes onPress when pressed", async () => {
		const onPress = jest.fn();
		await render(
			<PillCheckbox label="Fruit" selected={false} onPress={onPress} />,
		);
		await fireEvent.press(screen.getByText("Fruit"));
		expect(onPress).toHaveBeenCalledTimes(1);
	});
});
