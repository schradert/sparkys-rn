import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import SafeScreen from "@/components/SafeScreen";

describe("SafeScreen", () => {
	it("renders its children", async () => {
		await render(
			<SafeScreen>
				<Text>Hello</Text>
			</SafeScreen>,
		);
		expect(screen.getByText("Hello")).toBeOnTheScreen();
	});

	it("applies the default background color", async () => {
		await render(
			<SafeScreen>
				<Text>Body</Text>
			</SafeScreen>,
		);
		expect(screen.getByText("Body")).toBeOnTheScreen();
	});

	it("applies a custom background color and an extra style prop", async () => {
		await render(
			<SafeScreen backgroundColor="#ff0000" style={{ padding: 10 }}>
				<Text>Body</Text>
			</SafeScreen>,
		);
		expect(screen.getByText("Body")).toBeOnTheScreen();
	});
});
