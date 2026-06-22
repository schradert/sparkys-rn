import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
	LayoutAnimation,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import PillCheckbox from "@/components/PillCheckbox";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";

interface CollapsibleMultiSelectSectionProps {
	title: string;
	options: readonly string[];
	selectedValues: string[];
	onSelectionChange: (values: string[]) => void;
}

export default function CollapsibleMultiSelectSection({
	title,
	options,
	selectedValues,
	onSelectionChange,
}: CollapsibleMultiSelectSectionProps) {
	const [isExpanded, setIsExpanded] = useState<boolean>(false);
	const [searchQuery, setSearchQuery] = useState<string>("");
	const { theme } = useTheme();
	const colors = Colors[theme];

	function toggleExpansion(): void {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setIsExpanded(!isExpanded);
		if (!isExpanded) {
			setSearchQuery("");
		}
	}

	function handlePillPress(value: string): void {
		const newSelection = selectedValues.includes(value)
			? selectedValues.filter((v) => v !== value)
			: [...selectedValues, value];
		onSelectionChange(newSelection);
	}

	function fuzzyMatch(query: string, text: string): boolean {
		const queryLower = query.toLowerCase();
		const textLower = text.toLowerCase();
		return textLower.includes(queryLower);
	}

	const filteredOptions = searchQuery
		? options.filter((option) => fuzzyMatch(searchQuery, option))
		: options;

	const hasSelections = selectedValues.length > 0;

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
					{title} {hasSelections && `(${selectedValues.length})`}
				</Text>
				<View style={styles.headerRight}>
					{!isExpanded && hasSelections && (
						<View style={styles.selectedPillsContainer}>
							{selectedValues.slice(0, 2).map((value) => (
								<View
									key={value}
									style={[
										styles.pill,
										{
											backgroundColor: colors.primary,
											borderColor: colors.primary,
										},
									]}
								>
									<Text style={[styles.pillText, { color: "white" }]}>
										{value}
									</Text>
								</View>
							))}
							{selectedValues.length > 2 && (
								<Text
									style={[styles.moreText, { color: colors.textSecondary }]}
								>
									+{selectedValues.length - 2} more
								</Text>
							)}
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
					style={[
						styles.expandedContent,
						{ backgroundColor: colors.surface, borderTopColor: colors.border },
					]}
				>
					<View
						style={[
							styles.searchContainer,
							{ backgroundColor: colors.cardBackground },
						]}
					>
						<Ionicons
							name="search-outline"
							size={16}
							color={colors.textSecondary}
						/>
						<TextInput
							style={[styles.searchInput, { color: colors.text }]}
							placeholder={`Search ${title.toLowerCase()}...`}
							placeholderTextColor={colors.textMuted}
							value={searchQuery}
							onChangeText={setSearchQuery}
							autoCapitalize="none"
							autoCorrect={false}
						/>
						{searchQuery.length > 0 && (
							<Pressable onPress={() => setSearchQuery("")}>
								<Ionicons
									name="close-circle"
									size={16}
									color={colors.textSecondary}
								/>
							</Pressable>
						)}
					</View>

					<View
						style={[styles.pillContainer, { backgroundColor: colors.surface }]}
					>
						{filteredOptions.map((option) => (
							<PillCheckbox
								key={option}
								label={option}
								selected={selectedValues.includes(option)}
								onPress={() => handlePillPress(option)}
							/>
						))}
						{filteredOptions.length === 0 && searchQuery && (
							<Text
								style={[styles.noResultsText, { color: colors.textSecondary }]}
							>
								No results found for "{searchQuery}"
							</Text>
						)}
					</View>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	pill: {
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
		borderWidth: 1.5,
		borderColor: "#dee2e6",
		backgroundColor: "white",
		marginRight: 4,
	},
	pillText: {
		color: "#495057",
		fontSize: 12,
		fontWeight: "500",
	},
	headerRight: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		flex: 1,
		justifyContent: "flex-end",
	},
	selectedPillsContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
	},
	moreText: {
		fontSize: 12,
		fontWeight: "500",
	},
	filterHeaderText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1a1a1a",
		flex: 1,
	},
	expandedContent: {
		borderTopWidth: 1,
		borderTopColor: "#dee2e6",
		padding: 16,
	},
	searchContainer: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		marginBottom: 16,
		backgroundColor: "white",
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#dee2e6",
		gap: 8,
	},
	searchInput: {
		flex: 1,
		fontSize: 14,
		color: "#1a1a1a",
		paddingVertical: 0,
	},
	pillContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
	},
	noResultsText: {
		fontSize: 14,
		color: "#6c757d",
		fontStyle: "italic",
		textAlign: "center",
		width: "100%",
		paddingVertical: 20,
	},
	filterHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		backgroundColor: "white",
		minHeight: 56,
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
