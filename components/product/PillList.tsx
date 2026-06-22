import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface PillListProps {
	title: string;
	icon: IoniconName;
	iconSize: number;
	values: string[];
}

/**
 * Read-only labelled pill list shared by the product screens' Occasions and
 * Distributors sections. The caller decides whether to render it (both screens
 * only show the section when there is at least one value).
 */
export default function PillList({
	title,
	icon,
	iconSize,
	values,
}: PillListProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<View style={styles.section}>
			<Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
			<View style={styles.pillsContainer}>
				{values.map((value, index) => (
					<View
						// biome-ignore lint/suspicious/noArrayIndexKey: values are not guaranteed unique within the list, so a value+index composite is used; the list is static display only
						key={`${value}-${index}`}
						style={[
							styles.pill,
							{ backgroundColor: colors.surface, borderColor: colors.border },
						]}
					>
						<Ionicons name={icon} size={iconSize} color={colors.primary} />
						<Text style={[styles.pillText, { color: colors.primary }]}>
							{value}
						</Text>
					</View>
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
	pillsContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	pill: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f8f9fa",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: "#dee2e6",
		gap: 6,
	},
	pillText: {
		fontSize: 14,
		fontWeight: "500",
		color: "#007bff",
	},
});
