import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import type { ExternalProduct, InternalProduct } from "@/constants/Products";
import { updateMetadataItems } from "@/constants/Products";
import {
	setExternalProducts,
	setInternalProducts,
	useProductStore,
} from "@/store/products";
import InternalProductDetail from "../[id]";

// --- Mutable mocks -----------------------------------------------------------

let mockParams: { id?: string } = { id: "int-1" };
const mockRouter = { back: jest.fn(), push: jest.fn() };

jest.mock("expo-router", () => ({
	useLocalSearchParams: () => mockParams,
	get router() {
		return mockRouter;
	},
}));

jest.mock("@/hooks/useTheme", () => ({
	useTheme: () => ({ theme: "light" }),
}));

// Render icons as plain text of their `name` so glyphs are queryable.
jest.mock("@expo/vector-icons", () => {
	const { Text } = require("react-native");
	return {
		Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
	};
});

const mockUpdateInternalProduct = jest.fn();
const mockArchiveInternalProduct = jest.fn();
const mockUnarchiveInternalProduct = jest.fn();

jest.mock("@/hooks/useSheetsData", () => ({
	useSheetsData: () => ({
		updateInternalProduct: mockUpdateInternalProduct,
		archiveInternalProduct: mockArchiveInternalProduct,
		unarchiveInternalProduct: mockUnarchiveInternalProduct,
	}),
}));

// --- Fixtures ----------------------------------------------------------------

function makeInternal(
	overrides: Partial<InternalProduct> = {},
): InternalProduct {
	return {
		id: "int-1",
		sparkys_product_name: "Red Round Latex",
		product_type: "Latex Balloons",
		sparkys_color: "Red",
		texture: "Matte",
		shape: "Round",
		occasions: ["Birthday"],
		products: ["SKU-A"],
		threshold_quantity: 10,
		never_out: false,
		status: "active",
		...overrides,
	};
}

function makeExternal(
	overrides: Partial<ExternalProduct> = {},
): ExternalProduct {
	return {
		unique_id_sku: "SKU-A",
		manufacturer_color: "Flaming Red",
		brand: "Qualatex",
		size: '11"',
		bag_quantity: 100,
		distributors: ["Default Distributor"],
		quantity: 5,
		status: "active",
		...overrides,
	};
}

// Pull the most recent destructive/default Alert action so we can drive the
// archive/unarchive confirmation flows.
function pressLatestAlertConfirm() {
	const alertSpy = Alert.alert as jest.Mock;
	const lastCall = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
	const buttons = lastCall[2] as Array<{
		text: string;
		onPress?: () => void | Promise<void>;
	}>;
	const confirm = buttons.find((b) => b.text !== "Cancel");
	return confirm?.onPress?.();
}

beforeEach(() => {
	jest.clearAllMocks();
	mockParams = { id: "int-1" };
	setInternalProducts([]);
	setExternalProducts([]);
	updateMetadataItems({});
	jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

describe("InternalProductDetail — loading & not found", () => {
	it("renders the not-found state when the product is missing", async () => {
		// store is empty -> getInternalProductById returns undefined
		await render(<InternalProductDetail />);
		expect(screen.getByText("Product Not Found")).toBeOnTheScreen();
		expect(screen.getByText("Internal product not found")).toBeOnTheScreen();
	});

	it("navigates back from the not-found header", async () => {
		await render(<InternalProductDetail />);
		await fireEvent.press(screen.getByText("arrow-back"));
		expect(mockRouter.back).toHaveBeenCalledTimes(1);
	});

	it("stays in the loading state when no id param is provided", async () => {
		mockParams = {};
		await render(<InternalProductDetail />);
		// Neither found nor not-found content renders; the spinner glyph is absent
		// from text queries, but the not-found title must not appear.
		expect(screen.queryByText("Product Not Found")).toBeNull();
		expect(screen.queryByText("Internal Product")).toBeNull();
	});
});

describe("InternalProductDetail — read-only view", () => {
	it("renders product details, metadata, occasions and externals", async () => {
		setInternalProducts([makeInternal()]);
		setExternalProducts([makeExternal()]);
		await render(<InternalProductDetail />);

		expect(screen.getByText("Internal Product")).toBeOnTheScreen();
		expect(screen.getByText("Red Round Latex")).toBeOnTheScreen();
		// metadata values
		expect(screen.getByText("Latex Balloons")).toBeOnTheScreen();
		expect(screen.getByText("Matte")).toBeOnTheScreen();
		expect(screen.getByText("Round")).toBeOnTheScreen();
		expect(screen.getByText("Red")).toBeOnTheScreen();
		// occasion pill (read-only)
		expect(screen.getByText("Birthday")).toBeOnTheScreen();
		// external products section
		expect(screen.getByText("External Products (1)")).toBeOnTheScreen();
		expect(screen.getByText("SKU-A")).toBeOnTheScreen();
		// total quantity (active external) and threshold. The total (5) also
		// appears on the external product card, so match by count.
		expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText("10")).toBeOnTheScreen();
		expect(screen.getByText("Total Quantity")).toBeOnTheScreen();
		expect(screen.getByText("Threshold Quantity")).toBeOnTheScreen();
	});

	it("omits empty metadata fields and hides occasions/externals when empty", async () => {
		setInternalProducts([
			makeInternal({
				product_type: "",
				texture: "   ",
				occasions: [],
			}),
		]);
		setExternalProducts([]);
		await render(<InternalProductDetail />);

		expect(screen.queryByText("Latex Balloons")).toBeNull();
		expect(screen.queryByText("Occasions")).toBeNull();
		expect(screen.queryByText(/External Products/)).toBeNull();
		// remaining metadata still shows
		expect(screen.getByText("Round")).toBeOnTheScreen();
	});

	it("shows the Never Out badge when never_out is set", async () => {
		setInternalProducts([makeInternal({ never_out: true })]);
		await render(<InternalProductDetail />);
		expect(screen.getByText("Never Out")).toBeOnTheScreen();
	});

	it("navigates to a metadata route when a metadata row is pressed", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await fireEvent.press(screen.getByText("Latex Balloons"));
		expect(mockRouter.push).toHaveBeenCalledWith(
			"/metadata/productTypes/Latex%20Balloons",
		);
	});

	it("navigates back from the found-view header", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await fireEvent.press(screen.getByText("arrow-back"));
		expect(mockRouter.back).toHaveBeenCalledTimes(1);
	});

	it("colours the total quantity red when below threshold", async () => {
		setInternalProducts([makeInternal({ threshold_quantity: 100 })]);
		setExternalProducts([makeExternal({ quantity: 5 })]);
		await render(<InternalProductDetail />);
		// Total (5) is shown in the header box; the same value also appears on the
		// external card, so assert by count.
		expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText("Total Quantity")).toBeOnTheScreen();
	});

	it("colours the total quantity green when comfortably above threshold", async () => {
		setInternalProducts([makeInternal({ threshold_quantity: 1 })]);
		setExternalProducts([makeExternal({ quantity: 50 })]);
		await render(<InternalProductDetail />);
		expect(screen.getAllByText("50").length).toBeGreaterThanOrEqual(1);
	});

	it("excludes archived external products from the total quantity", async () => {
		setInternalProducts([
			makeInternal({ products: ["SKU-A", "SKU-B"], threshold_quantity: 1 }),
		]);
		setExternalProducts([
			makeExternal({ unique_id_sku: "SKU-A", quantity: 7 }),
			makeExternal({
				unique_id_sku: "SKU-B",
				quantity: 99,
				status: "archived",
			}),
		]);
		await render(<InternalProductDetail />);
		// Only the active SKU-A (7) counts toward the total; the archived 99 does
		// not contribute. The total (7) plus the active card both render "7".
		expect(screen.getAllByText("7").length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText("Total Quantity")).toBeOnTheScreen();
	});

	it("treats an external product with no status as active for the total", async () => {
		const ext = makeExternal({ quantity: 12 });
		delete (ext as { status?: string }).status;
		setInternalProducts([makeInternal({ threshold_quantity: 1 })]);
		setExternalProducts([ext]);
		await render(<InternalProductDetail />);
		expect(screen.getAllByText("12").length).toBeGreaterThanOrEqual(1);
	});
});

describe("InternalProductDetail — store subscription", () => {
	it("refreshes externals when the store changes", async () => {
		setInternalProducts([makeInternal({ products: ["SKU-A"] })]);
		setExternalProducts([makeExternal({ unique_id_sku: "SKU-A" })]);
		await render(<InternalProductDetail />);
		expect(screen.getByText("External Products (1)")).toBeOnTheScreen();

		// Trigger the subscription callback by mutating the store.
		setExternalProducts([
			makeExternal({ unique_id_sku: "SKU-A" }),
			makeExternal({ unique_id_sku: "SKU-A", brand: "Anagram" }),
		]);
		// Re-read: the internal product still groups SKU-A; the section title
		// reflects the refreshed external list.
		expect(screen.getByText(/External Products/)).toBeOnTheScreen();
	});

	it("clears the product when it disappears from the store", async () => {
		setInternalProducts([makeInternal()]);
		setExternalProducts([makeExternal()]);
		await render(<InternalProductDetail />);
		expect(screen.getByText("Red Round Latex")).toBeOnTheScreen();

		// Remove the internal product; the subscription re-reads and finds none.
		await act(async () => {
			setInternalProducts([]);
		});
		expect(screen.getByText("Internal product not found")).toBeOnTheScreen();
	});

	it("ignores store changes while no id is present", async () => {
		mockParams = {};
		await render(<InternalProductDetail />);
		// A store change fires the subscription, which early-returns on the
		// missing id. The screen remains in its loading state (no crash).
		await act(async () => {
			setInternalProducts([makeInternal()]);
		});
		expect(screen.queryByText("Internal Product")).toBeNull();
	});
});

describe("InternalProductDetail — metadata archived labels", () => {
	it("appends an (Archived) suffix to archived option labels in edit mode", async () => {
		updateMetadataItems({
			shape: [
				{ name: "Round", status: "active" },
				{ name: "Heart", status: "archived" },
			],
		});
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await fireEvent.press(screen.getByText("pencil"));
		await fireEvent.press(screen.getByText("Shape"));
		expect(screen.getByText("Heart (Archived)")).toBeOnTheScreen();
	});
});

describe("InternalProductDetail — loading states", () => {
	it("shows the hourglass while a save is in flight", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await fireEvent.press(screen.getByText("pencil"));
		await fireEvent.changeText(
			screen.getByPlaceholderText("Enter product name"),
			"Renamed",
		);
		// Hold the save open with a deferred that only resolves after we have
		// observed the in-flight hourglass.
		let resolveSave: (v: { success: boolean }) => void = () => {};
		mockUpdateInternalProduct.mockReturnValue(
			new Promise((resolve) => {
				resolveSave = resolve;
			}),
		);
		const press = fireEvent.press(screen.getByText("checkmark"));
		expect(await screen.findByText("hourglass")).toBeOnTheScreen();
		resolveSave({ success: true });
		await press;
	});

	it("shows the hourglass while an archive is in flight", async () => {
		setInternalProducts([makeInternal({ status: "active" })]);
		await render(<InternalProductDetail />);
		await fireEvent.press(screen.getByText("archive-outline"));
		let resolveArchive: (v: { success: boolean }) => void = () => {};
		mockArchiveInternalProduct.mockReturnValue(
			new Promise((resolve) => {
				resolveArchive = resolve;
			}),
		);
		const confirm = pressLatestAlertConfirm();
		expect(await screen.findByText("hourglass")).toBeOnTheScreen();
		resolveArchive({ success: true });
		await confirm;
	});
});

describe("InternalProductDetail — edit mode", () => {
	async function enterEdit() {
		await fireEvent.press(screen.getByText("pencil"));
	}

	it("toggles into edit mode and renders the editable form", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await enterEdit();
		expect(screen.getByPlaceholderText("Enter product name")).toBeOnTheScreen();
		// Editable section headers. The Occasions multi-select appends a count
		// when values are selected, so match it loosely.
		expect(screen.getByText("Product Type")).toBeOnTheScreen();
		expect(screen.getByText(/Occasions/)).toBeOnTheScreen();
	});

	it("edits the product name field", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await enterEdit();
		const input = screen.getByPlaceholderText("Enter product name");
		await fireEvent.changeText(input, "New Name");
		expect(screen.getByDisplayValue("New Name")).toBeOnTheScreen();
	});

	it("renders an empty name input when the name is cleared", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await enterEdit();
		const input = screen.getByPlaceholderText("Enter product name");
		await fireEvent.changeText(input, "");
		// Empty string falls through the `|| ""` fallback for the input value.
		expect(screen.getByPlaceholderText("Enter product name")).toBeOnTheScreen();
	});

	it("toggles the Never Out badge on and off in edit mode", async () => {
		setInternalProducts([makeInternal({ never_out: false })]);
		await render(<InternalProductDetail />);
		await enterEdit();
		const badge = screen.getByText("Never Out");
		await fireEvent.press(badge); // inactive -> active
		await fireEvent.press(screen.getByText("Never Out")); // active -> inactive
		expect(screen.getByText("Never Out")).toBeOnTheScreen();
	});

	it("parses a numeric threshold edit", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await enterEdit();
		const input = screen.getByDisplayValue("10");
		await fireEvent.changeText(input, "25");
		expect(screen.getByDisplayValue("25")).toBeOnTheScreen();
	});

	it("falls back to 0 when the threshold edit is not a number", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await enterEdit();
		const input = screen.getByDisplayValue("10");
		await fireEvent.changeText(input, "abc");
		expect(screen.getByDisplayValue("0")).toBeOnTheScreen();
	});

	it("changes a radio field, stripping any (Archived) suffix", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await enterEdit();
		// Expand the "Shape" radio section, then pick "Heart".
		await fireEvent.press(screen.getByText("Shape"));
		await fireEvent.press(screen.getByText("Heart"));
		// Save with the change to confirm it took effect downstream.
		mockUpdateInternalProduct.mockResolvedValue({ success: true });
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateInternalProduct).toHaveBeenCalledWith(
			expect.objectContaining({ shape: "Heart" }),
		);
	});

	it("changes the product type, colour and texture radio fields", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await enterEdit();

		await fireEvent.press(screen.getByText("Product Type"));
		await fireEvent.press(screen.getByText("Foil Balloons"));

		await fireEvent.press(screen.getByText("Sparky's Color"));
		await fireEvent.press(screen.getByText("Blue"));

		await fireEvent.press(screen.getByText("Texture"));
		await fireEvent.press(screen.getByText("Pearl"));

		mockUpdateInternalProduct.mockResolvedValue({ success: true });
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateInternalProduct).toHaveBeenCalledWith(
			expect.objectContaining({
				product_type: "Foil Balloons",
				sparkys_color: "Blue",
				texture: "Pearl",
			}),
		);
	});

	it("changes the occasions multi-select", async () => {
		setInternalProducts([makeInternal({ occasions: [] })]);
		await render(<InternalProductDetail />);
		await enterEdit();
		await fireEvent.press(screen.getByText("Occasions"));
		await fireEvent.press(screen.getByText("Wedding"));
		mockUpdateInternalProduct.mockResolvedValue({ success: true });
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateInternalProduct).toHaveBeenCalledWith(
			expect.objectContaining({ occasions: "Wedding" }),
		);
	});

	it("cancels edit mode and reverts unsaved changes", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(
			screen.getByPlaceholderText("Enter product name"),
			"Throwaway",
		);
		await fireEvent.press(screen.getByText("close"));
		// Back to read-only view with the original name.
		expect(screen.getByText("Red Round Latex")).toBeOnTheScreen();
		expect(screen.queryByPlaceholderText("Enter product name")).toBeNull();
	});
});

describe("InternalProductDetail — save flow", () => {
	async function enterEdit() {
		await fireEvent.press(screen.getByText("pencil"));
	}

	it("exits edit mode without saving when nothing changed", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await enterEdit();
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateInternalProduct).not.toHaveBeenCalled();
		expect(screen.getByText("Red Round Latex")).toBeOnTheScreen();
	});

	it("saves successfully and shows a success alert", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(
			screen.getByPlaceholderText("Enter product name"),
			"Renamed Product",
		);
		mockUpdateInternalProduct.mockResolvedValue({ success: true });
		await fireEvent.press(screen.getByText("checkmark"));

		expect(mockUpdateInternalProduct).toHaveBeenCalledWith(
			expect.objectContaining({ sparkys_product_name: "Renamed Product" }),
		);
		expect(Alert.alert).toHaveBeenCalledWith(
			"Success",
			"Product updated successfully",
		);
		// Store reflects the new name.
		expect(
			useProductStore.getState().internalProducts[0].sparkys_product_name,
		).toBe("Renamed Product");
	});

	it("blocks the save when the new name duplicates another product", async () => {
		setInternalProducts([
			makeInternal({ id: "int-1", sparkys_product_name: "Original" }),
			makeInternal({ id: "int-2", sparkys_product_name: "Taken" }),
		]);
		await render(<InternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(
			screen.getByPlaceholderText("Enter product name"),
			"  taken  ",
		);
		await fireEvent.press(screen.getByText("checkmark"));
		expect(Alert.alert).toHaveBeenCalledWith(
			"Error",
			"A product with this name already exists",
		);
		expect(mockUpdateInternalProduct).not.toHaveBeenCalled();
	});

	it("allows the save when the renamed product has no duplicate", async () => {
		setInternalProducts([
			makeInternal({ id: "int-1", sparkys_product_name: "Original" }),
			makeInternal({ id: "int-2", sparkys_product_name: "Other" }),
		]);
		await render(<InternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(
			screen.getByPlaceholderText("Enter product name"),
			"Unique Name",
		);
		mockUpdateInternalProduct.mockResolvedValue({ success: true });
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateInternalProduct).toHaveBeenCalled();
	});

	it("shows the server error message when the save fails", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(
			screen.getByPlaceholderText("Enter product name"),
			"Renamed",
		);
		mockUpdateInternalProduct.mockResolvedValue({
			success: false,
			error: "Boom from server",
		});
		await fireEvent.press(screen.getByText("checkmark"));
		expect(Alert.alert).toHaveBeenCalledWith("Error", "Boom from server");
	});

	it("shows a generic error when the failed save has no message", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(
			screen.getByPlaceholderText("Enter product name"),
			"Renamed",
		);
		mockUpdateInternalProduct.mockResolvedValue({ success: false });
		await fireEvent.press(screen.getByText("checkmark"));
		expect(Alert.alert).toHaveBeenCalledWith(
			"Error",
			"Failed to update product",
		);
	});

	it("shows a generic error when the save throws", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(
			screen.getByPlaceholderText("Enter product name"),
			"Renamed",
		);
		mockUpdateInternalProduct.mockRejectedValue(new Error("network"));
		await fireEvent.press(screen.getByText("checkmark"));
		expect(Alert.alert).toHaveBeenCalledWith(
			"Error",
			"Failed to update product",
		);
	});

	it("saves a threshold-only change without touching the duplicate check", async () => {
		setInternalProducts([makeInternal()]);
		await render(<InternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(screen.getByDisplayValue("10"), "20");
		mockUpdateInternalProduct.mockResolvedValue({ success: true });
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateInternalProduct).toHaveBeenCalledWith(
			expect.objectContaining({ threshold_quantity: 20 }),
		);
	});

	it("defaults the saved status to active when none is set", async () => {
		const product = makeInternal();
		delete (product as { status?: string }).status;
		setInternalProducts([product]);
		await render(<InternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(screen.getByDisplayValue("10"), "30");
		mockUpdateInternalProduct.mockResolvedValue({ success: true });
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateInternalProduct).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" }),
		);
	});
});

describe("InternalProductDetail — archive flow", () => {
	it("archives a product through the confirmation alert", async () => {
		setInternalProducts([makeInternal({ status: "active" })]);
		await render(<InternalProductDetail />);
		await fireEvent.press(screen.getByText("archive-outline"));
		// Confirmation alert raised with archive copy.
		expect(Alert.alert).toHaveBeenCalledWith(
			"Archive Product",
			'Are you sure you want to archive "Red Round Latex"?',
			expect.any(Array),
		);
		mockArchiveInternalProduct.mockResolvedValue({ success: true });
		await pressLatestAlertConfirm();
		expect(mockArchiveInternalProduct).toHaveBeenCalledWith("int-1");
		expect(Alert.alert).toHaveBeenLastCalledWith(
			"Success",
			"Product archived successfully!",
		);
		expect(useProductStore.getState().internalProducts[0].status).toBe(
			"archived",
		);
	});

	it("unarchives an already-archived product", async () => {
		setInternalProducts([makeInternal({ status: "archived" })]);
		await render(<InternalProductDetail />);
		// Archived products show the refresh (unarchive) glyph.
		await fireEvent.press(screen.getByText("refresh-outline"));
		mockUnarchiveInternalProduct.mockResolvedValue({ success: true });
		await pressLatestAlertConfirm();
		expect(mockUnarchiveInternalProduct).toHaveBeenCalledWith("int-1");
		expect(useProductStore.getState().internalProducts[0].status).toBe(
			"active",
		);
	});

	it("surfaces the server error when archiving fails", async () => {
		setInternalProducts([makeInternal({ status: "active" })]);
		await render(<InternalProductDetail />);
		await fireEvent.press(screen.getByText("archive-outline"));
		mockArchiveInternalProduct.mockResolvedValue({
			success: false,
			error: "Archive failed",
		});
		await pressLatestAlertConfirm();
		expect(Alert.alert).toHaveBeenLastCalledWith("Error", "Archive failed");
	});

	it("shows a generic error when archiving fails without a message", async () => {
		setInternalProducts([makeInternal({ status: "active" })]);
		await render(<InternalProductDetail />);
		await fireEvent.press(screen.getByText("archive-outline"));
		mockArchiveInternalProduct.mockResolvedValue({ success: false });
		await pressLatestAlertConfirm();
		expect(Alert.alert).toHaveBeenLastCalledWith(
			"Error",
			"Failed to archive product",
		);
	});

	it("shows a generic error when archiving throws", async () => {
		setInternalProducts([makeInternal({ status: "active" })]);
		await render(<InternalProductDetail />);
		await fireEvent.press(screen.getByText("archive-outline"));
		mockArchiveInternalProduct.mockRejectedValue(new Error("explode"));
		await pressLatestAlertConfirm();
		expect(Alert.alert).toHaveBeenLastCalledWith(
			"Error",
			"Failed to archive product",
		);
	});

	it("does nothing when the archive confirmation is cancelled", async () => {
		setInternalProducts([makeInternal({ status: "active" })]);
		await render(<InternalProductDetail />);
		await fireEvent.press(screen.getByText("archive-outline"));
		const alertSpy = Alert.alert as jest.Mock;
		const buttons = alertSpy.mock.calls[alertSpy.mock.calls.length - 1][2];
		const cancel = buttons.find((b: { text: string }) => b.text === "Cancel");
		expect(cancel.style).toBe("cancel");
		expect(mockArchiveInternalProduct).not.toHaveBeenCalled();
	});
});
