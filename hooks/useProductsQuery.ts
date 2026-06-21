import { useQuery } from "@tanstack/react-query";
import {
	convertExternalProductSheetToModel,
	convertInternalProductSheetToModel,
} from "@/constants/Products";
import { GoogleSheetsService } from "@/services/googleSheets";
import { useAuth } from "./useAuth";

// TODO: source from EXPO_PUBLIC_SPREADSHEET_ID once eas.json passes it through.
const SPREADSHEET_ID = "1V4r_IT3XQB5hxIkX0iO6p1ASqgtz4MrfAGXq0QW8pzE";

/**
 * Server-state for the Google Sheets product data, via TanStack Query.
 *
 * Gives caching, request dedupe, retry/backoff, and background refetch for
 * free — a modern replacement for the hand-rolled global state + manual
 * subscribe/forceUpdate in `useSheetsData`. Adopt incrementally:
 * `const { data, isLoading, refetch } = useProductsQuery();`
 */
export function useProductsQuery() {
	const { getAccessToken, isSignedIn } = useAuth();

	return useQuery({
		queryKey: ["sheets", "products"],
		enabled: isSignedIn,
		staleTime: 60_000,
		queryFn: async () => {
			const accessToken = await getAccessToken();
			if (!accessToken) {
				throw new Error("No access token available");
			}
			const service = new GoogleSheetsService(SPREADSHEET_ID);
			const data = await service.getAllSheetsData(accessToken);
			return {
				internalProducts: (data.internalProducts ?? []).map(
					convertInternalProductSheetToModel,
				),
				externalProducts: (data.externalProducts ?? []).map(
					convertExternalProductSheetToModel,
				),
				metadata: data.fullMetadata ?? {},
			};
		},
	});
}
