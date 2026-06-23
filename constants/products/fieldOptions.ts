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

export let PRODUCT_FIELD_OPTIONS = { ...DEFAULT_FIELD_OPTIONS };

// Archive management for metadata items
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

export function updateMetadataItems(
	metadata: Record<string, Array<{ name: string; status: string }>>,
) {
	METADATA_ITEMS = { ...metadata };
}

export function getMetadataItems(
	fieldKey: string,
	includeArchived: boolean = false,
): Array<{ name: string; status: string }> {
	const items = METADATA_ITEMS[fieldKey] || [];
	return includeArchived
		? items
		: items.filter((item) => item.status === "active");
}

export function isMetadataItemArchived(
	fieldKey: string,
	value: string,
): boolean {
	const items = METADATA_ITEMS[fieldKey] || [];
	const item = items.find((item) => item.name === value);
	return item?.status === "archived" || false;
}

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

export type FieldOptions = typeof PRODUCT_FIELD_OPTIONS;
export type Field = keyof FieldOptions;
export type FieldFilters = {
	[K in Field]: string[];
};
