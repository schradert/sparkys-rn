import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { updateFieldOptions, updateMetadataItems } from "@/constants/Products";
import {
	getAllExternalProducts,
	getAllInternalProducts,
	setExternalProducts,
	setInternalProducts,
} from "@/store/products";
import {
	makeInternal,
	renderWithProviders,
	resetCameraState,
	resetSheetsMock,
	sheetsControl,
} from "../../test-support/inventory";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ theme: "light" }) }));
jest.mock("@/hooks/useSheetsData", () => ({
	useSheetsData: () =>
		require("../../test-support/inventory").sheetsControl.mock,
}));
jest.mock("expo-camera", () => {
	const { Pressable, Text } = require("react-native");
	return {
		useCameraPermissions: () => {
			const state = require("../../test-support/inventory").cameraState;
			return [state.permission, state.requestPermission];
		},
		CameraView: ({
			onBarcodeScanned,
		}: {
			onBarcodeScanned?: (e: { data: string }) => void;
		}) => (
			<Pressable
				testID="camera-view"
				onPress={() => onBarcodeScanned?.({ data: "SCAN-123" })}
			>
				<Text>camera</Text>
			</Pressable>
		),
	};
});
jest.mock("@expo/vector-icons", () => {
	const { Text } = require("react-native");
	return { Ionicons: ({ name }: { name: string }) => <Text>{name}</Text> };
});
jest.mock("@/components/AvatarDropdown", () => {
	const { Text } = require("react-native");
	return { __esModule: true, default: () => <Text>avatar</Text> };
});
jest.mock("@/components/InternalProductCard", () => {
	const { Text } = require("react-native");
	return {
		__esModule: true,
		default: ({
			internalProduct,
		}: {
			internalProduct: { sparkys_product_name: string };
		}) => <Text>{internalProduct.sparkys_product_name}</Text>,
	};
});

import Inventory from "@/app/inventory";

let alertSpy: jest.SpiedFunction<typeof Alert.alert>;

beforeEach(() => {
	jest.clearAllMocks();
	resetCameraState();
	resetSheetsMock();
	setInternalProducts([]);
	setExternalProducts([]);
	updateFieldOptions({
		productType: ["Latex Balloons"],
		manufacturer_color: ["Flaming Red"],
		sparkys_color: ["Red"],
		manufacturer: ["Qualatex"],
		size: ['11"'],
		texture: ["Matte"],
		bagQuantity: ["50"],
		shape: ["Round"],
		distributor: ["Default Distributor"],
		occasion: ["Birthday"],
	});
	updateMetadataItems({});
	alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => {
	alertSpy.mockRestore();
});

// Open the internal-product add modal from the products view.
async function openInternalAddModal() {
	await fireEvent.press(screen.getByText("add"));
}

// Fill every required internal-product field via the real collapsible sections.
async function fillInternalRequiredFields(name = "Brand New Product") {
	await fireEvent.changeText(
		screen.getByPlaceholderText("Product Name..."),
		name,
	);
	await fireEvent.press(screen.getByText("Product Type"));
	await fireEvent.press(screen.getByText("Latex Balloons"));
	await fireEvent.press(screen.getByText("Sparky's Color"));
	await fireEvent.press(screen.getByText("Red"));
	await fireEvent.press(screen.getByText("Texture"));
	await fireEvent.press(screen.getByText("Matte"));
	await fireEvent.press(screen.getByText("Shape"));
	await fireEvent.press(screen.getByText("Round"));
}

describe("Inventory — add internal product", () => {
	it("alerts when the product name is empty", async () => {
		await renderWithProviders(<Inventory />);
		await openInternalAddModal();
		await fireEvent.press(screen.getByText("checkmark"));
		expect(alertSpy).toHaveBeenCalledWith(
			"Error",
			"Please enter a product name",
		);
	});

	it("alerts on a duplicate product name", async () => {
		setInternalProducts([makeInternal({ sparkys_product_name: "Dupe" })]);
		await renderWithProviders(<Inventory />);
		await openInternalAddModal();
		await fireEvent.changeText(
			screen.getByPlaceholderText("Product Name..."),
			"  dupe ",
		);
		await fireEvent.press(screen.getByText("checkmark"));
		expect(alertSpy).toHaveBeenCalledWith(
			"Error",
			"A product with this name already exists",
		);
	});

	it("alerts for each missing required selection in turn", async () => {
		await renderWithProviders(<Inventory />);
		await openInternalAddModal();
		const name = screen.getByPlaceholderText("Product Name...");
		await fireEvent.changeText(name, "Stepwise");

		// Missing product type.
		await fireEvent.press(screen.getByText("checkmark"));
		expect(alertSpy).toHaveBeenLastCalledWith(
			"Error",
			"Please select a product type",
		);

		await fireEvent.press(screen.getByText("Product Type"));
		await fireEvent.press(screen.getByText("Latex Balloons"));
		await fireEvent.press(screen.getByText("checkmark"));
		expect(alertSpy).toHaveBeenLastCalledWith("Error", "Please select a color");

		await fireEvent.press(screen.getByText("Sparky's Color"));
		await fireEvent.press(screen.getByText("Red"));
		await fireEvent.press(screen.getByText("checkmark"));
		expect(alertSpy).toHaveBeenLastCalledWith(
			"Error",
			"Please select a texture",
		);

		await fireEvent.press(screen.getByText("Texture"));
		await fireEvent.press(screen.getByText("Matte"));
		await fireEvent.press(screen.getByText("checkmark"));
		expect(alertSpy).toHaveBeenLastCalledWith("Error", "Please select a shape");
	});

	it("creates the product and adds it to the store on success", async () => {
		await renderWithProviders(<Inventory />);
		await openInternalAddModal();
		await fillInternalRequiredFields("Brand New Product");
		// Also exercise the Never Out toggle, threshold input, and occasions multi.
		await fireEvent.press(screen.getByText("Never Out"));
		await fireEvent.changeText(screen.getByPlaceholderText("0"), "7");
		await fireEvent.press(screen.getByText("Occasions"));
		await fireEvent.press(screen.getByText("Birthday"));

		await fireEvent.press(screen.getByText("checkmark"));

		await waitFor(() =>
			expect(sheetsControl.mock.addInternalProduct).toHaveBeenCalledTimes(1),
		);
		expect(
			getAllInternalProducts().some(
				(p) => p.sparkys_product_name === "Brand New Product",
			),
		).toBe(true);
		expect(alertSpy).toHaveBeenLastCalledWith(
			"Success",
			'Internal product "Brand New Product" has been created!',
		);
	});

	it("alerts with the failure reason when the sheet add fails", async () => {
		sheetsControl.mock.addInternalProduct.mockResolvedValueOnce({
			success: false,
			error: "sheet down",
		});
		await renderWithProviders(<Inventory />);
		await openInternalAddModal();
		await fillInternalRequiredFields();
		await fireEvent.press(screen.getByText("checkmark"));
		await waitFor(() =>
			expect(alertSpy).toHaveBeenLastCalledWith("Error", "sheet down"),
		);
	});

	it("uses a generic message when the failure has no error string", async () => {
		sheetsControl.mock.addInternalProduct.mockResolvedValueOnce({
			success: false,
		});
		await renderWithProviders(<Inventory />);
		await openInternalAddModal();
		await fillInternalRequiredFields();
		await fireEvent.press(screen.getByText("checkmark"));
		await waitFor(() =>
			expect(alertSpy).toHaveBeenLastCalledWith(
				"Error",
				"Failed to add internal product",
			),
		);
	});

	it("alerts when the sheet add throws", async () => {
		sheetsControl.mock.addInternalProduct.mockRejectedValueOnce(
			new Error("boom"),
		);
		await renderWithProviders(<Inventory />);
		await openInternalAddModal();
		await fillInternalRequiredFields();
		await fireEvent.press(screen.getByText("checkmark"));
		await waitFor(() =>
			expect(alertSpy).toHaveBeenLastCalledWith(
				"Error",
				"Failed to add internal product to spreadsheet",
			),
		);
	});

	it("closes the add modal and resets the form via the cancel button", async () => {
		await renderWithProviders(<Inventory />);
		await openInternalAddModal();
		expect(screen.getByText("Add New Product")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("close"));
		expect(screen.queryByText("Add New Product")).toBeNull();
	});
});

describe("Inventory — add metadata", () => {
	async function openMetadataAddModal(viewLabel = "Product Types") {
		await fireEvent.press(screen.getByText("Products"));
		await fireEvent.press(screen.getByText(viewLabel));
		// The metadata views use the "add" icon for the add button.
		await fireEvent.press(screen.getByText("add"));
	}

	it("alerts when the metadata value is empty", async () => {
		await renderWithProviders(<Inventory />);
		await openMetadataAddModal();
		await fireEvent.press(screen.getByText("checkmark"));
		expect(alertSpy).toHaveBeenCalledWith("Error", "Please enter a value");
	});

	it("alerts when the metadata value already exists", async () => {
		await renderWithProviders(<Inventory />);
		await openMetadataAddModal();
		await fireEvent.changeText(
			screen.getByPlaceholderText(/Enter product type name/i),
			"Latex Balloons",
		);
		await fireEvent.press(screen.getByText("checkmark"));
		expect(alertSpy).toHaveBeenCalledWith("Error", "This value already exists");
	});

	it("rejects adding to the Sizes category which has no sheet", async () => {
		await renderWithProviders(<Inventory />);
		await openMetadataAddModal("Sizes");
		await fireEvent.changeText(
			screen.getByPlaceholderText(/Enter size name/i),
			'20"',
		);
		await fireEvent.press(screen.getByText("checkmark"));
		expect(alertSpy).toHaveBeenCalledWith(
			"Error",
			"Cannot add items to this category",
		);
	});

	it("adds a new metadata value on success", async () => {
		await renderWithProviders(<Inventory />);
		await openMetadataAddModal();
		await fireEvent.changeText(
			screen.getByPlaceholderText(/Enter product type name/i),
			"Bubble Balloons",
		);
		await fireEvent.press(screen.getByText("checkmark"));
		await waitFor(() =>
			expect(sheetsControl.mock.addMetadata).toHaveBeenCalledWith(
				"product_types",
				"Bubble Balloons",
			),
		);
		expect(alertSpy).toHaveBeenLastCalledWith(
			"Success",
			'"Bubble Balloons" has been added!',
		);
	});

	it("alerts the failure reason when metadata add fails", async () => {
		sheetsControl.mock.addMetadata.mockResolvedValueOnce({
			success: false,
			error: "nope",
		});
		await renderWithProviders(<Inventory />);
		await openMetadataAddModal();
		await fireEvent.changeText(
			screen.getByPlaceholderText(/Enter product type name/i),
			"Bubble Balloons",
		);
		await fireEvent.press(screen.getByText("checkmark"));
		await waitFor(() =>
			expect(alertSpy).toHaveBeenLastCalledWith("Error", "nope"),
		);
	});

	it("uses a generic message when metadata add fails with no error string", async () => {
		sheetsControl.mock.addMetadata.mockResolvedValueOnce({ success: false });
		await renderWithProviders(<Inventory />);
		await openMetadataAddModal();
		await fireEvent.changeText(
			screen.getByPlaceholderText(/Enter product type name/i),
			"Bubble Balloons",
		);
		await fireEvent.press(screen.getByText("checkmark"));
		await waitFor(() =>
			expect(alertSpy).toHaveBeenLastCalledWith("Error", "Failed to add item"),
		);
	});

	it("alerts when metadata add throws", async () => {
		sheetsControl.mock.addMetadata.mockRejectedValueOnce(new Error("x"));
		await renderWithProviders(<Inventory />);
		await openMetadataAddModal();
		await fireEvent.changeText(
			screen.getByPlaceholderText(/Enter product type name/i),
			"Bubble Balloons",
		);
		await fireEvent.press(screen.getByText("checkmark"));
		await waitFor(() =>
			expect(alertSpy).toHaveBeenLastCalledWith(
				"Error",
				"Failed to add item to spreadsheet",
			),
		);
	});

	it.each([
		["External Colors", "manufacturer_colors", "New MColor"],
		["Internal Colors", "sparkys_colors", "New SColor"],
		["Brands", "brands", "New Brand"],
		["Textures", "textures", "New Texture"],
		["Bag Quantities", "bag_quantities", "999"],
		["Shapes", "shapes", "New Shape"],
		["Distributors", "distributors", "New Dist"],
		["Occasions", "occasions", "New Occasion"],
	])("adds metadata in the %s view with the right sheet name", async (label, sheet, value) => {
		// Each case drives one metadata view so handleAddMetadata's fieldKey
		// ladder and getSheetNameForMetadata switch are each exercised.
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("Products"));
		await fireEvent.press(screen.getByText(label));
		await fireEvent.press(screen.getByText("add"));
		const input = screen.getByPlaceholderText(
			new RegExp(`Enter ${label.slice(0, -1).toLowerCase()} name`, "i"),
		);
		await fireEvent.changeText(input, value);
		await fireEvent.press(screen.getByText("checkmark"));
		await waitFor(() =>
			expect(sheetsControl.mock.addMetadata).toHaveBeenLastCalledWith(
				sheet,
				value,
			),
		);
	});
});

describe("Inventory — store-derived helpers", () => {
	it("keeps the external store empty until an external product is added", async () => {
		await renderWithProviders(<Inventory />);
		expect(getAllExternalProducts()).toHaveLength(0);
	});
});
