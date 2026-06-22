import InternalProductCard from "@/components/InternalProductCard";
import type { ExternalProduct, InternalProduct } from "@/constants/Products";
import { filteredExternalsForInternal } from "@/hooks/useInventoryFilters";
import type { AuditEvent } from "@/services/googleSheets";
import { logger } from "@/services/logger";
import MetadataCard from "./MetadataCard";
import type { ExternalFilters, InternalFilters, ViewMode } from "./types";

interface InventoryListItemProps {
	item: InternalProduct | string;
	currentView: ViewMode;
	externalProducts: ExternalProduct[];
	internalFilters: InternalFilters;
	externalFilters: ExternalFilters;
	events: AuditEvent[];
	onMetadataPress: (field: string, value: string) => void;
}

/**
 * One row of the inventory list. In the products view the item is an internal
 * product rendered as an InternalProductCard (with its linked externals); in a
 * metadata view the item is a value name rendered as a MetadataCard.
 */
export default function InventoryListItem({
	item,
	currentView,
	externalProducts,
	internalFilters,
	externalFilters,
	events,
	onMetadataPress,
}: InventoryListItemProps) {
	if (currentView !== "products") {
		return <MetadataCard item={item as string} viewMode={currentView} />;
	}

	const product = item as InternalProduct;
	logger.debug(
		"Inventory",
		"Rendering InternalProductCard with item:",
		product,
	);

	const relatedExternals = externalProducts.filter((ext) =>
		product.products.includes(ext.unique_id_sku),
	);
	const filteredExternals = filteredExternalsForInternal(
		product,
		externalProducts,
		externalFilters,
	);
	logger.debug(
		"Inventory",
		`External products for ${product.sparkys_product_name}:`,
		`${relatedExternals.length} total, ${filteredExternals.length} after filters`,
	);

	return (
		<InternalProductCard
			internalProduct={product}
			externalProducts={relatedExternals}
			events={events}
			onMetadataPress={onMetadataPress}
			selectedFilters={{ internal: internalFilters, external: externalFilters }}
		/>
	);
}
