import { act, renderHook, waitFor } from "@testing-library/react-native";

// `react-native`'s `useColorScheme` is just a getter that returns this
// submodule's default export. Mocking the submodule overrides the single
// dependency of both the native re-export and the web hydration variant while
// leaving the rest of react-native (and the jest-expo preset) intact.
const mockUseRNColorScheme = jest.fn<string | null | undefined, []>();
jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
	__esModule: true,
	default: () => mockUseRNColorScheme(),
}));

// `require` (not dynamic `import`) — the jest VM here isn't running with
// --experimental-vm-modules, so ESM dynamic import is unavailable.
const { useColorScheme: useNativeColorScheme } =
	require("@/hooks/useColorScheme") as typeof import("@/hooks/useColorScheme");
const { useColorScheme: useWebColorScheme } =
	require("@/hooks/useColorScheme.web") as typeof import("@/hooks/useColorScheme.web");

describe("useColorScheme (native re-export)", () => {
	beforeEach(() => {
		mockUseRNColorScheme.mockReset();
	});

	it("re-exports react-native's useColorScheme", async () => {
		mockUseRNColorScheme.mockReturnValue("dark");

		const { result } = await renderHook(() => useNativeColorScheme());

		expect(result.current).toBe("dark");
	});
});

describe("useColorScheme.web", () => {
	beforeEach(() => {
		mockUseRNColorScheme.mockReset();
	});

	it("returns the live system scheme once hydrated", async () => {
		mockUseRNColorScheme.mockReturnValue("dark");

		const { result } = await renderHook(() => useWebColorScheme());

		// The hydration effect has flipped `hasHydrated` to true, so the live
		// system scheme ("dark") is now returned.
		await waitFor(() => {
			expect(result.current).toBe("dark");
		});
	});

	it("reflects a light system scheme once hydrated", async () => {
		mockUseRNColorScheme.mockReturnValue("light");

		let result: { current: ReturnType<typeof useWebColorScheme> } | undefined;
		await act(async () => {
			({ result } = await renderHook(() => useWebColorScheme()));
		});

		await waitFor(() => {
			// biome-ignore lint/style/noNonNullAssertion: assigned within act above
			expect(result!.current).toBe("light");
		});
	});

	it("returns the pre-hydration 'light' fallback before the effect runs", async () => {
		mockUseRNColorScheme.mockReturnValue("dark");

		// Suppress the one-shot hydration effect so `hasHydrated` stays false and
		// the function falls through to its "light" default branch.
		const react = require("react") as typeof import("react");
		const effectSpy = jest
			.spyOn(react, "useEffect")
			.mockImplementation(() => undefined);
		try {
			const { result } = await renderHook(() => useWebColorScheme());
			expect(result.current).toBe("light");
		} finally {
			effectSpy.mockRestore();
		}
	});
});
