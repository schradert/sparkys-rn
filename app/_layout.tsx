import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Keyboard, TouchableWithoutFeedback, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";

function ThemedRootLayout() {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<SafeAreaProvider>
			<TouchableWithoutFeedback onPress={Keyboard.dismiss}>
				<View style={{ flex: 1, backgroundColor: colors.cardBackground }}>
					<Stack screenOptions={{ headerShown: false }}>
						<Stack.Screen name="login" />
						<Stack.Screen name="inventory" />
						<Stack.Screen name="product/[id]" />
						<Stack.Screen name="metadata/[...params]" />
					</Stack>
					<StatusBar
						style={theme === "dark" ? "light" : "dark"}
						backgroundColor={colors.cardBackground}
					/>
				</View>
			</TouchableWithoutFeedback>
		</SafeAreaProvider>
	);
}

export default function RootLayout() {
	return (
		<ThemeProvider>
			<ThemedRootLayout />
		</ThemeProvider>
	);
}
