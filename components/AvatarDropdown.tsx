import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/hooks/useAuth";

export default function AvatarDropdown() {
	const { user, signOut } = useAuth();
	const [isDropdownVisible, setIsDropdownVisible] = useState(false);

	const handleSignOut = async () => {
		console.log("Sign out clicked");
		setIsDropdownVisible(false);
		try {
			await signOut();
			console.log("Sign out completed");
			router.replace("/login");
		} catch (error) {
			console.log("Sign out error:", error);
		}
	};

	return (
		<View style={styles.container}>
			<Pressable
				style={styles.avatarButton}
				onPress={() => setIsDropdownVisible(!isDropdownVisible)}
			>
				{user?.user?.photo ? (
					<Image source={{ uri: user.user.photo }} style={styles.avatar} />
				) : (
					<View style={styles.defaultAvatar}>
						<Ionicons name="person" size={24} color="#007bff" />
					</View>
				)}
			</Pressable>

			{isDropdownVisible && (
				<View style={styles.dropdown}>
					<View style={styles.triangle} />
					<Pressable style={styles.dropdownItem} onPress={handleSignOut}>
						<Ionicons name="log-out-outline" size={20} color="#dc3545" />
						<Text style={styles.dropdownText}>Sign Out</Text>
					</Pressable>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		position: "relative",
	},
	avatarButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		overflow: "hidden",
	},
	avatar: {
		width: 40,
		height: 40,
		borderRadius: 20,
	},
	defaultAvatar: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "#f8f9fa",
		justifyContent: "center",
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#dee2e6",
	},
	overlay: {
		flex: 1,
		backgroundColor: "transparent",
	},
	dropdown: {
		position: "absolute",
		top: 45,
		right: 0,
		backgroundColor: "white",
		borderRadius: 8,
		minWidth: 150,
		elevation: 8,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 8,
		zIndex: 1000,
	},
	triangle: {
		position: "absolute",
		top: -8,
		right: 12,
		width: 0,
		height: 0,
		backgroundColor: "transparent",
		borderStyle: "solid",
		borderLeftWidth: 8,
		borderRightWidth: 8,
		borderBottomWidth: 8,
		borderLeftColor: "transparent",
		borderRightColor: "transparent",
		borderBottomColor: "white",
	},
	dropdownItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 16,
		gap: 12,
	},
	dropdownText: {
		fontSize: 16,
		color: "#dc3545",
		fontWeight: "500",
	},
});
