/** Hook for reading the active theme from the ThemeProvider context. */

import { useContext } from "react";
import { ThemeContext } from "@/components/ThemeProvider";

/**
 * Access the current theme (colors and scheme) from {@link ThemeContext}.
 * Throws when used outside a `ThemeProvider`.
 */
export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
