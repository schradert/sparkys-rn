/**
 * Web stub for the log file sink. The native `expo-file-system` object API is
 * unavailable on `react-native-web`, so on web we keep logs in memory only (the
 * ring buffer in `logger.ts` still works and powers the live view). Metro
 * resolves this `.web.ts` variant automatically for the web bundle.
 */

import type { SegmentInfo } from "./types";

export function appendLines(_lines: string[]): void {}

export async function readAllSegments(): Promise<string> {
	return "";
}

export function listSegmentInfo(): SegmentInfo[] {
	return [];
}

export function readMarker(): string | null {
	return null;
}

export function writeMarker(_json: string): void {}

export function isAvailable(): boolean {
	return false;
}
