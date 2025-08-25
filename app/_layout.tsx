import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
	return (
		<SafeAreaProvider>
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="login" />
				<Stack.Screen name="inventory" />
				<Stack.Screen name="product/[id]" />
				<Stack.Screen name="metadata/[...params]" />
			</Stack>
			<StatusBar style="light" />
		</SafeAreaProvider>
	);
}
