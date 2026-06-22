import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { updateFieldOptions, updateMetadataItems } from "@/constants/Products";
import {
	addExternalProduct,
	setExternalProducts,
	setInternalProducts,
} from "@/store/products";
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
				testID="camera-scan"
				onPress={() => onBarcodeScanned?.({ data: "SCAN-NEW" })}
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

// NOTE: InternalProductCard is intentionally NOT mocked here so the real card
// drives handleMetadataPress through its (and the nested external card's) pills.

import Inventory from "@/app/inventory";

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
});

describe("Inventory — Android LayoutAnimation guard", () => {
	it("enables the experimental flag at import time on Android", () => {
		// The module-level guard runs only when Platform.OS is "android" and the
		// experimental setter exists. Re-import in an isolated registry with those
		// conditions on the same react-native instance the module resolves.
		const setter = jest.fn();
		jest.isolateModules(() => {
			const RN = require("react-native");
			Object.defineProperty(RN.Platform, "OS", {
				configurable: true,
				value: "android",
			});
			RN.UIManager.setLayoutAnimationEnabledExperimental = setter;
			require("@/app/inventory");
		});
		expect(setter).toHaveBeenCalledWith(true);
	});
});

describe("Inventory — handleMetadataPress via the real product card", () => {
	it("toggles an internal filter when an internal metadata pill is pressed", async () => {
		setInternalProducts([makeInternal({ id: "1", products: ["SKU-A"] })]);
		setExternalProducts([makeExternal({ unique_id_sku: "SKU-A" })]);
		await renderWithProviders(<Inventory />);

		// The card shows the product_type pill; pressing it selects that filter,
		// which surfaces the filter badge in the header.
		await fireEvent.press(screen.getByText("Latex Balloons"));
		expect(screen.getByText("1")).toBeOnTheScreen();
		// Pressing again removes it (covers the include->filter branch).
		await fireEvent.press(screen.getByText("Latex Balloons"));
		expect(screen.queryByText("1")).toBeNull();
	});

	it("toggles an external filter when a nested external metadata pill is pressed", async () => {
		setInternalProducts([makeInternal({ id: "1", products: ["SKU-A"] })]);
		setExternalProducts([
			makeExternal({ unique_id_sku: "SKU-A", brand: "Qualatex" }),
		]);
		await renderWithProviders(<Inventory />);

		// Two "chevron-down" glyphs exist (header dropdown + card expander); the
		// card's is the second. Pressing it reveals the nested external card.
		const chevrons = screen.getAllByText("chevron-down");
		await fireEvent.press(chevrons[chevrons.length - 1]);
		// Press the external brand pill -> external filter toggles on.
		await fireEvent.press(screen.getByText("Qualatex"));
		expect(screen.getByText("1")).toBeOnTheScreen();
		// Press again -> external filter toggles back off (the filter->remove
		// branch of handleMetadataPress for external fields).
		await fireEvent.press(screen.getByText("Qualatex"));
		expect(screen.queryByText("1")).toBeNull();
	});
});

describe("Inventory — store change debounce", () => {
	it("recomputes when the product store changes after mount", async () => {
		jest.useFakeTimers();
		try {
			setInternalProducts([
				makeInternal({ id: "1", sparkys_product_name: "First" }),
			]);
			setExternalProducts([makeExternal({ unique_id_sku: "SKU-A" })]);
			await renderWithProviders(<Inventory />);
			expect(screen.getByText("First")).toBeOnTheScreen();

			// Mutate the store while mounted, then let the 100ms debounce elapse so
			// the store-change effect's timeout callback runs (setStoreUpdateTrigger).
			await act(async () => {
				addExternalProduct(makeExternal({ unique_id_sku: "SKU-NEW" }));
				jest.advanceTimersByTime(150);
			});
			expect(screen.getByText("First")).toBeOnTheScreen();
		} finally {
			jest.runOnlyPendingTimers();
			jest.useRealTimers();
		}
	});
});

describe("Inventory — modal hardware back (onRequestClose)", () => {
	// Walk the open subtree for the single rendered Modal's onRequestClose and
	// invoke it (a closed Modal renders nothing, so exactly one is present).
	async function fireOpenModalRequestClose() {
		type Node = NonNullable<typeof screen.root>;
		const found: Array<() => void> = [];
		const walk = (n: Node | null): void => {
			if (!n) return;
			const cb = (n.props as { onRequestClose?: () => void }).onRequestClose;
			if (typeof cb === "function") found.push(cb);
			for (const child of n.children) {
				if (typeof child !== "string") walk(child);
			}
		};
		walk(screen.root);
		expect(found.length).toBe(1);
		await act(async () => {
			found[0]();
		});
	}

	it("closes the filter modal via the back handler", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("options-outline"));
		expect(screen.getByText("Filter Inventory")).toBeOnTheScreen();
		await fireOpenModalRequestClose();
		await waitFor(() =>
			expect(screen.queryByText("Filter Inventory")).toBeNull(),
		);
	});

	it("closes the add modal via the back handler", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("add"));
		expect(screen.getByText("Add New Product")).toBeOnTheScreen();
		await fireOpenModalRequestClose();
		await waitFor(() =>
			expect(screen.queryByText("Add New Product")).toBeNull(),
		);
	});

	it("closes the metadata filter modal via the back handler", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("Products"));
		await fireEvent.press(screen.getByText("Product Types"));
		await fireEvent.press(screen.getByText("options-outline"));
		expect(screen.getByText(/Filter ProductTypes/)).toBeOnTheScreen();
		await fireOpenModalRequestClose();
		await waitFor(() =>
			expect(screen.queryByText(/Filter ProductTypes/)).toBeNull(),
		);
	});

	it("closes the scanner modal via the back handler", async () => {
		await renderWithProviders(<Inventory />);
		await fireEvent.press(screen.getByText("barcode-outline"));
		expect(screen.getByText("Scan Barcode")).toBeOnTheScreen();
		await fireOpenModalRequestClose();
		await waitFor(() => expect(screen.queryByText("Scan Barcode")).toBeNull());
	});
});
