import { render, screen } from "@testing-library/react-native";
import NotFoundScreen from "@/app/+not-found";

// `Stack.Screen` only configures the native header (no visible output in the
// test renderer), and `Link` renders its children as text. Render both as
// lightweight passthroughs so the screen's own markup is what we assert on.
jest.mock("expo-router", () => {
	const { Text } = require("react-native") as typeof import("react-native");
	return {
		Stack: { Screen: () => null },
		Link: ({ children }: { children: React.ReactNode }) => (
			<Text>{children}</Text>
		),
	};
});

describe("+not-found", () => {
	it("renders the go-home link", async () => {
		await render(<NotFoundScreen />);
		expect(screen.getByText("Go back to Home screen!")).toBeOnTheScreen();
	});
});
