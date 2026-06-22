/// <reference types="jest" />
import { type ColorScheme, Colors, toColorScheme } from "@/constants/Colors";

describe("Colors palette", () => {
	it("defines light and dark schemes", () => {
		expect(Object.keys(Colors).sort()).toEqual(["dark", "light"]);
	});

	it("shares the same color keys across schemes", () => {
		expect(Object.keys(Colors.dark).sort()).toEqual(
			Object.keys(Colors.light).sort(),
		);
	});

	it("exposes the expected palette values", () => {
		expect(Colors.light.primary).toBe("#007bff");
		expect(Colors.light.background).toBe("#ffffff");
		expect(Colors.dark.background).toBe("#000000");
		expect(Colors.dark.text).toBe("#ffffff");
	});

	it("uses valid hex color strings for every entry", () => {
		const hex = /^#[0-9a-f]{6}$/;
		for (const scheme of Object.values(Colors)) {
			for (const value of Object.values(scheme)) {
				expect(value).toMatch(hex);
			}
		}
	});
});

describe("toColorScheme", () => {
	it('returns "dark" only for the explicit "dark" value', () => {
		expect(toColorScheme("dark")).toBe("dark");
	});

	it.each<[string | null | undefined]>([
		["light"],
		["unspecified"],
		[""],
		[null],
		[undefined],
	])("coerces %p to light", (value) => {
		const scheme: ColorScheme = toColorScheme(value);
		expect(scheme).toBe("light");
	});
});
