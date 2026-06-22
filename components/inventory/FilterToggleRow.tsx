import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface FilterToggleRowProps {
	label: string;
	icon: IoniconName;
	active: boolean;
	onToggle: () => void;
	/** The "on" accent color for the icon, label, and track. */
	activeColor: string;
	/** Thumb travel distance when on (the metadata toggle uses a wider track). */
	thumbTranslateOn?: number;
	/** When set, the thumb is this color while off (otherwise it stays white). */
	thumbOffColor?: string;
}

/**
 * A labeled boolean toggle row used by the filter modals (understocked, the two
 * product show-archived rows, and the metadata show-archived row). The small
 * positional/thumb-color differences between those rows are props.
 */
export default function FilterToggleRow({
	label,
	icon,
	active,
	onToggle,
	activeColor,
	thumbTranslateOn = 18,
	thumbOffColor = "white",
}: FilterToggleRowProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	return (
		<View
			style={[styles.filterSection, { backgroundColor: colors.cardBackground }]}
		>
			<Pressable
				style={[
					styles.filterHeader,
					{ backgroundColor: colors.cardBackground },
				]}
				onPress={onToggle}
			>
				<View style={styles.understockedHeader}>
					<Ionicons
						name={icon}
						size={20}
						color={active ? activeColor : colors.icon}
					/>
					<Text
						style={[
							styles.filterHeaderText,
							{ color: active ? activeColor : colors.text },
						]}
					>
						{label}
					</Text>
				</View>
				<View
					style={[
						styles.toggleSwitch,
						{ backgroundColor: active ? activeColor : colors.surface },
					]}
				>
					<View
						style={[
							styles.toggleThumb,
							{
								backgroundColor: active ? "white" : thumbOffColor,
								transform: [{ translateX: active ? thumbTranslateOn : 2 }],
							},
						]}
					/>
				</View>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	filterSection: {
		backgroundColor: "white",
		marginBottom: 16,
		borderRadius: 12,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		overflow: "hidden",
	},
	filterHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		backgroundColor: "white",
	},
	filterHeaderText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1a1a1a",
		flex: 1,
	},
	understockedHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		flex: 1,
	},
	toggleSwitch: {
		width: 44,
		height: 24,
		borderRadius: 12,
		justifyContent: "center",
		position: "relative",
	},
	toggleThumb: {
		width: 20,
		height: 20,
		borderRadius: 10,
		position: "absolute",
	},
});
