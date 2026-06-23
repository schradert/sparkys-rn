/** Route `/external-product/[sku]` — the external-product detail screen. */
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ExternalProductEditForm from "@/components/product/ExternalProductEditForm";
import ExternalProductView from "@/components/product/ExternalProductView";
import {
	ProductLoading,
	ProductNotFound,
} from "@/components/product/ProductDetailChrome";
import ProductDetailHeader from "@/components/product/ProductDetailHeader";
import { useArchiveProduct } from "@/components/product/useArchiveProduct";
import {
	type AuditEventInput,
	useExternalProductEditor,
} from "@/components/product/useExternalProductEditor";
import { Colors } from "@/constants/Colors";
import type {
	ExternalProduct,
	ExternalProductSheet,
	InternalProduct,
	InternalProductSheet,
} from "@/constants/Products";
import { useSheetsData } from "@/hooks/useSheetsData";
import { useTheme } from "@/hooks/useTheme";
import {
	getAllInternalProducts,
	getExternalProductBySku,
	updateExternalProduct,
} from "@/store/products";

type MutationResult = { success: boolean; error?: string };

/**
 * Route `/external-product/[sku]` — loads the external product by SKU and its
 * owning internal product from the store, then renders the loading/not-found
 * states or the detail body.
 */
export default function ExternalProductDetail() {
	const { theme } = useTheme();
	const colors = Colors[theme];

	const {
		updateExternalProduct: updateExternalProductInSheet,
		updateInternalProduct: updateInternalProductInSheet,
		archiveExternalProduct,
		unarchiveExternalProduct,
		logAuditEvent,
	} = useSheetsData();
	const { sku } = useLocalSearchParams<{ sku: string }>();
	const [externalProduct, setExternalProduct] =
		useState<ExternalProduct | null>(null);
	const [internalProduct, setInternalProduct] =
		useState<InternalProduct | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!sku) return;

		// Use React.startTransition to batch updates and prevent cascading effects
		React.startTransition(() => {
			const external = getExternalProductBySku(sku);
			setExternalProduct(external || null);

			if (external) {
				// Find the internal product that contains this external product's SKU
				const internal = getAllInternalProducts().find((candidate) =>
					candidate.products.includes(external.unique_id_sku),
				);
				setInternalProduct(internal || null);
			}

			setLoading(false);
		});
	}, [sku]);

	if (loading) {
		return <ProductLoading />;
	}

	if (!externalProduct) {
		return <ProductNotFound message="External product not found" />;
	}

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.cardBackground }]}
		>
			<ExternalProductBody
				product={externalProduct}
				internalProduct={internalProduct}
				updateExternalInSheet={updateExternalProductInSheet}
				updateInternalInSheet={updateInternalProductInSheet}
				archiveInSheet={archiveExternalProduct}
				unarchiveInSheet={unarchiveExternalProduct}
				logAuditEvent={logAuditEvent}
				onProductChanged={setExternalProduct}
				onInternalChanged={setInternalProduct}
			/>
		</SafeAreaView>
	);
}

interface ExternalProductBodyProps {
	product: ExternalProduct;
	internalProduct: InternalProduct | null;
	updateExternalInSheet: (
		sheet: ExternalProductSheet,
	) => Promise<MutationResult>;
	updateInternalInSheet: (
		sheet: InternalProductSheet,
	) => Promise<MutationResult>;
	archiveInSheet: (sku: string) => Promise<MutationResult>;
	unarchiveInSheet: (sku: string) => Promise<MutationResult>;
	logAuditEvent: (event: AuditEventInput) => Promise<void>;
	onProductChanged: (product: ExternalProduct) => void;
	onInternalChanged: (internal: InternalProduct | null) => void;
}

/**
 * The loaded external product: shared header chrome plus the read-only view or
 * the edit form. The editor hook owns the edit lifecycle, a concrete working
 * copy, and the multi-step save/reassignment flow.
 */
function ExternalProductBody({
	product,
	internalProduct,
	updateExternalInSheet,
	updateInternalInSheet,
	archiveInSheet,
	unarchiveInSheet,
	logAuditEvent,
	onProductChanged,
	onInternalChanged,
}: ExternalProductBodyProps) {
	const { theme } = useTheme();
	const colors = Colors[theme];

	const {
		isEditing,
		editedProduct,
		setEditedProduct,
		selectedInternal,
		setSelectedInternal,
		isSaving,
		beginEdit,
		cancelEdit,
		incrementStock,
		decrementStock,
		handleSave,
	} = useExternalProductEditor({
		product,
		originalInternal: internalProduct,
		updateExternalInSheet,
		updateInternalInSheet,
		logAuditEvent,
		onExternalSaved: onProductChanged,
		onReassigned: onInternalChanged,
	});

	const isArchived = product.status === "archived";
	const { isArchiving, confirmArchive } = useArchiveProduct({
		logTag: "ExternalProduct",
		isArchived,
		name: product.unique_id_sku,
		mutate: (action) =>
			action === "unarchive"
				? unarchiveInSheet(product.unique_id_sku)
				: archiveInSheet(product.unique_id_sku),
		onArchived: (status) => {
			const updated = { ...product, status };
			updateExternalProduct(product.unique_id_sku, updated);
			onProductChanged(updated);
		},
	});

	return (
		<>
			<ProductDetailHeader
				title="External Product"
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
						<ExternalProductEditForm
							editedProduct={editedProduct}
							setEditedProduct={setEditedProduct}
							selectedInternal={selectedInternal}
							setSelectedInternal={setSelectedInternal}
							onIncrement={incrementStock}
							onDecrement={decrementStock}
						/>
					) : (
						<ExternalProductView
							product={product}
							internalProduct={internalProduct}
						/>
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
	},
});
