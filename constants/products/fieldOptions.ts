/**
 * In-memory catalog of selectable values for each product field. Seeded with
 * built-in defaults and overlaid at runtime from the metadata sheets, so the UI
 * has options before the first fetch and stays in sync after it.
 */

/** Built-in fallback options used until the metadata sheets are loaded. */
export const DEFAULT_FIELD_OPTIONS = {
	productType: [
		"Latex Balloons",
		"Foil Balloons",
		"Bubble Balloons",
		"Modeling Balloons",
	],
	// Separate color fields for internal vs external products
	manufacturer_color: [
		"Flaming Red",
		"Ocean Blue",
		"Rose Pink",
		"Metallic Gold",
		"Chrome Silver",
		"Forest Green",
		"Royal Purple",
		"Sunset Orange",
		"Jet Black",
		"Pearl White",
	],
	sparkys_color: [
		"Red",
		"Blue",
		"Pink",
		"Gold",
		"Silver",
		"Green",
		"Purple",
		"Orange",
		"Black",
		"White",
	],
	manufacturer: ["Qualatex", "Anagram", "Betallic", "CTI", "Convergram"],
	size: ['9"', '11"', '16"', '18"', '36"', '40"'],
	texture: ["Matte", "Pearl", "Chrome", "Metallic", "Transparent"],
	bagQuantity: ["50", "100", "20"],
	shape: ["Round", "Heart", "Star"],
	distributor: ["Default Distributor"],
	occasion: [
		"Birthday",
		"Wedding",
		"Baby Shower",
		"Anniversary",
		"Graduation",
		"Holiday",
	],
} as const;

/** Live, mutable field options; starts as the defaults and is overlaid at runtime. */
export let PRODUCT_FIELD_OPTIONS = { ...DEFAULT_FIELD_OPTIONS };

/** Per-field lists of archived metadata names, keyed by field. */
export const ARCHIVED_METADATA_ITEMS: Record<string, string[]> = {
	productType: [],
	manufacturer_color: [],
	sparkys_color: [],
	manufacturer: [],
	size: [],
	texture: [],
	bagQuantity: [],
	shape: [],
	distributor: [],
	occasion: [],
};

type FieldOptionInput = string | { name: string };

/** Overlay loaded options onto the live set, coercing items to plain names. */
export function updateFieldOptions(
	newOptions: Record<string, FieldOptionInput[]>,
) {
	// Convert metadata objects to strings for existing compatibility
	const convertedOptions: Record<string, string[]> = {};
	for (const [key, items] of Object.entries(newOptions)) {
		convertedOptions[key] = items.map((item) =>
			typeof item === "object" ? item.name : item,
		);
	}
	PRODUCT_FIELD_OPTIONS = { ...PRODUCT_FIELD_OPTIONS, ...convertedOptions };
}

// Metadata storage with status
let METADATA_ITEMS: Record<
	string,
	Array<{ name: string; status: string }>
> = {};

/** Replace the stored metadata items (name + status) keyed by field. */
export function updateMetadataItems(
	metadata: Record<string, Array<{ name: string; status: string }>>,
) {
	METADATA_ITEMS = { ...metadata };
}

/** Metadata items for a field; active-only unless `includeArchived`. */
export function getMetadataItems(
	fieldKey: string,
	includeArchived: boolean = false,
): Array<{ name: string; status: string }> {
	const items = METADATA_ITEMS[fieldKey] || [];
	return includeArchived
		? items
		: items.filter((item) => item.status === "active");
}

/** Whether a field's metadata value is marked archived. */
export function isMetadataItemArchived(
	fieldKey: string,
	value: string,
): boolean {
	const items = METADATA_ITEMS[fieldKey] || [];
	const item = items.find((item) => item.name === value);
	return item?.status === "archived" || false;
}

/** Names for a field: active options, plus archived names when requested. */
export function getAllMetadataItems(
	fieldKey: string,
	includeArchived: boolean = false,
): string[] {
	const activeItems: readonly string[] =
		PRODUCT_FIELD_OPTIONS[fieldKey as keyof typeof PRODUCT_FIELD_OPTIONS] ?? [];
	if (!includeArchived) {
		return [...activeItems];
	}
	const archivedItems = getMetadataItems(fieldKey, true)
		.filter((item) => item.status === "archived")
		.map((item) => item.name);
	return [...activeItems, ...archivedItems];
}

/** The shape of the live field-options map. */
export type FieldOptions = typeof PRODUCT_FIELD_OPTIONS;
/** A field-options key (e.g. `"productType"`, `"size"`). */
export type Field = keyof FieldOptions;
/** A selected-values filter holding a string array per field. */
export type FieldFilters = {
	[K in Field]: string[];
};
