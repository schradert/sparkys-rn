// Barrel for product constants, types, schemas, and helpers.
// Logic lives in ./products/*; this file re-exports the public surface so
// existing `@/constants/Products` imports keep working unchanged.

export {
	archiveExternalProduct,
	archiveInternalProduct,
	isExternalProductArchived,
	isInternalProductArchived,
	unarchiveExternalProduct,
	unarchiveInternalProduct,
} from "./products/archive";
export {
	convertExternalProductModelToSheet,
	convertExternalProductSheetToModel,
	convertInternalProductModelToSheet,
	convertInternalProductSheetToModel,
	formatCommaSeparated,
	parseCommaSeparated,
} from "./products/convert";
export type {
	Field,
	FieldFilters,
	FieldOptions,
} from "./products/fieldOptions";
export {
	ARCHIVED_METADATA_ITEMS,
	DEFAULT_FIELD_OPTIONS,
	getAllMetadataItems,
	getMetadataItems,
	isMetadataItemArchived,
	PRODUCT_FIELD_OPTIONS,
	updateFieldOptions,
	updateMetadataItems,
} from "./products/fieldOptions";
export type {
	ExternalProductSheet,
	InternalProductSheet,
} from "./products/schema";
export {
	ExternalProductSheetSchema,
	InternalProductSheetSchema,
	safeParseExternalProductSheet,
	safeParseInternalProductSheet,
} from "./products/schema";
export {
	getExternalProductsForInternal,
	getInternalProductTotalQuantity,
	getQuantityColor,
} from "./products/stock";
export type {
	ExternalProduct,
	ExternalProductField,
	InternalProduct,
	InternalProductField,
} from "./products/types";
export {
	EXTERNAL_PRODUCT_FIELDS,
	INTERNAL_PRODUCT_FIELDS,
} from "./products/types";
