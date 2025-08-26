import { Pressable, StyleSheet, Text } from "react-native";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";

interface PillCheckboxProps {
	label: string;
	selected: boolean;
	onPress: () => void;
}

export default function PillCheckbox({
	label,
	selected,
	onPress,
}: PillCheckboxProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<Pressable
			style={[
				styles.pill,
				{
					backgroundColor: selected ? colors.primary : colors.cardBackground,
					borderColor: selected ? colors.primary : colors.border,
				},
			]}
			onPress={onPress}
		>
			<Text
				style={[
					styles.pillText,
					{
						color: selected ? "white" : colors.textSecondary,
					},
				]}
			>
				{label}
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	pill: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: "#dee2e6",
		backgroundColor: "white",
		margin: 4,
	},
	pillText: {
		color: "#495057",
		fontSize: 14,
		fontWeight: "500",
	},
});
