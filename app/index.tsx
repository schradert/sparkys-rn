import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/hooks/useAuth";

export default function Index() {
	const { isLoading, isSignedIn } = useAuth();

	useEffect(() => {
		const timer = setTimeout(() => {
			if (!isLoading) {
				if (isSignedIn) {
					router.replace("/inventory");
				} else {
					router.replace("/login");
				}
			}
		}, 100);

		return () => clearTimeout(timer);
	}, [isLoading, isSignedIn]);

	return (
		<View style={styles.container}>
			<ActivityIndicator size="large" />
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#f8f9fa",
	},
});
