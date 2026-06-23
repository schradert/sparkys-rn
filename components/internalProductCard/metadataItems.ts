import { getFieldIcon } from "@/components/activity/eventPresentation";
import type { InternalProduct } from "@/constants/Products";

export function buildMetadataItems(internalProduct: InternalProduct) {
	return [
		{
			field: "product_type",
			value: internalProduct.product_type,
			icon: getFieldIcon("product_type"),
		},
		{
			field: "texture",
			value: internalProduct.texture,
			icon: getFieldIcon("texture"),
		},
		{
			field: "shape",
			value: internalProduct.shape,
			icon: getFieldIcon("shape"),
		},
		{
			field: "sparkys_color",
			value: internalProduct.sparkys_color,
			icon: getFieldIcon("sparkys_color"),
		},
	].filter((item) => item.value && item.value.trim() !== "");
}
