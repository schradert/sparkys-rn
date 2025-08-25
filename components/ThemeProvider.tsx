import {
	createContext,
	type PropsWithChildren,
	useEffect,
	useState,
} from "react";
import { useColorScheme } from "react-native";

export const ThemeContext = createContext({
	theme: "light",
	toggleTheme: () => {},
});

export function ThemeProvider({ children }: PropsWithChildren) {
	const systemColorScheme = useColorScheme();
	const [theme, setTheme] = useState(systemColorScheme || "light");

	const toggleTheme = () => {
		setTheme(theme === "light" ? "dark" : "light");
	};

	// Update theme when system theme changes
	useEffect(() => {
		setTheme(systemColorScheme || "light");
	}, [systemColorScheme]);

	return (
		<ThemeContext.Provider value={{ theme, toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}
