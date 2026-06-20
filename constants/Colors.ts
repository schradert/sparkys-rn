/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 */

export const Colors = {
	light: {
		// Primary colors
		primary: "#007bff",
		background: "#ffffff",
		surface: "#f8f9fa",

		// Text colors
		text: "#1a1a1a",
		textSecondary: "#495057",
		textMuted: "#6c757d",

		// Border and separator colors
		border: "#dee2e6",
		borderLight: "#e1e5e9",
		separator: "#f1f3f4",

		// Status colors
		success: "#28a745",
		error: "#dc3545",
		warning: "#ffc107",

		// Card and component colors
		cardBackground: "#ffffff",
		metadataBackground: "#f8f9fa",
		selectedBackground: "#e3f2fd",

		// Icons
		icon: "#666666",
		iconMuted: "#9ca3af",
	},
	dark: {
		// Primary colors
		primary: "#007bff",
		background: "#000000",
		surface: "#333333",

		// Text colors (inverted from light)
		text: "#ffffff",
		textSecondary: "#e5e5e5",
		textMuted: "#9ca3af",

		// Border and separator colors (dark variants)
		border: "#444444",
		borderLight: "#555555",
		separator: "#2a2a2a",

		// Status colors (same as light - they work well in both)
		success: "#28a745",
		error: "#dc3545",
		warning: "#ffc107",

		// Card and component colors (dark variants)
		cardBackground: "#1a1a1a",
		metadataBackground: "#333333",
		selectedBackground: "#1e3a5f",

		// Icons (lighter in dark mode)
		icon: "#cccccc",
		iconMuted: "#888888",
	},
};

/** The available color schemes: "light" | "dark". */
export type ColorScheme = keyof typeof Colors;

/** A single scheme's palette (the keys shared by light and dark). */
export type ColorKey = keyof typeof Colors.light;

/** The resolved palette for one scheme (e.g. `Colors["light"]`). */
export type ThemeColors = (typeof Colors)[ColorScheme];

/**
 * Coerce any platform color-scheme value to a known scheme. React Native's
 * `useColorScheme()` can return `null`, `undefined`, or `"unspecified"`; we
 * treat everything that isn't an explicit `"dark"` as light.
 */
export function toColorScheme(value: string | null | undefined): ColorScheme {
	return value === "dark" ? "dark" : "light";
}
