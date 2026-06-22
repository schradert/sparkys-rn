import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import type { ExternalProduct, InternalProduct } from "@/constants/Products";
import { updateMetadataItems } from "@/constants/Products";
import {
	setExternalProducts,
	setInternalProducts,
	useProductStore,
} from "@/store/products";
import ExternalProductDetail from "../[sku]";

// --- Mutable mocks -----------------------------------------------------------

let mockParams: { sku?: string } = { sku: "SKU-A" };
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

jest.mock("@expo/vector-icons", () => {
	const { Text } = require("react-native");
	return {
		Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
	};
});

const mockUpdateExternalProduct = jest.fn();
const mockUpdateInternalProduct = jest.fn();
const mockArchiveExternalProduct = jest.fn();
const mockUnarchiveExternalProduct = jest.fn();
const mockLogAuditEvent = jest.fn();

jest.mock("@/hooks/useSheetsData", () => ({
	useSheetsData: () => ({
		updateExternalProduct: mockUpdateExternalProduct,
		updateInternalProduct: mockUpdateInternalProduct,
		archiveExternalProduct: mockArchiveExternalProduct,
		unarchiveExternalProduct: mockUnarchiveExternalProduct,
		logAuditEvent: mockLogAuditEvent,
	}),
}));

// --- Fixtures ----------------------------------------------------------------

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
		quantity: 42,
		status: "active",
		...overrides,
	};
}

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

async function enterEdit() {
	await fireEvent.press(screen.getByText("pencil"));
}

beforeEach(() => {
	jest.clearAllMocks();
	mockParams = { sku: "SKU-A" };
	setInternalProducts([]);
	setExternalProducts([]);
	updateMetadataItems({});
	jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

describe("ExternalProductDetail — loading & not found", () => {
	it("renders the not-found state when the SKU is missing", async () => {
		await render(<ExternalProductDetail />);
		expect(screen.getByText("Product Not Found")).toBeOnTheScreen();
		expect(screen.getByText("External product not found")).toBeOnTheScreen();
	});

	it("navigates back from the not-found header", async () => {
		await render(<ExternalProductDetail />);
		await fireEvent.press(screen.getByText("arrow-back"));
		expect(mockRouter.back).toHaveBeenCalledTimes(1);
	});

	it("stays in the loading state when no sku param is provided", async () => {
		mockParams = {};
		await render(<ExternalProductDetail />);
		expect(screen.queryByText("Product Not Found")).toBeNull();
		expect(screen.queryByText("External Product")).toBeNull();
	});
});

describe("ExternalProductDetail — read-only view", () => {
	it("renders the SKU, quantity, metadata and distributors", async () => {
		setExternalProducts([makeExternal()]);
		await render(<ExternalProductDetail />);
		expect(screen.getByText("External Product")).toBeOnTheScreen();
		expect(screen.getByText("SKU-A")).toBeOnTheScreen();
		expect(screen.getByText("42")).toBeOnTheScreen();
		expect(screen.getByText("Flaming Red")).toBeOnTheScreen();
		expect(screen.getByText("Qualatex")).toBeOnTheScreen();
		expect(screen.getByText('11"')).toBeOnTheScreen();
		expect(screen.getByText("100")).toBeOnTheScreen();
		// distributors section
		expect(screen.getByText("Distributors")).toBeOnTheScreen();
		expect(screen.getByText("Default Distributor")).toBeOnTheScreen();
	});

	it("links to the grouping internal product when present", async () => {
		setInternalProducts([makeInternal({ products: ["SKU-A"] })]);
		setExternalProducts([makeExternal()]);
		await render(<ExternalProductDetail />);
		expect(
			screen.getByText("Grouped under Internal Product"),
		).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("Red Round Latex"));
		expect(mockRouter.push).toHaveBeenCalledWith("/internal-product/int-1");
	});

	it("navigates to a metadata route when a metadata row is pressed", async () => {
		setExternalProducts([makeExternal()]);
		await render(<ExternalProductDetail />);
		await fireEvent.press(screen.getByText("Qualatex"));
		expect(mockRouter.push).toHaveBeenCalledWith(
			"/metadata/manufacturers/Qualatex",
		);
	});

	it("navigates back from the found-view header", async () => {
		setExternalProducts([makeExternal()]);
		await render(<ExternalProductDetail />);
		await fireEvent.press(screen.getByText("arrow-back"));
		expect(mockRouter.back).toHaveBeenCalledTimes(1);
	});

	it("omits empty metadata fields and hides distributors when empty", async () => {
		setExternalProducts([
			makeExternal({
				manufacturer_color: "",
				brand: "   ",
				distributors: [],
			}),
		]);
		await render(<ExternalProductDetail />);
		expect(screen.queryByText("Flaming Red")).toBeNull();
		expect(screen.queryByText("Qualatex")).toBeNull();
		expect(screen.queryByText("Distributors")).toBeNull();
		expect(screen.getByText('11"')).toBeOnTheScreen();
	});

	it("does not render the internal-product link when no internal groups the SKU", async () => {
		setInternalProducts([makeInternal({ products: ["OTHER"] })]);
		setExternalProducts([makeExternal()]);
		await render(<ExternalProductDetail />);
		expect(screen.queryByText("Grouped under Internal Product")).toBeNull();
	});
});

describe("ExternalProductDetail — quantity controls", () => {
	it("increments stock by the bag quantity", async () => {
		setExternalProducts([makeExternal({ quantity: 42, bag_quantity: 100 })]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.press(screen.getByText("add"));
		expect(screen.getByDisplayValue("142")).toBeOnTheScreen();
	});

	it("decrements stock by one but never below zero", async () => {
		setExternalProducts([makeExternal({ quantity: 1 })]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.press(screen.getByText("remove")); // 1 -> 0
		expect(screen.getByDisplayValue("0")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("remove")); // clamped at 0
		expect(screen.getByDisplayValue("0")).toBeOnTheScreen();
	});

	it("parses a manual quantity edit", async () => {
		setExternalProducts([makeExternal({ quantity: 42 })]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(screen.getByDisplayValue("42"), "7");
		expect(screen.getByDisplayValue("7")).toBeOnTheScreen();
	});

	it("falls back to 0 when the manual quantity edit is not a number", async () => {
		setExternalProducts([makeExternal({ quantity: 42 })]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(screen.getByDisplayValue("42"), "xyz");
		expect(screen.getByDisplayValue("0")).toBeOnTheScreen();
	});

	it("does not change quantity when increment/decrement run without edits", async () => {
		// Increment/decrement are only rendered in edit mode; pressing them after
		// a no-op edit keeps the value consistent.
		setExternalProducts([makeExternal({ quantity: 8, bag_quantity: 2 })]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.press(screen.getByText("add")); // 8 -> 10
		await fireEvent.press(screen.getByText("remove")); // 10 -> 9
		expect(screen.getByDisplayValue("9")).toBeOnTheScreen();
	});
});

describe("ExternalProductDetail — edit fields", () => {
	it("renders the editable sections including Internal Product", async () => {
		setInternalProducts([makeInternal()]);
		setExternalProducts([makeExternal()]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		expect(screen.getByText("Internal Product")).toBeOnTheScreen();
		expect(screen.getByText("Manufacturer Color")).toBeOnTheScreen();
		expect(screen.getByText("Brand")).toBeOnTheScreen();
		expect(screen.getByText("Size")).toBeOnTheScreen();
		expect(screen.getByText("Bag Quantity")).toBeOnTheScreen();
		// The Distributors multi-select appends a count when values are selected.
		expect(screen.getByText(/Distributors/)).toBeOnTheScreen();
	});

	it("changes the brand radio field, stripping any (Archived) suffix", async () => {
		setExternalProducts([makeExternal()]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.press(screen.getByText("Brand"));
		await fireEvent.press(screen.getByText("Anagram"));
		mockUpdateExternalProduct.mockResolvedValue({ success: true });
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateExternalProduct).toHaveBeenCalledWith(
			expect.objectContaining({ brand: "Anagram" }),
		);
	});

	it("changes the manufacturer colour and size radio fields", async () => {
		setExternalProducts([makeExternal()]);
		await render(<ExternalProductDetail />);
		await enterEdit();

		await fireEvent.press(screen.getByText("Manufacturer Color"));
		await fireEvent.press(screen.getByText("Ocean Blue"));

		await fireEvent.press(screen.getByText("Size"));
		await fireEvent.press(screen.getByText('16"'));

		mockUpdateExternalProduct.mockResolvedValue({ success: true });
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateExternalProduct).toHaveBeenCalledWith(
			expect.objectContaining({
				manufacturer_color: "Ocean Blue",
				size: '16"',
			}),
		);
	});

	it("changes the bag quantity radio (parsed to a number)", async () => {
		setExternalProducts([makeExternal({ bag_quantity: 100 })]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.press(screen.getByText("Bag Quantity"));
		await fireEvent.press(screen.getByText("50"));
		mockUpdateExternalProduct.mockResolvedValue({ success: true });
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateExternalProduct).toHaveBeenCalledWith(
			expect.objectContaining({ bag_quantity: 50 }),
		);
	});

	it("changes the distributors multi-select", async () => {
		setExternalProducts([makeExternal({ distributors: [] })]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.press(screen.getByText("Distributors"));
		await fireEvent.press(screen.getByText("Default Distributor"));
		mockUpdateExternalProduct.mockResolvedValue({ success: true });
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateExternalProduct).toHaveBeenCalledWith(
			expect.objectContaining({ distributors: "Default Distributor" }),
		);
	});

	it("lists only active internal products as reassignment options", async () => {
		setInternalProducts([
			makeInternal({ id: "int-1", sparkys_product_name: "Active One" }),
			makeInternal({
				id: "int-2",
				sparkys_product_name: "Archived One",
				status: "archived",
				products: [],
			}),
		]);
		setExternalProducts([makeExternal()]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.press(screen.getByText("Internal Product"));
		expect(screen.getByText("Active One")).toBeOnTheScreen();
		expect(screen.queryByText("Archived One")).toBeNull();
	});

	it("reverts unsaved edits on cancel", async () => {
		setInternalProducts([makeInternal()]);
		setExternalProducts([makeExternal({ quantity: 42 })]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(screen.getByDisplayValue("42"), "9");
		await fireEvent.press(screen.getByText("close"));
		// Read-only view shows the original quantity again.
		expect(screen.getByText("42")).toBeOnTheScreen();
	});

	it("cancels cleanly when the product has no original internal assignment", async () => {
		// No internal product groups this SKU, so originalInternalProduct is null.
		setInternalProducts([
			makeInternal({ id: "x", sparkys_product_name: "X", products: [] }),
		]);
		setExternalProducts([makeExternal({ quantity: 42 })]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(screen.getByDisplayValue("42"), "9");
		await fireEvent.press(screen.getByText("close"));
		expect(screen.getByText("42")).toBeOnTheScreen();
	});
});

describe("ExternalProductDetail — save: external fields", () => {
	it("exits edit mode without saving when nothing changed", async () => {
		setInternalProducts([makeInternal()]);
		setExternalProducts([makeExternal()]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateExternalProduct).not.toHaveBeenCalled();
		expect(mockUpdateInternalProduct).not.toHaveBeenCalled();
	});

	it("saves external field changes and shows a success alert", async () => {
		setExternalProducts([makeExternal({ quantity: 42 })]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(screen.getByDisplayValue("42"), "50");
		mockUpdateExternalProduct.mockResolvedValue({ success: true });
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateExternalProduct).toHaveBeenCalledWith(
			expect.objectContaining({ quantity: 50 }),
		);
		expect(Alert.alert).toHaveBeenCalledWith(
			"Success",
			"Product updated successfully",
		);
		expect(useProductStore.getState().externalProducts[0].quantity).toBe(50);
	});

	it("shows the server error when the external save fails", async () => {
		setExternalProducts([makeExternal({ quantity: 42 })]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(screen.getByDisplayValue("42"), "50");
		mockUpdateExternalProduct.mockResolvedValue({
			success: false,
			error: "External boom",
		});
		await fireEvent.press(screen.getByText("checkmark"));
		expect(Alert.alert).toHaveBeenCalledWith("Error", "External boom");
	});

	it("shows a generic error when the external save fails without a message", async () => {
		setExternalProducts([makeExternal({ quantity: 42 })]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(screen.getByDisplayValue("42"), "50");
		mockUpdateExternalProduct.mockResolvedValue({ success: false });
		await fireEvent.press(screen.getByText("checkmark"));
		expect(Alert.alert).toHaveBeenCalledWith(
			"Error",
			"Failed to update product",
		);
	});

	it("shows a generic error when the save throws", async () => {
		setExternalProducts([makeExternal({ quantity: 42 })]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(screen.getByDisplayValue("42"), "50");
		mockUpdateExternalProduct.mockRejectedValue(new Error("network"));
		await fireEvent.press(screen.getByText("checkmark"));
		expect(Alert.alert).toHaveBeenCalledWith(
			"Error",
			"Failed to update product",
		);
	});
});

describe("ExternalProductDetail — save: internal reassignment", () => {
	// Build a screen where SKU-A starts under "Old" and we reassign to "New".
	async function setupReassign() {
		setInternalProducts([
			makeInternal({
				id: "old",
				sparkys_product_name: "Old",
				products: ["SKU-A"],
			}),
			makeInternal({
				id: "new",
				sparkys_product_name: "New",
				products: [],
			}),
		]);
		setExternalProducts([makeExternal()]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.press(screen.getByText("Internal Product"));
		await fireEvent.press(screen.getByText("New"));
	}

	it("reassigns the SKU across internal products and logs an audit event", async () => {
		await setupReassign();
		mockUpdateInternalProduct.mockResolvedValue({ success: true });
		mockLogAuditEvent.mockResolvedValue(undefined);
		await fireEvent.press(screen.getByText("checkmark"));

		// Two sheet writes: remove from old, add to new.
		expect(mockUpdateInternalProduct).toHaveBeenCalledTimes(2);
		expect(mockLogAuditEvent).toHaveBeenCalledTimes(1);
		expect(Alert.alert).toHaveBeenCalledWith(
			"Success",
			"Product updated successfully",
		);
		// Store: SKU removed from old, added to new.
		const products = useProductStore.getState().internalProducts;
		expect(products.find((p) => p.id === "old")?.products).not.toContain(
			"SKU-A",
		);
		expect(products.find((p) => p.id === "new")?.products).toContain("SKU-A");
	});

	it("aborts cleanly when removing the SKU from the old product fails", async () => {
		await setupReassign();
		mockUpdateInternalProduct.mockResolvedValueOnce({
			success: false,
			error: "remove failed",
		});
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateInternalProduct).toHaveBeenCalledTimes(1);
		expect(Alert.alert).toHaveBeenCalledWith("Error", "remove failed");
		// Nothing logged, store untouched for the reassignment.
		expect(mockLogAuditEvent).not.toHaveBeenCalled();
	});

	it("shows a generic error when removal fails without a message", async () => {
		await setupReassign();
		mockUpdateInternalProduct.mockResolvedValueOnce({ success: false });
		await fireEvent.press(screen.getByText("checkmark"));
		expect(Alert.alert).toHaveBeenCalledWith(
			"Error",
			"Failed to reassign product",
		);
	});

	it("rolls back when adding the SKU to the new product fails", async () => {
		await setupReassign();
		mockUpdateInternalProduct
			.mockResolvedValueOnce({ success: true }) // remove from old
			.mockResolvedValueOnce({ success: false, error: "add failed" }) // add to new
			.mockResolvedValueOnce({ success: true }); // rollback restore old
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateInternalProduct).toHaveBeenCalledTimes(3);
		expect(Alert.alert).toHaveBeenCalledWith("Error", "add failed");
		expect(mockLogAuditEvent).not.toHaveBeenCalled();
	});

	it("shows a generic error and rolls back when the add fails without a message", async () => {
		await setupReassign();
		mockUpdateInternalProduct
			.mockResolvedValueOnce({ success: true })
			.mockResolvedValueOnce({ success: false })
			.mockResolvedValueOnce({ success: true });
		await fireEvent.press(screen.getByText("checkmark"));
		expect(Alert.alert).toHaveBeenCalledWith(
			"Error",
			"Failed to reassign product",
		);
	});

	it("reports a failed rollback after a failed add", async () => {
		await setupReassign();
		mockUpdateInternalProduct
			.mockResolvedValueOnce({ success: true }) // remove from old
			.mockResolvedValueOnce({ success: false, error: "add failed" }) // add to new
			.mockResolvedValueOnce({ success: false, error: "rollback failed" }); // rollback fails
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateInternalProduct).toHaveBeenCalledTimes(3);
		expect(Alert.alert).toHaveBeenCalledWith("Error", "add failed");
	});

	it("aborts without rollback when reassign-from-unassigned add fails", async () => {
		// SKU starts unassigned, so there is no old product to roll back to.
		setInternalProducts([
			makeInternal({ id: "new", sparkys_product_name: "New", products: [] }),
		]);
		setExternalProducts([makeExternal()]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.press(screen.getByText("Internal Product"));
		await fireEvent.press(screen.getByText("New"));
		mockUpdateInternalProduct.mockResolvedValueOnce({
			success: false,
			error: "add failed",
		});
		await fireEvent.press(screen.getByText("checkmark"));
		// Only the add was attempted; no rollback write because there was no old
		// internal product.
		expect(mockUpdateInternalProduct).toHaveBeenCalledTimes(1);
		expect(Alert.alert).toHaveBeenCalledWith("Error", "add failed");
		expect(mockLogAuditEvent).not.toHaveBeenCalled();
	});

	it("reassigns from no internal product to a new one", async () => {
		// SKU-A is initially unassigned (no internal lists it).
		setInternalProducts([
			makeInternal({ id: "new", sparkys_product_name: "New", products: [] }),
		]);
		setExternalProducts([makeExternal()]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.press(screen.getByText("Internal Product"));
		await fireEvent.press(screen.getByText("New"));
		mockUpdateInternalProduct.mockResolvedValue({ success: true });
		mockLogAuditEvent.mockResolvedValue(undefined);
		await fireEvent.press(screen.getByText("checkmark"));
		// Only the "add to new" write happens (no old product to remove from).
		expect(mockUpdateInternalProduct).toHaveBeenCalledTimes(1);
		expect(mockLogAuditEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				before_state: JSON.stringify({ internal_product: "Unassigned" }),
				changes: JSON.stringify({ internal_product: "New" }),
			}),
		);
	});
});

describe("ExternalProductDetail — metadata archived labels", () => {
	it("appends an (Archived) suffix to archived option labels in edit mode", async () => {
		updateMetadataItems({
			manufacturer: [
				{ name: "Qualatex", status: "active" },
				{ name: "Anagram", status: "archived" },
			],
		});
		setExternalProducts([makeExternal()]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.press(screen.getByText("Brand"));
		expect(screen.getByText("Anagram (Archived)")).toBeOnTheScreen();
	});
});

describe("ExternalProductDetail — save status fallback", () => {
	it("defaults the saved external status to active when none is set", async () => {
		const product = makeExternal({ quantity: 42 });
		delete (product as { status?: string }).status;
		setExternalProducts([product]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(screen.getByDisplayValue("42"), "50");
		mockUpdateExternalProduct.mockResolvedValue({ success: true });
		await fireEvent.press(screen.getByText("checkmark"));
		expect(mockUpdateExternalProduct).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" }),
		);
	});
});

describe("ExternalProductDetail — loading states", () => {
	it("shows the hourglass while a save is in flight", async () => {
		setExternalProducts([makeExternal({ quantity: 42 })]);
		await render(<ExternalProductDetail />);
		await enterEdit();
		await fireEvent.changeText(screen.getByDisplayValue("42"), "50");
		// Hold the save open with a deferred that only resolves after we have
		// observed the in-flight hourglass.
		let resolveSave: (v: { success: boolean }) => void = () => {};
		mockUpdateExternalProduct.mockReturnValue(
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
		setExternalProducts([makeExternal({ status: "active" })]);
		await render(<ExternalProductDetail />);
		await fireEvent.press(screen.getByText("archive-outline"));
		let resolveArchive: (v: { success: boolean }) => void = () => {};
		mockArchiveExternalProduct.mockReturnValue(
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

describe("ExternalProductDetail — archive flow", () => {
	it("archives an external product through the confirmation alert", async () => {
		setExternalProducts([makeExternal({ status: "active" })]);
		await render(<ExternalProductDetail />);
		await fireEvent.press(screen.getByText("archive-outline"));
		expect(Alert.alert).toHaveBeenCalledWith(
			"Archive Product",
			'Are you sure you want to archive "SKU-A"?',
			expect.any(Array),
		);
		mockArchiveExternalProduct.mockResolvedValue({ success: true });
		await pressLatestAlertConfirm();
		expect(mockArchiveExternalProduct).toHaveBeenCalledWith("SKU-A");
		expect(Alert.alert).toHaveBeenLastCalledWith(
			"Success",
			"Product archived successfully!",
		);
		expect(useProductStore.getState().externalProducts[0].status).toBe(
			"archived",
		);
	});

	it("unarchives an already-archived external product", async () => {
		setExternalProducts([makeExternal({ status: "archived" })]);
		await render(<ExternalProductDetail />);
		await fireEvent.press(screen.getByText("refresh-outline"));
		mockUnarchiveExternalProduct.mockResolvedValue({ success: true });
		await pressLatestAlertConfirm();
		expect(mockUnarchiveExternalProduct).toHaveBeenCalledWith("SKU-A");
		expect(useProductStore.getState().externalProducts[0].status).toBe(
			"active",
		);
	});

	it("surfaces the server error when archiving fails", async () => {
		setExternalProducts([makeExternal({ status: "active" })]);
		await render(<ExternalProductDetail />);
		await fireEvent.press(screen.getByText("archive-outline"));
		mockArchiveExternalProduct.mockResolvedValue({
			success: false,
			error: "Archive failed",
		});
		await pressLatestAlertConfirm();
		expect(Alert.alert).toHaveBeenLastCalledWith("Error", "Archive failed");
	});

	it("shows a generic error when archiving fails without a message", async () => {
		setExternalProducts([makeExternal({ status: "active" })]);
		await render(<ExternalProductDetail />);
		await fireEvent.press(screen.getByText("archive-outline"));
		mockArchiveExternalProduct.mockResolvedValue({ success: false });
		await pressLatestAlertConfirm();
		expect(Alert.alert).toHaveBeenLastCalledWith(
			"Error",
			"Failed to archive product",
		);
	});

	it("shows a generic error when archiving throws", async () => {
		setExternalProducts([makeExternal({ status: "active" })]);
		await render(<ExternalProductDetail />);
		await fireEvent.press(screen.getByText("archive-outline"));
		mockArchiveExternalProduct.mockRejectedValue(new Error("explode"));
		await pressLatestAlertConfirm();
		expect(Alert.alert).toHaveBeenLastCalledWith(
			"Error",
			"Failed to archive product",
		);
	});

	it("does nothing when the archive confirmation is cancelled", async () => {
		setExternalProducts([makeExternal({ status: "active" })]);
		await render(<ExternalProductDetail />);
		await fireEvent.press(screen.getByText("archive-outline"));
		const alertSpy = Alert.alert as jest.Mock;
		const buttons = alertSpy.mock.calls[alertSpy.mock.calls.length - 1][2];
		const cancel = buttons.find((b: { text: string }) => b.text === "Cancel");
		expect(cancel.style).toBe("cancel");
		expect(mockArchiveExternalProduct).not.toHaveBeenCalled();
	});
});
