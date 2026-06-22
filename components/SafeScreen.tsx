import type React from "react";
import { type StyleProp, StyleSheet, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface SafeScreenProps {
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
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
