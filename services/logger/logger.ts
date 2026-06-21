/**
 * Core logger: a lightweight, ergonomic API used across the app.
 *
 *   logger.debug/info/warn/error(tag, msg, context?)
 *
 * Mirrors the codebase's module-global + subscriber idiom (see `hooks/useAuth`,
 * `store/products`). State lives at module scope; `useLogs()` subscribes for a
 * live view. A log call NEVER throws and never blocks: entries land in an
 * in-memory ring (for the live view) and a pending buffer that is flushed to
 * disk in batches (and immediately on `error`).
 */

import { appendLines } from "./fileSink";
import { formatEntry, redactString, serializeContext } from "./serialize";
import type { LogEntry, LogLevel } from "./types";

const LEVEL_RANK: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

const RING_MAX = 300; // recent entries kept in memory for the live view
const PENDING_MAX = 2000; // safety cap on un-flushed lines
const FLUSH_DEBOUNCE_MS = 2500;

function makeSessionId(): string {
	const rand = Math.random().toString(36).slice(2, 8);
	return `${Date.now().toString(36)}-${rand}`;
}

const sessionId = makeSessionId();
let seq = 0;
let minLevel: LogLevel =
	typeof __DEV__ !== "undefined" && __DEV__ ? "debug" : "info";

const ring: LogEntry[] = [];
let subscribers: Array<() => void> = [];
let pending: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function notify(): void {
	for (const cb of subscribers) {
		try {
			cb();
		} catch {}
	}
}

/** Subscribe to live log updates. Returns an unsubscribe function. */
export function subscribeToLogs(cb: () => void): () => void {
	subscribers.push(cb);
	return () => {
		subscribers = subscribers.filter((s) => s !== cb);
	};
}

/** Snapshot of the in-memory ring (oldest → newest). */
export function getLogEntries(): LogEntry[] {
	return ring.slice();
}

export function getSessionId(): string {
	return sessionId;
}

export function getMinLevel(): LogLevel {
	return minLevel;
}

export function setMinLevel(level: LogLevel): void {
	minLevel = level;
}

/** Persist any buffered lines now (synchronous). Safe to call anytime. */
export function flushLogs(): void {
	if (flushTimer) {
		clearTimeout(flushTimer);
		flushTimer = null;
	}
	if (!pending.length) return;
	const lines = pending;
	pending = [];
	try {
		appendLines(lines);
	} catch {}
}

function scheduleFlush(): void {
	if (flushTimer) return;
	flushTimer = setTimeout(() => {
		flushTimer = null;
		flushLogs();
	}, FLUSH_DEBOUNCE_MS);
}

function emit(level: LogLevel, tag: string, msg: string, ctx?: unknown): void {
	try {
		if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;
		const now = Date.now();
		const entry: LogEntry = {
			seq: ++seq,
			t: now,
			ts: new Date(now).toISOString(),
			level,
			tag: String(tag),
			msg: redactString(String(msg)),
			session: sessionId,
			ctx: ctx === undefined ? undefined : serializeContext(ctx),
		};

		ring.push(entry);
		if (ring.length > RING_MAX) ring.shift();
		notify();

		if (pending.length < PENDING_MAX) pending.push(formatEntry(entry));
		// Persist errors immediately so they survive a crash; batch the rest.
		if (level === "error") flushLogs();
		else scheduleFlush();
	} catch {
		// Logging must never throw.
	}
}

export const logger = {
	debug: (tag: string, msg: string, ctx?: unknown) =>
		emit("debug", tag, msg, ctx),
	info: (tag: string, msg: string, ctx?: unknown) =>
		emit("info", tag, msg, ctx),
	warn: (tag: string, msg: string, ctx?: unknown) =>
		emit("warn", tag, msg, ctx),
	error: (tag: string, msg: string, ctx?: unknown) =>
		emit("error", tag, msg, ctx),
};

export type Logger = typeof logger;
