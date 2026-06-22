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

interface CollapsibleFilterSectionProps {
	title: string;
	options: string[];
	selectedValues: string[];
	onSelectionChange: (values: string[]) => void;
}

// Simple substring matching used to filter options while searching.
function fuzzyMatch(query: string, text: string): boolean {
	return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * A collapsible, searchable multi-select filter section: a header with a
 * selection count, an expand/collapse search box, and a wrap of pill checkboxes.
 * When collapsed with selections it shows the selected pills plus a "+N more".
 */
export default function CollapsibleFilterSection({
	title,
	options,
	selectedValues,
	onSelectionChange,
}: CollapsibleFilterSectionProps) {
	const [isExpanded, setIsExpanded] = useState<boolean>(false);
	const [searchQuery, setSearchQuery] = useState<string>("");
	const { theme } = useTheme();
	const colors = Colors[theme];

	function toggleExpansion(): void {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setIsExpanded(!isExpanded);
		if (!isExpanded) {
			// Reset search when expanding
			setSearchQuery("");
		}
	}

	function handlePillPress(value: string): void {
		const newSelection = selectedValues.includes(value)
			? selectedValues.filter((v) => v !== value)
			: [...selectedValues, value];
		onSelectionChange(newSelection);
	}

	// Filter options based on search query
	const filteredOptions = searchQuery
		? options.filter((option) => fuzzyMatch(searchQuery, option))
		: options;

	const displayOptions = isExpanded
		? filteredOptions
		: options.filter((opt) => selectedValues.includes(opt));
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
				<Ionicons
					name={isExpanded ? "chevron-down" : "chevron-forward"}
					size={16}
					color={colors.icon}
				/>
			</Pressable>

			{(isExpanded || hasSelections) && (
				<View
					style={[styles.expandedContent, { backgroundColor: colors.surface }]}
				>
					{isExpanded && (
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
					)}

					<View
						style={[styles.pillContainer, { backgroundColor: colors.surface }]}
					>
						{displayOptions.map((option) => (
							<PillCheckbox
								key={option}
								label={option}
								selected={selectedValues.includes(option)}
								onPress={() => handlePillPress(option)}
							/>
						))}
						{isExpanded && filteredOptions.length === 0 && searchQuery && (
							<Text
								style={[styles.noResultsText, { color: colors.textSecondary }]}
							>
								No results found for "{searchQuery}"
							</Text>
						)}
						{!isExpanded && hasSelections && (
							<Pressable
								style={[
									styles.expandPill,
									{
										backgroundColor: colors.surface,
										borderColor: colors.border,
									},
								]}
								onPress={toggleExpansion}
							>
								<Text
									style={[styles.expandText, { color: colors.textSecondary }]}
								>
									+{options.length - selectedValues.length} more
								</Text>
							</Pressable>
						)}
					</View>
				</View>
			)}
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
	pillContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
	},
	expandPill: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: "#6c757d",
		backgroundColor: "white",
		margin: 4,
		borderStyle: "dashed",
	},
	expandText: {
		color: "#6c757d",
		fontSize: 14,
		fontWeight: "500",
	},
	expandedContent: {
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
	noResultsText: {
		fontSize: 14,
		color: "#6c757d",
		fontStyle: "italic",
		textAlign: "center",
		width: "100%",
		paddingVertical: 20,
	},
});
