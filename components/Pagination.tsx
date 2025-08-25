import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

interface BasicPaginationProps<T> {
	data: T[];
	renderItem: ({ item }: { item: T }) => React.ReactElement;
	emptyText?: string;
	itemsPerPage?: number;
	maxVisiblePages?: number;
	keyExtractor?: (item: T) => string;
}

export default function Pagination<T>({
	data,
	renderItem,
	emptyText = "No items",
	itemsPerPage = 10,
	maxVisiblePages = 5,
	keyExtractor = (item: any) => item.id?.toString() || Math.random().toString(),
}: BasicPaginationProps<T>) {
	const [currentPage, setCurrentPage] = useState(1);

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
				<Text style={styles.emptyText}>{emptyText}</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<FlatList
				data={currentData}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				ListEmptyComponent={renderEmpty}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={styles.listContainer}
			/>

			<View style={styles.paginationContainer}>
				<Pressable
					disabled={isFirstPage}
					onPress={() => setCurrentPage(currentPage - 1)}
					style={[
						styles.paginationButton,
						isFirstPage && styles.paginationButtonDisabled,
					]}
				>
					<Ionicons
						name="chevron-back"
						size={16}
						color={isFirstPage ? "#adb5bd" : "#007bff"}
					/>
				</Pressable>

				{pageNumbers.map((page, index) =>
					page === "..." ? (
						<View key={`ellipsis-${index}`} style={styles.ellipsis}>
							<Text style={styles.ellipsisText}>...</Text>
						</View>
					) : (
						<Pressable
							key={page}
							onPress={() => setCurrentPage(page as number)}
							style={[
								styles.pageNumberButton,
								currentPage === page && styles.pageNumberButtonActive,
							]}
						>
							<Text
								style={[
									styles.pageNumberText,
									currentPage === page && styles.pageNumberTextActive,
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
						isLastPage && styles.paginationButtonDisabled,
					]}
				>
					<Ionicons
						name="chevron-forward"
						size={16}
						color={isLastPage ? "#adb5bd" : "#007bff"}
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
