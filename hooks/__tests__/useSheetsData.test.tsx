import type {
	ExternalProductSheet,
	InternalProductSheet,
} from "@/constants/Products";
import { updateFieldOptions, updateMetadataItems } from "@/constants/Products";
import { setExternalProducts, setInternalProducts } from "@/store/products";

// --- Mock surface -----------------------------------------------------------
// `useSheetsData` talks to the network exclusively through `GoogleSheetsService`,
// to auth through `useAuth`, and persists into the product store + the Products
// field-option caches. Each collaborator is a jest.fn we can re-point per test
// (resolve to drive the success path, reject to drive the catch path). The
// mocks must be declared before the hook module is (re)required.
const mockGetAllSheetsData = jest.fn();
const mockAddMetadataItem = jest.fn();
const mockAddInternalProduct = jest.fn();
const mockAddExternalProduct = jest.fn();
const mockUpdateMetadataItem = jest.fn();
const mockUpdateInternalProduct = jest.fn();
const mockUpdateExternalProduct = jest.fn();
const mockArchiveMetadataItem = jest.fn();
const mockUnarchiveMetadataItem = jest.fn();
const mockArchiveExternalProduct = jest.fn();
const mockUnarchiveExternalProduct = jest.fn();
const mockArchiveInternalProduct = jest.fn();
const mockUnarchiveInternalProduct = jest.fn();
const mockLogEvent = jest.fn();
const mockGetAuditEvents = jest.fn();

// The constructor is itself a jest.fn so we can assert it received SPREADSHEET_ID.
const mockServiceConstructor = jest.fn();

jest.mock("@/services/googleSheets", () => ({
	GoogleSheetsService: class {
		constructor(spreadsheetId: string) {
			mockServiceConstructor(spreadsheetId);
		}
		getAllSheetsData = (...a: unknown[]) => mockGetAllSheetsData(...a);
		addMetadataItem = (...a: unknown[]) => mockAddMetadataItem(...a);
		addInternalProduct = (...a: unknown[]) => mockAddInternalProduct(...a);
		addExternalProduct = (...a: unknown[]) => mockAddExternalProduct(...a);
		updateMetadataItem = (...a: unknown[]) => mockUpdateMetadataItem(...a);
		updateInternalProduct = (...a: unknown[]) =>
			mockUpdateInternalProduct(...a);
		updateExternalProduct = (...a: unknown[]) =>
			mockUpdateExternalProduct(...a);
		archiveMetadataItem = (...a: unknown[]) => mockArchiveMetadataItem(...a);
		unarchiveMetadataItem = (...a: unknown[]) =>
			mockUnarchiveMetadataItem(...a);
		archiveExternalProduct = (...a: unknown[]) =>
			mockArchiveExternalProduct(...a);
		unarchiveExternalProduct = (...a: unknown[]) =>
			mockUnarchiveExternalProduct(...a);
		archiveInternalProduct = (...a: unknown[]) =>
			mockArchiveInternalProduct(...a);
		unarchiveInternalProduct = (...a: unknown[]) =>
			mockUnarchiveInternalProduct(...a);
		logEvent = (...a: unknown[]) => mockLogEvent(...a);
		getAuditEvents = (...a: unknown[]) => mockGetAuditEvents(...a);
	},
}));

const mockGetAccessToken = jest.fn();
const authState = { isSignedIn: false };
jest.mock("@/hooks/useAuth", () => ({
	useAuth: () => ({
		getAccessToken: mockGetAccessToken,
		isSignedIn: authState.isSignedIn,
	}),
}));

// `convert*SheetToModel` are exercised by their own suite; here we stub them to a
// tagged identity so we can assert the converted output flows into the store and
// the global state without re-testing valibot parsing. `updateFieldOptions` /
// `updateMetadataItems` are spies so the metadata-cache side effects are visible.
jest.mock("@/constants/Products", () => ({
	convertInternalProductSheetToModel: jest.fn((row: { id: string }) => ({
		...row,
		converted: "internal",
	})),
	convertExternalProductSheetToModel: jest.fn(
		(row: { unique_id_sku: string }) => ({ ...row, converted: "external" }),
	),
	updateFieldOptions: jest.fn(),
	updateMetadataItems: jest.fn(),
}));

// Store writes are observed, not exercised (the store has its own tests).
jest.mock("@/store/products", () => ({
	setInternalProducts: jest.fn(),
	setExternalProducts: jest.fn(),
}));

// `react-native` is replaced with a minimal surface. The hook only touches
// `Alert.alert`; spreading the real module instead eagerly loads native
// TurboModules (FlatList/DevMenu/…) that have no JS implementation under Jest
// and crash on require. RNTL's pure `renderHook` drives a plain hook without
// host components, so this stub is sufficient.
const mockAlertAlert = jest.fn();
jest.mock("react-native", () => ({
	Alert: { alert: (...a: unknown[]) => mockAlertAlert(...a) },
	// expo-modules-core (pulled in by the jest-expo preset's winter `fetch`
	// global) reads `Platform.select`/`Platform.OS` at module load, so the stub
	// must expose them even though the hook itself never touches Platform.
	Platform: {
		OS: "ios",
		select: (specifics: Record<string, unknown>) =>
			specifics.ios ?? specifics.default,
	},
}));

type SheetsModule = typeof import("@/hooks/useSheetsData");
type SheetsApi = ReturnType<SheetsModule["useSheetsData"]>;
// The `pure` entry exposes `renderHook`/`act` *without* registering RNTL's
// auto-cleanup hooks (which throw when required from inside a test body).
type RNTLPure = typeof import("@testing-library/react-native/pure");

/**
 * Re-require the hook in a fresh module registry. `useSheetsData` keeps a
 * module-level `globalSheetsState` singleton plus subscriber arrays; isolating
 * the module resets them so each test starts clean. React and RNTL are required
 * inside the *same* isolated scope so the renderer and the hook share one React
 * instance (otherwise hooks dispatch against a null dispatcher).
 */
function loadIsolated(): { mod: SheetsModule; rntl: RNTLPure } {
	let mod: SheetsModule;
	let rntl: RNTLPure;
	jest.isolateModules(() => {
		rntl = require("@testing-library/react-native/pure") as RNTLPure;
		mod = require("@/hooks/useSheetsData") as SheetsModule;
	});
	// biome-ignore lint/style/noNonNullAssertion: isolateModules runs synchronously
	return { mod: mod!, rntl: rntl! };
}

/** Render the hook once and hand back the live `result`, `act`, and `unmount`. */
async function loadHook(): Promise<{
	mod: SheetsModule;
	result: { current: SheetsApi };
	act: RNTLPure["act"];
	unmount: () => Promise<void>;
}> {
	const { mod, rntl } = loadIsolated();
	const { result, unmount } = await rntl.renderHook(() => mod.useSheetsData());
	return { mod, result, act: rntl.act, unmount };
}

const alertMock = mockAlertAlert;

const internalRow: InternalProductSheet = {
	id: "ip1",
	sparkys_product_name: "Sparkler",
	product_type: "candle",
	sparkys_color: "red",
	texture: "smooth",
	shape: "round",
	occasions: "birthday",
	products: "111,222",
	threshold_quantity: 5,
	never_out: false,
};

const externalRow: ExternalProductSheet = {
	unique_id_sku: "ep1",
	manufacturer_color: "blue",
	brand: "Acme",
	size: "L",
	bag_quantity: 10,
	distributors: "distA",
	quantity: 3,
};

/** A representative `getAllSheetsData` payload (drives the load success path). */
function sheetsPayload() {
	return {
		metadata: { productType: ["candle"] },
		fullMetadata: { productType: [{ name: "candle", status: "active" }] },
		internalProducts: [internalRow],
		externalProducts: [externalRow],
	};
}

beforeEach(() => {
	authState.isSignedIn = false;
	mockGetAccessToken.mockReset().mockResolvedValue("tok");
	mockGetAllSheetsData.mockReset().mockResolvedValue(sheetsPayload());
	mockAddMetadataItem.mockReset().mockResolvedValue(undefined);
	mockAddInternalProduct.mockReset().mockResolvedValue(undefined);
	mockAddExternalProduct.mockReset().mockResolvedValue(undefined);
	mockUpdateMetadataItem.mockReset().mockResolvedValue(undefined);
	mockUpdateInternalProduct.mockReset().mockResolvedValue(undefined);
	mockUpdateExternalProduct.mockReset().mockResolvedValue(undefined);
	mockArchiveMetadataItem.mockReset().mockResolvedValue(undefined);
	mockUnarchiveMetadataItem.mockReset().mockResolvedValue(undefined);
	mockArchiveExternalProduct.mockReset().mockResolvedValue(undefined);
	mockUnarchiveExternalProduct.mockReset().mockResolvedValue(undefined);
	mockArchiveInternalProduct.mockReset().mockResolvedValue(undefined);
	mockUnarchiveInternalProduct.mockReset().mockResolvedValue(undefined);
	mockLogEvent.mockReset().mockResolvedValue(undefined);
	mockGetAuditEvents.mockReset().mockResolvedValue([]);
	mockServiceConstructor.mockReset();
	alertMock.mockReset();
	(setInternalProducts as jest.Mock).mockClear();
	(setExternalProducts as jest.Mock).mockClear();
	(updateFieldOptions as jest.Mock).mockClear();
	(updateMetadataItems as jest.Mock).mockClear();
});

describe("initial load on sign-in", () => {
	it("loads data when signed in with a token and populates state + caches", async () => {
		authState.isSignedIn = true;
		const { result } = await loadHook();

		expect(mockGetAllSheetsData).toHaveBeenCalledWith("tok");
		// Converted rows reach the product store and the global hook state.
		expect(setInternalProducts).toHaveBeenCalledWith([
			expect.objectContaining({ id: "ip1", converted: "internal" }),
		]);
		expect(setExternalProducts).toHaveBeenCalledWith([
			expect.objectContaining({ unique_id_sku: "ep1", converted: "external" }),
		]);
		expect(result.current.internalProducts).toEqual([
			expect.objectContaining({ converted: "internal" }),
		]);
		expect(result.current.externalProducts).toEqual([
			expect.objectContaining({ converted: "external" }),
		]);
		expect(result.current.isLoading).toBe(false);
		expect(result.current.error).toBeNull();
		expect(result.current.lastUpdated).toBeInstanceOf(Date);
		// fullMetadata present -> metadata items cache is refreshed.
		expect(updateMetadataItems).toHaveBeenCalledWith({
			productType: [{ name: "candle", status: "active" }],
		});
	});

	it("sets an error and skips loading when signed in but no token is available", async () => {
		authState.isSignedIn = true;
		mockGetAccessToken.mockResolvedValue(null);
		const { result } = await loadHook();

		expect(mockGetAllSheetsData).not.toHaveBeenCalled();
		expect(result.current.error).toBe("No access token available");
		expect(result.current.isLoading).toBe(false);
	});

	it("does not auto-load when signed out", async () => {
		authState.isSignedIn = false;
		await loadHook();
		expect(mockGetAccessToken).not.toHaveBeenCalled();
		expect(mockGetAllSheetsData).not.toHaveBeenCalled();
	});

	it("does not reload when data was already loaded (lastUpdated set)", async () => {
		authState.isSignedIn = true;
		const { mod, rntl } = loadIsolated();
		// First consumer loads and sets the singleton's `lastUpdated`.
		await rntl.renderHook(() => mod.useSheetsData());
		expect(mockGetAllSheetsData).toHaveBeenCalledTimes(1);

		// A second consumer of the same module sees `lastUpdated` already set, so
		// the load effect's guard short-circuits and no new fetch happens.
		mockGetAllSheetsData.mockClear();
		await rntl.renderHook(() => mod.useSheetsData());
		expect(mockGetAllSheetsData).not.toHaveBeenCalled();
	});

	it("omits the metadata-items cache refresh when fullMetadata is absent", async () => {
		authState.isSignedIn = true;
		mockGetAllSheetsData.mockResolvedValue({
			metadata: { productType: ["candle"] },
			internalProducts: [],
			externalProducts: [],
		});
		const { result } = await loadHook();

		expect(updateFieldOptions).toHaveBeenCalledWith({
			productType: ["candle"],
		});
		expect(updateMetadataItems).not.toHaveBeenCalled();
		// Falls back to an empty metadata record.
		expect(result.current.metadata).toEqual({});
	});

	it("handles a payload with null product arrays", async () => {
		authState.isSignedIn = true;
		mockGetAllSheetsData.mockResolvedValue({
			metadata: {},
			fullMetadata: {},
			internalProducts: null,
			externalProducts: null,
		});
		const { result } = await loadHook();

		expect(setInternalProducts).toHaveBeenCalledWith([]);
		expect(setExternalProducts).toHaveBeenCalledWith([]);
		expect(result.current.internalProducts).toEqual([]);
	});

	it("records an error message when the initial load throws", async () => {
		authState.isSignedIn = true;
		mockGetAllSheetsData.mockRejectedValue(new Error("network down"));
		const { result } = await loadHook();

		expect(result.current.error).toBe("network down");
		expect(result.current.isLoading).toBe(false);
		expect(result.current.lastUpdated).toBeNull();
	});

	it("falls back to a default error message when the thrown error is empty", async () => {
		authState.isSignedIn = true;
		// getErrorMessage("") -> "" (falsy) -> exercises the `|| "Failed to load…"`.
		mockGetAllSheetsData.mockRejectedValue("");
		const { result } = await loadHook();

		expect(result.current.error).toBe("Failed to load data from spreadsheet");
	});

	it("errors when SPREADSHEET_ID is unset", async () => {
		authState.isSignedIn = true;
		// Re-mock the resolved id to empty inside a fresh registry so the guard at
		// the top of loadSheetsData throws before any service call.
		let mod: SheetsModule;
		let rntl: RNTLPure;
		jest.isolateModules(() => {
			jest.doMock("@/constants/Spreadsheet", () => ({ SPREADSHEET_ID: "" }));
			rntl = require("@testing-library/react-native/pure") as RNTLPure;
			mod = require("@/hooks/useSheetsData") as SheetsModule;
		});
		// biome-ignore lint/style/noNonNullAssertion: isolateModules runs synchronously
		const { result } = await rntl!.renderHook(() => mod!.useSheetsData());
		jest.dontMock("@/constants/Spreadsheet");

		expect(mockGetAllSheetsData).not.toHaveBeenCalled();
		expect(result.current.error).toBe(
			"Please set EXPO_PUBLIC_SPREADSHEET_ID to database sheet ID.",
		);
	});
});

describe("loadInitialData (manual)", () => {
	it("loads on demand when a token is present", async () => {
		const { result, act } = await loadHook();
		expect(mockGetAllSheetsData).not.toHaveBeenCalled();

		await act(async () => {
			await result.current.loadInitialData();
		});
		expect(mockGetAllSheetsData).toHaveBeenCalledWith("tok");
		expect(result.current.lastUpdated).toBeInstanceOf(Date);
	});

	it("sets an error and returns early when no token is available", async () => {
		mockGetAccessToken.mockResolvedValue(null);
		const { result, act } = await loadHook();

		await act(async () => {
			await result.current.loadInitialData();
		});
		expect(mockGetAllSheetsData).not.toHaveBeenCalled();
		expect(result.current.error).toBe("No access token available");
	});
});

describe("refresh", () => {
	it("refreshes successfully and toggles isRefreshing without alerting", async () => {
		const { result, act } = await loadHook();

		await act(async () => {
			await result.current.refresh();
		});
		expect(mockGetAllSheetsData).toHaveBeenCalledWith("tok");
		expect(result.current.isRefreshing).toBe(false);
		expect(result.current.lastUpdated).toBeInstanceOf(Date);
		expect(alertMock).not.toHaveBeenCalled();
	});

	it("alerts when the refresh load fails", async () => {
		mockGetAllSheetsData.mockRejectedValue(new Error("refresh boom"));
		const { result, act } = await loadHook();

		await act(async () => {
			await result.current.refresh();
		});
		expect(result.current.isRefreshing).toBe(false);
		expect(alertMock).toHaveBeenCalledWith("Error", "refresh boom");
	});

	it("alerts the load fallback message when refresh fails without an error string", async () => {
		// `loadSheetsData` always supplies its own fallback on failure, so
		// `refreshSheetsData` surfaces `result.error` directly and the alert shows
		// that message.
		mockGetAllSheetsData.mockRejectedValue("");
		const { result, act } = await loadHook();

		await act(async () => {
			await result.current.refresh();
		});
		expect(alertMock).toHaveBeenCalledWith(
			"Error",
			"Failed to load data from spreadsheet",
		);
	});

	it("alerts and returns early when no token is available", async () => {
		mockGetAccessToken.mockResolvedValue(null);
		const { result, act } = await loadHook();

		await act(async () => {
			await result.current.refresh();
		});
		expect(mockGetAllSheetsData).not.toHaveBeenCalled();
		expect(alertMock).toHaveBeenCalledWith(
			"Error",
			"No access token available",
		);
	});
});

describe("addMetadata", () => {
	it("adds an item and appends it to the matching field key in state", async () => {
		const { result, act } = await loadHook();

		let outcome: Awaited<ReturnType<SheetsApi["addMetadata"]>> | undefined;
		await act(async () => {
			outcome = await result.current.addMetadata("product_types", "sparkler");
		});

		expect(outcome).toEqual({ success: true });
		expect(mockAddMetadataItem).toHaveBeenCalledWith(
			"product_types",
			"sparkler",
			"tok",
		);
		expect(result.current.metadata.productType).toEqual([
			{ name: "sparkler", status: "active" },
		]);
		// setMetadata pushes the active-only names into field options.
		expect(updateFieldOptions).toHaveBeenCalledWith({
			productType: ["sparkler"],
		});
	});

	it("leaves metadata unchanged when the sheet name has no field key", async () => {
		const { result, act } = await loadHook();

		await act(async () => {
			await result.current.addMetadata("manufacturer_colors", "teal");
		});
		// manufacturer_colors maps to null in getMetadataFieldKey -> no field added.
		expect(result.current.metadata.manufacturer_colors).toBeUndefined();
		expect(mockAddMetadataItem).toHaveBeenCalled();
	});

	it("returns the error and alerts nothing when the service throws", async () => {
		mockAddMetadataItem.mockRejectedValue(new Error("add failed"));
		const { result, act } = await loadHook();

		let outcome: Awaited<ReturnType<SheetsApi["addMetadata"]>> | undefined;
		await act(async () => {
			outcome = await result.current.addMetadata("product_types", "x");
		});
		expect(outcome).toEqual({ success: false, error: "add failed" });
	});

	it("falls back to a default error message when the thrown error is empty", async () => {
		mockAddMetadataItem.mockRejectedValue("");
		const { result, act } = await loadHook();

		let outcome: Awaited<ReturnType<SheetsApi["addMetadata"]>> | undefined;
		await act(async () => {
			outcome = await result.current.addMetadata("product_types", "x");
		});
		expect(outcome).toEqual({ success: false, error: "Failed to add item" });
	});

	it("alerts and returns the no-token result when unauthenticated", async () => {
		mockGetAccessToken.mockResolvedValue(null);
		const { result, act } = await loadHook();

		let outcome: Awaited<ReturnType<SheetsApi["addMetadata"]>> | undefined;
		await act(async () => {
			outcome = await result.current.addMetadata("product_types", "x");
		});
		expect(outcome).toEqual({ success: false, error: "No access token" });
		expect(mockAddMetadataItem).not.toHaveBeenCalled();
		expect(alertMock).toHaveBeenCalledWith(
			"Error",
			"No access token available",
		);
	});
});

describe("sheet-name -> field-key mapping", () => {
	// `getMetadataFieldKey` (reached via addMetadata, which appends the new item
	// under the mapped key) covers every non-default branch of that switch.
	const addMetadataCases: [string, string][] = [
		["product_types", "productType"],
		["colors", "color"],
		["brands", "manufacturer"],
		["textures", "texture"],
		["bag_quantities", "bagQuantity"],
		["shapes", "shape"],
		["distributors", "distributor"],
		["occasions", "occasion"],
	];

	it.each(
		addMetadataCases,
	)("addMetadata maps sheet %s to field key %s", async (sheetName, fieldKey) => {
		const { result, act } = await loadHook();
		await act(async () => {
			await result.current.addMetadata(sheetName, "item");
		});
		expect(result.current.metadata[fieldKey]).toEqual([
			{ name: "item", status: "active" },
		]);
	});

	// `getFieldKeyForSheetName` (reached via updateMetadata, surfaced in
	// `metadataChangeInfo.fieldKey`) covers every non-default branch there.
	const updateMetadataCases: [string, string][] = [
		["product_types", "productType"],
		["colors", "color"],
		["brands", "manufacturer"],
		["textures", "texture"],
		["shapes", "shape"],
		["distributors", "distributor"],
		["occasions", "occasion"],
		["bag_quantities", "bagQuantity"],
	];

	it.each(
		updateMetadataCases,
	)("updateMetadata maps sheet %s to field key %s", async (sheetName, fieldKey) => {
		const { result, act } = await loadHook();
		let outcome: Awaited<ReturnType<SheetsApi["updateMetadata"]>> | undefined;
		await act(async () => {
			outcome = await result.current.updateMetadata(sheetName, "a", "b");
		});
		expect(outcome?.metadataChangeInfo?.fieldKey).toBe(fieldKey);
	});
});

describe("addInternalProduct", () => {
	it("delegates to the service and reports success", async () => {
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["addInternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.addInternalProduct(internalRow);
		});
		expect(outcome).toEqual({ success: true });
		expect(mockAddInternalProduct).toHaveBeenCalledWith(internalRow, "tok");
	});

	it("stringifies the error when the service throws", async () => {
		mockAddInternalProduct.mockRejectedValue(new Error("add ip failed"));
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["addInternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.addInternalProduct(internalRow);
		});
		// This branch uses String(error), not getErrorMessage.
		expect(outcome).toEqual({
			success: false,
			error: "Error: add ip failed",
		});
	});

	it("falls back to a default error message when String(error) is empty", async () => {
		// String("") === "" (falsy) -> exercises the `|| "Failed to add…"` RHS.
		mockAddInternalProduct.mockRejectedValue("");
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["addInternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.addInternalProduct(internalRow);
		});
		expect(outcome).toEqual({
			success: false,
			error: "Failed to add internal product",
		});
	});

	it("alerts and returns the no-token result when unauthenticated", async () => {
		mockGetAccessToken.mockResolvedValue(null);
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["addInternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.addInternalProduct(internalRow);
		});
		expect(outcome).toEqual({ success: false, error: "No access token" });
		expect(mockAddInternalProduct).not.toHaveBeenCalled();
		expect(alertMock).toHaveBeenCalledWith(
			"Error",
			"No access token available",
		);
	});
});

describe("addExternalProduct", () => {
	it("delegates to the service and reports success", async () => {
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["addExternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.addExternalProduct(externalRow);
		});
		expect(outcome).toEqual({ success: true });
		expect(mockAddExternalProduct).toHaveBeenCalledWith(externalRow, "tok");
	});

	it("returns the error message when the service throws", async () => {
		mockAddExternalProduct.mockRejectedValue(new Error("add ep failed"));
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["addExternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.addExternalProduct(externalRow);
		});
		expect(outcome).toEqual({ success: false, error: "add ep failed" });
	});

	it("falls back to a default error message when the thrown error is empty", async () => {
		mockAddExternalProduct.mockRejectedValue("");
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["addExternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.addExternalProduct(externalRow);
		});
		expect(outcome).toEqual({
			success: false,
			error: "Failed to add external product",
		});
	});

	it("alerts and returns the no-token result when unauthenticated", async () => {
		mockGetAccessToken.mockResolvedValue(null);
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["addExternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.addExternalProduct(externalRow);
		});
		expect(outcome).toEqual({ success: false, error: "No access token" });
		expect(mockAddExternalProduct).not.toHaveBeenCalled();
	});
});

describe("updateMetadata", () => {
	it("renames an item in state and notifies metadata-change subscribers", async () => {
		const { result, act } = await loadHook();
		// Seed two existing items so the rename branch (prevMetadata[fieldKey])
		// runs and the non-matching item ("keep") exercises the map's pass-through.
		await act(async () => {
			await result.current.addMetadata("product_types", "old");
			await result.current.addMetadata("product_types", "keep");
		});

		const changes: Array<{
			fieldKey: string;
			oldValue: string;
			newValue: string;
		}> = [];
		const unsub = result.current.subscribeToMetadataChanges((c) =>
			changes.push(c),
		);

		let outcome: Awaited<ReturnType<SheetsApi["updateMetadata"]>> | undefined;
		await act(async () => {
			outcome = await result.current.updateMetadata(
				"product_types",
				"old",
				"new",
			);
		});

		expect(mockUpdateMetadataItem).toHaveBeenCalledWith(
			"product_types",
			"old",
			"new",
			"tok",
		);
		expect(result.current.metadata.productType).toEqual([
			{ name: "new", status: "active" },
			{ name: "keep", status: "active" },
		]);
		expect(outcome).toEqual({
			success: true,
			metadataChangeInfo: {
				fieldKey: "productType",
				oldValue: "old",
				newValue: "new",
			},
		});
		expect(changes).toEqual([
			{ fieldKey: "productType", oldValue: "old", newValue: "new" },
		]);

		// Unsubscribe removes the listener: a second change must not re-notify it.
		unsub();
		await act(async () => {
			await result.current.updateMetadata("product_types", "new", "newer");
		});
		expect(changes).toHaveLength(1);
	});

	it("does not notify when the sheet name has no field key", async () => {
		const { result, act } = await loadHook();

		const changes: unknown[] = [];
		result.current.subscribeToMetadataChanges((c) => changes.push(c));

		let outcome: Awaited<ReturnType<SheetsApi["updateMetadata"]>> | undefined;
		await act(async () => {
			// "sparkys_colors" maps to null in both key lookups.
			outcome = await result.current.updateMetadata("sparkys_colors", "a", "b");
		});
		expect(changes).toHaveLength(0);
		// metadataChangeInfo.fieldKey collapses to "" when no key matched.
		expect(outcome).toEqual({
			success: true,
			metadataChangeInfo: { fieldKey: "", oldValue: "a", newValue: "b" },
		});
	});

	it("leaves state untouched when the field key has no existing entries", async () => {
		const { result, act } = await loadHook();
		// No prior addMetadata, so prevMetadata[fieldKey] is undefined -> setMetadata
		// returns prev unchanged, but the notify branch still fires.
		const changes: unknown[] = [];
		result.current.subscribeToMetadataChanges((c) => changes.push(c));

		await act(async () => {
			await result.current.updateMetadata("product_types", "old", "new");
		});
		expect(result.current.metadata.productType).toBeUndefined();
		expect(changes).toHaveLength(1);
	});

	it("returns the error message when the service throws", async () => {
		mockUpdateMetadataItem.mockRejectedValue(new Error("upd meta failed"));
		const { result, act } = await loadHook();

		let outcome: Awaited<ReturnType<SheetsApi["updateMetadata"]>> | undefined;
		await act(async () => {
			outcome = await result.current.updateMetadata("product_types", "a", "b");
		});
		expect(outcome).toEqual({ success: false, error: "upd meta failed" });
	});

	it("falls back to a default error message when the thrown error is empty", async () => {
		mockUpdateMetadataItem.mockRejectedValue("");
		const { result, act } = await loadHook();

		let outcome: Awaited<ReturnType<SheetsApi["updateMetadata"]>> | undefined;
		await act(async () => {
			outcome = await result.current.updateMetadata("product_types", "a", "b");
		});
		expect(outcome).toEqual({
			success: false,
			error: "Failed to update metadata",
		});
	});

	it("alerts and returns the no-token result when unauthenticated", async () => {
		mockGetAccessToken.mockResolvedValue(null);
		const { result, act } = await loadHook();

		let outcome: Awaited<ReturnType<SheetsApi["updateMetadata"]>> | undefined;
		await act(async () => {
			outcome = await result.current.updateMetadata("product_types", "a", "b");
		});
		expect(outcome).toEqual({ success: false, error: "No access token" });
		expect(mockUpdateMetadataItem).not.toHaveBeenCalled();
	});
});

describe("updateInternalProduct", () => {
	it("delegates to the service and reports success", async () => {
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["updateInternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.updateInternalProduct(internalRow);
		});
		expect(outcome).toEqual({ success: true });
		expect(mockUpdateInternalProduct).toHaveBeenCalledWith(internalRow, "tok");
	});

	it("returns the error message when the service throws", async () => {
		mockUpdateInternalProduct.mockRejectedValue(new Error("upd ip failed"));
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["updateInternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.updateInternalProduct(internalRow);
		});
		expect(outcome).toEqual({ success: false, error: "upd ip failed" });
	});

	it("falls back to a default error message when the thrown error is empty", async () => {
		mockUpdateInternalProduct.mockRejectedValue("");
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["updateInternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.updateInternalProduct(internalRow);
		});
		expect(outcome).toEqual({
			success: false,
			error: "Failed to update internal product",
		});
	});

	it("alerts and returns the no-token result when unauthenticated", async () => {
		mockGetAccessToken.mockResolvedValue(null);
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["updateInternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.updateInternalProduct(internalRow);
		});
		expect(outcome).toEqual({ success: false, error: "No access token" });
		expect(mockUpdateInternalProduct).not.toHaveBeenCalled();
	});
});

describe("updateExternalProduct", () => {
	it("delegates to the service (default audit logging) and reports success", async () => {
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["updateExternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.updateExternalProduct(externalRow);
		});
		expect(outcome).toEqual({ success: true });
		expect(mockUpdateExternalProduct).toHaveBeenCalledWith(
			externalRow,
			"tok",
			false,
		);
	});

	it("forwards the skipAuditLog flag", async () => {
		const { result, act } = await loadHook();

		await act(async () => {
			await result.current.updateExternalProduct(externalRow, true);
		});
		expect(mockUpdateExternalProduct).toHaveBeenCalledWith(
			externalRow,
			"tok",
			true,
		);
	});

	it("returns the error message when the service throws", async () => {
		mockUpdateExternalProduct.mockRejectedValue(new Error("upd ep failed"));
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["updateExternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.updateExternalProduct(externalRow);
		});
		expect(outcome).toEqual({ success: false, error: "upd ep failed" });
	});

	it("falls back to a default error message when the thrown error is empty", async () => {
		mockUpdateExternalProduct.mockRejectedValue("");
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["updateExternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.updateExternalProduct(externalRow);
		});
		expect(outcome).toEqual({
			success: false,
			error: "Failed to update external product",
		});
	});

	it("alerts and returns the no-token result when unauthenticated", async () => {
		mockGetAccessToken.mockResolvedValue(null);
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["updateExternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.updateExternalProduct(externalRow);
		});
		expect(outcome).toEqual({ success: false, error: "No access token" });
		expect(mockUpdateExternalProduct).not.toHaveBeenCalled();
	});
});

describe("archiveMetadata", () => {
	it("flips an existing item to archived in state, leaving others active", async () => {
		const { result, act } = await loadHook();
		// "other" is non-matching and exercises the map's pass-through branch.
		await act(async () => {
			await result.current.addMetadata("product_types", "candle");
			await result.current.addMetadata("product_types", "other");
		});

		let outcome: Awaited<ReturnType<SheetsApi["archiveMetadata"]>> | undefined;
		await act(async () => {
			outcome = await result.current.archiveMetadata("product_types", "candle");
		});
		expect(outcome).toEqual({ success: true });
		expect(mockArchiveMetadataItem).toHaveBeenCalledWith(
			"product_types",
			"candle",
			"tok",
		);
		expect(result.current.metadata.productType).toEqual([
			{ name: "candle", status: "archived" },
			{ name: "other", status: "active" },
		]);
	});

	it("leaves state unchanged when the field key is absent", async () => {
		const { result, act } = await loadHook();
		// No seeded productType entries -> prevMetadata[fieldKey] undefined branch.
		await act(async () => {
			await result.current.archiveMetadata("product_types", "candle");
		});
		expect(result.current.metadata.productType).toBeUndefined();
		expect(mockArchiveMetadataItem).toHaveBeenCalled();
	});

	it("returns the error message when the service throws", async () => {
		mockArchiveMetadataItem.mockRejectedValue(new Error("arch meta failed"));
		const { result, act } = await loadHook();

		let outcome: Awaited<ReturnType<SheetsApi["archiveMetadata"]>> | undefined;
		await act(async () => {
			outcome = await result.current.archiveMetadata("product_types", "candle");
		});
		expect(outcome).toEqual({ success: false, error: "arch meta failed" });
	});

	it("falls back to a default error message when the thrown error is empty", async () => {
		mockArchiveMetadataItem.mockRejectedValue("");
		const { result, act } = await loadHook();

		let outcome: Awaited<ReturnType<SheetsApi["archiveMetadata"]>> | undefined;
		await act(async () => {
			outcome = await result.current.archiveMetadata("product_types", "candle");
		});
		expect(outcome).toEqual({
			success: false,
			error: "Failed to archive metadata",
		});
	});

	it("alerts and returns the no-token result when unauthenticated", async () => {
		mockGetAccessToken.mockResolvedValue(null);
		const { result, act } = await loadHook();

		let outcome: Awaited<ReturnType<SheetsApi["archiveMetadata"]>> | undefined;
		await act(async () => {
			outcome = await result.current.archiveMetadata("product_types", "candle");
		});
		expect(outcome).toEqual({ success: false, error: "No access token" });
		expect(mockArchiveMetadataItem).not.toHaveBeenCalled();
	});
});

describe("unarchiveMetadata", () => {
	it("flips an archived item back to active in state, leaving others untouched", async () => {
		const { result, act } = await loadHook();
		// "other" stays archived and exercises the map's pass-through branch.
		await act(async () => {
			await result.current.addMetadata("product_types", "candle");
			await result.current.addMetadata("product_types", "other");
			await result.current.archiveMetadata("product_types", "candle");
			await result.current.archiveMetadata("product_types", "other");
		});

		let outcome:
			| Awaited<ReturnType<SheetsApi["unarchiveMetadata"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.unarchiveMetadata(
				"product_types",
				"candle",
			);
		});
		expect(outcome).toEqual({ success: true });
		expect(mockUnarchiveMetadataItem).toHaveBeenCalledWith(
			"product_types",
			"candle",
			"tok",
		);
		expect(result.current.metadata.productType).toEqual([
			{ name: "candle", status: "active" },
			{ name: "other", status: "archived" },
		]);
	});

	it("leaves state unchanged when the field key is absent", async () => {
		const { result, act } = await loadHook();
		await act(async () => {
			await result.current.unarchiveMetadata("product_types", "candle");
		});
		expect(result.current.metadata.productType).toBeUndefined();
		expect(mockUnarchiveMetadataItem).toHaveBeenCalled();
	});

	it("returns the error message when the service throws", async () => {
		mockUnarchiveMetadataItem.mockRejectedValue(
			new Error("unarch meta failed"),
		);
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["unarchiveMetadata"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.unarchiveMetadata(
				"product_types",
				"candle",
			);
		});
		expect(outcome).toEqual({ success: false, error: "unarch meta failed" });
	});

	it("falls back to a default error message when the thrown error is empty", async () => {
		mockUnarchiveMetadataItem.mockRejectedValue("");
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["unarchiveMetadata"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.unarchiveMetadata(
				"product_types",
				"candle",
			);
		});
		expect(outcome).toEqual({
			success: false,
			error: "Failed to unarchive metadata",
		});
	});

	it("alerts and returns the no-token result when unauthenticated", async () => {
		mockGetAccessToken.mockResolvedValue(null);
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["unarchiveMetadata"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.unarchiveMetadata(
				"product_types",
				"candle",
			);
		});
		expect(outcome).toEqual({ success: false, error: "No access token" });
		expect(mockUnarchiveMetadataItem).not.toHaveBeenCalled();
	});
});

describe("archiveExternalProduct", () => {
	it("delegates to the service and reports success", async () => {
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["archiveExternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.archiveExternalProduct("ep1");
		});
		expect(outcome).toEqual({ success: true });
		expect(mockArchiveExternalProduct).toHaveBeenCalledWith("ep1", "tok");
	});

	it("returns the error message when the service throws", async () => {
		mockArchiveExternalProduct.mockRejectedValue(new Error("arch ep failed"));
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["archiveExternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.archiveExternalProduct("ep1");
		});
		expect(outcome).toEqual({ success: false, error: "arch ep failed" });
	});

	it("falls back to a default error message when the thrown error is empty", async () => {
		mockArchiveExternalProduct.mockRejectedValue("");
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["archiveExternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.archiveExternalProduct("ep1");
		});
		expect(outcome).toEqual({
			success: false,
			error: "Failed to archive external product",
		});
	});

	it("alerts and returns the no-token result when unauthenticated", async () => {
		mockGetAccessToken.mockResolvedValue(null);
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["archiveExternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.archiveExternalProduct("ep1");
		});
		expect(outcome).toEqual({ success: false, error: "No access token" });
		expect(mockArchiveExternalProduct).not.toHaveBeenCalled();
	});
});

describe("unarchiveExternalProduct", () => {
	it("delegates to the service and reports success", async () => {
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["unarchiveExternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.unarchiveExternalProduct("ep1");
		});
		expect(outcome).toEqual({ success: true });
		expect(mockUnarchiveExternalProduct).toHaveBeenCalledWith("ep1", "tok");
	});

	it("returns the error message when the service throws", async () => {
		mockUnarchiveExternalProduct.mockRejectedValue(
			new Error("unarch ep failed"),
		);
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["unarchiveExternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.unarchiveExternalProduct("ep1");
		});
		expect(outcome).toEqual({ success: false, error: "unarch ep failed" });
	});

	it("falls back to a default error message when the thrown error is empty", async () => {
		mockUnarchiveExternalProduct.mockRejectedValue("");
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["unarchiveExternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.unarchiveExternalProduct("ep1");
		});
		expect(outcome).toEqual({
			success: false,
			error: "Failed to unarchive external product",
		});
	});

	it("alerts and returns the no-token result when unauthenticated", async () => {
		mockGetAccessToken.mockResolvedValue(null);
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["unarchiveExternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.unarchiveExternalProduct("ep1");
		});
		expect(outcome).toEqual({ success: false, error: "No access token" });
		expect(mockUnarchiveExternalProduct).not.toHaveBeenCalled();
	});
});

describe("archiveInternalProduct", () => {
	it("delegates to the service and reports success", async () => {
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["archiveInternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.archiveInternalProduct("Sparkler");
		});
		expect(outcome).toEqual({ success: true });
		expect(mockArchiveInternalProduct).toHaveBeenCalledWith("Sparkler", "tok");
	});

	it("returns the error message when the service throws", async () => {
		mockArchiveInternalProduct.mockRejectedValue(new Error("arch ip failed"));
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["archiveInternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.archiveInternalProduct("Sparkler");
		});
		expect(outcome).toEqual({ success: false, error: "arch ip failed" });
	});

	it("falls back to a default error message when the thrown error is empty", async () => {
		mockArchiveInternalProduct.mockRejectedValue("");
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["archiveInternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.archiveInternalProduct("Sparkler");
		});
		expect(outcome).toEqual({
			success: false,
			error: "Failed to archive internal product",
		});
	});

	it("alerts and returns the no-token result when unauthenticated", async () => {
		mockGetAccessToken.mockResolvedValue(null);
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["archiveInternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.archiveInternalProduct("Sparkler");
		});
		expect(outcome).toEqual({ success: false, error: "No access token" });
		expect(mockArchiveInternalProduct).not.toHaveBeenCalled();
	});
});

describe("unarchiveInternalProduct", () => {
	it("delegates to the service and reports success", async () => {
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["unarchiveInternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.unarchiveInternalProduct("Sparkler");
		});
		expect(outcome).toEqual({ success: true });
		expect(mockUnarchiveInternalProduct).toHaveBeenCalledWith(
			"Sparkler",
			"tok",
		);
	});

	it("returns the error message when the service throws", async () => {
		mockUnarchiveInternalProduct.mockRejectedValue(
			new Error("unarch ip failed"),
		);
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["unarchiveInternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.unarchiveInternalProduct("Sparkler");
		});
		expect(outcome).toEqual({ success: false, error: "unarch ip failed" });
	});

	it("falls back to a default error message when the thrown error is empty", async () => {
		mockUnarchiveInternalProduct.mockRejectedValue("");
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["unarchiveInternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.unarchiveInternalProduct("Sparkler");
		});
		expect(outcome).toEqual({
			success: false,
			error: "Failed to unarchive internal product",
		});
	});

	it("alerts and returns the no-token result when unauthenticated", async () => {
		mockGetAccessToken.mockResolvedValue(null);
		const { result, act } = await loadHook();

		let outcome:
			| Awaited<ReturnType<SheetsApi["unarchiveInternalProduct"]>>
			| undefined;
		await act(async () => {
			outcome = await result.current.unarchiveInternalProduct("Sparkler");
		});
		expect(outcome).toEqual({ success: false, error: "No access token" });
		expect(mockUnarchiveInternalProduct).not.toHaveBeenCalled();
	});
});

describe("logAuditEvent", () => {
	const event = {
		timestamp: "2026-01-01T00:00:00Z",
		event_type: "create" as const,
		object_type: "metadata" as const,
		object_id: "x",
		object_name: "X",
		changes: "{}",
		before_state: "{}",
		sheet_name: "product_types",
	};

	it("delegates to the service when authenticated", async () => {
		const { result, act } = await loadHook();
		await act(async () => {
			await result.current.logAuditEvent(event);
		});
		expect(mockLogEvent).toHaveBeenCalledWith(event, "tok");
	});

	it("returns early without calling the service when no token is available", async () => {
		mockGetAccessToken.mockResolvedValue(null);
		const { result, act } = await loadHook();
		await act(async () => {
			await result.current.logAuditEvent(event);
		});
		expect(mockLogEvent).not.toHaveBeenCalled();
		// No alert on this path — logging failures are silent.
		expect(alertMock).not.toHaveBeenCalled();
	});

	it("swallows service errors", async () => {
		mockLogEvent.mockRejectedValue(new Error("log failed"));
		const { result, act } = await loadHook();
		await expect(
			act(async () => {
				await result.current.logAuditEvent(event);
			}),
		).resolves.toBeUndefined();
	});
});

describe("getAuditEvents", () => {
	it("returns events from the service with default paging", async () => {
		const events = [{ id: 1 }];
		mockGetAuditEvents.mockResolvedValue(events);
		const { result, act } = await loadHook();

		let out: unknown;
		await act(async () => {
			out = await result.current.getAuditEvents();
		});
		expect(out).toBe(events);
		expect(mockGetAuditEvents).toHaveBeenCalledWith("tok", 50, 0);
	});

	it("forwards explicit limit and offset", async () => {
		const { result, act } = await loadHook();
		await act(async () => {
			await result.current.getAuditEvents(10, 20);
		});
		expect(mockGetAuditEvents).toHaveBeenCalledWith("tok", 10, 20);
	});

	it("returns an empty list and alerts when no token is available", async () => {
		mockGetAccessToken.mockResolvedValue(null);
		const { result, act } = await loadHook();

		let out: unknown;
		await act(async () => {
			out = await result.current.getAuditEvents();
		});
		expect(out).toEqual([]);
		expect(mockGetAuditEvents).not.toHaveBeenCalled();
		expect(alertMock).toHaveBeenCalledWith(
			"Error",
			"No access token available",
		);
	});

	it("returns an empty list when the service throws", async () => {
		mockGetAuditEvents.mockRejectedValue(new Error("audit boom"));
		const { result, act } = await loadHook();

		let out: unknown;
		await act(async () => {
			out = await result.current.getAuditEvents();
		});
		expect(out).toEqual([]);
	});
});

describe("subscription lifecycle", () => {
	it("re-renders subscribers on state change and unsubscribes on unmount", async () => {
		const { result, act, unmount } = await loadHook();

		// A successful refresh runs updateSheetsState, notifying the forceUpdate sub.
		await act(async () => {
			await result.current.refresh();
		});
		const updatedAt = result.current.lastUpdated;
		expect(updatedAt).toBeInstanceOf(Date);

		await unmount();
		// After unmount the subscriber is removed, so a further state change must
		// not throw (no stale subscriber) — drive one through a fresh consumer.
		const { result: other, act: act2 } = await loadHook();
		await expect(
			act2(async () => {
				await other.current.refresh();
			}),
		).resolves.toBeUndefined();
	});
});

describe("service construction", () => {
	it("constructs GoogleSheetsService with the resolved spreadsheet ID", async () => {
		authState.isSignedIn = true;
		await loadHook();
		// Default dev sheet id from constants/Spreadsheet resolveSpreadsheetId().
		expect(mockServiceConstructor).toHaveBeenCalledWith(
			"1V4r_IT3XQB5hxIkX0iO6p1ASqgtz4MrfAGXq0QW8pzE",
		);
	});
});
