import type { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import type React from "react";
import type { ExternalProduct, InternalProduct } from "@/constants/Products";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

/**
 * A single read-only metadata row: the icon, the displayed value, the label,
 * and the metadata-browse route the row links to. Every field shown in the
 * Product Details grid is clickable, so `route` is always present.
 */
export interface MetadataItem {
	field: string;
	value: string;
	icon: IoniconName;
	label: string;
	route: Href;
}

interface MetadataFieldConfig<T> {
	field: string;
	label: string;
	icon: IoniconName;
	getValue: (product: T) => string | undefined;
	getRoute: (value: string) => Href;
}

/**
 * Build the displayable metadata rows for a product from a field config table,
 * dropping any field whose value is empty/whitespace. Replaces the per-screen
 * `getIconForMetadata` / `getMetadataRoute` switch ladders with a data-driven
 * lookup over only the real, clickable fields.
 */
function buildMetadataItems<T>(
	product: T,
	configs: readonly MetadataFieldConfig<T>[],
): MetadataItem[] {
	const items: MetadataItem[] = [];
	for (const config of configs) {
		const value = config.getValue(product);
		if (value && value.trim() !== "") {
			items.push({
				field: config.field,
				value,
				icon: config.icon,
				label: config.label,
				route: config.getRoute(value),
			});
		}
	}
	return items;
}

const INTERNAL_METADATA_FIELDS: readonly MetadataFieldConfig<InternalProduct>[] =
	[
		{
			field: "product_type",
			label: "Product Type",
			icon: "shapes-outline",
			getValue: (p) => p.product_type,
			getRoute: (value) =>
				`/metadata/productTypes/${encodeURIComponent(value)}` as Href,
		},
		{
			field: "texture",
			label: "Texture",
			icon: "hand-left-outline",
			getValue: (p) => p.texture,
			getRoute: (value) =>
				`/metadata/textures/${encodeURIComponent(value)}` as Href,
		},
		{
			field: "shape",
			label: "Shape",
			icon: "diamond-outline",
			getValue: (p) => p.shape,
			getRoute: (value) =>
				`/metadata/shapes/${encodeURIComponent(value)}` as Href,
		},
		{
			field: "sparkys_color",
			label: "Sparky's Color",
			icon: "color-palette-outline",
			getValue: (p) => p.sparkys_color,
			getRoute: (value) =>
				`/metadata/colors/${encodeURIComponent(value)}` as Href,
		},
	];

const EXTERNAL_METADATA_FIELDS: readonly MetadataFieldConfig<ExternalProduct>[] =
	[
		{
			field: "manufacturer_color",
			label: "Manufacturer Color",
			icon: "color-palette-outline",
			getValue: (p) => p.manufacturer_color,
			getRoute: (value) =>
				`/metadata/colors/${encodeURIComponent(value)}` as Href,
		},
		{
			field: "brand",
			label: "Brand",
			icon: "business-outline",
			getValue: (p) => p.brand,
			getRoute: (value) =>
				`/metadata/manufacturers/${encodeURIComponent(value)}` as Href,
		},
		{
			field: "size",
			label: "Size",
			icon: "resize-outline",
			getValue: (p) => p.size,
			getRoute: (value) =>
				`/metadata/sizes/${encodeURIComponent(value)}` as Href,
		},
		{
			field: "bag_quantity",
			label: "Bag Quantity",
			icon: "bag-outline",
			getValue: (p) => p.bag_quantity?.toString(),
			getRoute: (value) =>
				`/metadata/bagQuantities/${encodeURIComponent(value)}` as Href,
		},
	];

export function getInternalMetadataItems(
	product: InternalProduct,
): MetadataItem[] {
	return buildMetadataItems(product, INTERNAL_METADATA_FIELDS);
}

export function getExternalMetadataItems(
	product: ExternalProduct,
): MetadataItem[] {
	return buildMetadataItems(product, EXTERNAL_METADATA_FIELDS);
}
