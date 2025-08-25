import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
	LayoutAnimation,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	UIManager,
	View,
} from "react-native";
import Pagination from "@/components/Pagination";
import {
	BALLOON_PRODUCTS,
	type Field,
	type FieldFilters,
	PRODUCT_FIELD_OPTIONS,
	type Product,
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
		<View style={styles.filterSection}>
			<Pressable style={styles.filterHeader} onPress={toggleExpansion}>
				<Text style={styles.filterHeaderText}>
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

function ProductCard({ item }: { item: Product }) {
	const product = item;
	return (
		<View style={styles.card}>
			<View style={styles.cardHeader}>
				<Text style={styles.productName}>{product.name}</Text>
				<Text style={styles.price}>${product.price}</Text>
			</View>

			<View style={styles.details}>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Type:</Text>
					<Text style={styles.detailValue}>{product.productType}</Text>
				</View>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Occasion:</Text>
					<Text style={styles.detailValue}>{product.occasion}</Text>
				</View>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Color:</Text>
					<Text style={styles.detailValue}>{product.color}</Text>
				</View>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Size:</Text>
					<Text style={styles.detailValue}>{product.size}</Text>
				</View>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Manufacturer:</Text>
					<Text style={styles.detailValue}>{product.manufacturer}</Text>
				</View>
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Texture:</Text>
					<Text style={styles.detailValue}>{product.texture}</Text>
				</View>
			</View>
		</View>
	);
}

export default function Inventory() {
	const products = BALLOON_PRODUCTS;
	const defaultFilters: FieldFilters = {
		productType: [],
		occasion: [],
		color: [],
		manufacturer: [],
		size: [],
		texture: [],
	};

	const [filters, setFilters] = useState<FieldFilters>(defaultFilters);
	const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

	const filteredProducts = products.filter((product) => {
		if (!filters) return true;

		return Object.entries(filters).every(([key, selectedValues]) => {
			if (!selectedValues || selectedValues.length === 0) return true;
			const productValue = product[key as Field] as string;
			return selectedValues.includes(productValue);
		});
	});

	function clearAllFilters(): void {
		setFilters(defaultFilters);
	}

	function handleFilterChange(category: Field, values: string[]): void {
		setFilters((prev) => ({
			...prev,
			[category]: values,
		}));
	}

	function formatCategoryTitle(category: string): string {
		return (
			category.charAt(0).toUpperCase() +
			category.slice(1).replace(/([A-Z])/g, " $1")
		);
	}

	const totalSelections = Object.values(filters).reduce(
		(sum, arr) => sum + (arr?.length || 0),
		0,
	);

	return (
		<View style={styles.container}>
			<View style={styles.headerContainer}>
				<Text style={styles.title}>Inventory</Text>
				<View style={styles.headerActions}>
					{totalSelections > 0 && (
						<View style={styles.filterBadge}>
							<Text style={styles.filterBadgeText}>{totalSelections}</Text>
						</View>
					)}
					<Pressable
						onPress={() => setIsFilterModalVisible(true)}
						style={styles.filterButton}
					>
						<Ionicons name="options-outline" size={24} color="#007bff" />
					</Pressable>
				</View>
			</View>

			<Pagination
				data={filteredProducts}
				renderItem={ProductCard}
				keyExtractor={(item) => item.id.toString()}
			/>

			<Modal
				visible={isFilterModalVisible}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setIsFilterModalVisible(false)}
			>
				<View style={styles.modalContainer}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>Filter Inventory</Text>
						<View style={styles.modalHeaderActions}>
							{totalSelections > 0 && (
								<Pressable onPress={clearAllFilters} style={styles.clearButton}>
									<Text style={styles.clearText}>Clear All</Text>
								</Pressable>
							)}
							<Pressable
								onPress={() => setIsFilterModalVisible(false)}
								style={styles.closeButton}
							>
								<Ionicons name="close" size={24} color="#6c757d" />
							</Pressable>
						</View>
					</View>

					<ScrollView
						style={styles.modalScrollView}
						showsVerticalScrollIndicator={false}
					>
						{Object.entries(PRODUCT_FIELD_OPTIONS).map(
							([category, options]) => (
								<CollapsibleFilterSection
									key={category}
									title={formatCategoryTitle(category)}
									options={options}
									selectedValues={filters[category as Field] || []}
									onSelectionChange={(values) =>
										handleFilterChange(category as Field, values)
									}
								/>
							),
						)}
					</ScrollView>
				</View>
			</Modal>
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
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e5e9",
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#1a1a1a",
	},
	headerActions: {
		flexDirection: "row",
		alignItems: "center",
	},
	filterButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: "#f8f9fa",
		borderWidth: 1,
		borderColor: "#dee2e6",
		justifyContent: "center",
		alignItems: "center",
	},
	filterBadge: {
		position: "absolute",
		top: -4,
		right: -4,
		backgroundColor: "#ff4757",
		borderRadius: 10,
		minWidth: 20,
		height: 20,
		justifyContent: "center",
		alignItems: "center",
		zIndex: 1,
	},
	filterBadgeText: {
		color: "white",
		fontSize: 12,
		fontWeight: "bold",
	},
	modalContainer: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 16,
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e5e9",
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#1a1a1a",
	},
	modalHeaderActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
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
	closeButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: "#f8f9fa",
		justifyContent: "center",
		alignItems: "center",
	},
	modalScrollView: {
		flex: 1,
		paddingHorizontal: 16,
		paddingTop: 16,
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
	card: {
		backgroundColor: "white",
		borderRadius: 12,
		padding: 16,
		marginVertical: 8,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
	},
	cardHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: 12,
	},
	productName: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1a1a1a",
		flex: 1,
		marginRight: 12,
	},
	price: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#007bff",
	},
	details: {
		gap: 4,
	},
	detailRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	detailLabel: {
		fontSize: 13,
		color: "#6c757d",
		fontWeight: "500",
	},
	detailValue: {
		fontSize: 13,
		color: "#495057",
		fontWeight: "600",
	},
});
