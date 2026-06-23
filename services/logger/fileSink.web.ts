/**
 * Web stub for the log file sink. The native `expo-file-system` object API is
 * unavailable on `react-native-web`, so on web we keep logs in memory only (the
 * ring buffer in `logger.ts` still works and powers the live view). Metro
 * resolves this `.web.ts` variant automatically for the web bundle.
 */

import type { SegmentInfo } from "./types";

/** No-op on web: there is no on-disk segment to append to. */
export function appendLines(_lines: string[]): void {}

/** No retained segments on web; always empty. */
export async function readAllSegments(): Promise<string> {
	return "";
}

/** No segments on web; always empty. */
export function listSegmentInfo(): SegmentInfo[] {
	return [];
}

/** No session marker on web; always null. */
export function readMarker(): string | null {
	return null;
}

/** No-op on web: the session marker isn't persisted. */
export function writeMarker(_json: string): void {}

/** Always false: on-disk persistence is unavailable on web. */
export function isAvailable(): boolean {
	return false;
}
