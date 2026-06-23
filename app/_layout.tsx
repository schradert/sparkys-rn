/** Root route layout: app-wide providers, the expo-router stack, and chrome. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect } from "react";
import {
	AppState,
	Keyboard,
	TouchableWithoutFeedback,
	View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LogErrorBoundary } from "@/components/LogErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";
import { logger } from "@/services/logger";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: 2, staleTime: 30_000, refetchOnWindowFocus: false },
	},
});

/**
 * The themed shell rendered inside the providers: keeps the Android navigation
 * bar hidden across app-state and theme changes and hosts the router stack.
 */
function ThemedRootLayout() {
	const { theme } = useTheme();
	const colors = Colors[theme];

	const hideNavigationBar = useCallback(async () => {
		try {
			// SDK 56 enforces edge-to-edge, so `setBehaviorAsync` is gone; hiding
			// the bar already gives the swipe-to-reveal ("overlay-swipe") behavior.
			await NavigationBar.setVisibilityAsync("hidden");
		} catch (error) {
			logger.warn("Nav", "Navigation bar hide failed", { error });
		}
	}, []);

	const hideWithRetry = useCallback(async () => {
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
	}, [hideNavigationBar]);

	useEffect(() => {
		hideWithRetry();

		// Re-hide navigation bar when app becomes active
		const handleAppStateChange = (nextAppState: string) => {
			if (nextAppState === "active") {
				hideWithRetry();
			}
		};

		const subscription = AppState.addEventListener(
			"change",
			handleAppStateChange,
		);

		return () => subscription?.remove();
	}, [hideWithRetry]);

	// Hide navigation bar immediately when theme changes
	useEffect(() => {
		const forceHide = async () => {
			// Multiple rapid attempts to ensure it stays hidden
			for (let i = 0; i < 5; i++) {
				NavigationBar.setVisibilityAsync("hidden").catch(() => {});
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
		};
		forceHide();
	}, [theme]);

	return (
		<SafeAreaProvider>
			<TouchableWithoutFeedback onPress={Keyboard.dismiss}>
				<View style={{ flex: 1, backgroundColor: colors.cardBackground }}>
					<LogErrorBoundary>
						<Stack screenOptions={{ headerShown: false }}>
							<Stack.Screen name="login" />
							<Stack.Screen name="inventory" />
							<Stack.Screen name="metadata/[...params]" />
							<Stack.Screen name="diagnostics" />
						</Stack>
					</LogErrorBoundary>
					<StatusBar style={theme === "dark" ? "light" : "dark"} />
				</View>
			</TouchableWithoutFeedback>
		</SafeAreaProvider>
	);
}

/** The app root — wraps every route in the query client and theme providers. */
export default function RootLayout() {
	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider>
				<ThemedRootLayout />
			</ThemeProvider>
		</QueryClientProvider>
	);
}
