import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Pagination from "@/components/Pagination";
import {
	BALLOON_PRODUCTS,
	type Field,
	type FieldFilters,
	type Product,
} from "@/constants/Products";

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

	const filteredProducts = products.filter((product) => {
		if (!filters) return true;

		return Object.entries(filters).every(([key, selectedValues]) => {
			if (!selectedValues || selectedValues.length === 0) return true;
			const productValue = product[key as keyof Product] as string;
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

	return (
		<View style={styles.container}>
			<Pagination
				data={filteredProducts}
				renderItem={ProductCard}
				keyExtractor={(item) => item.id.toString()}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
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
