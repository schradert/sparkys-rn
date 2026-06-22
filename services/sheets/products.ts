/**
 * Product resource API, split across focused modules:
 * - `products.read` — sheet parsing into typed product rows.
 * - `products.internal` / `products.external` — create + update with audit diffing.
 * - `products.archive` — archive/unarchive status flips.
 *
 * Re-exported here so callers can import the whole product surface from
 * `@/services/sheets/products`.
 */
export {
	archiveExternalProduct,
	archiveInternalProduct,
	unarchiveExternalProduct,
	unarchiveInternalProduct,
} from "./products.archive";
export {
	addExternalProduct,
	updateExternalProduct,
} from "./products.external";
export {
	addInternalProduct,
	updateInternalProduct,
} from "./products.internal";
export {
	getExternalProductData,
	getInternalProductData,
} from "./products.read";
