/// <reference types="jest" />
import * as v from "valibot";
import { InternalProductSchema } from "@/constants/Products";

const valid = {
	id: "1",
	sparkys_product_name: "Red Latex",
	product_type: "Latex Balloons",
	sparkys_color: "Red",
	texture: "Matte",
	shape: "Round",
	occasions: ["Birthday"],
	products: ["123"],
	threshold_quantity: 5,
	never_out: false,
	status: "active" as const,
};

describe("InternalProductSchema (react-hook-form resolver)", () => {
	it("accepts a valid product", () => {
		expect(v.safeParse(InternalProductSchema, valid).success).toBe(true);
	});

	it("requires a non-empty product name", () => {
		const r = v.safeParse(InternalProductSchema, {
			...valid,
			sparkys_product_name: "   ",
		});
		expect(r.success).toBe(false);
	});

	it("rejects a negative threshold", () => {
		const r = v.safeParse(InternalProductSchema, {
			...valid,
			threshold_quantity: -1,
		});
		expect(r.success).toBe(false);
	});

	it("trims the product name on parse", () => {
		const r = v.parse(InternalProductSchema, {
			...valid,
			sparkys_product_name: "  Spaced  ",
		});
		expect(r.sparkys_product_name).toBe("Spaced");
	});
});
