import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";
import { VIEW_OPTIONS } from "./inventoryMaps";
import type { ViewMode } from "./types";

interface ViewModeDropdownProps {
	currentView: ViewMode;
	onSelect: (viewMode: ViewMode) => void;
}

/** The view selector list shown beneath the header when the title is tapped. */
export default function ViewModeDropdown({
	currentView,
	onSelect,
}: ViewModeDropdownProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<View
			style={[
				styles.dropdown,
				{
					backgroundColor: colors.cardBackground,
					borderBottomColor: colors.borderLight,
				},
			]}
		>
			{VIEW_OPTIONS.map((option) => (
				<Pressable
					key={option.key}
					onPress={() => onSelect(option.key)}
					style={[
						styles.dropdownItem,
						{ borderBottomColor: colors.separator },
						currentView === option.key && {
							backgroundColor: colors.surface,
						},
					]}
				>
					<Text
						style={[
							styles.dropdownText,
							{ color: colors.textSecondary },
							currentView === option.key && {
								color: colors.primary,
								fontWeight: "600",
							},
						]}
					>
						{option.label}
					</Text>
				</Pressable>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	dropdown: {
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e5e9",
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	dropdownItem: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#f1f3f4",
	},
	dropdownText: {
		fontSize: 16,
		color: "#495057",
	},
});
