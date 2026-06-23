/** Theme context and provider tracking light/dark color scheme. */
import {
	createContext,
	type PropsWithChildren,
	useEffect,
	useState,
} from "react";
import { useColorScheme } from "react-native";
import { type ColorScheme, toColorScheme } from "@/constants/Colors";

/** The current color scheme plus a toggle, exposed via {@link ThemeContext}. */
interface ThemeContextValue {
	theme: ColorScheme;
	toggleTheme: () => void;
}

/** Context carrying the active {@link ColorScheme} and a toggle; read via `useTheme`. */
export const ThemeContext = createContext<ThemeContextValue>({
	theme: "light",
	toggleTheme: () => {},
});

/**
 * Provides theme state to the tree, seeding from the OS color scheme and
 * re-syncing when it changes; `toggleTheme` flips between light and dark.
 */
export function ThemeProvider({ children }: PropsWithChildren) {
	const systemColorScheme = useColorScheme();
	const [theme, setTheme] = useState<ColorScheme>(
		toColorScheme(systemColorScheme),
	);

	const toggleTheme = () => {
		setTheme(theme === "light" ? "dark" : "light");
	};

	// Update theme when system theme changes
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: re-sync theme to the OS color scheme when it changes
		setTheme(toColorScheme(systemColorScheme));
	}, [systemColorScheme]);

	return (
		<ThemeContext.Provider value={{ theme, toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}
