/** Hook owning the internal-product edit lifecycle and save flow. */
import { useState } from "react";
import { Alert } from "react-native";
import type {
	InternalProduct,
	InternalProductSheet,
} from "@/constants/Products";
import { logger } from "@/services/logger";
import { getAllInternalProducts } from "@/store/products";

type MutationResult = { success: boolean; error?: string };

interface UseInternalProductEditorOptions {
	/** The current product; the working copy is seeded from it on each edit. */
	product: InternalProduct;
	/** Persist the edited product to the spreadsheet. */
	updateInSheet: (sheet: InternalProductSheet) => Promise<MutationResult>;
	/** Apply a successful save to the store and parent screen state. */
	onSaved: (saved: InternalProduct) => void;
}

interface UseInternalProductEditorResult {
	isEditing: boolean;
	editedProduct: InternalProduct;
	setEditedProduct: (product: InternalProduct) => void;
	isSaving: boolean;
	beginEdit: () => void;
	cancelEdit: () => void;
	handleSave: () => Promise<void>;
}

function hasInternalChanges(
	edited: InternalProduct,
	original: InternalProduct,
): boolean {
	return (
		edited.sparkys_product_name !== original.sparkys_product_name ||
		edited.product_type !== original.product_type ||
		edited.sparkys_color !== original.sparkys_color ||
		edited.texture !== original.texture ||
		edited.shape !== original.shape ||
		JSON.stringify(edited.occasions) !== JSON.stringify(original.occasions) ||
		edited.threshold_quantity !== original.threshold_quantity ||
		edited.never_out !== original.never_out
	);
}

/**
 * Owns the editable copy of an internal product, the edit/save/cancel
 * lifecycle, and the save flow: duplicate-name guard, change detection, the
 * sheet write, and success/error alerts. Entering edit mode reseeds the working
 * copy from the current product, so `editedProduct` is always concrete and the
 * edit form needs no null guard.
 */
export function useInternalProductEditor({
	product,
	updateInSheet,
	onSaved,
}: UseInternalProductEditorOptions): UseInternalProductEditorResult {
	const [isEditing, setIsEditing] = useState(false);
	const [editedProduct, setEditedProduct] = useState<InternalProduct>(product);
	const [isSaving, setIsSaving] = useState(false);

	const beginEdit = () => {
		setEditedProduct(product);
		setIsEditing(true);
	};

	const cancelEdit = () => {
		setEditedProduct(product);
		setIsEditing(false);
	};

	const handleSave = async () => {
		// Check for duplicate names (excluding current product)
		if (editedProduct.sparkys_product_name !== product.sparkys_product_name) {
			const allProducts = getAllInternalProducts();
			const existingProduct = allProducts.find(
				(p) =>
					p.id !== editedProduct.id &&
					p.sparkys_product_name.toLowerCase().trim() ===
						editedProduct.sparkys_product_name.toLowerCase().trim(),
			);
			if (existingProduct) {
				Alert.alert("Error", "A product with this name already exists");
				return;
			}
		}

		if (!hasInternalChanges(editedProduct, product)) {
			setIsEditing(false);
			return;
		}

		setIsSaving(true);
		try {
			const productForSheet: InternalProductSheet = {
				id: editedProduct.id,
				sparkys_product_name: editedProduct.sparkys_product_name,
				product_type: editedProduct.product_type,
				sparkys_color: editedProduct.sparkys_color,
				texture: editedProduct.texture,
				shape: editedProduct.shape,
				occasions: editedProduct.occasions.join(", "),
				products: editedProduct.products.join(", "),
				threshold_quantity: editedProduct.threshold_quantity,
				never_out: editedProduct.never_out,
				status: editedProduct.status || "active",
			};

			const result = await updateInSheet(productForSheet);
			if (result.success) {
				onSaved(editedProduct);
				setIsEditing(false);
				Alert.alert("Success", "Product updated successfully");
			} else {
				Alert.alert("Error", result.error || "Failed to update product");
			}
		} catch (error) {
			logger.error("InternalProduct", "Failed to update product", {
				error,
				id: product.id,
			});
			Alert.alert("Error", "Failed to update product");
		} finally {
			setIsSaving(false);
		}
	};

	return {
		isEditing,
		editedProduct,
		setEditedProduct,
		isSaving,
		beginEdit,
		cancelEdit,
		handleSave,
	};
}
