import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";
import MetadataDetail from "@/app/metadata/[...params]";
import { logger } from "@/services/logger";

// --- Mock surface -----------------------------------------------------------
const mockBack = jest.fn();
let mockParams: { params: string[] | undefined } = {
	params: ["colors", "Red"],
};
jest.mock("expo-router", () => ({
	router: { back: (...args: unknown[]) => mockBack(...args) },
	useLocalSearchParams: () => mockParams,
}));

jest.mock("@/hooks/useTheme", () => ({
	useTheme: () => ({ theme: "light" }),
}));

const mockUpdateMetadata = jest.fn();
const mockArchiveMetadata = jest.fn();
const mockUnarchiveMetadata = jest.fn();
jest.mock("@/hooks/useSheetsData", () => ({
	useSheetsData: () => ({
		updateMetadata: mockUpdateMetadata,
		archiveMetadata: mockArchiveMetadata,
		unarchiveMetadata: mockUnarchiveMetadata,
	}),
}));

// Keep the real field-option constants (so the "already exists" branch uses real
// data) but make the archived-state lookup controllable per test.
let mockIsArchived = false;
jest.mock("@/constants/Products", () => {
	const actual = jest.requireActual("@/constants/Products");
	return {
		...actual,
		isMetadataItemArchived: () => mockIsArchived,
	};
});

// Render Ionicons as their glyph name so icon-only buttons are queryable.
jest.mock("@expo/vector-icons", () => {
	const { Text } = require("react-native") as typeof import("react-native");
	return {
		Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text>,
	};
});

/**
 * Find a button in the most recent alert's button list and invoke its handler.
 * Wrapped in `act` so the resulting state updates are flushed before assertions.
 * Returns the (possibly async) handler result so callers can await completion.
 */
async function pressAlertButton(label: string): Promise<unknown> {
	const call = (Alert.alert as jest.Mock).mock.calls.at(-1);
	const buttons = call?.[2] as
		| { text?: string; onPress?: () => void | Promise<void> }[]
		| undefined;
	const button = buttons?.find((b) => b.text === label);
	let outcome: unknown;
	await act(async () => {
		outcome = await button?.onPress?.();
	});
	return outcome;
}

beforeEach(() => {
	mockBack.mockReset();
	mockParams = { params: ["colors", "Red"] };
	mockUpdateMetadata.mockReset().mockResolvedValue({ success: true });
	mockArchiveMetadata.mockReset().mockResolvedValue({ success: true });
	mockUnarchiveMetadata.mockReset().mockResolvedValue({ success: true });
	mockIsArchived = false;
	jest.spyOn(Alert, "alert").mockImplementation(() => {});
	(logger.error as jest.Mock).mockClear();
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe("metadata/[...params] — routing guards", () => {
	it("shows the invalid-route screen when there are no params", async () => {
		// An empty array is iterable (so the leading destructure is safe) yet has
		// length < 2, which is what reaches the invalid-route guard in practice.
		mockParams = { params: [] };
		await render(<MetadataDetail />);
		expect(screen.getByText("Invalid Route")).toBeOnTheScreen();
		expect(screen.getByText("Invalid metadata route")).toBeOnTheScreen();
	});

	it("shows the invalid-route screen when there are too few params", async () => {
		mockParams = { params: ["colors"] };
		await render(<MetadataDetail />);
		expect(screen.getByText("Invalid metadata route")).toBeOnTheScreen();
	});

	it("navigates back from the invalid-route screen", async () => {
		mockParams = { params: [] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:arrow-back"));
		expect(mockBack).toHaveBeenCalledTimes(1);
	});

	it("shows the invalid-category screen for an unknown view mode", async () => {
		mockParams = { params: ["nonsense", "Value"] };
		await render(<MetadataDetail />);
		expect(screen.getByText("Invalid Category")).toBeOnTheScreen();
		expect(screen.getByText("Invalid metadata category")).toBeOnTheScreen();
	});

	it("navigates back from the invalid-category screen", async () => {
		mockParams = { params: ["nonsense", "Value"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:arrow-back"));
		expect(mockBack).toHaveBeenCalledTimes(1);
	});

	it.each([
		["manufacturer", "Brand title special-case"],
		["bagQuantity", "Bag Quantity title special-case"],
		["productType", "Product Type title special-case"],
	])("computes the title for the %s special-case before the category guard", async (viewMode) => {
		// These viewMode strings hit formatCategoryTitle's special branches and
		// then fall through to the invalid-category screen (no field key).
		mockParams = { params: [viewMode, "Value"] };
		await render(<MetadataDetail />);
		expect(screen.getByText("Invalid Category")).toBeOnTheScreen();
	});
});

describe("metadata/[...params] — display", () => {
	it("renders the value details for a valid color route", async () => {
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		expect(screen.getByText("Value Details")).toBeOnTheScreen();
		expect(screen.getByText("Red")).toBeOnTheScreen();
		// Header title is the singular category name ("Color" sliced from "Colors").
		expect(screen.getByText("Color")).toBeOnTheScreen();
		// Not editing + not archived → the pencil (edit) icon is shown.
		expect(screen.getByText("icon:pencil")).toBeOnTheScreen();
		expect(screen.getByText("icon:archive-outline")).toBeOnTheScreen();
	});

	it("decodes a URL-encoded item name", async () => {
		mockParams = { params: ["colors", "Royal%20Blue"] };
		await render(<MetadataDetail />);
		expect(screen.getByText("Royal Blue")).toBeOnTheScreen();
	});

	it("renders the archived indicator and unarchive action when archived", async () => {
		mockIsArchived = true;
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		expect(screen.getByText("This color is archived")).toBeOnTheScreen();
		expect(screen.getByText("icon:refresh-outline")).toBeOnTheScreen();
		// The archive action is replaced by unarchive when archived.
		expect(screen.queryByText("icon:archive-outline")).toBeNull();
	});

	it("formats multi-word category titles from camelCase view modes", async () => {
		mockParams = { params: ["bagQuantities", "100"] };
		await render(<MetadataDetail />);
		// "bagQuantities" → "Bag Quantities" → singular "Bag Quantitie".
		expect(screen.getByText("Bag Quantitie")).toBeOnTheScreen();
	});

	it("navigates back from the detail view", async () => {
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:arrow-back"));
		expect(mockBack).toHaveBeenCalledTimes(1);
	});

	// Render + save once per view mode so both getFieldKey (render) and
	// getSheetName (handleSave) switch arms are exercised for every category.
	it.each([
		["productTypes", "product_types"],
		["occasions", "occasions"],
		["manufacturers", "brands"],
		["textures", "textures"],
		["bagQuantities", "bag_quantities"],
		["shapes", "shapes"],
		["distributors", "distributors"],
		["colors", "colors"],
	])("maps the %s view mode to its sheet on save", async (viewMode, sheetName) => {
		mockUpdateMetadata.mockResolvedValue({ success: true });
		mockParams = { params: [viewMode, "Original"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:pencil"));
		await fireEvent.changeText(screen.getByDisplayValue("Original"), "Updated");
		await fireEvent.press(screen.getByText("icon:checkmark"));

		await waitFor(() =>
			expect(mockUpdateMetadata).toHaveBeenCalledWith(
				sheetName,
				"Original",
				"Updated",
			),
		);
	});
});

describe("metadata/[...params] — editing", () => {
	it("enters edit mode and shows the input prefilled", async () => {
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:pencil"));

		expect(screen.getByText("Edit Value")).toBeOnTheScreen();
		expect(screen.getByDisplayValue("Red")).toBeOnTheScreen();
		// Editing shows the checkmark (save) and close (cancel) icons.
		expect(screen.getByText("icon:checkmark")).toBeOnTheScreen();
		expect(screen.getByText("icon:close")).toBeOnTheScreen();
	});

	it("cancels editing and restores the original value", async () => {
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:pencil"));
		await fireEvent.changeText(screen.getByDisplayValue("Red"), "Crimson");
		await fireEvent.press(screen.getByText("icon:close"));

		// Back to the read-only view with the original value.
		expect(screen.getByText("Value Details")).toBeOnTheScreen();
		expect(screen.getByText("Red")).toBeOnTheScreen();
	});

	it("warns when saving an empty value", async () => {
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:pencil"));
		await fireEvent.changeText(screen.getByDisplayValue("Red"), "   ");
		await fireEvent.press(screen.getByText("icon:checkmark"));

		expect(Alert.alert).toHaveBeenCalledWith("Error", "Please enter a value");
		expect(mockUpdateMetadata).not.toHaveBeenCalled();
	});

	it("reports no changes and navigates back when the value is unchanged", async () => {
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:pencil"));
		await fireEvent.press(screen.getByText("icon:checkmark"));

		expect(Alert.alert).toHaveBeenCalledWith("Info", "No changes to save");
		expect(mockBack).toHaveBeenCalledTimes(1);
		expect(mockUpdateMetadata).not.toHaveBeenCalled();
	});

	it("rejects a value that already exists in the field options", async () => {
		// "productTypes" maps to the `productType` field, whose default options
		// include "Foil Balloons" — editing "Latex Balloons" to it must be rejected.
		mockParams = { params: ["productTypes", "Latex Balloons"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:pencil"));
		await fireEvent.changeText(
			screen.getByDisplayValue("Latex Balloons"),
			"Foil Balloons",
		);
		await fireEvent.press(screen.getByText("icon:checkmark"));

		expect(Alert.alert).toHaveBeenCalledWith(
			"Error",
			"This value already exists",
		);
		expect(mockUpdateMetadata).not.toHaveBeenCalled();
	});

	it("blocks saving for metadata types without a sheet (sizes)", async () => {
		mockParams = { params: ["sizes", "Tiny"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:pencil"));
		await fireEvent.changeText(screen.getByDisplayValue("Tiny"), "Huge");
		await fireEvent.press(screen.getByText("icon:checkmark"));

		expect(Alert.alert).toHaveBeenCalledWith(
			"Error",
			"Cannot update this metadata type",
		);
		expect(mockUpdateMetadata).not.toHaveBeenCalled();
	});

	it("saves a valid new value and navigates back", async () => {
		mockUpdateMetadata.mockResolvedValue({ success: true });
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:pencil"));
		await fireEvent.changeText(screen.getByDisplayValue("Red"), "Crimson");
		await fireEvent.press(screen.getByText("icon:checkmark"));

		await waitFor(() =>
			expect(mockUpdateMetadata).toHaveBeenCalledWith(
				"colors",
				"Red",
				"Crimson",
			),
		);
		expect(Alert.alert).toHaveBeenCalledWith(
			"Success",
			'"Crimson" has been saved!',
		);
		expect(mockBack).toHaveBeenCalledTimes(1);
	});

	it("shows the returned error when a save fails", async () => {
		mockUpdateMetadata.mockResolvedValue({
			success: false,
			error: "server boom",
		});
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:pencil"));
		await fireEvent.changeText(screen.getByDisplayValue("Red"), "Crimson");
		await fireEvent.press(screen.getByText("icon:checkmark"));

		await waitFor(() =>
			expect(Alert.alert).toHaveBeenCalledWith("Error", "server boom"),
		);
		expect(mockBack).not.toHaveBeenCalled();
	});

	it("falls back to a generic message when a save fails without an error", async () => {
		mockUpdateMetadata.mockResolvedValue({ success: false });
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:pencil"));
		await fireEvent.changeText(screen.getByDisplayValue("Red"), "Crimson");
		await fireEvent.press(screen.getByText("icon:checkmark"));

		await waitFor(() =>
			expect(Alert.alert).toHaveBeenCalledWith(
				"Error",
				"Failed to save changes",
			),
		);
	});

	it("logs and alerts when the save call throws", async () => {
		const err = new Error("network down");
		mockUpdateMetadata.mockRejectedValue(err);
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:pencil"));
		await fireEvent.changeText(screen.getByDisplayValue("Red"), "Crimson");
		await fireEvent.press(screen.getByText("icon:checkmark"));

		await waitFor(() =>
			expect(logger.error).toHaveBeenCalledWith(
				"Metadata",
				"Failed to save changes",
				expect.objectContaining({ error: err }),
			),
		);
		expect(Alert.alert).toHaveBeenCalledWith("Error", "Failed to save changes");
	});

	it("shows the saving spinner icon while a save is in flight", async () => {
		let resolveSave: (r: { success: boolean }) => void = () => {};
		mockUpdateMetadata.mockReturnValue(
			new Promise((resolve) => {
				resolveSave = resolve;
			}),
		);
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:pencil"));
		await fireEvent.changeText(screen.getByDisplayValue("Red"), "Crimson");

		const press = fireEvent.press(screen.getByText("icon:checkmark"));
		await waitFor(() =>
			expect(screen.getByText("icon:hourglass-outline")).toBeOnTheScreen(),
		);

		await act(async () => {
			resolveSave({ success: true });
			await press;
		});
		await waitFor(() => expect(mockBack).toHaveBeenCalled());
	});
});

describe("metadata/[...params] — archive", () => {
	it("blocks archiving for metadata types without a sheet (sizes)", async () => {
		mockParams = { params: ["sizes", "Tiny"] };
		await render(<MetadataDetail />);
		// "sizes" has a field key, so the detail view (with archive action) renders.
		await fireEvent.press(screen.getByText("icon:archive-outline"));

		expect(Alert.alert).toHaveBeenCalledWith(
			"Error",
			"Cannot archive this metadata type",
		);
	});

	it("confirms and archives an item, then navigates back", async () => {
		mockArchiveMetadata.mockResolvedValue({ success: true });
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:archive-outline"));

		expect(Alert.alert).toHaveBeenCalledWith(
			"Archive Value",
			'Are you sure you want to archive "Red"?',
			expect.any(Array),
		);
		await pressAlertButton("Archive");

		await waitFor(() =>
			expect(mockArchiveMetadata).toHaveBeenCalledWith("colors", "Red"),
		);
		expect(Alert.alert).toHaveBeenCalledWith(
			"Success",
			'"Red" has been archived!',
		);
		expect(mockBack).toHaveBeenCalledTimes(1);
	});

	it("shows the returned error when archiving fails", async () => {
		mockArchiveMetadata.mockResolvedValue({
			success: false,
			error: "cannot archive",
		});
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:archive-outline"));
		await pressAlertButton("Archive");

		await waitFor(() =>
			expect(Alert.alert).toHaveBeenCalledWith("Error", "cannot archive"),
		);
		expect(mockBack).not.toHaveBeenCalled();
	});

	it("falls back to a generic message when archiving fails without an error", async () => {
		mockArchiveMetadata.mockResolvedValue({ success: false });
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:archive-outline"));
		await pressAlertButton("Archive");

		await waitFor(() =>
			expect(Alert.alert).toHaveBeenCalledWith(
				"Error",
				"Failed to archive item",
			),
		);
	});

	it("logs and alerts when the archive call throws", async () => {
		const err = new Error("archive boom");
		mockArchiveMetadata.mockRejectedValue(err);
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:archive-outline"));
		await pressAlertButton("Archive");

		await waitFor(() =>
			expect(logger.error).toHaveBeenCalledWith(
				"Metadata",
				"Failed to archive item",
				expect.objectContaining({ error: err }),
			),
		);
		expect(Alert.alert).toHaveBeenCalledWith("Error", "Failed to archive item");
	});

	it("shows the hourglass icon while archiving is in flight", async () => {
		let resolveArchive: (r: { success: boolean }) => void = () => {};
		mockArchiveMetadata.mockReturnValue(
			new Promise((resolve) => {
				resolveArchive = resolve;
			}),
		);
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:archive-outline"));

		// Invoke the confirm handler without awaiting so the in-flight state shows.
		const call = (Alert.alert as jest.Mock).mock.calls.at(-1);
		const buttons = call?.[2] as { text?: string; onPress?: () => void }[];
		await act(async () => {
			buttons.find((b) => b.text === "Archive")?.onPress?.();
		});

		await waitFor(() =>
			expect(screen.getByText("icon:hourglass")).toBeOnTheScreen(),
		);

		await act(async () => {
			resolveArchive({ success: true });
		});
		await waitFor(() => expect(mockBack).toHaveBeenCalled());
	});
});

describe("metadata/[...params] — unarchive", () => {
	beforeEach(() => {
		mockIsArchived = true;
	});

	it("blocks unarchiving for metadata types without a sheet (sizes)", async () => {
		mockParams = { params: ["sizes", "Tiny"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:refresh-outline"));

		expect(Alert.alert).toHaveBeenCalledWith(
			"Error",
			"Cannot unarchive this metadata type",
		);
	});

	it("confirms and unarchives an item, then navigates back", async () => {
		mockUnarchiveMetadata.mockResolvedValue({ success: true });
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:refresh-outline"));

		expect(Alert.alert).toHaveBeenCalledWith(
			"Unarchive Value",
			'Are you sure you want to unarchive "Red"?',
			expect.any(Array),
		);
		await pressAlertButton("Unarchive");

		await waitFor(() =>
			expect(mockUnarchiveMetadata).toHaveBeenCalledWith("colors", "Red"),
		);
		expect(Alert.alert).toHaveBeenCalledWith(
			"Success",
			'"Red" has been unarchived!',
		);
		expect(mockBack).toHaveBeenCalledTimes(1);
	});

	it("shows the returned error when unarchiving fails", async () => {
		mockUnarchiveMetadata.mockResolvedValue({
			success: false,
			error: "cannot unarchive",
		});
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:refresh-outline"));
		await pressAlertButton("Unarchive");

		await waitFor(() =>
			expect(Alert.alert).toHaveBeenCalledWith("Error", "cannot unarchive"),
		);
	});

	it("falls back to a generic message when unarchiving fails without an error", async () => {
		mockUnarchiveMetadata.mockResolvedValue({ success: false });
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:refresh-outline"));
		await pressAlertButton("Unarchive");

		await waitFor(() =>
			expect(Alert.alert).toHaveBeenCalledWith(
				"Error",
				"Failed to unarchive item",
			),
		);
	});

	it("logs and alerts when the unarchive call throws", async () => {
		const err = new Error("unarchive boom");
		mockUnarchiveMetadata.mockRejectedValue(err);
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:refresh-outline"));
		await pressAlertButton("Unarchive");

		await waitFor(() =>
			expect(logger.error).toHaveBeenCalledWith(
				"Metadata",
				"Failed to unarchive item",
				expect.objectContaining({ error: err }),
			),
		);
		expect(Alert.alert).toHaveBeenCalledWith(
			"Error",
			"Failed to unarchive item",
		);
	});

	it("cancels the unarchive confirmation without calling the hook", async () => {
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:refresh-outline"));
		// The Cancel button has no onPress; pressing it is a no-op.
		await pressAlertButton("Cancel");

		expect(mockUnarchiveMetadata).not.toHaveBeenCalled();
		expect(mockBack).not.toHaveBeenCalled();
	});

	it("shows the hourglass icon while unarchiving is in flight", async () => {
		let resolveUnarchive: (r: { success: boolean }) => void = () => {};
		mockUnarchiveMetadata.mockReturnValue(
			new Promise((resolve) => {
				resolveUnarchive = resolve;
			}),
		);
		mockParams = { params: ["colors", "Red"] };
		await render(<MetadataDetail />);
		await fireEvent.press(screen.getByText("icon:refresh-outline"));

		const call = (Alert.alert as jest.Mock).mock.calls.at(-1);
		const buttons = call?.[2] as { text?: string; onPress?: () => void }[];
		await act(async () => {
			buttons.find((b) => b.text === "Unarchive")?.onPress?.();
		});

		await waitFor(() =>
			expect(screen.getByText("icon:hourglass")).toBeOnTheScreen(),
		);

		await act(async () => {
			resolveUnarchive({ success: true });
		});
		await waitFor(() => expect(mockBack).toHaveBeenCalled());
	});
});
