/// <reference types="jest" />
// Exercises log collection/formatting. We stub the disk reader and the logger
// session id, and make Platform / expo-constants mutable so device-label,
// filename, and header branches can all be driven from the test body.

const mockReadAllSegments = jest.fn<Promise<string>, []>();
const mockFlushLogs = jest.fn();
const mockGetSessionId = jest.fn<string, []>();

jest.mock("@/services/logger/fileSink", () => ({
	readAllSegments: () => mockReadAllSegments(),
}));

jest.mock("@/services/logger/logger", () => ({
	flushLogs: () => mockFlushLogs(),
	getSessionId: () => mockGetSessionId(),
}));

const mockPlatform: {
	OS: string;
	Version: string | number;
	constants: { Model?: string; Manufacturer?: string };
} = { OS: "ios", Version: "17.0", constants: {} };

const mockConstants: { expoConfig?: { version?: string } } = {
	expoConfig: { version: "1.2.3" },
};

jest.mock("react-native", () => ({
	get Platform() {
		return mockPlatform;
	},
}));

jest.mock("expo-constants", () => ({
	__esModule: true,
	get default() {
		return mockConstants;
	},
}));

import {
	type CollectedLogs,
	collectLogs,
	LOG_SCOPES,
	type LogScope,
} from "@/services/logger/collect";
import type { LogEntry } from "@/services/logger/types";

const SESSION = "sess-current";

function entry(over: Partial<LogEntry> & { seq: number; t: number }): LogEntry {
	return {
		ts: new Date(over.t).toISOString(),
		level: "info",
		tag: "Tag",
		msg: "msg",
		session: SESSION,
		...over,
	};
}

/** Build NDJSON text from entries (one JSON object per line). */
function ndjson(entries: LogEntry[]): string {
	return `${entries.map((e) => JSON.stringify(e)).join("\n")}\n`;
}

beforeEach(() => {
	jest.clearAllMocks();
	mockGetSessionId.mockReturnValue(SESSION);
	mockReadAllSegments.mockResolvedValue("");
	mockPlatform.OS = "ios";
	mockPlatform.Version = "17.0";
	mockPlatform.constants = {};
	mockConstants.expoConfig = { version: "1.2.3" };
});

describe("LOG_SCOPES", () => {
	it("declares all four scopes with labels and hints", () => {
		const keys = LOG_SCOPES.map((s) => s.key);
		expect(keys).toEqual([
			"session",
			"last15min",
			"sinceLastError",
			"allRetained",
		]);
		for (const s of LOG_SCOPES) {
			expect(typeof s.label).toBe("string");
			expect(typeof s.hint).toBe("string");
		}
	});
});

describe("collectLogs — flush + parse", () => {
	it("flushes pending logs to disk before reading", async () => {
		await collectLogs("allRetained");
		expect(mockFlushLogs).toHaveBeenCalledTimes(1);
	});

	it("skips blank lines, malformed JSON, and entries failing the type guard", async () => {
		const good = entry({ seq: 1, t: 1000, msg: "keep" });
		const raw = [
			"", // blank
			"   ", // whitespace
			"{not json", // parse error
			JSON.stringify({ t: "nope", level: "info" }), // t not a number
			JSON.stringify({ t: 5, level: 42 }), // level not a string
			"null", // parses but falsy → guarded out
			JSON.stringify(good),
		].join("\n");
		mockReadAllSegments.mockResolvedValue(raw);

		const out = await collectLogs("allRetained");
		expect(out.entryCount).toBe(1);
		expect(out.body).toContain("keep");
	});

	it("sorts entries by timestamp then sequence", async () => {
		const raw = ndjson([
			entry({ seq: 2, t: 2000, msg: "second" }),
			entry({ seq: 1, t: 2000, msg: "first" }), // same t, lower seq → earlier
			entry({ seq: 3, t: 1000, msg: "earliest" }),
		]);
		mockReadAllSegments.mockResolvedValue(raw);
		const out = await collectLogs("allRetained");
		const lines = out.body.split("\n");
		expect(lines[0]).toContain("earliest");
		expect(lines[1]).toContain("first");
		expect(lines[2]).toContain("second");
	});
});

describe("collectLogs — scope filtering", () => {
	function mixed(): string {
		return ndjson([
			entry({ seq: 1, t: 1000, session: "old", level: "info", msg: "a" }),
			entry({ seq: 2, t: 2000, session: "old", level: "error", msg: "boom" }),
			entry({ seq: 3, t: 3000, session: SESSION, level: "info", msg: "b" }),
			entry({ seq: 4, t: 4000, session: SESSION, level: "warn", msg: "c" }),
		]);
	}

	it("allRetained returns every entry", async () => {
		mockReadAllSegments.mockResolvedValue(mixed());
		const out = await collectLogs("allRetained");
		expect(out.entryCount).toBe(4);
	});

	it("session keeps only the current session's entries", async () => {
		mockReadAllSegments.mockResolvedValue(mixed());
		const out = await collectLogs("session");
		expect(out.entryCount).toBe(2);
		expect(out.body).toContain("b");
		expect(out.body).toContain("c");
		expect(out.body).not.toContain("boom");
	});

	it("last15min keeps entries newer than the cutoff", async () => {
		const now = Date.now();
		const raw = ndjson([
			entry({ seq: 1, t: now - 60 * 60_000, msg: "hour-ago" }), // dropped
			entry({ seq: 2, t: now - 60_000, msg: "minute-ago" }), // kept
		]);
		mockReadAllSegments.mockResolvedValue(raw);
		const out = await collectLogs("last15min");
		expect(out.entryCount).toBe(1);
		expect(out.body).toContain("minute-ago");
	});

	it("sinceLastError slices from the most recent error onward", async () => {
		mockReadAllSegments.mockResolvedValue(mixed());
		const out = await collectLogs("sinceLastError");
		// Sorted order: a, boom(error), b, c → slice from boom.
		expect(out.entryCount).toBe(3);
		expect(out.body).toContain("boom");
		expect(out.body).not.toContain(" a "); // entry "a" (pre-error) excluded
	});

	it("sinceLastError falls back to current session when no error exists", async () => {
		const raw = ndjson([
			entry({ seq: 1, t: 1000, session: "old", level: "info", msg: "a" }),
			entry({ seq: 2, t: 2000, session: SESSION, level: "info", msg: "b" }),
		]);
		mockReadAllSegments.mockResolvedValue(raw);
		const out = await collectLogs("sinceLastError");
		expect(out.entryCount).toBe(1);
		expect(out.body).toContain("b");
	});
});

describe("collectLogs — line + header rendering", () => {
	it("renders a line without a context suffix when ctx is absent", async () => {
		mockReadAllSegments.mockResolvedValue(
			ndjson([entry({ seq: 1, t: 1000, tag: "Sheets", msg: "loaded" })]),
		);
		const out = await collectLogs("allRetained");
		expect(out.body).toMatch(/INFO\s+\[Sheets\] loaded$/);
		expect(out.body).not.toContain("|");
	});

	it("appends serialized context after a pipe", async () => {
		mockReadAllSegments.mockResolvedValue(
			ndjson([entry({ seq: 1, t: 1000, ctx: { count: 2 } })]),
		);
		const out = await collectLogs("allRetained");
		expect(out.body).toContain('| {"count":2}');
	});

	it("marks context that cannot be serialized", async () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		// JSON.parse of the NDJSON can't carry a cycle, so inject the raw line.
		const base = entry({ seq: 1, t: 1000 });
		const line = JSON.stringify({ ...base, ctx: { ok: 1 } });
		mockReadAllSegments.mockResolvedValue(line);
		// Re-route JSON.stringify to throw only for the ctx object during render.
		const realStringify = JSON.stringify;
		const spy = jest
			.spyOn(JSON, "stringify")
			.mockImplementation((value: unknown, ...rest) => {
				if (value && typeof value === "object" && "ok" in value) {
					throw new Error("nope");
				}
				return realStringify(value, ...(rest as []));
			});
		try {
			const out = await collectLogs("allRetained");
			expect(out.body).toContain("[unserializable]");
		} finally {
			spy.mockRestore();
		}
	});

	it("includes the user email line only when provided", async () => {
		mockReadAllSegments.mockResolvedValue(ndjson([entry({ seq: 1, t: 1000 })]));
		const withEmail = await collectLogs("allRetained", {
			userEmail: "a@b.com",
		});
		expect(withEmail.header).toContain("# user: a@b.com");

		const withoutEmail = await collectLogs("allRetained");
		expect(withoutEmail.header).not.toContain("# user:");
	});

	it("uses fallbacks in the header when the app version is unknown", async () => {
		mockConstants.expoConfig = undefined;
		mockReadAllSegments.mockResolvedValue(ndjson([entry({ seq: 1, t: 1000 })]));
		const out = await collectLogs("allRetained");
		expect(out.header).toContain("# app version: unknown");
		expect(out.header).toContain(`# session: ${SESSION}`);
		expect(out.header).toContain("# scope: allRetained  entries: 1");
	});
});

describe("collectLogs — file name + device label", () => {
	it("derives an iOS file name from version, platform and timestamp", async () => {
		const out = await collectLogs("allRetained");
		expect(out.fileName).toMatch(
			/^sparkys-diag_1.2.3_ios_ios-17.0_\d{8}-\d{6}\.log$/,
		);
	});

	it("labels Android devices by Model", async () => {
		mockPlatform.OS = "android";
		mockPlatform.Version = 34;
		mockPlatform.constants = { Model: "Pixel 7", Manufacturer: "Google" };
		const out = await collectLogs("allRetained");
		expect(out.header).toContain("(Pixel 7)");
		expect(out.fileName).toContain("Pixel-7");
	});

	it("falls back to Manufacturer when Model is missing", async () => {
		mockPlatform.OS = "android";
		mockPlatform.constants = { Manufacturer: "Samsung" };
		const out = await collectLogs("allRetained");
		expect(out.header).toContain("(Samsung)");
	});

	it("falls back to the literal 'android' when both are missing", async () => {
		mockPlatform.OS = "android";
		mockPlatform.constants = {};
		const out = await collectLogs("allRetained");
		expect(out.header).toContain("(android)");
	});

	it("sanitizes a version that is all separators down to 'x'", async () => {
		mockConstants.expoConfig = { version: "///" };
		const out = await collectLogs("allRetained");
		// sanitize("///") → "" → "x"
		expect(out.fileName).toContain("sparkys-diag_x_");
	});

	it("defaults the version segment to '0' when expoConfig is absent", async () => {
		mockConstants.expoConfig = undefined;
		const out = await collectLogs("allRetained");
		expect(out.fileName).toContain("sparkys-diag_0_");
	});
});

describe("collectLogs — body cap", () => {
	it("truncates the oldest lines when the body exceeds the size limit", async () => {
		// Each entry renders to a long line; enough of them to top 4 MB.
		const big = "y".repeat(2048);
		const entries: LogEntry[] = [];
		for (let i = 0; i < 2500; i++) {
			entries.push(entry({ seq: i + 1, t: 1000 + i, msg: `${big}-${i}` }));
		}
		mockReadAllSegments.mockResolvedValue(ndjson(entries));
		const out = await collectLogs("allRetained");
		expect(out.body.startsWith("# [truncated ")).toBe(true);
		expect(out.body).toMatch(/# \[truncated \d+ older line\(s\) to fit/);
		expect(out.body.length).toBeLessThanOrEqual(
			4 * 1024 * 1024 + 200, // cap + the truncation header
		);
		// Newest line is retained; an early one is gone.
		expect(out.body).toContain("-2499");
		expect(out.body).not.toContain(`${big}-0`);
	});

	it("leaves a small body untouched (no truncation header)", async () => {
		mockReadAllSegments.mockResolvedValue(
			ndjson([entry({ seq: 1, t: 1000, msg: "tiny" })]),
		);
		const out = await collectLogs("allRetained");
		expect(out.body).not.toContain("[truncated");
	});
});

describe("public types", () => {
	it("CollectedLogs/LogScope are usable shapes", async () => {
		const scope: LogScope = "session";
		const collected: CollectedLogs = await collectLogs(scope);
		expect(collected).toHaveProperty("header");
		expect(collected).toHaveProperty("body");
		expect(collected).toHaveProperty("fileName");
		expect(collected).toHaveProperty("entryCount");
	});
});
