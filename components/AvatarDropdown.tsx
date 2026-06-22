import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { logger } from "@/services/logger";

export default function AvatarDropdown() {
	const { user, signOut } = useAuth();
	const { theme, toggleTheme } = useTheme();
	const [isDropdownVisible, setIsDropdownVisible] = useState(false);
	const colors = Colors[theme];

	const handleSignOut = async () => {
		logger.debug("Auth", "Sign out clicked");
		setIsDropdownVisible(false);
		try {
			await signOut();
			logger.info("Auth", "Sign out completed");
			router.replace("/login");
		} catch (error) {
			logger.debug("Auth", "Sign out error", { error });
		}
	};

	const handleThemeToggle = () => {
		toggleTheme();
		setIsDropdownVisible(false);
	};

	const handleActivityPress = () => {
		setIsDropdownVisible(false);
		router.push("/activity");
	};

	const handleDiagnosticsPress = () => {
		setIsDropdownVisible(false);
		router.push("/diagnostics");
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
					<View
						style={[
							styles.defaultAvatar,
							{ backgroundColor: colors.surface, borderColor: colors.border },
						]}
					>
						<Ionicons name="person" size={24} color={colors.primary} />
					</View>
				)}
			</Pressable>

			{isDropdownVisible && (
				<View
					style={[styles.dropdown, { backgroundColor: colors.cardBackground }]}
				>
					<View
						style={[
							styles.triangle,
							{ borderBottomColor: colors.cardBackground },
						]}
					/>
					<Pressable style={styles.dropdownItem} onPress={handleThemeToggle}>
						<Ionicons
							name={theme === "dark" ? "sunny-outline" : "moon-outline"}
							size={20}
							color={colors.icon}
						/>
						<Text
							style={[styles.themeToggleText, { color: colors.textSecondary }]}
						>
							{theme === "dark" ? "Light" : "Dark"}
						</Text>
					</Pressable>
					<View
						style={[styles.separator, { backgroundColor: colors.separator }]}
					/>
					<Pressable style={styles.dropdownItem} onPress={handleActivityPress}>
						<Ionicons name="time-outline" size={20} color={colors.icon} />
						<Text
							style={[styles.themeToggleText, { color: colors.textSecondary }]}
						>
							Activity
						</Text>
					</Pressable>
					<View
						style={[styles.separator, { backgroundColor: colors.separator }]}
					/>
					<Pressable
						style={styles.dropdownItem}
						onPress={handleDiagnosticsPress}
					>
						<Ionicons name="bug-outline" size={20} color={colors.icon} />
						<Text
							style={[styles.themeToggleText, { color: colors.textSecondary }]}
						>
							Share diagnostics
						</Text>
					</Pressable>
					<View
						style={[styles.separator, { backgroundColor: colors.separator }]}
					/>
					<Pressable style={styles.dropdownItem} onPress={handleSignOut}>
						<Ionicons name="log-out-outline" size={20} color={colors.error} />
						<Text style={[styles.dropdownText, { color: colors.error }]}>
							Sign Out
						</Text>
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
	themeToggleText: {
		fontSize: 16,
		color: "#495057",
		fontWeight: "500",
	},
	separator: {
		height: 1,
		backgroundColor: "#e1e5e9",
		marginVertical: 4,
	},
});
