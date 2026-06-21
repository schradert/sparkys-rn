/**
 * Top-level React error boundary. Catches render-phase errors (which the global
 * `ErrorUtils` handler does not surface usefully), logs them with the component
 * stack, flushes to disk, and shows a themed recovery screen.
 *
 * Rendered inside `ThemeProvider` + `SafeAreaProvider` (see `app/_layout.tsx`)
 * so the fallback can use the theme and safe-area insets.
 */

import { Ionicons } from "@expo/vector-icons";
import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";
import { flushLogs, logger } from "@/services/logger";

interface Props {
	children: ReactNode;
}

interface State {
	error: Error | null;
}

function ErrorFallback({
	error,
	onReset,
}: {
	error: Error;
	onReset: () => void;
}) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
		>
			<View style={styles.content}>
				<Ionicons name="warning-outline" size={56} color={colors.error} />
				<Text style={[styles.title, { color: colors.text }]}>
					Something went wrong
				</Text>
				<Text
					style={[styles.message, { color: colors.textSecondary }]}
					numberOfLines={6}
				>
					{error.message || "An unexpected error occurred."}
				</Text>
				<Text style={[styles.hint, { color: colors.textMuted }]}>
					The error was saved to this device's logs. To send them to the
					developer, tap “Try again”, then open your avatar menu (top-right) →
					Share diagnostics.
				</Text>
				<Pressable
					style={[styles.button, { backgroundColor: colors.primary }]}
					onPress={onReset}
				>
					<Ionicons name="refresh" size={20} color="#ffffff" />
					<Text style={styles.buttonText}>Try again</Text>
				</Pressable>
			</View>
		</SafeAreaView>
	);
}

export class LogErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error, info: { componentStack?: string }) {
		logger.error("react", error?.message || "Render error", {
			error,
			componentStack: info?.componentStack,
		});
		flushLogs(); // persist before any potential follow-on crash
	}

	reset = () => {
		this.setState({ error: null });
	};

	render() {
		if (this.state.error) {
			return <ErrorFallback error={this.state.error} onReset={this.reset} />;
		}
		return this.props.children;
	}
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	content: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 32,
		gap: 16,
	},
	title: {
		fontSize: 22,
		fontWeight: "bold",
		textAlign: "center",
	},
	message: {
		fontSize: 15,
		textAlign: "center",
	},
	hint: {
		fontSize: 13,
		textAlign: "center",
		lineHeight: 18,
	},
	button: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 12,
		paddingHorizontal: 24,
		borderRadius: 8,
		marginTop: 8,
	},
	buttonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "600",
	},
});
