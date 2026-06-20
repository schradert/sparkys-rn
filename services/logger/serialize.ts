/**
 * Turns arbitrary log context into a JSON-safe, redacted, size-bounded value.
 *
 * Why this exists:
 * - `JSON.stringify(new Error())` is `"{}"` — Errors must be expanded by hand.
 * - Circular references throw — we detect and replace them.
 * - Logs are uploaded to Google Drive, so secrets (OAuth tokens, passwords)
 *   MUST be scrubbed before anything is persisted. The app's Google access
 *   token flows through `useAuth`, so this is not hypothetical.
 */

import type { LogEntry } from "./types";

const MAX_STRING = 4096;
const MAX_DEPTH = 6;
const MAX_ITEMS = 100;
const REDACTED = "[REDACTED]";

/**
 * Object keys whose values are always replaced wholesale. Compared after
 * lowercasing and stripping non-alphanumerics, so `access_token`, `accessToken`
 * and `Authorization` all match.
 */
const REDACT_KEYS = new Set([
	"accesstoken",
	"refreshtoken",
	"idtoken",
	"token",
	"authorization",
	"auth",
	"bearer",
	"password",
	"passwd",
	"secret",
	"clientsecret",
	"apikey",
	"cookie",
	"credential",
	"credentials",
	"serverauthcode",
]);

function normalizeKey(key: string): string {
	return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/** Scrub token-shaped substrings from any string we persist. */
export function redactString(value: string): string {
	let out = value;
	// Google OAuth access tokens (ya29.*).
	out = out.replace(/ya29\.[A-Za-z0-9._-]+/g, "[REDACTED_TOKEN]");
	// JWTs / id tokens (three base64url segments).
	out = out.replace(
		/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
		"[REDACTED_JWT]",
	);
	// "Bearer <token>".
	out = out.replace(/(bearer\s+)[A-Za-z0-9._-]+/gi, `$1${REDACTED}`);
	return out;
}

function clampString(s: string): string {
	const red = redactString(s);
	return red.length > MAX_STRING
		? `${red.slice(0, MAX_STRING)}…[+${red.length - MAX_STRING} chars]`
		: red;
}

function serializeError(
	err: Error,
	seen: Set<unknown>,
): Record<string, unknown> {
	const out: Record<string, unknown> = {
		name: err.name,
		message: clampString(String(err.message ?? "")),
	};
	if (err.stack) out.stack = clampString(String(err.stack));
	// Capture own enumerable extras (e.g. `error.code`, `error.response`).
	for (const key of Object.keys(err)) {
		if (key === "name" || key === "message" || key === "stack") continue;
		try {
			out[key] = REDACT_KEYS.has(normalizeKey(key))
				? REDACTED
				: safe((err as unknown as Record<string, unknown>)[key], 1, seen);
		} catch {
			out[key] = "[Unserializable]";
		}
	}
	const cause = (err as { cause?: unknown }).cause;
	if (cause != null) out.cause = safe(cause, 1, seen);
	return out;
}

function safe(value: unknown, depth: number, seen: Set<unknown>): unknown {
	if (value === null) return null;
	const t = typeof value;
	if (t === "string") return clampString(value as string);
	if (t === "number")
		return Number.isFinite(value as number) ? value : String(value);
	if (t === "boolean" || t === "undefined") return value;
	if (t === "bigint") return `${(value as bigint).toString()}n`;
	if (t === "function")
		return `[Function ${(value as { name?: string }).name || "anonymous"}]`;
	if (t === "symbol") return (value as symbol).toString();

	// Objects from here on.
	if (value instanceof Error) return serializeError(value, seen);
	if (depth >= MAX_DEPTH) return "[Truncated: max depth]";
	if (seen.has(value)) return "[Circular]";
	seen.add(value);
	try {
		if (Array.isArray(value)) {
			const out = value
				.slice(0, MAX_ITEMS)
				.map((v) => safe(v, depth + 1, seen));
			if (value.length > MAX_ITEMS)
				out.push(`[+${value.length - MAX_ITEMS} more]`);
			return out;
		}
		if (value instanceof Map) {
			const out: Record<string, unknown> = {};
			let i = 0;
			for (const [k, v] of value) {
				if (i++ >= MAX_ITEMS) {
					out["…"] = `[+${value.size - MAX_ITEMS} more]`;
					break;
				}
				const key = String(k);
				out[key] = REDACT_KEYS.has(normalizeKey(key))
					? REDACTED
					: safe(v, depth + 1, seen);
			}
			return out;
		}
		if (value instanceof Set) return safe([...value], depth, seen);

		// Plain object / class instance.
		const obj = value as Record<string, unknown>;
		const keys = Object.keys(obj);
		const out: Record<string, unknown> = {};
		let i = 0;
		for (const key of keys) {
			if (i++ >= MAX_ITEMS) {
				out["…"] = `[+${keys.length - MAX_ITEMS} more]`;
				break;
			}
			if (REDACT_KEYS.has(normalizeKey(key))) {
				out[key] = REDACTED;
				continue;
			}
			try {
				out[key] = safe(obj[key], depth + 1, seen);
			} catch {
				out[key] = "[Unserializable]";
			}
		}
		return out;
	} finally {
		// Drop on exit so siblings sharing a ref aren't flagged "Circular";
		// only genuine cycles (an ancestor) are caught.
		seen.delete(value);
	}
}

/** Produce a JSON-safe, redacted, bounded representation of arbitrary context. */
export function serializeContext(ctx: unknown): unknown {
	try {
		return safe(ctx, 0, new Set());
	} catch {
		return "[Unserializable context]";
	}
}

/** Serialize a full entry to a single NDJSON line. Never throws. */
export function formatEntry(entry: LogEntry): string {
	try {
		return JSON.stringify(entry);
	} catch {
		return JSON.stringify({
			t: entry.t,
			ts: entry.ts,
			seq: entry.seq,
			level: entry.level,
			tag: entry.tag,
			msg: "[Unserializable entry]",
			session: entry.session,
		});
	}
}
