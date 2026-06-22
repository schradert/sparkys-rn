import { logger } from "@/services/logger";
import type { SheetsClient } from "./client";
import { getMetadataValues } from "./metadata";
import { getExternalProductData, getInternalProductData } from "./products";

/** Names of the active items in a metadata list. */
function activeNames(items: Array<{ name: string; status: string }>): string[] {
	return items
		.filter((item) => item.status === "active")
		.map((item) => item.name);
}

/**
 * Fetch every metadata + product sheet in parallel and assemble the combined
 * view the app consumes: active-only metadata, the full metadata (with status),
 * and the parsed product lists. Sizes are derived from external products.
 */
export async function getAllSheetsData(
	client: SheetsClient,
	accessToken: string,
) {
	try {
		const [
			productTypes,
			occasions,
			manufacturerColors,
			sparkyColors,
			brands,
			shapes,
			textures,
			distributors,
			bagQuantities,
			internalProducts,
			externalProducts,
		] = await Promise.all([
			getMetadataValues(client, "product_types", accessToken),
			getMetadataValues(client, "occasions", accessToken),
			getMetadataValues(client, "manufacturer_colors", accessToken),
			getMetadataValues(client, "sparkys_colors", accessToken),
			getMetadataValues(client, "brands", accessToken),
			getMetadataValues(client, "shapes", accessToken),
			getMetadataValues(client, "textures", accessToken),
			getMetadataValues(client, "distributors", accessToken),
			getMetadataValues(client, "bag_quantities", accessToken),
			getInternalProductData(client, accessToken),
			getExternalProductData(client, accessToken),
		]);

		const uniqueSizes = [
			...new Set(externalProducts.map((p) => p.size).filter(Boolean)),
		].sort();

		const uniqueSizesWithStatus = uniqueSizes.map((size) => ({
			name: size,
			status: "active",
		}));

		return {
			metadata: {
				productType: activeNames(productTypes),
				manufacturer_color: activeNames(manufacturerColors),
				sparkys_color: activeNames(sparkyColors),
				manufacturer: activeNames(brands),
				size: uniqueSizes,
				texture: activeNames(textures),
				bagQuantity: activeNames(bagQuantities),
				shape: activeNames(shapes),
				distributor: activeNames(distributors),
				occasion: activeNames(occasions),
			},
			fullMetadata: {
				productType: productTypes,
				manufacturer_color: manufacturerColors,
				sparkys_color: sparkyColors,
				manufacturer: brands,
				size: uniqueSizesWithStatus,
				texture: textures,
				bagQuantity: bagQuantities,
				shape: shapes,
				distributor: distributors,
				occasion: occasions,
			},
			internalProducts,
			externalProducts,
		};
	} catch (error) {
		logger.error("Sheets", "Error fetching sheets data:", error);
		throw error;
	}
}
