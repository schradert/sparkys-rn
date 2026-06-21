/**
 * Shared types for the logging subsystem.
 *
 * Log entries are persisted as NDJSON (one JSON object per line) so the format
 * is append-friendly and survives truncation. See `fileSink.ts` for storage and
 * `serialize.ts` for how arbitrary context is made JSON-safe + redacted.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
	/** Monotonic sequence number within the current session. */
	seq: number;
	/** Epoch milliseconds (fast range filtering without re-parsing `ts`). */
	t: number;
	/** ISO-8601 timestamp. */
	ts: string;
	level: LogLevel;
	/** Subsystem tag, e.g. "Sheets", "Auth", "console". */
	tag: string;
	/** Human-readable message (already redacted of token-shaped substrings). */
	msg: string;
	/** Id of the app session this entry belongs to. */
	session: string;
	/** JSON-safe, redacted, size-bounded structured context. Omitted when absent. */
	ctx?: unknown;
}

/** Metadata about a persisted log segment file on disk. */
export interface SegmentInfo {
	name: string;
	size: number;
	modified: number | null;
}
