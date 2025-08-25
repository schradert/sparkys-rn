import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function RootLayout() {
	return (
		<SafeAreaProvider>
			<ThemeProvider>
				<Stack screenOptions={{ headerShown: false }}>
					<Stack.Screen name="login" />
					<Stack.Screen name="inventory" />
					<Stack.Screen name="product/[id]" />
					<Stack.Screen name="metadata/[...params]" />
				</Stack>
				<StatusBar style="auto" />
			</ThemeProvider>
		</SafeAreaProvider>
	);
}
