import { router } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
	const { signIn, isLoading } = useAuth();
	const [isSigningIn, setIsSigningIn] = useState(false);

	const handleSignIn = async () => {
		setIsSigningIn(true);
		const result = await signIn();
		setIsSigningIn(false);

		if (result.success) {
			router.replace("/inventory");
		} else {
			Alert.alert("Sign In Failed", result.error || "Something went wrong");
		}
	};

	if (isLoading) {
		return (
			<View style={[styles.container, styles.centered]}>
				<ActivityIndicator size="large" color="#007bff" />
				<Text style={styles.loadingText}>Loading...</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<View style={styles.content}>
				<View style={styles.header}>
					<Text style={styles.title}>Sparky's Inventory</Text>
					<Text style={styles.subtitle}>Sign in to access your inventory</Text>
				</View>

				<View style={styles.buttonContainer}>
					<Pressable
						style={[styles.signInButton, isSigningIn && styles.buttonDisabled]}
						onPress={handleSignIn}
						disabled={isSigningIn}
					>
						{isSigningIn ? (
							<ActivityIndicator size="small" color="white" />
						) : (
							<Text style={styles.buttonText}>Sign in with Google</Text>
						)}
					</Pressable>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingHorizontal: 20,
		backgroundColor: "#f8f9fa",
	},
	centered: {
		justifyContent: "center",
		alignItems: "center",
	},
	content: {
		flex: 1,
		justifyContent: "center",
		maxWidth: 400,
		alignSelf: "center",
		width: "100%",
	},
	header: {
		alignItems: "center",
		marginBottom: 60,
	},
	title: {
		fontSize: 32,
		fontWeight: "bold",
		marginBottom: 12,
		textAlign: "center",
		color: "#1a1a1a",
	},
	subtitle: {
		fontSize: 16,
		textAlign: "center",
		lineHeight: 24,
		color: "#6c757d",
	},
	buttonContainer: {
		gap: 16,
	},
	signInButton: {
		height: 56,
		borderRadius: 12,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#007bff",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	buttonDisabled: {
		opacity: 0.7,
	},
	buttonText: {
		fontSize: 18,
		fontWeight: "600",
		color: "white",
	},
	loadingText: {
		fontSize: 16,
		marginTop: 16,
		color: "#1a1a1a",
	},
});
