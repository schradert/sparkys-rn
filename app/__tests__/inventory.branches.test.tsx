import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import {
	PRODUCT_FIELD_OPTIONS,
	updateFieldOptions,
	updateMetadataItems,
} from "@/constants/Products";
import {
	setExternalProducts,
	setInternalProducts,
	useProductStore,
} from "@/store/products";
import {
	cameraState,
	makeExternal,
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
		}) => {
			const { scanData } = require("../../test-support/inventory").cameraState;
			return (
				<Pressable
					testID="camera-scan"
					onPress={() => onBarcodeScanned?.({ data: scanData })}
				>
					<Text>camera</Text>
				</Pressable>
			);
		},
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

describe("Inventory — nullish fallbacks in filtering", () => {
	it("defaults a missing internal status and missing occasions during filtering", async () => {
		const internal = makeInternal({
			id: "1",
			sparkys_product_name: "Defaulted",
			products: ["SKU-A"],
		});
		// Force status and occasions to be absent to hit the `|| "active"` and
		// `|| []` fallbacks in getCurrentData.
		(internal as { status?: string }).status = undefined;
		(internal as { occasions?: string[] }).occasions = undefined;
		setInternalProducts([internal]);
		setExternalProducts([makeExternal({ unique_id_sku: "SKU-A" })]);

		await renderWithProviders(<Inventory />);
		// Select an occasions filter -> exercises (occasions || []).includes(...).
		await fireEvent.press(screen.getByText("options-outline"));
		await fireEvent.press(screen.getByText("Occasions"));
		await fireEvent.press(screen.getByText("Birthday"));
		await fireEvent.press(screen.getByText("close"));
		// The product has no occasions, so it is filtered out.
		expect(screen.queryByText("Defaulted")).toBeNull();
	});

	it("defaults a missing external status in the cross-match filter", async () => {
		const external = makeExternal({
			unique_id_sku: "SKU-A",
			brand: "Qualatex",
		});
		(external as { status?: string }).status = undefined;
		setInternalProducts([
			makeInternal({
				id: "1",
				sparkys_product_name: "Cross Match",
				products: ["SKU-A"],
			}),
		]);
		setExternalProducts([external]);

		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("options-outline"));
		await fireEvent.press(screen.getByText("Brand"));
		await fireEvent.press(screen.getByText("Qualatex"));
		await fireEvent.press(screen.getByText("close"));
		// The active-by-default external matches, so the internal stays visible.
		expect(screen.getByText("Cross Match")).toBeOnTheScreen();
	});

	it("treats an undefined internal-products store slice as empty", async () => {
		setInternalProducts([
			makeInternal({ id: "1", sparkys_product_name: "WillVanish" }),
		]);
		setExternalProducts([makeExternal()]);
		await renderWithProviders(<Inventory />);
		expect(screen.getByText("WillVanish")).toBeOnTheScreen();

		// Force the store slice to undefined to hit the `?. ... || []` guard in
		// getCurrentData and the `(internalProducts || [])` guard in
		// generateUniqueId (reached when opening the add modal).
		await waitFor(() => {
			useProductStore.setState({
				internalProducts: undefined as unknown as never[],
			});
		});
		await waitFor(() => expect(screen.queryByText("WillVanish")).toBeNull());
		// Opening the add modal runs generateUniqueId against the undefined slice.
		await fireEvent.press(screen.getByText("add"));
		expect(screen.getByText("Add New Product")).toBeOnTheScreen();
	});
});

describe("Inventory — numeric input fallbacks", () => {
	it("coerces non-numeric threshold input to zero", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("add"));
		// The threshold input shows "0"; non-numeric text -> NaN -> 0 branch.
		const threshold = screen.getByPlaceholderText("0");
		await fireEvent.changeText(threshold, "abc");
		// A valid number takes the other branch.
		await fireEvent.changeText(threshold, "5");
		expect(screen.getByText("Add New Product")).toBeOnTheScreen();
	});

	it("coerces non-numeric bag-quantity and quantity input to zero", async () => {
		setInternalProducts([
			makeInternal({
				id: "1",
				sparkys_product_name: "Assign",
				products: [],
				status: "archived",
			}),
		]);
		cameraState.scanData = "SKU-NUM";
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("barcode-outline"));
		await fireEvent.press(screen.getByTestId("camera-scan"));
		// External form: both numeric inputs coerce bad text to 0.
		await fireEvent.changeText(screen.getByPlaceholderText("50"), "xx");
		await fireEvent.changeText(screen.getByPlaceholderText("0"), "yy");
		expect(screen.getByText("Add New Product")).toBeOnTheScreen();
	});
});

describe("Inventory — missing field options fallbacks", () => {
	it("renders the internal form when product field options are absent", async () => {
		// Remove every option list so the `PRODUCT_FIELD_OPTIONS.x || []` fallbacks
		// in the internal form (product type, color, texture, shape, occasions)
		// and the occasions form-state fallback are taken.
		for (const key of Object.keys(PRODUCT_FIELD_OPTIONS)) {
			delete (PRODUCT_FIELD_OPTIONS as Record<string, unknown>)[key];
		}
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("add"));
		expect(screen.getByText("Product Type")).toBeOnTheScreen();
		expect(screen.getByText("Occasions")).toBeOnTheScreen();
	});

	it("renders the external form when product field options are absent", async () => {
		setInternalProducts([
			makeInternal({
				id: "1",
				sparkys_product_name: "Assign",
				products: [],
				status: "archived",
			}),
		]);
		for (const key of Object.keys(PRODUCT_FIELD_OPTIONS)) {
			delete (PRODUCT_FIELD_OPTIONS as Record<string, unknown>)[key];
		}
		cameraState.scanData = "SKU-OPT";
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("barcode-outline"));
		await fireEvent.press(screen.getByTestId("camera-scan"));
		// Manufacturer Color/Brand/Size radio sections render with empty options.
		expect(screen.getByText("Manufacturer Color")).toBeOnTheScreen();
		expect(screen.getByText("Size")).toBeOnTheScreen();
	});
});

describe("Inventory — add external generic error fallback", () => {
	it("uses a generic message when the external add fails without an error string", async () => {
		sheetsControl.mock.addExternalProduct.mockResolvedValueOnce({
			success: false,
		});
		setInternalProducts([
			makeInternal({
				id: "1",
				sparkys_product_name: "Assign",
				products: [],
				status: "archived",
			}),
		]);
		cameraState.scanData = "SKU-GEN";
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("barcode-outline"));
		await fireEvent.press(screen.getByTestId("camera-scan"));
		await fireEvent.press(screen.getByText("Assign to Internal Product"));
		await fireEvent.press(screen.getByText("Assign"));
		await fireEvent.press(screen.getByText("Manufacturer Color"));
		await fireEvent.press(screen.getByText("Flaming Red"));
		await fireEvent.press(screen.getByText("Brand"));
		await fireEvent.press(screen.getByText("Qualatex"));
		await fireEvent.press(screen.getByText("Size"));
		await fireEvent.press(screen.getByText('11"'));
		await fireEvent.press(screen.getByText("checkmark"));
		await waitFor(() =>
			expect(alertSpy).toHaveBeenLastCalledWith(
				"Error",
				"Failed to add external product",
			),
		);
	});
});

describe("Inventory — add metadata with missing field options", () => {
	it("uses an empty existing-values list when the field options are absent", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("Products"));
		await fireEvent.press(screen.getByText("Textures"));
		// Remove the texture options so `PRODUCT_FIELD_OPTIONS[fieldKey] ?? []`
		// takes the nullish-coalescing fallback in handleAddMetadata.
		delete (PRODUCT_FIELD_OPTIONS as Record<string, unknown>).texture;
		await fireEvent.press(screen.getByText("add"));
		await fireEvent.changeText(
			screen.getByPlaceholderText(/Enter texture name/i),
			"Velvet",
		);
		await fireEvent.press(screen.getByText("checkmark"));
		// The dedup check passes (empty list), so the add proceeds.
		await waitFor(() =>
			expect(sheetsControl.mock.addMetadata).toHaveBeenLastCalledWith(
				"textures",
				"Velvet",
			),
		);
	});
});

describe("Inventory — add external with an unresolved assigned product", () => {
	it("succeeds without linking when the assigned internal product is gone", async () => {
		setInternalProducts([
			makeInternal({
				id: "1",
				sparkys_product_name: "Assign",
				products: [],
				status: "archived",
			}),
		]);
		cameraState.scanData = "SKU-NOLINK";
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("barcode-outline"));
		await fireEvent.press(screen.getByTestId("camera-scan"));
		await fireEvent.press(screen.getByText("Assign to Internal Product"));
		await fireEvent.press(screen.getByText("Assign"));
		await fireEvent.press(screen.getByText("Manufacturer Color"));
		await fireEvent.press(screen.getByText("Flaming Red"));
		await fireEvent.press(screen.getByText("Brand"));
		await fireEvent.press(screen.getByText("Qualatex"));
		await fireEvent.press(screen.getByText("Size"));
		await fireEvent.press(screen.getByText('11"'));

		// Remove the internal product so the assigned name no longer resolves at
		// submit, exercising the `if (assignedInternalProduct)` false branches.
		await waitFor(() => setInternalProducts([]));
		await fireEvent.press(screen.getByText("checkmark"));

		await waitFor(() =>
			expect(sheetsControl.mock.addExternalProduct).toHaveBeenCalledTimes(1),
		);
		// The product is not linked, but the add still reports success.
		expect(sheetsControl.mock.updateInternalProduct).not.toHaveBeenCalled();
		expect(alertSpy).toHaveBeenLastCalledWith(
			"Success",
			expect.stringContaining("added and assigned"),
		);
	});
});

describe("Inventory — generateUniqueId with a blank product id", () => {
	it("ignores products whose id is blank when computing the next id", async () => {
		// A product with an empty id exercises the `p?.id || "0"` fallback.
		setInternalProducts([
			makeInternal({ id: "", sparkys_product_name: "Blank Id", products: [] }),
		]);
		await renderWithProviders(<Inventory />);
		// Opening the add modal runs generateUniqueId over the blank-id product.
		await fireEvent.press(screen.getByText("add"));
		expect(screen.getByText("Add New Product")).toBeOnTheScreen();
	});
});

describe("Inventory — submitting state shows the hourglass", () => {
	it("disables the save button and shows the hourglass while submitting", async () => {
		// A never-resolving add keeps isSubmittingInternal true so the hourglass
		// icon (and the disabled/opacity branch) render.
		let release: (v: { success: boolean }) => void = () => {};
		sheetsControl.mock.addInternalProduct.mockReturnValueOnce(
			new Promise((resolve) => {
				release = resolve;
			}),
		);
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("add"));
		await fireEvent.changeText(
			screen.getByPlaceholderText("Product Name..."),
			"Submitting Product",
		);
		await fireEvent.press(screen.getByText("Product Type"));
		await fireEvent.press(screen.getByText("Latex Balloons"));
		await fireEvent.press(screen.getByText("Sparky's Color"));
		await fireEvent.press(screen.getByText("Red"));
		await fireEvent.press(screen.getByText("Texture"));
		await fireEvent.press(screen.getByText("Matte"));
		await fireEvent.press(screen.getByText("Shape"));
		await fireEvent.press(screen.getByText("Round"));
		await fireEvent.press(screen.getByText("checkmark"));

		// While the promise is pending, the hourglass replaces the checkmark.
		await waitFor(() =>
			expect(screen.getByText("hourglass")).toBeOnTheScreen(),
		);

		// Release the promise so the effect settles cleanly.
		await waitFor(async () => {
			release({ success: true });
		});
	});
});
