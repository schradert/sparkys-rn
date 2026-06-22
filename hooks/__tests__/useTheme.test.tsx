import { renderHook } from "@testing-library/react-native";
import type { ComponentType, PropsWithChildren } from "react";
import { ThemeContext } from "@/components/ThemeProvider";
import { useTheme } from "@/hooks/useTheme";

describe("useTheme", () => {
	it("returns the surrounding ThemeContext value", async () => {
		const toggleTheme = jest.fn();
		const wrapper = ({ children }: PropsWithChildren) => (
			<ThemeContext.Provider value={{ theme: "dark", toggleTheme }}>
				{children}
			</ThemeContext.Provider>
		);

		const { result } = await renderHook(() => useTheme(), { wrapper });

		expect(result.current.theme).toBe("dark");
		expect(result.current.toggleTheme).toBe(toggleTheme);
	});

	it("throws when used outside a ThemeProvider", async () => {
		// The context default value is truthy, so force `null` to hit the guard.
		// React surfaces a render-time throw as a rejected `renderHook` promise.
		const wrapper = ({ children }: PropsWithChildren) => (
			<ThemeContext.Provider
				value={null as unknown as React.ContextType<typeof ThemeContext>}
			>
				{children}
			</ThemeContext.Provider>
		);

		await expect(
			renderHook(() => useTheme(), {
				wrapper: wrapper as ComponentType,
			}),
		).rejects.toThrow("useTheme must be used within a ThemeProvider");
	});
});
