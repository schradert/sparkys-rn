import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { Alert } from "react-native";
import { updateFieldOptions, updateMetadataItems } from "@/constants/Products";
import {
	getAllExternalProducts,
	getInternalProductById,
	setExternalProducts,
	setInternalProducts,
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
			onMountError,
		}: {
			onBarcodeScanned?: (e: { data: string }) => void;
			onMountError?: (e: unknown) => void;
		}) => {
			const { scanData } = require("../../test-support/inventory").cameraState;
			return (
				<>
					<Pressable
						testID="camera-scan"
						onPress={() => onBarcodeScanned?.({ data: scanData })}
					>
						<Text>camera</Text>
					</Pressable>
					<Pressable
						testID="camera-mount-error"
						onPress={() => onMountError?.({ message: "mount fail" })}
					>
						<Text>mount-error</Text>
					</Pressable>
				</>
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
	cameraState.scanData = "SCAN-NEW";
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

describe("Inventory — barcode scanner permission gating", () => {
	it("requests permission when permission is still null", async () => {
		cameraState.permission = null;
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("barcode-outline"));
		expect(cameraState.requestPermission).toHaveBeenCalledTimes(1);
		// Scanner did not open without a granted permission.
		expect(screen.queryByText("Scan Barcode")).toBeNull();
	});

	it("alerts and offers Grant when permission is denied", async () => {
		cameraState.permission = {
			granted: false,
			canAskAgain: true,
			expires: "never",
			status: "denied",
		};
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("barcode-outline"));
		expect(alertSpy).toHaveBeenCalledWith(
			"Camera Permission",
			"We need camera permission to scan barcodes",
			[{ text: "Cancel" }, expect.objectContaining({ text: "Grant" })],
		);
		// Invoking the Grant button calls requestPermission.
		const buttons = alertSpy.mock.calls[0][2] as Array<{
			text: string;
			onPress?: () => void;
		}>;
		buttons[1].onPress?.();
		expect(cameraState.requestPermission).toHaveBeenCalledTimes(1);
	});

	it("opens the scanner when permission is granted", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("barcode-outline"));
		expect(screen.getByText("Scan Barcode")).toBeOnTheScreen();
	});

	it("closes the scanner with the close button", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("barcode-outline"));
		await fireEvent.press(screen.getByText("close"));
		expect(screen.queryByText("Scan Barcode")).toBeNull();
	});

	it("logs a camera mount error without crashing", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("barcode-outline"));
		await fireEvent.press(screen.getByTestId("camera-mount-error"));
		expect(screen.getByText("Scan Barcode")).toBeOnTheScreen();
	});
});

describe("Inventory — barcode scan handling", () => {
	it("navigates to the existing external product when the SKU is known", async () => {
		setExternalProducts([makeExternal({ unique_id_sku: "SCAN-KNOWN" })]);
		cameraState.scanData = "SCAN-KNOWN";
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("barcode-outline"));
		await fireEvent.press(screen.getByTestId("camera-scan"));
		expect(router.push).toHaveBeenCalledWith("/external-product/SCAN-KNOWN");
		// The add modal is not opened for a known SKU.
		expect(screen.queryByText("Add New Product")).toBeNull();
	});

	it("opens the external add form pre-populated for an unknown SKU", async () => {
		cameraState.scanData = "SCAN-NEW";
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("barcode-outline"));
		await fireEvent.press(screen.getByTestId("camera-scan"));
		// Add modal opens with the scanned barcode as the read-only SKU value.
		expect(screen.getByText("Add New Product")).toBeOnTheScreen();
		expect(screen.getByDisplayValue("SCAN-NEW")).toBeOnTheScreen();
	});
});

describe("Inventory — add external product", () => {
	// Scan an unknown SKU to surface the external product form.
	async function openExternalForm(sku = "SCAN-NEW") {
		cameraState.scanData = sku;
		await fireEvent.press(screen.getByText("barcode-outline"));
		await fireEvent.press(screen.getByTestId("camera-scan"));
	}

	// The assign target is seeded as archived so it stays out of the products
	// list (no card) while remaining in the assign dropdown, which maps every
	// internal product regardless of filters. That keeps option labels unique.
	function seedAssignTarget(name = "Target Internal") {
		setInternalProducts([
			makeInternal({
				id: "1",
				sparkys_product_name: name,
				products: [],
				status: "archived",
			}),
		]);
	}

	async function fillExternalRequiredFields(internalName?: string) {
		if (internalName) {
			await fireEvent.press(screen.getByText("Assign to Internal Product"));
			await fireEvent.press(screen.getByText(internalName));
		}
		await fireEvent.press(screen.getByText("Manufacturer Color"));
		await fireEvent.press(screen.getByText("Flaming Red"));
		await fireEvent.press(screen.getByText("Brand"));
		await fireEvent.press(screen.getByText("Qualatex"));
		await fireEvent.press(screen.getByText("Size"));
		await fireEvent.press(screen.getByText('11"'));
	}

	it("alerts for each missing required field in turn", async () => {
		setInternalProducts([
			makeInternal({ id: "1", sparkys_product_name: "Target Internal" }),
		]);
		await renderWithProviders(<Inventory />);
		await openExternalForm();

		// Missing manufacturer color (SKU is pre-filled from the scan).
		await fireEvent.press(screen.getByText("checkmark"));
		expect(alertSpy).toHaveBeenLastCalledWith(
			"Error",
			"Please select a manufacturer color",
		);

		await fireEvent.press(screen.getByText("Manufacturer Color"));
		await fireEvent.press(screen.getByText("Flaming Red"));
		await fireEvent.press(screen.getByText("checkmark"));
		expect(alertSpy).toHaveBeenLastCalledWith("Error", "Please select a brand");

		await fireEvent.press(screen.getByText("Brand"));
		await fireEvent.press(screen.getByText("Qualatex"));
		await fireEvent.press(screen.getByText("checkmark"));
		expect(alertSpy).toHaveBeenLastCalledWith("Error", "Please select a size");

		await fireEvent.press(screen.getByText("Size"));
		await fireEvent.press(screen.getByText('11"'));
		await fireEvent.press(screen.getByText("checkmark"));
		expect(alertSpy).toHaveBeenLastCalledWith(
			"Error",
			"Please assign this external product to an internal product",
		);
	});

	it("rejects a negative quantity", async () => {
		seedAssignTarget();
		await renderWithProviders(<Inventory />);
		await openExternalForm();
		await fillExternalRequiredFields("Target Internal");
		// The "0" placeholder belongs to the current quantity field; set it < 0.
		const currentQty = screen.getByPlaceholderText("0");
		await fireEvent.changeText(currentQty, "-5");
		await fireEvent.press(screen.getByText("checkmark"));
		expect(alertSpy).toHaveBeenLastCalledWith(
			"Error",
			"Please enter a valid quantity",
		);
	});

	it("creates the external product and links it to the assigned internal product", async () => {
		seedAssignTarget();
		await renderWithProviders(<Inventory />);
		await openExternalForm("SKU-LINK");
		await fillExternalRequiredFields("Target Internal");
		// Edit both quantity fields to exercise their onChangeText handlers.
		await fireEvent.changeText(screen.getByPlaceholderText("50"), "100");
		await fireEvent.changeText(screen.getByPlaceholderText("0"), "12");
		await fireEvent.press(screen.getByText("checkmark"));

		await waitFor(() =>
			expect(sheetsControl.mock.addExternalProduct).toHaveBeenCalledTimes(1),
		);
		// External product landed in the store.
		expect(
			getAllExternalProducts().some((e) => e.unique_id_sku === "SKU-LINK"),
		).toBe(true);
		// Internal product now references the new SKU.
		expect(getInternalProductById("1")?.products).toContain("SKU-LINK");
		expect(alertSpy).toHaveBeenLastCalledWith(
			"Success",
			'External product "SKU-LINK" added and assigned to "Target Internal"!',
		);
	});

	it("reports a partial success when linking the internal product fails", async () => {
		sheetsControl.mock.updateInternalProduct.mockResolvedValueOnce({
			success: false,
			error: "link fail",
		});
		seedAssignTarget();
		await renderWithProviders(<Inventory />);
		await openExternalForm("SKU-PARTIAL");
		await fillExternalRequiredFields("Target Internal");
		await fireEvent.press(screen.getByText("checkmark"));

		await waitFor(() =>
			expect(alertSpy).toHaveBeenLastCalledWith(
				"Partial Success",
				expect.stringContaining("failed to link"),
			),
		);
	});

	it("alerts and stops when the external add itself fails", async () => {
		sheetsControl.mock.addExternalProduct.mockResolvedValueOnce({
			success: false,
			error: "add fail",
		});
		seedAssignTarget();
		await renderWithProviders(<Inventory />);
		await openExternalForm("SKU-ADDFAIL");
		await fillExternalRequiredFields("Target Internal");
		await fireEvent.press(screen.getByText("checkmark"));

		await waitFor(() =>
			expect(alertSpy).toHaveBeenLastCalledWith("Error", "add fail"),
		);
		// Nothing was committed to the store.
		expect(getAllExternalProducts()).toHaveLength(0);
	});

	it("alerts when the external add throws", async () => {
		sheetsControl.mock.addExternalProduct.mockRejectedValueOnce(
			new Error("boom"),
		);
		seedAssignTarget();
		await renderWithProviders(<Inventory />);
		await openExternalForm("SKU-THROW");
		await fillExternalRequiredFields("Target Internal");
		await fireEvent.press(screen.getByText("checkmark"));

		await waitFor(() =>
			expect(alertSpy).toHaveBeenLastCalledWith(
				"Error",
				"Failed to add external product to spreadsheet",
			),
		);
	});
});
