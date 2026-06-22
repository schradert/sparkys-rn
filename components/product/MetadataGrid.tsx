import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";
import type { MetadataItem } from "./metadataMaps";

interface MetadataGridProps {
	items: MetadataItem[];
}

/**
 * The read-only "Product Details" grid shared by both product screens. Each
 * item is a clickable row that navigates to the field's metadata-browse route;
 * because every item carries a route by construction, there is no non-pressable
 * fallback to guard.
 */
export default function MetadataGrid({ items }: MetadataGridProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<View style={styles.section}>
			<Text style={[styles.sectionTitle, { color: colors.text }]}>
				Product Details
			</Text>
			<View style={styles.metadataGrid}>
				{items.map((item) => (
					<Pressable
						key={item.field}
						style={[styles.metadataItem, { backgroundColor: colors.surface }]}
						onPress={() => router.push(item.route)}
					>
						<Ionicons name={item.icon} size={20} color={colors.primary} />
						<View style={styles.metadataContent}>
							<Text
								style={[styles.metadataLabel, { color: colors.textSecondary }]}
							>
								{item.label}
							</Text>
							<Text style={[styles.metadataValue, { color: colors.primary }]}>
								{item.value}
							</Text>
						</View>
						<Ionicons name="chevron-forward" size={16} color={colors.primary} />
					</Pressable>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	section: {
		marginBottom: 20,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#1a1a1a",
		marginBottom: 12,
	},
	metadataGrid: {
		gap: 12,
	},
	metadataItem: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f8f9fa",
		padding: 16,
		borderRadius: 8,
		gap: 12,
	},
	metadataContent: {
		flex: 1,
	},
	metadataLabel: {
		fontSize: 12,
		color: "#6c757d",
		textTransform: "uppercase",
		fontWeight: "500",
		marginBottom: 2,
	},
	metadataValue: {
		fontSize: 16,
		color: "#1a1a1a",
		fontWeight: "500",
	},
});
