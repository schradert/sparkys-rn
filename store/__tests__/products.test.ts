/// <reference types="jest" />
import type { ExternalProduct, InternalProduct } from "@/constants/Products";
import {
	addExternalProduct,
	addInternalProduct,
	getAllExternalProducts,
	getAllInternalProducts,
	getExternalProductBySku,
	getInternalProductById,
	getInternalProductByName,
	setExternalProducts,
	setInternalProducts,
	subscribeToStoreChanges,
	updateInternalProduct,
} from "@/store/products";

const internal = (id: string, name: string): InternalProduct => ({
	id,
	sparkys_product_name: name,
	product_type: "",
	sparkys_color: "",
	texture: "",
	shape: "",
	occasions: [],
	products: [],
	threshold_quantity: 0,
	never_out: false,
});

const external = (sku: string): ExternalProduct => ({
	unique_id_sku: sku,
	manufacturer_color: "",
	brand: "",
	size: "",
	bag_quantity: 0,
	distributors: [],
	quantity: 0,
});

// The store is module-level singleton state; reset it before each test.
beforeEach(() => {
	setInternalProducts([]);
	setExternalProducts([]);
});

describe("internal product store", () => {
	it("adds a product and reads it back by id and name", () => {
		addInternalProduct(internal("1", "Red"));
		expect(getAllInternalProducts()).toHaveLength(1);
		expect(getInternalProductById("1")?.sparkys_product_name).toBe("Red");
		expect(getInternalProductByName("Red")?.id).toBe("1");
	});

	it("updates an existing product by id", () => {
		setInternalProducts([internal("1", "Red")]);
		updateInternalProduct("1", internal("1", "Blue"));
		expect(getInternalProductById("1")?.sparkys_product_name).toBe("Blue");
	});

	it("returns undefined for an unknown id", () => {
		expect(getInternalProductById("nope")).toBeUndefined();
	});
});

describe("external product store", () => {
	it("adds a product and reads it back by sku", () => {
		addExternalProduct(external("111"));
		expect(getAllExternalProducts()).toHaveLength(1);
		expect(getExternalProductBySku("111")?.unique_id_sku).toBe("111");
	});
});

describe("store change subscription", () => {
	it("notifies subscribers on change and stops after unsubscribe", () => {
		const listener = jest.fn();
		const unsubscribe = subscribeToStoreChanges(listener);

		addInternalProduct(internal("1", "Red"));
		expect(listener).toHaveBeenCalledTimes(1);

		unsubscribe();
		addInternalProduct(internal("2", "Blue"));
		expect(listener).toHaveBeenCalledTimes(1);
	});
});
