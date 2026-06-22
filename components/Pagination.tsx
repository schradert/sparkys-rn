import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
	FlatList,
	Pressable,
	RefreshControl,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { Colors } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";

interface PaginationProps<T> {
	data: T[];
	renderItem: ({ item }: { item: T }) => React.ReactElement;
	keyExtractor: (item: T) => string;
	emptyText?: string;
	itemsPerPage?: number;
	maxVisiblePages?: number;
	onRefresh?: () => void;
	refreshing?: boolean;
}

export default function Pagination<T>({
	data,
	renderItem,
	keyExtractor,
	emptyText = "No items",
	itemsPerPage = 10,
	maxVisiblePages = 5,
	onRefresh,
	refreshing = false,
}: PaginationProps<T>) {
	const [currentPage, setCurrentPage] = useState(1);
	const { theme } = useTheme();
	const colors = Colors[theme];

	const totalPages = Math.ceil(data.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const currentData = data.slice(startIndex, startIndex + itemsPerPage);
	const isFirstPage = currentPage === 1;
	const isLastPage = currentPage === totalPages;

	const pageNumbers: (number | string)[] = [];
	if (totalPages <= maxVisiblePages) {
		for (let i = 1; i <= totalPages; i++) {
			pageNumbers.push(i);
		}
	} else {
		pageNumbers.push(1);

		if (currentPage > 3) pageNumbers.push("...");

		const start = Math.max(2, currentPage - 1);
		const end = Math.min(totalPages - 1, currentPage + 1);
		for (let i = start; i <= end; i++) {
			if (i !== 1 && i !== totalPages) pageNumbers.push(i);
		}

		if (currentPage < totalPages - 2) pageNumbers.push("...");
		if (totalPages > 1) pageNumbers.push(totalPages);
	}

	function renderEmpty() {
		return (
			<View style={styles.emptyContainer}>
				<Text style={[styles.emptyText, { color: colors.textSecondary }]}>
					{emptyText}
				</Text>
			</View>
		);
	}

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- reset to the first page whenever the data set changes
		setCurrentPage(1);
	}, [data.length]);

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<FlatList
				data={currentData}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				ListEmptyComponent={renderEmpty}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={styles.listContainer}
				refreshControl={
					onRefresh ? (
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							colors={[colors.primary]}
							tintColor={colors.primary}
						/>
					) : undefined
				}
			/>

			<View
				style={[
					styles.paginationContainer,
					{
						backgroundColor: colors.cardBackground,
						borderTopColor: colors.borderLight,
					},
				]}
			>
				<Pressable
					disabled={isFirstPage}
					onPress={() => setCurrentPage(currentPage - 1)}
					style={[
						styles.paginationButton,
						{
							backgroundColor: isFirstPage ? colors.surface : colors.surface,
							borderColor: isFirstPage ? colors.borderLight : colors.border,
						},
					]}
				>
					<Ionicons
						name="chevron-back"
						size={16}
						color={isFirstPage ? colors.textMuted : colors.primary}
					/>
				</Pressable>

				{pageNumbers.map((page, index) =>
					page === "..." ? (
						<View
							key={`ellipsis-${index < pageNumbers.length / 2 ? "start" : "end"}`}
							style={styles.ellipsis}
						>
							<Text
								style={[styles.ellipsisText, { color: colors.textSecondary }]}
							>
								...
							</Text>
						</View>
					) : (
						<Pressable
							key={page}
							onPress={() => setCurrentPage(page as number)}
							style={[
								styles.pageNumberButton,
								{
									backgroundColor:
										currentPage === page ? colors.primary : colors.surface,
									borderColor:
										currentPage === page ? colors.primary : colors.border,
								},
							]}
						>
							<Text
								style={[
									styles.pageNumberText,
									{
										color:
											currentPage === page ? "white" : colors.textSecondary,
									},
								]}
							>
								{page}
							</Text>
						</Pressable>
					),
				)}

				<Pressable
					disabled={isLastPage}
					onPress={() => setCurrentPage(currentPage + 1)}
					style={[
						styles.paginationButton,
						{
							backgroundColor: isLastPage ? colors.surface : colors.surface,
							borderColor: isLastPage ? colors.borderLight : colors.border,
						},
					]}
				>
					<Ionicons
						name="chevron-forward"
						size={16}
						color={isLastPage ? colors.textMuted : colors.primary}
					/>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	pageNumber: {
		fontSize: 14,
		color: "#6c757d",
		fontWeight: "500",
	},
	pageNumberText: {
		fontSize: 14,
		fontWeight: "600",
		color: "#495057",
	},
	pageNumberTextActive: {
		color: "white",
	},
	pageNumberButton: {
		minWidth: 36,
		height: 36,
		borderRadius: 8,
		justifyContent: "center",
		alignItems: "center",
		marginHorizontal: 2,
		backgroundColor: "#f8f9fa",
		borderWidth: 1,
		borderColor: "#dee2e6",
		paddingHorizontal: 8,
	},
	pageNumberButtonActive: {
		backgroundColor: "#007bff",
		borderColor: "#007bff",
	},
	listContainer: {
		paddingHorizontal: 16,
		flexGrow: 1,
	},
	paginationContainer: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		paddingVertical: 16,
		paddingHorizontal: 16,
		backgroundColor: "white",
		borderTopWidth: 1,
		borderTopColor: "#e1e5e9",
	},
	paginationButton: {
		width: 36,
		height: 36,
		borderRadius: 8,
		justifyContent: "center",
		alignItems: "center",
		marginHorizontal: 4,
		backgroundColor: "#f8f9fa",
		borderWidth: 1,
		borderColor: "#dee2e6",
	},
	paginationButtonDisabled: {
		backgroundColor: "#f8f9fa",
		borderColor: "#dee2e6",
	},
	ellipsis: {
		minWidth: 36,
		height: 36,
		justifyContent: "center",
		alignItems: "center",
		marginHorizontal: 2,
	},
	ellipsisText: {
		fontSize: 14,
		color: "#6c757d",
		fontWeight: "600",
	},
	emptyContainer: {
		padding: 40,
		alignItems: "center",
	},
	emptyText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#6c757d",
		textAlign: "center",
	},
});
