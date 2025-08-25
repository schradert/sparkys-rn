import type React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface SafeScreenProps {
	children: React.ReactNode;
	style?: any;
	backgroundColor?: string;
}

export default function SafeScreen({
	children,
	style,
	backgroundColor = "#25292e",
}: SafeScreenProps) {
	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor }, style]}
			edges={["top", "left", "right"]}
		>
			{children}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});
