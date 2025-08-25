import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
	return (
		<>
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="login" />
				<Stack.Screen name="(tabs)" />
				<Stack.Screen name="product/[id]" />
				<Stack.Screen name="metadata/[...params]" />
			</Stack>
			<StatusBar style="light" />
		</>
	);
}
