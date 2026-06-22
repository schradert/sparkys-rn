import { act, renderHook } from "@testing-library/react-native";
import { setExternalProducts, setInternalProducts } from "@/store/products";

// The view-model depends on the sheets hook and the camera permission hook; stub
// both so the hook can mount outside the screen. The sheets object and the
// camera tuple must be stable identities across renders, otherwise the hook's
// dependency-tracked effects would re-run every render and loop.
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/hooks/useSheetsData", () => {
	const sheets = {
		isRefreshing: false,
		error: null,
		refresh: jest.fn(),
		addMetadata: jest.fn(async () => ({ success: true })),
		addInternalProduct: jest.fn(async () => ({ success: true })),
		addExternalProduct: jest.fn(async () => ({ success: true })),
		updateInternalProduct: jest.fn(async () => ({ success: true })),
		subscribeToMetadataChanges: jest.fn(() => () => {}),
		getAuditEvents: jest.fn(async () => []),
	};
	return { useSheetsData: () => sheets };
});
jest.mock("expo-camera", () => {
	const permission = {
		granted: true,
		canAskAgain: true,
		expires: "never",
		status: "granted",
	};
	const requestPermission = jest.fn();
	return { useCameraPermissions: () => [permission, requestPermission] };
});

import { useInventoryState } from "@/hooks/useInventoryState";

beforeEach(() => {
	jest.clearAllMocks();
	setInternalProducts([]);
	setExternalProducts([]);
});

describe("useInventoryState — handleMetadataPress field routing", () => {
	it("ignores a field that is neither an internal nor external filter key", async () => {
		const { result } = await renderHook(() => useInventoryState());

		// A field outside both filter-key sets is a no-op: neither selection set
		// changes and no selection is registered.
		await act(async () => {
			result.current.handleMetadataPress("not_a_filter_field", "whatever");
		});

		expect(result.current.totalSelections).toBe(0);
		expect(result.current.internalFilters.product_type).toEqual([]);
		expect(result.current.externalFilters.brand).toEqual([]);
	});

	it("toggles an internal filter key on and back off", async () => {
		const { result } = await renderHook(() => useInventoryState());

		await act(async () => {
			result.current.handleMetadataPress("product_type", "Latex Balloons");
		});
		expect(result.current.internalFilters.product_type).toEqual([
			"Latex Balloons",
		]);

		await act(async () => {
			result.current.handleMetadataPress("product_type", "Latex Balloons");
		});
		expect(result.current.internalFilters.product_type).toEqual([]);
	});

	it("toggles an external filter key on and back off", async () => {
		const { result } = await renderHook(() => useInventoryState());

		await act(async () => {
			result.current.handleMetadataPress("brand", "Qualatex");
		});
		expect(result.current.externalFilters.brand).toEqual(["Qualatex"]);

		await act(async () => {
			result.current.handleMetadataPress("brand", "Qualatex");
		});
		expect(result.current.externalFilters.brand).toEqual([]);
	});
});
