/**
 * Single source of truth for the metadata sheet/field/viewMode relationships.
 *
 * Each row ties together a Google Sheet tab name, the in-app metadata field key
 * components read from, and the inventory `viewMode` that surfaces it. The two
 * original `switch` ladders (`getMetadataFieldKey` and `getFieldKeyForSheetName`)
 * mapped sheet name -> field key identically — only their case order differed —
 * so both are now served by one table via `getFieldKeyForSheetName`.
 */
interface MetadataMapping {
	/** Google Sheet tab name (e.g. "product_types"). */
	sheetName: string;
	/** In-app metadata field key (e.g. "productType"). */
	fieldKey: string;
	/** Inventory view mode that surfaces this metadata (e.g. "productTypes"). */
	viewMode: string;
}

const METADATA_MAPPINGS: readonly MetadataMapping[] = [
	{
		sheetName: "product_types",
		fieldKey: "productType",
		viewMode: "productTypes",
	},
	{ sheetName: "colors", fieldKey: "color", viewMode: "colors" },
	{ sheetName: "brands", fieldKey: "manufacturer", viewMode: "manufacturers" },
	{ sheetName: "textures", fieldKey: "texture", viewMode: "textures" },
	{
		sheetName: "bag_quantities",
		fieldKey: "bagQuantity",
		viewMode: "bagQuantities",
	},
	{ sheetName: "shapes", fieldKey: "shape", viewMode: "shapes" },
	{
		sheetName: "distributors",
		fieldKey: "distributor",
		viewMode: "distributors",
	},
	{ sheetName: "occasions", fieldKey: "occasion", viewMode: "occasions" },
];

const FIELD_KEY_BY_SHEET_NAME = new Map(
	METADATA_MAPPINGS.map((m) => [m.sheetName, m.fieldKey]),
);

/**
 * Resolve a Google Sheet tab name to its in-app metadata field key, or `null`
 * for sheets that have no corresponding field (preserving the original
 * `default: return null` behavior of both source switches).
 */
export function getFieldKeyForSheetName(sheetName: string): string | null {
	return FIELD_KEY_BY_SHEET_NAME.get(sheetName) ?? null;
}
