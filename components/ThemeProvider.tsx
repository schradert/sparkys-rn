import {
	createContext,
	type PropsWithChildren,
	useEffect,
	useState,
} from "react";
import { useColorScheme } from "react-native";
import { type ColorScheme, toColorScheme } from "@/constants/Colors";

interface ThemeContextValue {
	theme: ColorScheme;
	toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
	theme: "light",
	toggleTheme: () => {},
});

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
		setTheme(toColorScheme(systemColorScheme));
	}, [systemColorScheme]);

	return (
		<ThemeContext.Provider value={{ theme, toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}
