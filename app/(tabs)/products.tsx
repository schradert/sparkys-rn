import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
	LayoutAnimation,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	UIManager,
	View,
} from "react-native";
import {
	type Field,
	type FieldFilters,
	type FieldOptions,
	PRODUCT_FIELD_OPTIONS,
} from "@/constants/Products";

// Enable LayoutAnimation on Android
if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface PillCheckboxProps {
	label: string;
	selected: boolean;
	onPress: () => void;
}

function PillCheckbox({ label, selected, onPress }: PillCheckboxProps) {
	return (
		<Pressable
			style={[styles.pill, selected && styles.pillSelected]}
			onPress={onPress}
		>
			<Text style={[styles.pillText, selected && styles.pillTextSelected]}>
				{label}
			</Text>
		</Pressable>
	);
}

interface CollapsibleFilterSectionProps {
	title: string;
	options: string[];
	selectedValues: string[];
	onSelectionChange: (values: string[]) => void;
}

function CollapsibleFilterSection({
	title,
	options,
	selectedValues,
	onSelectionChange,
}: CollapsibleFilterSectionProps) {
	const [isExpanded, setIsExpanded] = useState<boolean>(false);

	function toggleExpansion(): void {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setIsExpanded(!isExpanded);
	}

	function handlePillPress(value: string): void {
		const newSelection = selectedValues.includes(value)
			? selectedValues.filter((v) => v !== value)
			: [...selectedValues, value];
		onSelectionChange(newSelection);
	}

	const displayOptions = isExpanded
		? options
		: options.filter((opt) => selectedValues.includes(opt));
	const hasSelections = selectedValues.length > 0;

	return (
		<View style={styles.section}>
			<Pressable style={styles.header} onPress={toggleExpansion}>
				<Text style={styles.headerText}>
					{title} {hasSelections && `(${selectedValues.length})`}
				</Text>
				<Ionicons
					name={isExpanded ? "chevron-down" : "chevron-forward"}
					size={16}
					color="#666"
				/>
			</Pressable>

			{(isExpanded || hasSelections) && (
				<View style={styles.pillContainer}>
					{displayOptions.map((option) => (
						<PillCheckbox
							key={option}
							label={option}
							selected={selectedValues.includes(option)}
							onPress={() => handlePillPress(option)}
						/>
					))}
					{!isExpanded && hasSelections && (
						<Pressable style={styles.expandPill} onPress={toggleExpansion}>
							<Text style={styles.expandText}>
								+{options.length - selectedValues.length} more
							</Text>
						</Pressable>
					)}
				</View>
			)}
		</View>
	);
}

export default function Inventory({ filters }: { filters: FieldFilters }) {
	function formatCategoryTitle(category: string): string {
		return (
			category.charAt(0).toUpperCase() +
			category.slice(1).replace(/([A-Z])/g, " $1")
		);
	}

	const totalSelections = Object.values(filters).reduce(
		(sum, arr) => sum + arr.length,
		0,
	);

	return (
		<View style={styles.container}>
			<View style={styles.headerContainer}>
				<Text style={styles.title}>Filter Balloons</Text>
				{totalSelections > 0 && (
					<Pressable onPress={clearAllFilters} style={styles.clearButton}>
						<Text style={styles.clearText}>Clear All ({totalSelections})</Text>
					</Pressable>
				)}
			</View>

			<ScrollView
				style={styles.scrollView}
				showsVerticalScrollIndicator={false}
			>
				{Object.entries(PRODUCT_FIELD_OPTIONS).map(([category, options]) => (
					<CollapsibleFilterSection
						key={category}
						title={formatCategoryTitle(category)}
						options={options}
						selectedValues={filters[category]}
						onSelectionChange={(values) => handleFilterChange(category, values)}
					/>
				))}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	headerContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e5e9",
	},
	title: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#1a1a1a",
	},
	clearButton: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		backgroundColor: "#ff4757",
	},
	clearText: {
		color: "white",
		fontSize: 12,
		fontWeight: "600",
	},
	scrollView: {
		flex: 1,
	},
	section: {
		backgroundColor: "white",
		marginHorizontal: 16,
		marginVertical: 8,
		borderRadius: 12,
		overflow: "hidden",
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		backgroundColor: "white",
	},
	headerText: {
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
	pill: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
		borderWidth: 1.5,
		borderColor: "#dee2e6",
		backgroundColor: "white",
		margin: 4,
	},
	pillSelected: {
		backgroundColor: "#007bff",
		borderColor: "#007bff",
	},
	pillText: {
		color: "#495057",
		fontSize: 14,
		fontWeight: "500",
	},
	pillTextSelected: {
		color: "white",
		fontWeight: "600",
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
	footer: {
		padding: 16,
		backgroundColor: "white",
		borderTopWidth: 1,
		borderTopColor: "#e1e5e9",
	},
	footerText: {
		textAlign: "center",
		color: "#6c757d",
		fontSize: 14,
		fontWeight: "500",
	},
});
