import { valibotResolver } from "@hookform/resolvers/valibot";
import { useForm } from "react-hook-form";
import {
	type InternalProduct,
	InternalProductSchema,
} from "@/constants/Products";

const EMPTY_INTERNAL_PRODUCT: InternalProduct = {
	id: "",
	sparkys_product_name: "",
	product_type: "",
	sparkys_color: "",
	texture: "",
	shape: "",
	occasions: [],
	products: [],
	threshold_quantity: 0,
	never_out: false,
	status: "active",
};

/**
 * react-hook-form setup for editing an InternalProduct, validated by the
 * valibot InternalProductSchema. Replaces the hand-rolled `editedProduct`
 * useState + per-field `setEditedProduct` spreads in the product form.
 *
 * Adopt in the screen with `Controller` per input, e.g.:
 *   const { control, handleSubmit, reset } = useInternalProductForm(product);
 *   <Controller control={control} name="sparkys_product_name"
 *     render={({ field }) => <TextInput value={field.value} onChangeText={field.onChange} />} />
 *   <Button onPress={handleSubmit(onSave)} />
 *
 * Field-level edits use `setValue`/`field.onChange` (no full re-init), so text
 * inputs keep focus — unlike replacing the whole object on every keystroke.
 */
export function useInternalProductForm(initial?: Partial<InternalProduct>) {
	return useForm<InternalProduct>({
		resolver: valibotResolver(InternalProductSchema),
		defaultValues: { ...EMPTY_INTERNAL_PRODUCT, ...initial },
		mode: "onChange",
	});
}
