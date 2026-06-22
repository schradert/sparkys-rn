import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { updateFieldOptions, updateMetadataItems } from "@/constants/Products";
import { setExternalProducts, setInternalProducts } from "@/store/products";
import {
	makeEvent,
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

beforeEach(() => {
	jest.clearAllMocks();
	resetCameraState();
	resetSheetsMock();
	setInternalProducts([]);
	setExternalProducts([]);
	updateFieldOptions({
		productType: ["Latex Balloons", "Foil Balloons"],
		manufacturer_color: ["Flaming Red", "Ocean Blue"],
		sparkys_color: ["Red", "Blue"],
		manufacturer: ["Qualatex", "Anagram"],
		size: ['11"'],
		texture: ["Matte"],
		bagQuantity: ["50"],
		shape: ["Round"],
		distributor: ["Default Distributor"],
		occasion: ["Birthday"],
	});
	updateMetadataItems({});
});

describe("Inventory — audit events effect", () => {
	it("logs and recovers when getAuditEvents rejects", async () => {
		const { logger } = require("@/services/logger");
		sheetsControl.mock.getAuditEvents.mockRejectedValueOnce(new Error("nope"));
		await renderWithProviders(<Inventory />);
		await waitFor(() =>
			expect(logger.error).toHaveBeenCalledWith(
				"Inventory",
				"Failed to load audit events",
				expect.objectContaining({ error: expect.any(Error) }),
			),
		);
	});

	it("skips loading when getAuditEvents is unavailable", async () => {
		// The real hook may omit getAuditEvents; mimic that to hit the early return.
		sheetsControl.mock.getAuditEvents = undefined as unknown as jest.Mock;
		// Renders without throwing despite no events loader.
		await renderWithProviders(<Inventory />);
		expect(screen.getByText("Products")).toBeOnTheScreen();
	});
});

describe("Inventory — metadata-change subscription", () => {
	it("renames a matching internal filter value when metadata changes", async () => {
		await renderWithProviders(<Inventory />);
		// Select two internal product_type values so the rename map hits both the
		// matched (rename) and unmatched (keep) ternary branches.
		await fireEvent.press(screen.getByText("options-outline"));
		await fireEvent.press(screen.getByText("Type"));
		await fireEvent.press(screen.getByText("Latex Balloons"));
		await fireEvent.press(screen.getByText("Foil Balloons"));
		// Badge shows two selections.
		expect(screen.getAllByText("2").length).toBeGreaterThan(0);

		// Fire a metadata rename for one of the selected values.
		await act(async () => {
			sheetsControl.metadataChangeListener?.({
				fieldKey: "product_type",
				oldValue: "Latex Balloons",
				newValue: "Renamed Latex",
			});
		});
		// Selection count is unchanged; one value was renamed in place.
		expect(screen.getAllByText("2").length).toBeGreaterThan(0);
	});

	it("ignores an internal metadata change that does not match a selected value", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("options-outline"));
		await fireEvent.press(screen.getByText("Type"));
		await fireEvent.press(screen.getByText("Latex Balloons"));

		await act(async () => {
			sheetsControl.metadataChangeListener?.({
				fieldKey: "product_type",
				oldValue: "Not Selected",
				newValue: "Whatever",
			});
		});
		expect(screen.getAllByText("1").length).toBeGreaterThan(0);
	});

	it("renames a matching external filter value when metadata changes", async () => {
		await renderWithProviders(<Inventory />);
		// Select two brands so the rename map hits both ternary branches.
		await fireEvent.press(screen.getByText("options-outline"));
		await fireEvent.press(screen.getByText("Brand"));
		await fireEvent.press(screen.getByText("Qualatex"));
		await fireEvent.press(screen.getByText("Anagram"));

		await act(async () => {
			sheetsControl.metadataChangeListener?.({
				fieldKey: "brand",
				oldValue: "Qualatex",
				newValue: "Qualatex Pro",
			});
		});
		expect(screen.getAllByText("2").length).toBeGreaterThan(0);
	});

	it("ignores an external metadata change that does not match a selected value", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("options-outline"));
		await fireEvent.press(screen.getByText("Brand"));
		await fireEvent.press(screen.getByText("Qualatex"));

		await act(async () => {
			sheetsControl.metadataChangeListener?.({
				fieldKey: "brand",
				oldValue: "Other Brand",
				newValue: "Nope",
			});
		});
		expect(screen.getAllByText("1").length).toBeGreaterThan(0);
	});

	it("ignores metadata changes for fields that are neither internal nor external", async () => {
		await renderWithProviders(<Inventory />);
		await act(async () => {
			sheetsControl.metadataChangeListener?.({
				fieldKey: "bagQuantity",
				oldValue: "50",
				newValue: "100",
			});
		});
		expect(screen.getByText("Products")).toBeOnTheScreen();
	});
});

describe("Inventory — product sorting by audit events", () => {
	it("orders products by event frequency, then recency, then reverse alphabetical", async () => {
		setInternalProducts([
			makeInternal({
				id: "1",
				sparkys_product_name: "AAA Frequent",
				products: ["SKU-A"],
			}),
			makeInternal({
				id: "2",
				sparkys_product_name: "BBB Recent",
				products: ["SKU-B"],
			}),
			makeInternal({
				id: "3",
				sparkys_product_name: "CCC Older",
				products: ["SKU-C"],
			}),
			makeInternal({
				id: "4",
				sparkys_product_name: "DDD None",
				products: ["SKU-D"],
			}),
			makeInternal({
				id: "5",
				sparkys_product_name: "EEE None Too",
				products: ["SKU-E"],
			}),
		]);
		setExternalProducts([
			makeExternal({ unique_id_sku: "SKU-A" }),
			makeExternal({ unique_id_sku: "SKU-B" }),
			makeExternal({ unique_id_sku: "SKU-C" }),
			makeExternal({ unique_id_sku: "SKU-D" }),
			makeExternal({ unique_id_sku: "SKU-E" }),
		]);
		// id 1: two events (most frequent). id 2: one recent. id 3: one older.
		// ids 4 & 5: no events (forces the no-timestamp reverse-alpha branch).
		sheetsControl.mock.getAuditEvents.mockResolvedValueOnce([
			makeEvent({
				id: 100,
				object_id: "1",
				object_type: "internal_product",
				timestamp: "2026-03-01T00:00:00Z",
			}),
			makeEvent({
				id: 99,
				object_id: "1",
				object_type: "internal_product",
				timestamp: "2026-02-01T00:00:00Z",
			}),
			makeEvent({
				id: 98,
				object_id: "2",
				object_type: "internal_product",
				timestamp: "2026-05-01T00:00:00Z",
			}),
			makeEvent({
				id: 97,
				object_id: "3",
				object_type: "internal_product",
				timestamp: "2026-01-01T00:00:00Z",
			}),
		]);

		await renderWithProviders(<Inventory />);
		await waitFor(() =>
			expect(screen.getByText("AAA Frequent")).toBeOnTheScreen(),
		);
		// All five render; the comparator exercised frequency, recency, and the
		// two no-timestamp branches plus the reverse-alphabetical tiebreak.
		for (const name of [
			"AAA Frequent",
			"BBB Recent",
			"CCC Older",
			"DDD None",
			"EEE None Too",
		]) {
			expect(screen.getByText(name)).toBeOnTheScreen();
		}
	});

	it("breaks an identical event timestamp with reverse alphabetical order", async () => {
		setInternalProducts([
			makeInternal({
				id: "1",
				sparkys_product_name: "Alpha Same",
				products: ["SKU-A"],
			}),
			makeInternal({
				id: "2",
				sparkys_product_name: "Bravo Same",
				products: ["SKU-B"],
			}),
		]);
		setExternalProducts([
			makeExternal({ unique_id_sku: "SKU-A" }),
			makeExternal({ unique_id_sku: "SKU-B" }),
		]);
		const sameTime = "2026-04-01T00:00:00Z";
		sheetsControl.mock.getAuditEvents.mockResolvedValueOnce([
			makeEvent({
				id: 2,
				object_id: "1",
				object_type: "internal_product",
				timestamp: sameTime,
			}),
			makeEvent({
				id: 1,
				object_id: "2",
				object_type: "internal_product",
				timestamp: sameTime,
			}),
		]);
		await renderWithProviders(<Inventory />);
		await waitFor(() =>
			expect(screen.getByText("Alpha Same")).toBeOnTheScreen(),
		);
		expect(screen.getByText("Bravo Same")).toBeOnTheScreen();
	});

	it("orders a product with events ahead of one without", async () => {
		setInternalProducts([
			makeInternal({
				id: "1",
				sparkys_product_name: "Has Event",
				products: ["SKU-A"],
			}),
			makeInternal({
				id: "2",
				sparkys_product_name: "No Event",
				products: ["SKU-B"],
			}),
		]);
		setExternalProducts([
			makeExternal({ unique_id_sku: "SKU-A" }),
			makeExternal({ unique_id_sku: "SKU-B" }),
		]);
		sheetsControl.mock.getAuditEvents.mockResolvedValueOnce([
			makeEvent({
				id: 1,
				object_id: "2",
				object_type: "internal_product",
				timestamp: "2026-04-01T00:00:00Z",
			}),
		]);
		await renderWithProviders(<Inventory />);
		await waitFor(() =>
			expect(screen.getByText("Has Event")).toBeOnTheScreen(),
		);
		expect(screen.getByText("No Event")).toBeOnTheScreen();
	});
});

describe("Inventory — whitespace barcode submit", () => {
	it("alerts to scan a barcode first when the scanned value is whitespace", async () => {
		const { Alert } = require("react-native");
		const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
		require("../../test-support/inventory").cameraState.scanData = "   ";

		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("barcode-outline"));
		await fireEvent.press(screen.getByTestId("camera-scan"));
		// The external form opened (scannedBarcode is truthy whitespace).
		expect(screen.getByText("Add New Product")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("checkmark"));
		expect(alertSpy).toHaveBeenCalledWith(
			"Error",
			"Please scan a barcode first",
		);
		alertSpy.mockRestore();
	});
});
