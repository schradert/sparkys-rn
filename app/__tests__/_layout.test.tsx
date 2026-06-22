import { act, render, screen } from "@testing-library/react-native";
import { AppState } from "react-native";
import RootLayout from "@/app/_layout";
import { logger } from "@/services/logger";

// --- Mock surface -----------------------------------------------------------
// The navigation-bar side effect is the screen's main behavior; mock it so each
// call is observable and its resolution/rejection is controllable.
const mockSetVisibilityAsync = jest.fn<Promise<void>, [string]>();
jest.mock("expo-navigation-bar", () => ({
	setVisibilityAsync: (...args: [string]) => mockSetVisibilityAsync(...args),
}));

// StatusBar renders its chosen `style` as text so the theme branch is queryable.
jest.mock("expo-status-bar", () => {
	const { Text } = require("react-native") as typeof import("react-native");
	return {
		StatusBar: ({ style }: { style: string }) => <Text>{`bar:${style}`}</Text>,
	};
});

// `Stack` / `Stack.Screen` configure native navigation (no visible output); a
// passthrough keeps the tree renderable.
jest.mock("expo-router", () => {
	const ReactActual = require("react") as typeof import("react");
	const Stack = ({ children }: { children?: React.ReactNode }) =>
		ReactActual.createElement(ReactActual.Fragment, null, children);
	Stack.Screen = () => null;
	return { Stack };
});

// The real SafeAreaProvider defers rendering its children until it has measured
// insets, which never happens in the test renderer; its shipped jest mock
// renders children synchronously.
jest.mock(
	"react-native-safe-area-context",
	() => require("react-native-safe-area-context/jest/mock").default,
);

// Child providers/boundaries just render their children in this unit test.
jest.mock("@/components/LogErrorBoundary", () => ({
	LogErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/ThemeProvider", () => ({
	ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// `useTheme` drives the StatusBar style and background color.
let mockTheme: "light" | "dark" = "light";
jest.mock("@/hooks/useTheme", () => ({
	useTheme: () => ({ theme: mockTheme }),
}));

// Capture the AppState handler so app-state transitions can be driven, and
// expose a removable subscription to exercise the cleanup path.
let appStateHandler: ((s: string) => void) | undefined;
const mockRemove = jest.fn();

/**
 * Drive both fake timers and the promise microtask queue forward. The theme
 * effect awaits a 10ms timer between each of its five hide attempts, so the
 * loop only advances when timer ticks and `await`s are interleaved.
 */
async function flushTimersAndMicrotasks(totalMs: number): Promise<void> {
	const step = 10;
	for (let elapsed = 0; elapsed <= totalMs; elapsed += step) {
		await act(async () => {
			jest.advanceTimersByTime(step);
			await Promise.resolve();
		});
	}
}

beforeEach(() => {
	jest.useFakeTimers();
	mockSetVisibilityAsync.mockReset().mockResolvedValue(undefined);
	mockTheme = "light";
	appStateHandler = undefined;
	mockRemove.mockReset();
	(logger.warn as jest.Mock).mockClear();
	jest
		.spyOn(AppState, "addEventListener")
		.mockImplementation((_event, handler) => {
			appStateHandler = handler as (s: string) => void;
			return { remove: mockRemove } as ReturnType<
				typeof AppState.addEventListener
			>;
		});
});

afterEach(() => {
	jest.runOnlyPendingTimers();
	jest.useRealTimers();
	jest.restoreAllMocks();
});

describe("_layout", () => {
	it("renders the navigation stack inside the providers", async () => {
		await render(<RootLayout />);
		// StatusBar's light-theme style renders as "dark".
		expect(screen.getByText("bar:dark")).toBeOnTheScreen();
	});

	it("renders the light status bar style in the dark theme", async () => {
		mockTheme = "dark";
		await render(<RootLayout />);
		expect(screen.getByText("bar:light")).toBeOnTheScreen();
	});

	it("hides the navigation bar immediately and on the timed retries", async () => {
		await render(<RootLayout />);
		// Mount runs: forceHide loop (5x) + hideWithRetry immediate (1x).
		await flushTimersAndMicrotasks(100);
		const afterMount = mockSetVisibilityAsync.mock.calls.length;
		expect(afterMount).toBeGreaterThanOrEqual(6);

		// The 100ms and 500ms retries fire two more hide attempts.
		await flushTimersAndMicrotasks(600);
		expect(mockSetVisibilityAsync.mock.calls.length).toBeGreaterThan(
			afterMount,
		);
		expect(mockSetVisibilityAsync).toHaveBeenCalledWith("hidden");
	});

	it("logs a warning when hiding the navigation bar fails", async () => {
		const error = new Error("no nav bar");
		mockSetVisibilityAsync.mockRejectedValue(error);
		await render(<RootLayout />);
		await flushTimersAndMicrotasks(600);
		expect(logger.warn).toHaveBeenCalledWith(
			"Nav",
			"Navigation bar hide failed",
			{ error },
		);
	});

	it("re-hides the navigation bar when the app becomes active", async () => {
		await render(<RootLayout />);
		await flushTimersAndMicrotasks(600);
		const before = mockSetVisibilityAsync.mock.calls.length;

		await act(async () => {
			appStateHandler?.("active");
		});
		await flushTimersAndMicrotasks(600);
		expect(mockSetVisibilityAsync.mock.calls.length).toBeGreaterThan(before);
	});

	it("ignores non-active app-state transitions", async () => {
		await render(<RootLayout />);
		await flushTimersAndMicrotasks(600);
		const before = mockSetVisibilityAsync.mock.calls.length;

		await act(async () => {
			appStateHandler?.("background");
		});
		await flushTimersAndMicrotasks(600);
		// The background transition triggers no further hide attempts.
		expect(mockSetVisibilityAsync.mock.calls.length).toBe(before);
	});

	it("removes the app-state subscription on unmount", async () => {
		const view = await render(<RootLayout />);
		await flushTimersAndMicrotasks(600);
		await act(async () => {
			view.unmount();
		});
		expect(mockRemove).toHaveBeenCalledTimes(1);
	});

	it("swallows rejections from the theme-driven force-hide loop", async () => {
		// The force-hide loop attaches `.catch(() => {})`; a rejection must not
		// surface as an unhandled error or a logger.warn.
		mockSetVisibilityAsync.mockRejectedValue(new Error("nope"));
		await render(<RootLayout />);
		await flushTimersAndMicrotasks(100);
		// forceHide's own catch is silent (only hideNavigationBar logs).
		expect(screen.getByText("bar:dark")).toBeOnTheScreen();
	});
});
