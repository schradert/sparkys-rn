/**
 * Native persistence for logs: rotating NDJSON segment files under the app's
 * document directory.
 *
 * Uses the new `expo-file-system` object API. All of these FS calls are
 * SYNCHRONOUS and THROW on edge cases (missing dir, already-exists), so every
 * call is guarded — a logging call must never throw. The web build is served by
 * `fileSink.web.ts` (no-op) since the native FS API is unavailable there.
 *
 * Rotation policy: append to an active segment until it crosses
 * MAX_SEGMENT_BYTES, then start a new one; keep at most MAX_SEGMENTS files and
 * nothing older than MAX_AGE_MS, pruning oldest first.
 */

import { Directory, File, Paths } from "expo-file-system";
import type { SegmentInfo } from "./types";

const DIR_NAME = "logs";
const SEGMENT_PREFIX = "seg-";
const SEGMENT_EXT = ".ndjson";
const SEGMENT_RE = /^seg-(\d+)\.ndjson$/;

const MAX_SEGMENT_BYTES = 256 * 1024; // ~256 KB per file
const MAX_SEGMENTS = 8; // ~2 MB total cap
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let logDir: Directory | null = null;
let activeSegment: File | null = null;

function getDir(): Directory {
	if (logDir) return logDir;
	const dir = new Directory(Paths.document, DIR_NAME);
	try {
		if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
	} catch {
		// If we can't create the dir, subsequent writes will no-op safely.
	}
	logDir = dir;
	return dir;
}

/** Epoch ms encoded in a segment file name (0 if it doesn't match). */
function segmentTime(name: string): number {
	const m = name.match(SEGMENT_RE);
	return m ? Number(m[1]) : 0;
}

/** Segment files, oldest → newest. Best effort; never throws. */
function listSegments(): File[] {
	try {
		const dir = getDir();
		if (!dir.exists) return [];
		return dir
			.list()
			.filter(
				(e): e is File =>
					e instanceof File &&
					e.name.startsWith(SEGMENT_PREFIX) &&
					e.name.endsWith(SEGMENT_EXT),
			)
			.sort((a, b) => segmentTime(a.name) - segmentTime(b.name));
	} catch {
		return [];
	}
}

function prune(): void {
	try {
		const now = Date.now();
		// Age-based pruning.
		for (const f of listSegments()) {
			const stamp = segmentTime(f.name) || f.lastModified || now;
			if (now - stamp > MAX_AGE_MS) {
				try {
					f.delete();
				} catch {}
			}
		}
		// Count-based pruning (oldest first).
		const remaining = listSegments();
		for (let i = 0; i < remaining.length - MAX_SEGMENTS; i++) {
			try {
				remaining[i].delete();
			} catch {}
		}
	} catch {}
}

function newSegment(): File {
	const file = new File(
		getDir(),
		`${SEGMENT_PREFIX}${Date.now()}${SEGMENT_EXT}`,
	);
	try {
		file.create({ intermediates: true, overwrite: true });
	} catch {}
	prune();
	return file;
}

function getActiveSegment(): File {
	// Fast path: cached segment still under cap.
	if (activeSegment) {
		try {
			if (activeSegment.exists && activeSegment.size < MAX_SEGMENT_BYTES)
				return activeSegment;
		} catch {}
	}
	// Reuse the newest existing segment if it has room, else start fresh.
	const segs = listSegments();
	const newest = segs[segs.length - 1];
	try {
		if (newest?.exists && newest.size < MAX_SEGMENT_BYTES) {
			activeSegment = newest;
			return newest;
		}
	} catch {}
	activeSegment = newSegment();
	return activeSegment;
}

/** Append serialized NDJSON lines (without trailing newlines). Never throws. */
export function appendLines(lines: string[]): void {
	if (!lines.length) return;
	try {
		const seg = getActiveSegment();
		seg.write(`${lines.join("\n")}\n`, { append: true });
		try {
			if (seg.size >= MAX_SEGMENT_BYTES) activeSegment = null; // rotate next time
		} catch {}
	} catch {
		// Swallow: logging must never crash the app.
	}
}

/** Concatenated NDJSON of all retained segments, oldest → newest. */
export async function readAllSegments(): Promise<string> {
	const parts: string[] = [];
	for (const f of listSegments()) {
		try {
			parts.push(await f.text());
		} catch {}
	}
	return parts.join("");
}

/** Name/size/mtime for each retained segment, oldest → newest. */
export function listSegmentInfo(): SegmentInfo[] {
	return listSegments().map((f) => ({
		name: f.name,
		size: (() => {
			try {
				return f.size;
			} catch {
				return 0;
			}
		})(),
		modified: (() => {
			try {
				return f.lastModified;
			} catch {
				return null;
			}
		})(),
	}));
}

/**
 * Session marker: a tiny JSON file used to infer abnormal termination.
 * It is named so it never matches the segment filter, so listing/pruning
 * segments leaves it untouched.
 */
const MARKER_NAME = ".session.json";

/** Read the raw session-marker JSON, or null when none is stored. */
export function readMarker(): string | null {
	try {
		const f = new File(getDir(), MARKER_NAME);
		return f.exists ? f.textSync() : null;
	} catch {
		return null;
	}
}

/** Write the session-marker JSON, used to infer abnormal termination. */
export function writeMarker(json: string): void {
	try {
		const f = new File(getDir(), MARKER_NAME);
		if (!f.exists) f.create({ intermediates: true, overwrite: true });
		f.write(json);
	} catch {}
}

/** True when on-disk persistence is available (always on native). */
export function isAvailable(): boolean {
	return true;
}
