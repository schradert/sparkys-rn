/**
 * Assembles "relevant" logs into a single human-readable file for upload.
 *
 * Disk is the source of truth: we flush pending entries, read all retained
 * NDJSON segments, parse, then filter by the chosen scope. Output is a header
 * block (device/app/session metadata) followed by one formatted line per entry,
 * capped in size so we never approach Drive's multipart limit.
 */

import Constants from "expo-constants";
import { Platform } from "react-native";
import { readAllSegments } from "./fileSink";
import { flushLogs, getSessionId } from "./logger";
import type { LogEntry } from "./types";

export type LogScope =
	| "session"
	| "last15min"
	| "sinceLastError"
	| "allRetained";

export const LOG_SCOPES: { key: LogScope; label: string; hint: string }[] = [
	{
		key: "session",
		label: "Current session",
		hint: "Everything since the app last launched",
	},
	{ key: "last15min", label: "Last 15 minutes", hint: "Recent activity only" },
	{
		key: "sinceLastError",
		label: "Since last error",
		hint: "From the most recent error onward",
	},
	{
		key: "allRetained",
		label: "All retained logs",
		hint: "Every log still stored on this device",
	},
];

const MAX_BODY_BYTES = 4 * 1024 * 1024; // stay under Drive's 5 MB multipart cap
const LAST_MINUTES = 15;

export interface CollectedLogs {
	header: string;
	body: string;
	fileName: string;
	entryCount: number;
}

function parseEntries(ndjson: string): LogEntry[] {
	const out: LogEntry[] = [];
	for (const line of ndjson.split("\n")) {
		const s = line.trim();
		if (!s) continue;
		try {
			const e = JSON.parse(s) as LogEntry;
			if (e && typeof e.t === "number" && typeof e.level === "string")
				out.push(e);
		} catch {
			// Skip a partial/corrupt line rather than failing the whole upload.
		}
	}
	return out;
}

function filterByScope(entries: LogEntry[], scope: LogScope): LogEntry[] {
	switch (scope) {
		case "allRetained":
			return entries;
		case "session":
			return entries.filter((e) => e.session === getSessionId());
		case "last15min": {
			const cutoff = Date.now() - LAST_MINUTES * 60_000;
			return entries.filter((e) => e.t >= cutoff);
		}
		case "sinceLastError": {
			let idx = -1;
			for (let i = entries.length - 1; i >= 0; i--) {
				if (entries[i].level === "error") {
					idx = i;
					break;
				}
			}
			if (idx === -1)
				return entries.filter((e) => e.session === getSessionId());
			return entries.slice(idx);
		}
	}
}

function deviceLabel(): string {
	if (Platform.OS === "android") {
		const c = Platform.constants as { Model?: string; Manufacturer?: string };
		return c?.Model || c?.Manufacturer || "android";
	}
	return Platform.OS;
}

function sanitize(s: string): string {
	return s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "x";
}

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

function stamp(d: Date): string {
	return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function buildFileName(): string {
	const version = Constants.expoConfig?.version ?? "0";
	return `sparkys-diag_${sanitize(version)}_${sanitize(deviceLabel())}_${sanitize(`${Platform.OS}-${Platform.Version}`)}_${stamp(new Date())}.log`;
}

function renderHeader(
	scope: LogScope,
	count: number,
	userEmail?: string,
): string {
	const now = new Date();
	const lines = [
		"# Sparky's InvX diagnostics",
		`# generated: ${now.toISOString()} (local: ${now.toString()})`,
		`# app version: ${Constants.expoConfig?.version ?? "unknown"}`,
		`# platform: ${Platform.OS} ${String(Platform.Version)} (${deviceLabel()})`,
		`# session: ${getSessionId()}`,
		`# scope: ${scope}  entries: ${count}`,
	];
	if (userEmail) lines.push(`# user: ${userEmail}`);
	lines.push("# ---");
	return lines.join("\n");
}

function renderLine(e: LogEntry): string {
	const level = e.level.toUpperCase().padEnd(5);
	const base = `${e.ts} ${level} [${e.tag}] ${e.msg}`;
	if (e.ctx === undefined) return base;
	let ctx: string;
	try {
		ctx = JSON.stringify(e.ctx);
	} catch {
		ctx = "[unserializable]";
	}
	return `${base} | ${ctx}`;
}

/** Drop oldest lines until under the byte cap, noting how many were removed. */
function capBody(body: string): string {
	if (body.length <= MAX_BODY_BYTES) return body;
	const lines = body.split("\n");
	let dropped = 0;
	while (lines.join("\n").length > MAX_BODY_BYTES && lines.length > 1) {
		lines.shift();
		dropped++;
	}
	return `# [truncated ${dropped} older line(s) to fit upload limit]\n${lines.join("\n")}`;
}

/** Collect the relevant logs for `scope` into a single uploadable file. */
export async function collectLogs(
	scope: LogScope,
	opts?: { userEmail?: string },
): Promise<CollectedLogs> {
	flushLogs(); // make sure the latest entries are on disk
	const raw = await readAllSegments();
	const all = parseEntries(raw).sort((a, b) => a.t - b.t || a.seq - b.seq);
	const filtered = filterByScope(all, scope);
	const body = capBody(filtered.map(renderLine).join("\n"));
	const header = renderHeader(scope, filtered.length, opts?.userEmail);
	return {
		header,
		body,
		fileName: buildFileName(),
		entryCount: filtered.length,
	};
}
