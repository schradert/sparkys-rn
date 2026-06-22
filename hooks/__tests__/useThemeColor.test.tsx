import { renderHook } from "@testing-library/react-native";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useThemeColor } from "@/hooks/useThemeColor";

jest.mock("@/hooks/useColorScheme", () => ({ useColorScheme: jest.fn() }));
const mockUseColorScheme = jest.mocked(useColorScheme);

describe("useThemeColor", () => {
	it("returns the light override when set on the light scheme", async () => {
		mockUseColorScheme.mockReturnValue("light");
		const { result } = await renderHook(() =>
			useThemeColor({ light: "#abc123" }, "text"),
		);
		expect(result.current).toBe("#abc123");
	});

	it("returns the dark override when set on the dark scheme", async () => {
		mockUseColorScheme.mockReturnValue("dark");
		const { result } = await renderHook(() =>
			useThemeColor({ dark: "#321cba" }, "text"),
		);
		expect(result.current).toBe("#321cba");
	});

	it("falls back to the palette color when no override is given", async () => {
		mockUseColorScheme.mockReturnValue("light");
		const { result } = await renderHook(() => useThemeColor({}, "text"));
		expect(result.current).toBe(Colors.light.text);
	});
});
