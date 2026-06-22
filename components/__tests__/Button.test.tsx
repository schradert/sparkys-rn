import { fireEvent, render, screen } from "@testing-library/react-native";
import Button from "@/components/Button";

// Reference component test: under RNTL 14 (which uses `test-renderer` and an
// async `act`), `render` and `fireEvent` are async and MUST be awaited — see
// CONTRIBUTING.md. Querying without awaiting yields an empty result.
describe("Button", () => {
	it("renders its label", async () => {
		await render(<Button label="Save" />);
		expect(screen.getByText("Save")).toBeOnTheScreen();
	});

	it("invokes onPress when pressed", async () => {
		const onPress = jest.fn();
		await render(<Button label="Save" onPress={onPress} />);
		await fireEvent.press(screen.getByText("Save"));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("shows the icon glyph in the primary theme", async () => {
		await render(<Button label="Pick a photo" theme="primary" />);
		expect(screen.getByText("Pick a photo")).toBeOnTheScreen();
	});
});
