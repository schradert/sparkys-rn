import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";

/** Full-screen loading spinner shown while a product is being looked up. */
export function ProductLoading() {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.cardBackground }]}
		>
			<ActivityIndicator size="large" color={colors.primary} />
		</SafeAreaView>
	);
}

interface ProductNotFoundProps {
	message: string;
}

/** Not-found state with a back-navigating header and an error message. */
export function ProductNotFound({ message }: ProductNotFoundProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.cardBackground }]}
		>
			<View style={styles.header}>
				<Pressable onPress={() => router.back()}>
					<Ionicons name="arrow-back" size={24} color={colors.text} />
				</Pressable>
				<Text style={[styles.headerTitle, { color: colors.text }]}>
					Product Not Found
				</Text>
			</View>
			<View style={styles.errorContainer}>
				<Text style={[styles.errorText, { color: colors.error }]}>
					{message}
				</Text>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e5e9",
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#1a1a1a",
		flex: 1,
		textAlign: "center",
	},
	errorContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 20,
	},
	errorText: {
		fontSize: 16,
		color: "#dc3545",
		textAlign: "center",
	},
});
