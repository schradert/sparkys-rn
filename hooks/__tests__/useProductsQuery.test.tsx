import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren, ReactElement } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProductsQuery } from "@/hooks/useProductsQuery";
import { GoogleSheetsService } from "@/services/googleSheets";

jest.mock("@/hooks/useAuth", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/googleSheets");
jest.mock("@/constants/Products", () => ({
	convertInternalProductSheetToModel: (row: unknown) => row,
	convertExternalProductSheetToModel: (row: unknown) => row,
}));

const mockUseAuth = jest.mocked(useAuth);
const MockService = jest.mocked(GoogleSheetsService);

function wrapper({ children }: PropsWithChildren): ReactElement {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mockService(getAllSheetsData: jest.Mock) {
	MockService.mockImplementation(
		() => ({ getAllSheetsData }) as unknown as GoogleSheetsService,
	);
}

describe("useProductsQuery", () => {
	beforeEach(() => jest.clearAllMocks());

	it("stays idle when signed out", async () => {
		mockUseAuth.mockReturnValue({
			getAccessToken: jest.fn(),
			isSignedIn: false,
		} as unknown as ReturnType<typeof useAuth>);
		const { result } = await renderHook(() => useProductsQuery(), { wrapper });
		expect(result.current.fetchStatus).toBe("idle");
	});

	it("fetches and maps product data when signed in", async () => {
		mockService(
			jest.fn().mockResolvedValue({
				internalProducts: [{ id: "1" }],
				externalProducts: [{ unique_id_sku: "x" }],
				fullMetadata: { color: [] },
			}),
		);
		mockUseAuth.mockReturnValue({
			getAccessToken: jest.fn().mockResolvedValue("token"),
			isSignedIn: true,
		} as unknown as ReturnType<typeof useAuth>);
		const { result } = await renderHook(() => useProductsQuery(), { wrapper });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual({
			internalProducts: [{ id: "1" }],
			externalProducts: [{ unique_id_sku: "x" }],
			metadata: { color: [] },
		});
	});

	it("defaults missing data to empty collections", async () => {
		mockService(jest.fn().mockResolvedValue({}));
		mockUseAuth.mockReturnValue({
			getAccessToken: jest.fn().mockResolvedValue("token"),
			isSignedIn: true,
		} as unknown as ReturnType<typeof useAuth>);
		const { result } = await renderHook(() => useProductsQuery(), { wrapper });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual({
			internalProducts: [],
			externalProducts: [],
			metadata: {},
		});
	});

	it("errors when no access token is available", async () => {
		mockService(jest.fn());
		mockUseAuth.mockReturnValue({
			getAccessToken: jest.fn().mockResolvedValue(null),
			isSignedIn: true,
		} as unknown as ReturnType<typeof useAuth>);
		const { result } = await renderHook(() => useProductsQuery(), { wrapper });
		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(result.current.error).toEqual(
			new Error("No access token available"),
		);
	});
});
