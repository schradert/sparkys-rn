import { fireEvent, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { updateFieldOptions, updateMetadataItems } from "@/constants/Products";
import { setExternalProducts, setInternalProducts } from "@/store/products";
import {
	makeExternal,
	makeInternal,
	renderWithProviders,
	resetCameraState,
	resetSheetsMock,
	sheetsControl,
} from "../../test-support/inventory";

jest.mock("expo-router", () => ({
	router: { push: jest.fn() },
}));

jest.mock("@/hooks/useTheme", () => ({
	useTheme: () => ({ theme: "light" }),
}));

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
	return {
		Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
	};
});

// AvatarDropdown pulls in native Google Sign-in; it is not part of the
// inventory surface under test, so stub it.
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
	// Seed metadata so the metadata views and filter sections have content.
	updateFieldOptions({
		productType: ["Latex Balloons", "Foil Balloons"],
		manufacturer_color: ["Flaming Red"],
		sparkys_color: ["Red", "Blue"],
		manufacturer: ["Qualatex"],
		size: ['11"'],
		texture: ["Matte"],
		bagQuantity: ["50"],
		shape: ["Round"],
		distributor: ["Default Distributor"],
		occasion: ["Birthday"],
	});
	updateMetadataItems({
		productType: [
			{ name: "Latex Balloons", status: "active" },
			{ name: "Foil Balloons", status: "active" },
			{ name: "Retired Type", status: "archived" },
		],
		manufacturer_color: [{ name: "Flaming Red", status: "active" }],
		sparkys_color: [
			{ name: "Red", status: "active" },
			{ name: "Blue", status: "active" },
		],
		manufacturer: [{ name: "Qualatex", status: "active" }],
		size: [{ name: '11"', status: "active" }],
		texture: [{ name: "Matte", status: "active" }],
		bagQuantity: [{ name: "50", status: "active" }],
		shape: [{ name: "Round", status: "active" }],
		distributor: [{ name: "Default Distributor", status: "active" }],
		occasion: [{ name: "Birthday", status: "active" }],
	});
});

describe("Inventory — header and products view", () => {
	it("renders the products view by default with a product card", async () => {
		setInternalProducts([makeInternal()]);
		setExternalProducts([makeExternal()]);
		await renderWithProviders(<Inventory />);
		expect(screen.getByText("Products")).toBeOnTheScreen();
		expect(screen.getByText("Red Round Latex")).toBeOnTheScreen();
	});

	it("loads audit events on mount via getAuditEvents", async () => {
		await renderWithProviders(<Inventory />);
		expect(sheetsControl.mock.getAuditEvents).toHaveBeenCalledWith(1000, 0);
	});

	it("shows the loading indicator while sheets are refreshing", async () => {
		sheetsControl.mock.isRefreshing = true;
		await renderWithProviders(<Inventory />);
		expect(screen.getByText("Loading data...")).toBeOnTheScreen();
	});

	it("shows the error banner and retries on press", async () => {
		sheetsControl.mock.error = "Boom";
		await renderWithProviders(<Inventory />);
		expect(screen.getByText("Boom")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("Retry"));
		expect(sheetsControl.mock.refresh).toHaveBeenCalledTimes(1);
	});
});

describe("Inventory — view dropdown and metadata views", () => {
	it("opens the dropdown and switches to each metadata view", async () => {
		await renderWithProviders(<Inventory />);
		// Open the dropdown.
		await fireEvent.press(screen.getByText("Products"));

		const views: [string, string][] = [
			["Product Types", "Latex Balloons"],
			["External Colors", "Flaming Red"],
			["Internal Colors", "Red"],
			["Brands", "Qualatex"],
			["Sizes", '11"'],
			["Textures", "Matte"],
			["Bag Quantities", "50"],
			["Shapes", "Round"],
			["Distributors", "Default Distributor"],
			["Occasions", "Birthday"],
		];

		for (const [label, item] of views) {
			// The dropdown lists every view label; pick the option to switch.
			await fireEvent.press(screen.getByText(label));
			// The metadata card for that view should now be on screen.
			expect(screen.getByText(item)).toBeOnTheScreen();
			// Re-open the dropdown for the next iteration.
			await fireEvent.press(screen.getByText(label));
		}
	});

	it("navigates to the metadata detail when a metadata card is pressed", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("Products"));
		await fireEvent.press(screen.getByText("Product Types"));
		await fireEvent.press(screen.getByText("Latex Balloons"));
		expect(router.push).toHaveBeenCalledWith(
			"/metadata/productTypes/Latex%20Balloons",
		);
	});

	it("marks archived metadata items with an (Archived) label when shown", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("Products"));
		await fireEvent.press(screen.getByText("Product Types"));
		// Open the metadata filter modal and enable Show Archived.
		await fireEvent.press(screen.getByText("options-outline"));
		await fireEvent.press(screen.getByText("Show Archived Items"));
		await fireEvent.press(screen.getByText("close"));
		expect(screen.getByText("Retired Type (Archived)")).toBeOnTheScreen();
	});
});
