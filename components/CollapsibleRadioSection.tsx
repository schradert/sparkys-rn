import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
	LayoutAnimation,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import PillCheckbox from "@/components/PillCheckbox";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";

interface CollapsibleRadioSectionProps {
	title: string;
	options: string[];
	selectedValue: string;
	onSelectionChange: (value: string) => void;
}

export default function CollapsibleRadioSection({
	title,
	options,
	selectedValue,
	onSelectionChange,
}: CollapsibleRadioSectionProps) {
	const [isExpanded, setIsExpanded] = useState<boolean>(false);
	const { theme } = useTheme();
	const colors = Colors[theme];

	function toggleExpansion(): void {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setIsExpanded(!isExpanded);
	}

	function handlePillPress(value: string): void {
		onSelectionChange(value);
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setIsExpanded(false);
	}

	const hasSelection = selectedValue !== "";

	return (
		<View
			style={[styles.filterSection, { backgroundColor: colors.cardBackground }]}
		>
			<Pressable
				style={[
					styles.filterHeader,
					{ backgroundColor: colors.cardBackground },
				]}
				onPress={toggleExpansion}
			>
				<Text style={[styles.filterHeaderText, { color: colors.text }]}>
					{title}
				</Text>
				<View style={styles.headerRight}>
					{!isExpanded && hasSelection && (
						<View
							style={[
								styles.pill,
								{
									backgroundColor: colors.primary,
									borderColor: colors.primary,
								},
							]}
						>
							<Text style={[styles.pillText, { color: "white" }]}>
								{selectedValue}
							</Text>
						</View>
					)}
					<Ionicons
						name={isExpanded ? "chevron-down" : "chevron-forward"}
						size={16}
						color={colors.icon}
					/>
				</View>
			</Pressable>

			{isExpanded && (
				<View
					style={[styles.pillContainer, { backgroundColor: colors.surface }]}
				>
					{options.map((option) => (
						<PillCheckbox
							key={option}
							label={option}
							selected={selectedValue === option}
							onPress={() => handlePillPress(option)}
						/>
					))}
				</View>
			)}
		</View>
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
	headerRight: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	filterHeaderText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1a1a1a",
		flex: 1,
	},
	pillContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		padding: 16,
		paddingTop: 0,
		backgroundColor: "#f8f9fa",
	},
	filterHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		backgroundColor: "white",
	},
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
});
