// Google Sheets spreadsheet ID for the active build variant.
//
// EAS injects `EXPO_PUBLIC_SPREADSHEET_ID` per build profile (see `eas.json`),
// so development, preview and production builds each target their own sheet.
// Local `expo start` runs without the EAS environment, so we fall back to the
// development sheet to keep the dev flow working with no extra setup.

/** Development sheet — the fallback used by local `expo start`. */
export const DEFAULT_SPREADSHEET_ID =
	"1V4r_IT3XQB5hxIkX0iO6p1ASqgtz4MrfAGXq0QW8pzE";

/**
 * Resolve the spreadsheet ID from the environment, falling back to the
 * development sheet when the variable is missing or blank.
 */
export function resolveSpreadsheetId(
	envValue: string | undefined = process.env.EXPO_PUBLIC_SPREADSHEET_ID,
): string {
	const trimmed = envValue?.trim();
	return trimmed ? trimmed : DEFAULT_SPREADSHEET_ID;
}

/** The resolved spreadsheet ID for this run. */
export const SPREADSHEET_ID = resolveSpreadsheetId();
