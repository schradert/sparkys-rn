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

export function updateFieldOptions(
	newOptions: Partial<typeof PRODUCT_FIELD_OPTIONS>,
) {
	PRODUCT_FIELD_OPTIONS = { ...PRODUCT_FIELD_OPTIONS, ...newOptions };
}

export type FieldOptions = typeof PRODUCT_FIELD_OPTIONS;
export type Field = keyof FieldOptions;
export type FieldFilters = {
	[K in Field]: string[];
};

// Updated field options that include the new color fields
export const INTERNAL_PRODUCT_FIELDS = [
	"product_type",
	"texture",
	"shape",
	"occasions",
	"sparkys_color",
] as const;

export const EXTERNAL_PRODUCT_FIELDS = [
	"manufacturer_color",
	"brand",
	"size",
	"bag_quantity",
	"distributors",
] as const;

export type InternalProductField = (typeof INTERNAL_PRODUCT_FIELDS)[number];
export type ExternalProductField = (typeof EXTERNAL_PRODUCT_FIELDS)[number];

export interface InternalProduct {
	sparkys_product_name: string; // unique identifier
	product_type: string;
	sparkys_color: string;
	texture: string;
	shape: string;
	occasions: string[]; // multiple occasions
	products: string[]; // comma-separated list of barcodes
	threshold_quantity: number; // minimum stock threshold
}

export interface ExternalProduct {
	unique_id_sku: string; // barcode - unique identifier
	manufacturer_color: string;
	brand: string;
	size: string;
	bag_quantity: number;
	distributors: string[]; // multiple distributors
	quantity: number;
}

// Spreadsheet representations with comma-separated arrays
export interface InternalProductSheet {
	sparkys_product_name: string;
	product_type: string;
	sparkys_color: string;
	texture: string;
	shape: string;
	occasions: string; // comma-separated
	products: string; // comma-separated barcodes
	threshold_quantity: number;
}

export interface ExternalProductSheet {
	unique_id_sku: string;
	manufacturer_color: string;
	brand: string;
	size: string;
	bag_quantity: number;
	distributors: string; // comma-separated
	quantity: number;
}

// Utility functions for parsing comma-separated values
export function parseCommaSeparated(value: string): string[] {
	if (!value || value.trim() === "") return [];
	return value.split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
}

export function formatCommaSeparated(values: string[]): string {
	return values
		.map((value) => (value.includes(",") ? `"${value}"` : value))
		.join(",");
}

// Convert between sheet and app models
export function convertInternalProductSheetToModel(
	sheet: InternalProductSheet,
): InternalProduct {
	return {
		sparkys_product_name: sheet.sparkys_product_name,
		product_type: sheet.product_type,
		sparkys_color: sheet.sparkys_color,
		texture: sheet.texture,
		shape: sheet.shape,
		occasions: parseCommaSeparated(sheet.occasions),
		products: parseCommaSeparated(sheet.products),
		threshold_quantity: sheet.threshold_quantity,
	};
}

export function convertInternalProductModelToSheet(
	internal: InternalProduct,
): InternalProductSheet {
	return {
		sparkys_product_name: internal.sparkys_product_name,
		product_type: internal.product_type,
		sparkys_color: internal.sparkys_color,
		texture: internal.texture,
		shape: internal.shape,
		occasions: formatCommaSeparated(internal.occasions),
		products: formatCommaSeparated(internal.products),
		threshold_quantity: internal.threshold_quantity,
	};
}

export function convertExternalProductSheetToModel(
	sheet: ExternalProductSheet,
): ExternalProduct {
	return {
		unique_id_sku: sheet.unique_id_sku,
		manufacturer_color: sheet.manufacturer_color,
		brand: sheet.brand,
		size: sheet.size,
		bag_quantity: sheet.bag_quantity,
		distributors: parseCommaSeparated(sheet.distributors),
		quantity: sheet.quantity,
	};
}

export function convertExternalProductModelToSheet(
	external: ExternalProduct,
): ExternalProductSheet {
	return {
		unique_id_sku: external.unique_id_sku,
		manufacturer_color: external.manufacturer_color,
		brand: external.brand,
		size: external.size,
		bag_quantity: external.bag_quantity,
		distributors: formatCommaSeparated(external.distributors),
		quantity: external.quantity,
	};
}

export function getInternalProductTotalQuantity(
	internalProduct: InternalProduct,
	externalProducts: ExternalProduct[],
): number {
	return externalProducts
		.filter((ext) => internalProduct.products.includes(ext.unique_id_sku))
		.reduce((total, ext) => total + ext.quantity, 0);
}

// Helper to get external products for an internal product
export function getExternalProductsForInternal(
	internalProduct: InternalProduct,
	externalProducts: ExternalProduct[],
): ExternalProduct[] {
	return externalProducts.filter((ext) =>
		internalProduct.products.includes(ext.unique_id_sku),
	);
}

// Helper to get quantity color based on threshold
export function getQuantityColor(
	quantity: number,
	thresholdQuantity: number,
): "red" | "blue" | "green" {
	if (quantity < thresholdQuantity) {
		return "red";
	} else if (quantity <= thresholdQuantity * 1.25) {
		return "blue";
	} else {
		return "green";
	}
}

export const BALLOON_PRODUCTS: Product[] = [
	{
		id: "8901234567890",
		name: "Red Heart Birthday Balloon",
		productType: "Latex Balloons",
		occasion: "Birthday",
		color: "Red",
		manufacturer: "Qualatex",
		size: '11"',
		texture: "Matte",
		quantity: 18,
		bagQuantity: 100,
	},
	{
		id: "8901234567891",
		name: "Gold Wedding Foil Number",
		productType: "Foil Balloons",
		occasion: "Wedding",
		color: "Gold",
		manufacturer: "Anagram",
		size: '40"',
		texture: "Metallic",
		quantity: 71,
		bagQuantity: 20,
	},
	{
		id: "8901234567892",
		name: "Pink Baby Shower Elephant",
		productType: "Foil Balloons",
		occasion: "Baby Shower",
		color: "Pink",
		manufacturer: "Betallic",
		size: '36"',
		texture: "Pearl",
		quantity: 82,
		bagQuantity: 20,
	},
	{
		id: "8901234567893",
		name: "Blue Graduation Cap",
		productType: "Foil Balloons",
		occasion: "Graduation",
		color: "Blue",
		manufacturer: "CTI",
		size: '18"',
		texture: "Matte",
		quantity: 26,
		bagQuantity: 50,
	},
	{
		id: "8901234567894",
		name: "Silver Anniversary Stars",
		productType: "Latex Balloons",
		occasion: "Anniversary",
		color: "Silver",
		manufacturer: "Qualatex",
		size: '16"',
		texture: "Chrome",
		quantity: 33,
		bagQuantity: 50,
	},
	{
		id: "8901234500006",
		name: "Christmas Tree Holiday Balloon",
		productType: "Foil Balloons",
		occasion: "Holiday",
		color: "Green",
		manufacturer: "Convergram",
		size: '18"',
		texture: "Metallic",
		quantity: 54,
		bagQuantity: 50,
	},
	{
		id: "8901234500007",
		name: "Purple Modeling Balloon Pack",
		productType: "Modeling Balloons",
		occasion: "Birthday",
		color: "Purple",
		manufacturer: "Qualatex",
		size: '9"',
		texture: "Matte",
		quantity: 34,
		bagQuantity: 100,
	},
	{
		id: "8901234500008",
		name: "Clear Bubble Wedding Balloon",
		productType: "Bubble Balloons",
		occasion: "Wedding",
		color: "White",
		manufacturer: "Betallic",
		size: '18"',
		texture: "Transparent",
		quantity: 11,
		bagQuantity: 20,
	},
	{
		id: "8901234500009",
		name: "Orange Halloween Pumpkin",
		productType: "Foil Balloons",
		occasion: "Holiday",
		color: "Orange",
		manufacturer: "Anagram",
		size: '16"',
		texture: "Matte",
		quantity: 66,
		bagQuantity: 50,
	},
	{
		id: "8901234500010",
		name: "Black Graduation 2024",
		productType: "Latex Balloons",
		occasion: "Graduation",
		color: "Black",
		manufacturer: "CTI",
		size: '11"',
		texture: "Pearl",
		quantity: 68,
		bagQuantity: 100,
	},
	{
		id: "8901234500011",
		name: "Rose Gold Baby Girl",
		productType: "Foil Balloons",
		occasion: "Baby Shower",
		color: "Pink",
		manufacturer: "Convergram",
		size: '36"',
		texture: "Chrome",
		quantity: 100,
		bagQuantity: 20,
	},
	{
		id: "8901234500012",
		name: "Red Valentine Heart",
		productType: "Latex Balloons",
		occasion: "Anniversary",
		color: "Red",
		manufacturer: "Qualatex",
		size: '16"',
		texture: "Pearl",
		quantity: 40,
		bagQuantity: 100,
	},
	{
		id: "8901234500013",
		name: "Blue Modeling Animal Kit",
		productType: "Modeling Balloons",
		occasion: "Birthday",
		color: "Blue",
		manufacturer: "Betallic",
		size: '9"',
		texture: "Matte",
		quantity: 90,
		bagQuantity: 50,
	},
	{
		id: "8901234500014",
		name: "Gold 50th Anniversary",
		productType: "Foil Balloons",
		occasion: "Anniversary",
		color: "Gold",
		manufacturer: "Anagram",
		size: '18"',
		texture: "Metallic",
		quantity: 59,
		bagQuantity: 50,
	},
	{
		id: "8901234500015",
		name: "Pink Princess Birthday",
		productType: "Latex Balloons",
		occasion: "Birthday",
		color: "Pink",
		manufacturer: "CTI",
		size: '11"',
		texture: "Pearl",
		quantity: 40,
		bagQuantity: 50,
	},
	{
		id: "8901234500016",
		name: "Green Christmas Wreath",
		productType: "Foil Balloons",
		occasion: "Holiday",
		color: "Green",
		manufacturer: "Qualatex",
		size: '18"',
		texture: "Matte",
		quantity: 27,
		bagQuantity: 20,
	},
	{
		id: "8901234500017",
		name: "White Wedding Doves",
		productType: "Latex Balloons",
		occasion: "Wedding",
		color: "White",
		manufacturer: "Betallic",
		size: '16"',
		texture: "Pearl",
		quantity: 33,
		bagQuantity: 100,
	},
	{
		id: "8901234500018",
		name: "Purple Graduation 2025",
		productType: "Foil Balloons",
		occasion: "Graduation",
		color: "Purple",
		manufacturer: "Convergram",
		size: '40"',
		texture: "Chrome",
		quantity: 50,
		bagQuantity: 20,
	},
	{
		id: "8901234500019",
		name: "Orange Tiger Modeling",
		productType: "Modeling Balloons",
		occasion: "Birthday",
		color: "Orange",
		manufacturer: "Anagram",
		size: '9"',
		texture: "Matte",
		quantity: 88,
		bagQuantity: 100,
	},
	{
		id: "8901234500020",
		name: "Silver New Year 2025",
		productType: "Latex Balloons",
		occasion: "Holiday",
		color: "Silver",
		manufacturer: "CTI",
		size: '11"',
		texture: "Chrome",
		quantity: 18,
		bagQuantity: 50,
	},
	{
		id: "8901234500021",
		name: "Blue Baby Boy Footprints",
		productType: "Foil Balloons",
		occasion: "Baby Shower",
		color: "Blue",
		manufacturer: "Qualatex",
		size: '18"',
		texture: "Metallic",
		quantity: 80,
		bagQuantity: 50,
	},
	{
		id: "8901234500022",
		name: "Red Fire Truck Birthday",
		productType: "Latex Balloons",
		occasion: "Birthday",
		color: "Red",
		manufacturer: "Betallic",
		size: '16"',
		texture: "Matte",
		quantity: 53,
		bagQuantity: 100,
	},
	{
		id: "8901234500023",
		name: "Gold Wedding Rings",
		productType: "Foil Balloons",
		occasion: "Wedding",
		color: "Gold",
		manufacturer: "Convergram",
		size: '36"',
		texture: "Chrome",
		quantity: 82,
		bagQuantity: 20,
	},
	{
		id: "8901234500024",
		name: "Green Dinosaur Modeling",
		productType: "Modeling Balloons",
		occasion: "Birthday",
		color: "Green",
		manufacturer: "Anagram",
		size: '9"',
		texture: "Matte",
		quantity: 69,
		bagQuantity: 50,
	},
	{
		id: "8901234500025",
		name: "Pink Unicorn Bubble",
		productType: "Bubble Balloons",
		occasion: "Birthday",
		color: "Pink",
		manufacturer: "CTI",
		size: '18"',
		texture: "Transparent",
		quantity: 20,
		bagQuantity: 20,
	},
	{
		id: "8901234500026",
		name: "Black Halloween Bat",
		productType: "Foil Balloons",
		occasion: "Holiday",
		color: "Black",
		manufacturer: "Qualatex",
		size: '16"',
		texture: "Matte",
		quantity: 72,
		bagQuantity: 50,
	},
	{
		id: "8901234500027",
		name: "White Dove Wedding",
		productType: "Latex Balloons",
		occasion: "Wedding",
		color: "White",
		manufacturer: "Betallic",
		size: '11"',
		texture: "Pearl",
		quantity: 64,
		bagQuantity: 50,
	},
	{
		id: "8901234500028",
		name: "Purple Congrats Grad",
		productType: "Latex Balloons",
		occasion: "Graduation",
		color: "Purple",
		manufacturer: "Convergram",
		size: '16"',
		texture: "Chrome",
		quantity: 56,
		bagQuantity: 100,
	},
	{
		id: "8901234500029",
		name: "Orange Pumpkin Halloween",
		productType: "Latex Balloons",
		occasion: "Holiday",
		color: "Orange",
		manufacturer: "Anagram",
		size: '11"',
		texture: "Matte",
		quantity: 71,
		bagQuantity: 50,
	},
	{
		id: "8901234500030",
		name: "Silver 25th Anniversary",
		productType: "Foil Balloons",
		occasion: "Anniversary",
		color: "Silver",
		manufacturer: "CTI",
		size: '18"',
		texture: "Metallic",
		quantity: 52,
		bagQuantity: 20,
	},
	{
		id: "8901234500031",
		name: "Blue Shark Modeling",
		productType: "Modeling Balloons",
		occasion: "Birthday",
		color: "Blue",
		manufacturer: "Qualatex",
		size: '9"',
		texture: "Matte",
		quantity: 59,
		bagQuantity: 100,
	},
	{
		id: "8901234500032",
		name: "Pink Baby Girl Bottle",
		productType: "Foil Balloons",
		occasion: "Baby Shower",
		color: "Pink",
		manufacturer: "Betallic",
		size: '36"',
		texture: "Pearl",
		quantity: 8,
		bagQuantity: 20,
	},
	{
		id: "8901234500033",
		name: "Red Christmas Santa",
		productType: "Latex Balloons",
		occasion: "Holiday",
		color: "Red",
		manufacturer: "Convergram",
		size: '16"',
		texture: "Matte",
		quantity: 64,
		bagQuantity: 100,
	},
	{
		id: "8901234500034",
		name: "Gold Star Graduation",
		productType: "Foil Balloons",
		occasion: "Graduation",
		color: "Gold",
		manufacturer: "Anagram",
		size: '40"',
		texture: "Chrome",
		quantity: 10,
		bagQuantity: 20,
	},
	{
		id: "8901234500035",
		name: "Green Lucky Shamrock",
		productType: "Latex Balloons",
		occasion: "Holiday",
		color: "Green",
		manufacturer: "CTI",
		size: '11"',
		texture: "Pearl",
		quantity: 35,
		bagQuantity: 50,
	},
	{
		id: "8901234500036",
		name: "White Angel Wings",
		productType: "Foil Balloons",
		occasion: "Anniversary",
		color: "White",
		manufacturer: "Qualatex",
		size: '18"',
		texture: "Metallic",
		quantity: 16,
		bagQuantity: 50,
	},
	{
		id: "8901234500037",
		name: "Purple Butterfly Modeling",
		productType: "Modeling Balloons",
		occasion: "Birthday",
		color: "Purple",
		manufacturer: "Betallic",
		size: '9"',
		texture: "Matte",
		quantity: 87,
		bagQuantity: 50,
	},
	{
		id: "8901234500038",
		name: "Orange Basketball Sports",
		productType: "Latex Balloons",
		occasion: "Birthday",
		color: "Orange",
		manufacturer: "Convergram",
		size: '16"',
		texture: "Matte",
		quantity: 82,
		bagQuantity: 100,
	},
	{
		id: "8901234500039",
		name: "Black Elegant Anniversary",
		productType: "Latex Balloons",
		occasion: "Anniversary",
		color: "Black",
		manufacturer: "Anagram",
		size: '11"',
		texture: "Chrome",
		quantity: 9,
		bagQuantity: 50,
	},
	{
		id: "8901234500040",
		name: "Blue Baby Boy Rattle",
		productType: "Foil Balloons",
		occasion: "Baby Shower",
		color: "Blue",
		manufacturer: "CTI",
		size: '18"',
		texture: "Pearl",
		quantity: 19,
		bagQuantity: 20,
	},
	{
		id: "8901234500041",
		name: "Pink Flower Power",
		productType: "Latex Balloons",
		occasion: "Birthday",
		color: "Pink",
		manufacturer: "Qualatex",
		size: '16"',
		texture: "Pearl",
		quantity: 72,
		bagQuantity: 100,
	},
	{
		id: "8901234500042",
		name: "Silver Sparkle Wedding",
		productType: "Bubble Balloons",
		occasion: "Wedding",
		color: "Silver",
		manufacturer: "Betallic",
		size: '18"',
		texture: "Transparent",
		quantity: 35,
		bagQuantity: 50,
	},
	{
		id: "8901234500043",
		name: "Red Apple Teacher",
		productType: "Foil Balloons",
		occasion: "Graduation",
		color: "Red",
		manufacturer: "Convergram",
		size: '18"',
		texture: "Matte",
		quantity: 47,
		bagQuantity: 50,
	},
	{
		id: "8901234500044",
		name: "Green Cactus Modeling",
		productType: "Modeling Balloons",
		occasion: "Birthday",
		color: "Green",
		manufacturer: "Anagram",
		size: '9"',
		texture: "Matte",
		quantity: 68,
		bagQuantity: 100,
	},
	{
		id: "8901234500045",
		name: "Gold Turkey Thanksgiving",
		productType: "Latex Balloons",
		occasion: "Holiday",
		color: "Gold",
		manufacturer: "CTI",
		size: '11"',
		texture: "Metallic",
		quantity: 24,
		bagQuantity: 50,
	},
	{
		id: "8901234500046",
		name: "White Snowflake Winter",
		productType: "Foil Balloons",
		occasion: "Holiday",
		color: "White",
		manufacturer: "Qualatex",
		size: '16"',
		texture: "Chrome",
		quantity: 30,
		bagQuantity: 20,
	},
	{
		id: "8901234500047",
		name: "Purple Dragon Modeling",
		productType: "Modeling Balloons",
		occasion: "Birthday",
		color: "Purple",
		manufacturer: "Betallic",
		size: '9"',
		texture: "Matte",
		quantity: 23,
		bagQuantity: 50,
	},
	{
		id: "8901234500048",
		name: "Blue Ocean Bubble",
		productType: "Bubble Balloons",
		occasion: "Birthday",
		color: "Blue",
		manufacturer: "Convergram",
		size: '18"',
		texture: "Transparent",
		quantity: 11,
		bagQuantity: 20,
	},
	{
		id: "8901234500049",
		name: "Orange Sunset Anniversary",
		productType: "Latex Balloons",
		occasion: "Anniversary",
		color: "Orange",
		manufacturer: "Anagram",
		size: '16"',
		texture: "Pearl",
		quantity: 10,
		bagQuantity: 100,
	},
	{
		id: "8901234500050",
		name: "Black Tuxedo Wedding",
		productType: "Foil Balloons",
		occasion: "Wedding",
		color: "Black",
		manufacturer: "CTI",
		size: '36"',
		texture: "Matte",
		quantity: 41,
		bagQuantity: 20,
	},
];
