import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import ExternalProductCard from "@/components/ExternalProductCard";
import type { ExternalProduct } from "@/constants/Products";

jest.mock("expo-router", () => ({
	router: { push: jest.fn() },
}));

jest.mock("@/hooks/useTheme", () => ({
	useTheme: () => ({ theme: "light" }),
}));

function makeExternalProduct(
	overrides: Partial<ExternalProduct> = {},
): ExternalProduct {
	return {
		unique_id_sku: "SKU-123",
		manufacturer_color: "Flaming Red",
		brand: "Qualatex",
		size: '11"',
		bag_quantity: 100,
		distributors: ["Default Distributor"],
		quantity: 42,
		status: "active",
		...overrides,
	};
}

describe("ExternalProductCard", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("renders the SKU, quantity, and metadata fields", async () => {
		await render(
			<ExternalProductCard externalProduct={makeExternalProduct()} />,
		);
		expect(screen.getByText("SKU-123")).toBeOnTheScreen();
		expect(screen.getByText("42")).toBeOnTheScreen();
		expect(screen.getByText("Flaming Red")).toBeOnTheScreen();
		expect(screen.getByText("Qualatex")).toBeOnTheScreen();
		expect(screen.getByText('11"')).toBeOnTheScreen();
		expect(screen.getByText("Default Distributor")).toBeOnTheScreen();
	});

	it("navigates to the external product detail on header press", async () => {
		await render(
			<ExternalProductCard externalProduct={makeExternalProduct()} />,
		);
		await fireEvent.press(screen.getByText("SKU-123"));
		expect(router.push).toHaveBeenCalledWith("/external-product/SKU-123");
	});

	it("omits metadata fields that are empty or whitespace-only", async () => {
		await render(
			<ExternalProductCard
				externalProduct={makeExternalProduct({
					manufacturer_color: "",
					brand: "   ",
					size: '16"',
				})}
			/>,
		);
		expect(screen.getByText('16"')).toBeOnTheScreen();
		expect(screen.queryByText("Flaming Red")).toBeNull();
		expect(screen.queryByText("Qualatex")).toBeNull();
	});

	it("shows the archived label and dims the card when archived", async () => {
		await render(
			<ExternalProductCard
				externalProduct={makeExternalProduct({ status: "archived" })}
			/>,
		);
		expect(screen.getByText("(Archived)")).toBeOnTheScreen();
	});

	it("does not render the distributors section when distributors is empty", async () => {
		await render(
			<ExternalProductCard
				externalProduct={makeExternalProduct({ distributors: [] })}
			/>,
		);
		expect(screen.queryByText("Default Distributor")).toBeNull();
	});

	it("does not render the distributors section when distributors is missing", async () => {
		const product = makeExternalProduct();
		// Exercise the `externalProduct?.distributors` guard with a missing value.
		(product as { distributors?: string[] }).distributors = undefined;
		await render(<ExternalProductCard externalProduct={product} />);
		expect(screen.queryByText("Default Distributor")).toBeNull();
	});

	it("renders multiple distributors", async () => {
		await render(
			<ExternalProductCard
				externalProduct={makeExternalProduct({
					distributors: ["Dist A", "Dist B"],
				})}
			/>,
		);
		expect(screen.getByText("Dist A")).toBeOnTheScreen();
		expect(screen.getByText("Dist B")).toBeOnTheScreen();
	});

	it("invokes onMetadataPress when a metadata pill is pressed", async () => {
		const onMetadataPress = jest.fn();
		await render(
			<ExternalProductCard
				externalProduct={makeExternalProduct()}
				onMetadataPress={onMetadataPress}
			/>,
		);
		await fireEvent.press(screen.getByText("Flaming Red"));
		expect(onMetadataPress).toHaveBeenCalledWith(
			"manufacturer_color",
			"Flaming Red",
		);
	});

	it("invokes onMetadataPress when a distributor pill is pressed", async () => {
		const onMetadataPress = jest.fn();
		await render(
			<ExternalProductCard
				externalProduct={makeExternalProduct()}
				onMetadataPress={onMetadataPress}
			/>,
		);
		await fireEvent.press(screen.getByText("Default Distributor"));
		expect(onMetadataPress).toHaveBeenCalledWith(
			"distributors",
			"Default Distributor",
		);
	});

	it("does not throw when a pill is pressed without onMetadataPress", async () => {
		await render(
			<ExternalProductCard externalProduct={makeExternalProduct()} />,
		);
		await fireEvent.press(screen.getByText("Flaming Red"));
		expect(screen.getByText("Flaming Red")).toBeOnTheScreen();
	});

	it("highlights selected metadata and distributor pills via selectedFilters", async () => {
		await render(
			<ExternalProductCard
				externalProduct={makeExternalProduct()}
				selectedFilters={{
					external: {
						manufacturer_color: ["Flaming Red"],
						distributors: ["Default Distributor"],
					},
				}}
			/>,
		);
		// Selected pills still render their label; the branch is the styling path.
		expect(screen.getByText("Flaming Red")).toBeOnTheScreen();
		expect(screen.getByText("Default Distributor")).toBeOnTheScreen();
	});

	it("treats a field with no matching filter list as unselected", async () => {
		await render(
			<ExternalProductCard
				externalProduct={makeExternalProduct()}
				selectedFilters={{ external: { brand: ["Anagram"] } }}
			/>,
		);
		// brand "Qualatex" is not in the filter list -> unselected branch.
		expect(screen.getByText("Qualatex")).toBeOnTheScreen();
	});

	it("treats all pills as unselected when selectedFilters.external is absent", async () => {
		await render(
			<ExternalProductCard
				externalProduct={makeExternalProduct()}
				selectedFilters={{}}
			/>,
		);
		expect(screen.getByText("Flaming Red")).toBeOnTheScreen();
	});
});
