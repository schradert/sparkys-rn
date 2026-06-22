import { renderHook } from "@testing-library/react-native";
import { useInternalProductForm } from "@/hooks/useInternalProductForm";

describe("useInternalProductForm", () => {
	it("defaults to an empty internal product", async () => {
		const { result } = await renderHook(() => useInternalProductForm());
		expect(result.current.getValues()).toEqual({
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
		});
	});

	it("merges initial values over the empty defaults", async () => {
		const { result } = await renderHook(() =>
			useInternalProductForm({
				sparkys_product_name: "Balloon",
				threshold_quantity: 7,
			}),
		);
		const values = result.current.getValues();
		expect(values.sparkys_product_name).toBe("Balloon");
		expect(values.threshold_quantity).toBe(7);
		expect(values.id).toBe("");
	});
});
