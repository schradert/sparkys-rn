import { fireEvent, screen } from "@testing-library/react-native";
import { updateFieldOptions, updateMetadataItems } from "@/constants/Products";
import { setExternalProducts, setInternalProducts } from "@/store/products";
import {
	makeExternal,
	makeInternal,
	renderWithProviders,
	resetCameraState,
	resetSheetsMock,
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
// Render only the product name so card-internal metadata pills don't collide
// with filter-section option labels in queries. The screen's render-item
// closure (which computes filtered externals) still runs before this renders.
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

function seedMetadata() {
	updateFieldOptions({
		productType: ["Latex Balloons", "Foil Balloons"],
		manufacturer_color: ["Flaming Red", "Ocean Blue"],
		sparkys_color: ["Red", "Blue"],
		manufacturer: ["Qualatex", "Anagram"],
		size: ['11"', '16"'],
		texture: ["Matte", "Pearl"],
		bagQuantity: ["50"],
		shape: ["Round", "Heart"],
		distributor: ["Default Distributor", "Other Dist"],
		occasion: ["Birthday", "Wedding"],
	});
	updateMetadataItems({
		productType: [
			{ name: "Latex Balloons", status: "active" },
			{ name: "Foil Balloons", status: "active" },
		],
	});
}

beforeEach(() => {
	jest.clearAllMocks();
	resetCameraState();
	resetSheetsMock();
	setInternalProducts([]);
	setExternalProducts([]);
	seedMetadata();
});

describe("Inventory — filter modal toggles", () => {
	it("opens the filter modal and toggles understocked and both show-archived switches", async () => {
		await renderWithProviders(<Inventory />);
		// Open the inventory filter modal (options icon in products view).
		await fireEvent.press(screen.getByText("options-outline"));
		expect(screen.getByText("Filter Inventory")).toBeOnTheScreen();

		// Understocked toggle -> contributes 1 to the badge.
		await fireEvent.press(screen.getByText("Understocked Items"));

		// Two "Show Archived Items" rows: internal then external.
		const archived = screen.getAllByText("Show Archived Items");
		expect(archived).toHaveLength(2);
		await fireEvent.press(archived[0]);
		await fireEvent.press(archived[1]);

		// Badge now reflects 3 boolean selections (header + modal both show it).
		expect(screen.getAllByText("3").length).toBeGreaterThan(0);
	});

	it("selects internal and external array filters and clears them all", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("options-outline"));

		// Expand the internal "Type" section and pick an option.
		await fireEvent.press(screen.getByText("Type"));
		await fireEvent.press(screen.getByText("Latex Balloons"));

		// Expand the external "Brand" section and pick an option.
		await fireEvent.press(screen.getByText("Brand"));
		await fireEvent.press(screen.getByText("Qualatex"));

		// Two array selections -> badge "2".
		expect(screen.getAllByText("2").length).toBeGreaterThan(0);

		// Clear All resets every filter; the button disappears afterwards.
		await fireEvent.press(screen.getByText("Clear All"));
		expect(screen.queryByText("Clear All")).toBeNull();
	});

	it("toggles a selected pill off again via the array filter", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("options-outline"));
		await fireEvent.press(screen.getByText("Type"));
		// Select then deselect the same option (covers the include->remove branch).
		await fireEvent.press(screen.getByText("Latex Balloons"));
		await fireEvent.press(screen.getByText("Latex Balloons"));
		expect(screen.queryByText("Clear All")).toBeNull();
	});

	it("closes the filter modal with the close button", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("options-outline"));
		expect(screen.getByText("Filter Inventory")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("close"));
		// Modal content is gone (Modal with visible=false unmounts children).
		expect(screen.queryByText("Filter Inventory")).toBeNull();
	});

	it("searches within an expanded filter section and clears the query", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("options-outline"));
		// Expand the "Type" section to reveal its search box.
		await fireEvent.press(screen.getByText("Type"));
		const search = screen.getByPlaceholderText("Search type...");

		// A matching query keeps the matching option visible (fuzzyMatch hit).
		await fireEvent.changeText(search, "latex");
		expect(screen.getByText("Latex Balloons")).toBeOnTheScreen();
		expect(screen.queryByText("Foil Balloons")).toBeNull();

		// A non-matching query shows the empty-results message.
		await fireEvent.changeText(search, "zzz");
		expect(screen.getByText(/No results found for "zzz"/)).toBeOnTheScreen();

		// The clear-search button resets the query and restores all options.
		await fireEvent.press(screen.getByText("close-circle"));
		expect(screen.getByText("Latex Balloons")).toBeOnTheScreen();
		expect(screen.getByText("Foil Balloons")).toBeOnTheScreen();
	});

	it("shows the +N more pill for a collapsed section with selections", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("options-outline"));
		// Select an option in "Type", then collapse the section. After selection
		// the header text becomes "Type" + "(1)", so collapse via a prefix match.
		await fireEvent.press(screen.getByText("Type"));
		await fireEvent.press(screen.getByText("Latex Balloons"));
		await fireEvent.press(screen.getByText(/^Type/));
		// Collapsed with one of two options selected -> "+1 more".
		expect(screen.getByText("+1 more")).toBeOnTheScreen();
		// Pressing it re-expands the section.
		await fireEvent.press(screen.getByText("+1 more"));
		expect(screen.getByPlaceholderText("Search type...")).toBeOnTheScreen();
	});
});

describe("Inventory — metadata filter modal", () => {
	it("toggles show-archived for metadata views and clears it", async () => {
		await renderWithProviders(<Inventory />);
		// Switch to a metadata view first.
		await fireEvent.press(screen.getByText("Products"));
		await fireEvent.press(screen.getByText("Product Types"));

		// Open the metadata filter modal.
		await fireEvent.press(screen.getByText("options-outline"));
		expect(screen.getByText(/Filter ProductTypes/)).toBeOnTheScreen();

		// Enable show-archived -> badge "1" appears.
		await fireEvent.press(screen.getByText("Show Archived Items"));
		expect(screen.getAllByText("1").length).toBeGreaterThan(0);

		// Clear All turns it back off.
		await fireEvent.press(screen.getByText("Clear All"));
		expect(screen.queryByText("Clear All")).toBeNull();

		// Close the metadata filter modal.
		await fireEvent.press(screen.getByText("close"));
		expect(screen.queryByText(/Filter ProductTypes/)).toBeNull();
	});
});

describe("Inventory — product filtering logic", () => {
	it("filters out products that do not match the understocked toggle", async () => {
		// Product A is understocked (qty 2 < threshold 10); product B is stocked.
		setInternalProducts([
			makeInternal({
				id: "1",
				sparkys_product_name: "Understocked One",
				products: ["SKU-A"],
				threshold_quantity: 10,
			}),
			makeInternal({
				id: "2",
				sparkys_product_name: "Stocked Two",
				products: ["SKU-B"],
				threshold_quantity: 1,
			}),
		]);
		setExternalProducts([
			makeExternal({ unique_id_sku: "SKU-A", quantity: 2 }),
			makeExternal({ unique_id_sku: "SKU-B", quantity: 50 }),
		]);

		await renderWithProviders(<Inventory />);
		expect(screen.getByText("Understocked One")).toBeOnTheScreen();
		expect(screen.getByText("Stocked Two")).toBeOnTheScreen();

		await fireEvent.press(screen.getByText("options-outline"));
		await fireEvent.press(screen.getByText("Understocked Items"));
		await fireEvent.press(screen.getByText("close"));

		expect(screen.getByText("Understocked One")).toBeOnTheScreen();
		expect(screen.queryByText("Stocked Two")).toBeNull();
	});

	it("hides archived products unless show-archived is enabled", async () => {
		setInternalProducts([
			makeInternal({ id: "1", sparkys_product_name: "Active One" }),
			makeInternal({
				id: "2",
				sparkys_product_name: "Archived Two",
				products: ["SKU-B"],
				status: "archived",
			}),
		]);
		setExternalProducts([
			makeExternal({ unique_id_sku: "SKU-A" }),
			makeExternal({ unique_id_sku: "SKU-B" }),
		]);

		await renderWithProviders(<Inventory />);
		// Archived hidden by default.
		expect(screen.getByText("Active One")).toBeOnTheScreen();
		expect(screen.queryByText("Archived Two")).toBeNull();

		await fireEvent.press(screen.getByText("options-outline"));
		await fireEvent.press(screen.getAllByText("Show Archived Items")[0]);
		await fireEvent.press(screen.getByText("close"));

		expect(screen.getByText("Archived Two")).toBeOnTheScreen();
	});

	it("filters by a selected product_type and an occasions selection", async () => {
		setInternalProducts([
			makeInternal({
				id: "1",
				sparkys_product_name: "Latex Birthday",
				product_type: "Latex Balloons",
				occasions: ["Birthday"],
			}),
			makeInternal({
				id: "2",
				sparkys_product_name: "Foil Wedding",
				product_type: "Foil Balloons",
				occasions: ["Wedding"],
				products: ["SKU-B"],
			}),
		]);
		setExternalProducts([
			makeExternal({ unique_id_sku: "SKU-A" }),
			makeExternal({ unique_id_sku: "SKU-B" }),
		]);

		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("options-outline"));

		// Type = Latex Balloons.
		await fireEvent.press(screen.getByText("Type"));
		await fireEvent.press(screen.getByText("Latex Balloons"));
		// Occasions = Birthday.
		await fireEvent.press(screen.getByText("Occasions"));
		await fireEvent.press(screen.getByText("Birthday"));
		await fireEvent.press(screen.getByText("close"));

		expect(screen.getByText("Latex Birthday")).toBeOnTheScreen();
		expect(screen.queryByText("Foil Wedding")).toBeNull();
	});

	it("keeps internal products only when a related external matches the external filter", async () => {
		// Both internal products match internal filters (none set), but the
		// external brand filter only matches product A's external.
		setInternalProducts([
			makeInternal({
				id: "1",
				sparkys_product_name: "Has Qualatex",
				products: ["SKU-A"],
			}),
			makeInternal({
				id: "2",
				sparkys_product_name: "Has Anagram",
				products: ["SKU-B"],
			}),
		]);
		setExternalProducts([
			makeExternal({ unique_id_sku: "SKU-A", brand: "Qualatex" }),
			makeExternal({ unique_id_sku: "SKU-B", brand: "Anagram" }),
		]);

		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("options-outline"));
		await fireEvent.press(screen.getByText("Brand"));
		await fireEvent.press(screen.getByText("Qualatex"));
		await fireEvent.press(screen.getByText("close"));

		expect(screen.getByText("Has Qualatex")).toBeOnTheScreen();
		expect(screen.queryByText("Has Anagram")).toBeNull();
	});

	it("filters internal products by an external distributors selection", async () => {
		setInternalProducts([
			makeInternal({
				id: "1",
				sparkys_product_name: "Dist X Product",
				products: ["SKU-A"],
			}),
			makeInternal({
				id: "2",
				sparkys_product_name: "Dist Y Product",
				products: ["SKU-B"],
			}),
		]);
		setExternalProducts([
			makeExternal({
				unique_id_sku: "SKU-A",
				distributors: ["Default Distributor"],
			}),
			makeExternal({ unique_id_sku: "SKU-B", distributors: ["Other Dist"] }),
		]);

		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("options-outline"));
		await fireEvent.press(screen.getByText("Distributors"));
		await fireEvent.press(screen.getByText("Default Distributor"));
		await fireEvent.press(screen.getByText("close"));

		expect(screen.getByText("Dist X Product")).toBeOnTheScreen();
		expect(screen.queryByText("Dist Y Product")).toBeNull();
	});

	it("excludes archived externals from the external-filter cross match by default", async () => {
		setInternalProducts([
			makeInternal({
				id: "1",
				sparkys_product_name: "Only Archived External",
				products: ["SKU-A"],
			}),
		]);
		setExternalProducts([
			makeExternal({
				unique_id_sku: "SKU-A",
				brand: "Qualatex",
				status: "archived",
			}),
		]);

		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("options-outline"));
		await fireEvent.press(screen.getByText("Brand"));
		await fireEvent.press(screen.getByText("Qualatex"));
		await fireEvent.press(screen.getByText("close"));

		// The only related external is archived, so the internal product drops out.
		expect(screen.queryByText("Only Archived External")).toBeNull();
	});

	it("includes archived externals in the cross match when external show-archived is on", async () => {
		setInternalProducts([
			makeInternal({
				id: "1",
				sparkys_product_name: "Archived But Shown",
				products: ["SKU-A"],
			}),
		]);
		setExternalProducts([
			makeExternal({
				unique_id_sku: "SKU-A",
				brand: "Qualatex",
				status: "archived",
			}),
		]);

		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("options-outline"));
		// Enable external show-archived (second row), then filter by brand.
		await fireEvent.press(screen.getAllByText("Show Archived Items")[1]);
		await fireEvent.press(screen.getByText("Brand"));
		await fireEvent.press(screen.getByText("Qualatex"));
		await fireEvent.press(screen.getByText("close"));

		expect(screen.getByText("Archived But Shown")).toBeOnTheScreen();
	});
});
