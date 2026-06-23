/** Route fallback — the 404 screen for unmatched paths. */
import { Link, Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

/** The not-found screen shown for unmatched routes, with a link back to `/`. */
export default function NotFoundScreen() {
	return (
		<>
			<Stack.Screen options={{ title: "Oops! Not Found" }} />
			<View style={styles.container}>
				<Link href="/" style={styles.button}>
					Go back to Home screen!
				</Link>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#25292e",
		justifyContent: "center",
		alignItems: "center",
	},

	button: {
		fontSize: 20,
		textDecorationLine: "underline",
		color: "#fff",
	},
});
