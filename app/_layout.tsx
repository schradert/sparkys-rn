import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import {
	AppState,
	Keyboard,
	TouchableWithoutFeedback,
	View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";

function ThemedRootLayout() {
	const { theme } = useTheme();
	const colors = Colors[theme];

	const hideNavigationBar = async () => {
		try {
			console.log("Setting navigation bar visibility to hidden");
			await NavigationBar.setVisibilityAsync("hidden");
			console.log("Navigation bar hidden successfully");

			await NavigationBar.setBehaviorAsync("overlay-swipe");
			console.log("Navigation bar behavior set successfully");
		} catch (error) {
			console.error("Error with navigation bar:", error);
		}
	};

	const hideWithRetry = async () => {
		// Immediate attempt
		await hideNavigationBar();

		// Retry after 100ms
		setTimeout(async () => {
			await hideNavigationBar();
		}, 100);

		// Retry after 500ms
		setTimeout(async () => {
			await hideNavigationBar();
		}, 500);
	};

	useEffect(() => {
		hideWithRetry();

		// Re-hide navigation bar when app becomes active
		const handleAppStateChange = (nextAppState: string) => {
			if (nextAppState === "active") {
				console.log("App became active, re-hiding navigation bar");
				hideWithRetry();
			}
		};

		const subscription = AppState.addEventListener(
			"change",
			handleAppStateChange,
		);

		return () => subscription?.remove();
	}, []);

	// Hide navigation bar immediately when theme changes
	useEffect(() => {
		const forceHide = async () => {
			// Multiple rapid attempts to ensure it stays hidden
			for (let i = 0; i < 5; i++) {
				NavigationBar.setVisibilityAsync("hidden").catch(() => {});
				NavigationBar.setBehaviorAsync("overlay-swipe").catch(() => {});
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
		};
		forceHide();
	}, [theme]);

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
