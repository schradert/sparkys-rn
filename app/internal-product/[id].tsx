import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ExternalProductCard from "@/components/ExternalProductCard";
import InternalProductEditForm from "@/components/product/InternalProductEditForm";
import InternalProductView from "@/components/product/InternalProductView";
import {
	ProductLoading,
	ProductNotFound,
} from "@/components/product/ProductDetailChrome";
import ProductDetailHeader from "@/components/product/ProductDetailHeader";
import { useArchiveProduct } from "@/components/product/useArchiveProduct";
import { useInternalProductEditor } from "@/components/product/useInternalProductEditor";
import { Colors } from "@/constants/Colors";
import type {
	ExternalProduct,
	InternalProduct,
	InternalProductSheet,
} from "@/constants/Products";
import { getQuantityColor } from "@/constants/Products";
import { useSheetsData } from "@/hooks/useSheetsData";
import { useTheme } from "@/hooks/useTheme";
import {
	getExternalProductsForInternal,
	getInternalProductById,
	subscribeToStoreChanges,
	updateInternalProduct,
} from "@/store/products";

type MutationResult = { success: boolean; error?: string };

function quantityColorValue(
	colorType: "red" | "blue" | "green",
	primary: string,
): string {
	switch (colorType) {
		case "red":
			return "#dc3545";
		case "green":
			return "#28a745";
		default:
			return primary;
	}
}

export default function InternalProductDetail() {
	const { theme } = useTheme();
	const colors = Colors[theme];

	const {
		updateInternalProduct: updateInternalProductInSheet,
		archiveInternalProduct,
		unarchiveInternalProduct,
	} = useSheetsData();
	const { id } = useLocalSearchParams<{ id: string }>();
	const productId = decodeURIComponent(id || "");
	const [internalProduct, setInternalProduct] =
		useState<InternalProduct | null>(null);
	const [externalProducts, setExternalProducts] = useState<ExternalProduct[]>(
		[],
	);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!id) return;

		// Use React.startTransition to batch updates and prevent cascading effects
		React.startTransition(() => {
			const internal = getInternalProductById(productId);
			const externals = internal
				? getExternalProductsForInternal(internal)
				: [];

			setInternalProduct(internal || null);
			setExternalProducts(externals);
			setLoading(false);
		});
	}, [id, productId]);

	// Subscribe to store changes to refresh when external products are updated
	useEffect(() => {
		const unsubscribe = subscribeToStoreChanges(() => {
			if (!id) return;

			const internal = getInternalProductById(productId);
			const externals = internal
				? getExternalProductsForInternal(internal)
				: [];

			setInternalProduct(internal || null);
			setExternalProducts(externals);
		});

		return unsubscribe;
	}, [id, productId]);

	if (loading) {
		return <ProductLoading />;
	}

	if (!internalProduct) {
		return <ProductNotFound message="Internal product not found" />;
	}

	const totalQuantity = externalProducts
		.filter((ext) => (ext.status || "active") === "active")
		.reduce((total, ext) => total + ext.quantity, 0);

	const totalQuantityColor = quantityColorValue(
		getQuantityColor(totalQuantity, internalProduct.threshold_quantity),
		colors.primary,
	);

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.cardBackground }]}
		>
			<InternalProductBody
				product={internalProduct}
				totalQuantity={totalQuantity}
				totalQuantityColor={totalQuantityColor}
				externalProducts={externalProducts}
				updateInSheet={updateInternalProductInSheet}
				archiveInSheet={archiveInternalProduct}
				unarchiveInSheet={unarchiveInternalProduct}
				onProductChanged={setInternalProduct}
			/>
		</SafeAreaView>
	);
}

interface InternalProductBodyProps {
	product: InternalProduct;
	totalQuantity: number;
	totalQuantityColor: string;
	externalProducts: ExternalProduct[];
	updateInSheet: (sheet: InternalProductSheet) => Promise<MutationResult>;
	archiveInSheet: (id: string) => Promise<MutationResult>;
	unarchiveInSheet: (id: string) => Promise<MutationResult>;
	onProductChanged: (product: InternalProduct) => void;
}

/**
 * The loaded internal product: shared header chrome plus the read-only view or
 * the edit form. The editor hook owns the edit lifecycle and a concrete working
 * copy, so neither sub-view needs a null guard.
 */
function InternalProductBody({
	product,
	totalQuantity,
	totalQuantityColor,
	externalProducts,
	updateInSheet,
	archiveInSheet,
	unarchiveInSheet,
	onProductChanged,
}: InternalProductBodyProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	const {
		isEditing,
		editedProduct,
		setEditedProduct,
		isSaving,
		beginEdit,
		cancelEdit,
		handleSave,
	} = useInternalProductEditor({
		product,
		updateInSheet,
		onSaved: (saved) => {
			updateInternalProduct(product.id, saved);
			onProductChanged(saved);
		},
	});

	const isArchived = product.status === "archived";
	const { isArchiving, confirmArchive } = useArchiveProduct({
		logTag: "InternalProduct",
		isArchived,
		name: product.sparkys_product_name,
		mutate: (action) =>
			action === "unarchive"
				? unarchiveInSheet(product.id)
				: archiveInSheet(product.id),
		onArchived: (status) => {
			const updated = { ...product, status };
			updateInternalProduct(product.id, updated);
			onProductChanged(updated);
		},
	});

	return (
		<>
			<ProductDetailHeader
				title="Internal Product"
				isEditing={isEditing}
				isSaving={isSaving}
				isArchiving={isArchiving}
				isArchived={isArchived}
				onArchive={confirmArchive}
				onEdit={beginEdit}
				onSave={handleSave}
				onCancel={cancelEdit}
			/>

			<View
				style={[
					styles.contentContainer,
					{ backgroundColor: colors.background },
				]}
			>
				<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
					{isEditing ? (
						<InternalProductEditForm
							editedProduct={editedProduct}
							setEditedProduct={setEditedProduct}
							totalQuantity={totalQuantity}
							totalQuantityColor={totalQuantityColor}
						/>
					) : (
						<InternalProductView
							product={product}
							totalQuantity={totalQuantity}
							totalQuantityColor={totalQuantityColor}
						/>
					)}

					{externalProducts.length > 0 && (
						<View style={styles.section}>
							<Text style={[styles.sectionTitle, { color: colors.text }]}>
								External Products ({externalProducts.length})
							</Text>
							<Text
								style={[
									styles.sectionSubtitle,
									{ color: colors.textSecondary },
								]}
							>
								These are the manufacturer products grouped under this internal
								product
							</Text>
							{externalProducts.map((externalProduct) => (
								<ExternalProductCard
									key={externalProduct.unique_id_sku}
									externalProduct={externalProduct}
								/>
							))}
						</View>
					)}
				</ScrollView>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	contentContainer: {
		flex: 1,
	},
	content: {
		flex: 1,
		padding: 16,
		paddingBottom: 32,
	},
	section: {
		marginBottom: 20,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#1a1a1a",
		marginBottom: 12,
	},
	sectionSubtitle: {
		fontSize: 14,
		color: "#6c757d",
		marginBottom: 16,
		fontStyle: "italic",
	},
});
