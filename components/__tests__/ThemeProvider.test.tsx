import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useContext } from "react";
import { Text } from "react-native";
import { ThemeContext, ThemeProvider } from "@/components/ThemeProvider";

// `react-native`'s `useColorScheme` reads this submodule's default export, so
// mocking it here drives the provider's system-scheme branch without disturbing
// the rest of react-native or the jest-expo preset.
const mockUseRNColorScheme = jest.fn<string | null | undefined, []>();
jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
	__esModule: true,
	default: () => mockUseRNColorScheme(),
}));

// A consumer that surfaces the context value and exposes a press to toggle it.
function Consumer() {
	const { theme, toggleTheme } = useContext(ThemeContext);
	return (
		<Text testID="theme" onPress={toggleTheme}>
			{theme}
		</Text>
	);
}

beforeEach(() => {
	mockUseRNColorScheme.mockReset();
});

describe("ThemeProvider", () => {
	it("seeds the theme from a light system scheme", async () => {
		mockUseRNColorScheme.mockReturnValue("light");
		await render(
			<ThemeProvider>
				<Consumer />
			</ThemeProvider>,
		);
		expect(screen.getByTestId("theme")).toHaveTextContent("light");
	});

	it("seeds the theme from a dark system scheme", async () => {
		mockUseRNColorScheme.mockReturnValue("dark");
		await render(
			<ThemeProvider>
				<Consumer />
			</ThemeProvider>,
		);
		expect(screen.getByTestId("theme")).toHaveTextContent("dark");
	});

	it("coerces an unknown system scheme to light", async () => {
		mockUseRNColorScheme.mockReturnValue(null);
		await render(
			<ThemeProvider>
				<Consumer />
			</ThemeProvider>,
		);
		expect(screen.getByTestId("theme")).toHaveTextContent("light");
	});

	it("toggleTheme flips light -> dark and back", async () => {
		mockUseRNColorScheme.mockReturnValue("light");
		await render(
			<ThemeProvider>
				<Consumer />
			</ThemeProvider>,
		);
		const node = screen.getByTestId("theme");
		expect(node).toHaveTextContent("light");

		await fireEvent.press(node);
		expect(node).toHaveTextContent("dark");

		await fireEvent.press(node);
		expect(node).toHaveTextContent("light");
	});

	it("re-syncs the theme when the system scheme changes", async () => {
		mockUseRNColorScheme.mockReturnValue("light");
		const { rerender } = await render(
			<ThemeProvider>
				<Consumer />
			</ThemeProvider>,
		);
		expect(screen.getByTestId("theme")).toHaveTextContent("light");

		// The OS flips to dark; the sync effect re-runs on the changed dependency.
		mockUseRNColorScheme.mockReturnValue("dark");
		await act(async () => {
			rerender(
				<ThemeProvider>
					<Consumer />
				</ThemeProvider>,
			);
		});
		expect(screen.getByTestId("theme")).toHaveTextContent("dark");
	});

	it("falls back to the default context value outside a provider", async () => {
		// The default `toggleTheme` is a no-op; pressing it must not throw.
		await render(<Consumer />);
		const node = screen.getByTestId("theme");
		expect(node).toHaveTextContent("light");
		await fireEvent.press(node);
		expect(node).toHaveTextContent("light");
	});
});
