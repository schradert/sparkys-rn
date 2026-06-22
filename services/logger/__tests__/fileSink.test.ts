/// <reference types="jest" />
// Exercises the native NDJSON file sink. We replace expo-file-system with a
// small in-memory fake whose File/Directory instances resolve against a shared
// node registry, so we can seed segments, control sizes/timestamps, and force
// targeted throws to hit every guarded branch. All fake machinery lives inside
// the jest.mock factory (jest hoists it above imports and forbids referencing
// outer scope), and is re-exported so the test body can drive it.

interface FakeNode {
	kind: "file" | "dir";
	exists: boolean;
	content: string;
	lastModified: number | null;
	throwOn: Set<string>;
	children: string[];
}

jest.mock("expo-file-system", () => {
	const mockNodes = new Map<string, FakeNode>();
	const mockFlags = { failCreate: false };

	const mockEnsure = (key: string, kind: "file" | "dir"): FakeNode => {
		let n = mockNodes.get(key);
		if (!n) {
			n = {
				kind,
				exists: false,
				content: "",
				lastModified: 0,
				throwOn: new Set(),
				children: [],
			};
			mockNodes.set(key, n);
		}
		return n;
	};

	const mockThrow = (n: FakeNode | undefined, op: string): void => {
		if (n?.throwOn.has(op)) throw new Error(`forced throw: ${op}`);
	};

	/** Register a file under its parent directory's children list. */
	const mockRegister = (key: string): void => {
		const parentKey = key.slice(0, key.lastIndexOf("/"));
		const parent = mockEnsure(parentKey, "dir");
		if (!parent.children.includes(key)) parent.children.push(key);
	};

	class File {
		key: string;
		name: string;
		constructor(parent: { key?: string } | string, name?: string) {
			if (typeof parent === "string") {
				this.key = parent;
				this.name = parent.split("/").pop() ?? parent;
			} else {
				this.name = name ?? "";
				this.key = `${parent.key ?? "root"}/${name}`;
			}
		}
		get exists(): boolean {
			const n = mockNodes.get(this.key);
			mockThrow(n, "exists");
			return n?.exists ?? false;
		}
		get size(): number {
			const n = mockNodes.get(this.key);
			mockThrow(n, "size");
			return n ? n.content.length : 0;
		}
		get lastModified(): number | null {
			const n = mockNodes.get(this.key);
			mockThrow(n, "lastModified");
			return n ? n.lastModified : null;
		}
		create(_opts?: unknown): void {
			if (mockFlags.failCreate) throw new Error("forced create failure");
			const n = mockEnsure(this.key, "file");
			mockThrow(n, "create");
			n.exists = true;
			mockRegister(this.key);
		}
		write(data: string, opts?: { append?: boolean }): void {
			const n = mockEnsure(this.key, "file");
			mockThrow(n, "write");
			n.content = opts?.append ? n.content + data : data;
			n.exists = true;
			mockRegister(this.key);
		}
		delete(): void {
			const n = mockNodes.get(this.key);
			mockThrow(n, "delete");
			if (n) n.exists = false;
		}
		async text(): Promise<string> {
			const n = mockNodes.get(this.key);
			mockThrow(n, "text");
			return n?.content ?? "";
		}
		textSync(): string {
			const n = mockNodes.get(this.key);
			mockThrow(n, "textSync");
			return n?.content ?? "";
		}
	}

	class Directory {
		key: string;
		constructor(base: string, name: string) {
			this.key = `${base}/${name}`;
		}
		get exists(): boolean {
			const n = mockNodes.get(this.key);
			mockThrow(n, "exists");
			return n?.exists ?? false;
		}
		create(_opts?: unknown): void {
			const n = mockEnsure(this.key, "dir");
			mockThrow(n, "create");
			n.exists = true;
		}
		list(): File[] {
			const n = mockNodes.get(this.key);
			mockThrow(n, "list");
			// Real Directory.list() only yields entries that exist on disk.
			return (n?.children ?? [])
				.filter((childKey) => mockNodes.get(childKey)?.exists)
				.map((childKey) => new File(childKey));
		}
	}

	return {
		Directory,
		File,
		Paths: { document: "doc" },
		__nodes: mockNodes,
		__ensure: mockEnsure,
		__flags: mockFlags,
	};
});

import * as fs from "expo-file-system";

const mod = fs as unknown as {
	__nodes: Map<string, FakeNode>;
	__ensure: (key: string, kind: "file" | "dir") => FakeNode;
	__flags: { failCreate: boolean };
};
const nodes = mod.__nodes;
const ensureNode = mod.__ensure;
const flags = mod.__flags;

const DIR_KEY = "doc/logs";
const MAX_SEGMENT_BYTES = 256 * 1024;
const MAX_SEGMENTS = 8;

type FileSinkModule = typeof import("@/services/logger/fileSink");

function loadSink(): FileSinkModule {
	let m: FileSinkModule = {} as FileSinkModule;
	jest.isolateModules(() => {
		m = require("@/services/logger/fileSink");
	});
	return m;
}

/** Seed a segment file node and register it under the log directory. */
function seedSegment(
	name: string,
	content: string,
	opts: { lastModified?: number; throwOn?: string[] } = {},
): FakeNode {
	const key = `${DIR_KEY}/${name}`;
	const n = ensureNode(key, "file");
	n.exists = true;
	n.content = content;
	n.lastModified = opts.lastModified ?? 1;
	if (opts.throwOn) n.throwOn = new Set(opts.throwOn);
	const dir = ensureNode(DIR_KEY, "dir");
	dir.exists = true;
	if (!dir.children.includes(key)) dir.children.push(key);
	return n;
}

function segKeys(): string[] {
	return [...nodes.keys()].filter((k) => k.includes("/seg-"));
}

beforeEach(() => {
	nodes.clear();
	flags.failCreate = false;
});

describe("getDir / directory creation", () => {
	it("creates the log directory when it does not yet exist", () => {
		const { listSegmentInfo } = loadSink();
		expect(listSegmentInfo()).toEqual([]);
		expect(nodes.get(DIR_KEY)?.exists).toBe(true);
	});

	it("swallows a directory-create failure and still returns safely", () => {
		ensureNode(DIR_KEY, "dir").throwOn = new Set(["create"]);
		const { listSegmentInfo } = loadSink();
		expect(listSegmentInfo()).toEqual([]);
	});

	it("reuses the cached directory on subsequent calls", () => {
		const { listSegmentInfo } = loadSink();
		listSegmentInfo();
		ensureNode(DIR_KEY, "dir").exists = true;
		expect(listSegmentInfo()).toEqual([]);
	});
});

describe("listSegmentInfo / listSegments", () => {
	it("lists only segment files, sorted oldest → newest by encoded time", () => {
		seedSegment("seg-300.ndjson", "c");
		seedSegment("seg-100.ndjson", "ab");
		seedSegment("seg-200.ndjson", "abc");
		seedSegment("other.txt", "ignored");
		seedSegment(".session.json", "{}");

		const { listSegmentInfo } = loadSink();
		const info = listSegmentInfo();
		expect(info.map((i) => i.name)).toEqual([
			"seg-100.ndjson",
			"seg-200.ndjson",
			"seg-300.ndjson",
		]);
		expect(info[0]).toEqual({ name: "seg-100.ndjson", size: 2, modified: 1 });
	});

	it("returns 0 size / null modified when those getters throw", () => {
		seedSegment("seg-100.ndjson", "abc", {
			throwOn: ["size", "lastModified"],
		});
		const { listSegmentInfo } = loadSink();
		const info = listSegmentInfo();
		expect(info[0].size).toBe(0);
		expect(info[0].modified).toBeNull();
	});

	it("returns an empty list when the directory listing throws", () => {
		const dir = ensureNode(DIR_KEY, "dir");
		dir.exists = true;
		dir.throwOn = new Set(["list"]);
		const { listSegmentInfo } = loadSink();
		expect(listSegmentInfo()).toEqual([]);
	});

	it("returns an empty list when the directory does not exist", () => {
		seedSegment("seg-1.ndjson", "x");
		const dir = nodes.get(DIR_KEY) as FakeNode;
		dir.exists = false;
		// getDir() will attempt to create the dir; make that throw so it stays
		// absent and listSegments() takes the `!dir.exists` early-return branch.
		dir.throwOn = new Set(["create"]);
		const { listSegmentInfo } = loadSink();
		expect(listSegmentInfo()).toEqual([]);
	});
});

describe("readAllSegments", () => {
	it("concatenates the text of all segments oldest → newest", async () => {
		seedSegment("seg-200.ndjson", "second\n");
		seedSegment("seg-100.ndjson", "first\n");
		const { readAllSegments } = loadSink();
		await expect(readAllSegments()).resolves.toBe("first\nsecond\n");
	});

	it("skips a segment whose text() rejects but keeps the rest", async () => {
		seedSegment("seg-100.ndjson", "good\n");
		seedSegment("seg-200.ndjson", "bad", { throwOn: ["text"] });
		const { readAllSegments } = loadSink();
		await expect(readAllSegments()).resolves.toBe("good\n");
	});
});

describe("appendLines + rotation", () => {
	it("returns early and writes nothing for an empty line array", () => {
		const { appendLines } = loadSink();
		appendLines([]);
		expect(segKeys()).toHaveLength(0);
	});

	it("creates a fresh segment and appends a trailing newline", async () => {
		const { appendLines, readAllSegments } = loadSink();
		appendLines(["line1", "line2"]);
		const key = segKeys()[0];
		expect(key).toBeDefined();
		expect(nodes.get(key)?.content).toBe("line1\nline2\n");
		await expect(readAllSegments()).resolves.toBe("line1\nline2\n");
	});

	it("appends into the newest existing segment when it has room", () => {
		seedSegment("seg-100.ndjson", "existing\n");
		const { appendLines } = loadSink();
		appendLines(["more"]);
		expect(nodes.get(`${DIR_KEY}/seg-100.ndjson`)?.content).toBe(
			"existing\nmore\n",
		);
	});

	it("rotates to a new segment when the newest is at/over the byte cap", () => {
		seedSegment("seg-100.ndjson", "x".repeat(MAX_SEGMENT_BYTES));
		const { appendLines } = loadSink();
		appendLines(["fresh"]);
		const keys = segKeys();
		expect(keys.length).toBe(2);
		const newKey = keys.find((k) => !k.endsWith("seg-100.ndjson")) as string;
		expect(nodes.get(newKey)?.content).toBe("fresh\n");
	});

	it("reuses the cached active segment on the next append (fast path)", () => {
		const { appendLines } = loadSink();
		appendLines(["a"]);
		const key = segKeys()[0];
		appendLines(["b"]);
		expect(segKeys()).toHaveLength(1);
		expect(nodes.get(key)?.content).toBe("a\nb\n");
	});

	it("drops the cached active segment once it crosses the cap", () => {
		// Control the clock so the two newSegment() calls get distinct names.
		let clock = 5_000_000;
		const spy = jest.spyOn(Date, "now").mockImplementation(() => (clock += 1));
		try {
			const { appendLines } = loadSink();
			appendLines(["a"]);
			const firstKey = segKeys()[0];
			(nodes.get(firstKey) as FakeNode).content = "x".repeat(MAX_SEGMENT_BYTES);
			appendLines(["b"]); // post-write size >= cap → activeSegment = null
			appendLines(["c"]); // must pick/create a brand-new active segment
			expect(segKeys().length).toBe(2);
		} finally {
			spy.mockRestore();
		}
	});

	it("nulls the cached segment when a write pushes it to/over the cap", () => {
		// Reuse a near-cap segment (still < cap so the fast path keeps it), then
		// the post-write size check sees >= cap and clears the cache (line 129).
		let clock = 6_000_000;
		const spy = jest.spyOn(Date, "now").mockImplementation(() => (clock += 1));
		try {
			const { appendLines } = loadSink();
			appendLines(["a"]);
			const key = segKeys()[0];
			// One byte under the cap → reused, but the appended line tips it over.
			(nodes.get(key) as FakeNode).content = "x".repeat(MAX_SEGMENT_BYTES - 1);
			appendLines(["b"]); // after write: size >= cap → activeSegment = null
			appendLines(["c"]); // forced to mint a new segment
			expect(segKeys().length).toBe(2);
		} finally {
			spy.mockRestore();
		}
	});

	it("swallows a write failure without throwing", () => {
		seedSegment("seg-100.ndjson", "", { throwOn: ["write"] });
		const { appendLines } = loadSink();
		expect(() => appendLines(["x"])).not.toThrow();
	});

	it("tolerates the cached-segment size getter throwing on the fast path", () => {
		const { appendLines } = loadSink();
		appendLines(["a"]);
		const key = segKeys()[0];
		nodes.get(key)?.throwOn.add("size");
		expect(() => appendLines(["b"])).not.toThrow();
	});

	it("tolerates the post-write size check throwing", () => {
		const { appendLines } = loadSink();
		appendLines(["a"]);
		const key = segKeys()[0];
		(nodes.get(key) as FakeNode).throwOn = new Set(["size"]);
		expect(() => appendLines(["b"])).not.toThrow();
	});

	it("swallows a create failure when starting a new segment", () => {
		// Cap the newest so getActiveSegment() must call newSegment(), then make
		// every File.create() throw so newSegment()'s create is caught.
		seedSegment("seg-100.ndjson", "x".repeat(MAX_SEGMENT_BYTES));
		flags.failCreate = true;
		const { appendLines } = loadSink();
		// The new segment was never created (write target absent) → write throws →
		// outer catch in appendLines swallows it. Net: no throw escapes.
		expect(() => appendLines(["x"])).not.toThrow();
	});
});

// Pruning runs inside newSegment(), which is reached when the newest existing
// segment is over the byte cap. We pin Date.now() to a fixed, far-future value
// so the segment newSegment() mints has a deterministic, collision-free name.
describe("pruning", () => {
	const CLOCK = 10_000_000_000; // ~ year 2286; far beyond any seeded stamp
	const NEW_SEG = `seg-${CLOCK}.ndjson`;
	let clockSpy: jest.SpyInstance;

	beforeEach(() => {
		clockSpy = jest.spyOn(Date, "now").mockReturnValue(CLOCK);
	});

	afterEach(() => {
		clockSpy.mockRestore();
	});

	/** Seed an over-cap newest segment so appendLines() must mint a new one. */
	function seedOverCapNewest(name = "seg-9000000000.ndjson"): void {
		seedSegment(name, "x".repeat(MAX_SEGMENT_BYTES), { lastModified: CLOCK });
	}

	it("deletes segments older than the max age", () => {
		seedSegment("seg-1000.ndjson", "old", { lastModified: 1000 }); // ancient
		seedOverCapNewest();
		const { appendLines, listSegmentInfo } = loadSink();
		appendLines(["trigger"]);
		const names = listSegmentInfo().map((i) => i.name);
		expect(names).not.toContain("seg-1000.ndjson");
		expect(names).toContain(NEW_SEG); // the freshly minted segment survives
	});

	it("falls back to lastModified/now for age when the name lacks a stamp", () => {
		// A matching name with encoded time 0 makes segmentTime() falsy, so the
		// age check uses `f.lastModified || now`. lastModified=0 → uses now(),
		// which is recent → NOT pruned.
		seedSegment("seg-0.ndjson", "keep", { lastModified: 0 });
		seedOverCapNewest();
		const { appendLines, listSegmentInfo } = loadSink();
		appendLines(["trigger"]);
		expect(listSegmentInfo().map((i) => i.name)).toContain("seg-0.ndjson");
	});

	it("count-prunes oldest segments beyond MAX_SEGMENTS", () => {
		// Encoded times just below the clock so none are age-pruned. 9 segments
		// + an over-cap newest + the one appendLines mints = 11 → prune 3 oldest.
		for (let i = 1; i <= 9; i++) {
			seedSegment(`seg-${CLOCK - 100 + i}.ndjson`, "y", {
				lastModified: CLOCK,
			});
		}
		seedOverCapNewest(`seg-${CLOCK - 10}.ndjson`);
		const { appendLines, listSegmentInfo } = loadSink();
		appendLines(["trigger"]);
		expect(listSegmentInfo().length).toBe(MAX_SEGMENTS);
	});

	it("swallows a delete failure during age pruning", () => {
		seedSegment("seg-1000.ndjson", "old", {
			lastModified: 1000,
			throwOn: ["delete"],
		});
		seedOverCapNewest();
		const { appendLines } = loadSink();
		expect(() => appendLines(["trigger"])).not.toThrow();
	});

	it("swallows a delete failure during count pruning", () => {
		for (let i = 1; i <= 9; i++) {
			seedSegment(`seg-${CLOCK - 100 + i}.ndjson`, "y", {
				lastModified: CLOCK,
				throwOn: ["delete"],
			});
		}
		seedOverCapNewest(`seg-${CLOCK - 10}.ndjson`);
		const { appendLines } = loadSink();
		expect(() => appendLines(["trigger"])).not.toThrow();
	});

	it("does not prune fresh, in-range segments", () => {
		// Encoded time within MAX_AGE_MS of the clock → survives age pruning.
		const recentName = `seg-${CLOCK - 1000}.ndjson`;
		seedSegment(recentName, "recent", { lastModified: CLOCK });
		// Use a *higher* over-cap stamp so it remains the newest after sorting.
		seedOverCapNewest(`seg-${CLOCK - 1}.ndjson`);
		const { appendLines, listSegmentInfo } = loadSink();
		appendLines(["trigger"]);
		expect(listSegmentInfo().map((i) => i.name)).toContain(recentName);
	});

	it("treats a non-numeric segment id as time 0 (segmentTime fallback)", () => {
		// Matches the prefix/ext filter but not /^seg-(\d+)\.ndjson$/, so
		// segmentTime() returns 0 and the lastModified/now fallback is used.
		seedSegment("seg-abc.ndjson", "weird", { lastModified: CLOCK });
		seedOverCapNewest();
		const { appendLines, listSegmentInfo } = loadSink();
		// Fresh lastModified → survives. Exercises the `m ? … : 0` false branch.
		expect(() => appendLines(["trigger"])).not.toThrow();
		expect(listSegmentInfo().map((i) => i.name)).toContain("seg-abc.ndjson");
	});
});

describe("session marker", () => {
	it("readMarker returns file contents when the marker exists", () => {
		const n = ensureNode(`${DIR_KEY}/.session.json`, "file");
		n.exists = true;
		n.content = '{"clean":true}';
		const { readMarker } = loadSink();
		expect(readMarker()).toBe('{"clean":true}');
	});

	it("readMarker returns null when the marker is absent", () => {
		const { readMarker } = loadSink();
		expect(readMarker()).toBeNull();
	});

	it("readMarker returns null when reading throws", () => {
		const n = ensureNode(`${DIR_KEY}/.session.json`, "file");
		n.exists = true;
		n.throwOn = new Set(["textSync"]);
		const { readMarker } = loadSink();
		expect(readMarker()).toBeNull();
	});

	it("writeMarker creates the file when missing then writes", () => {
		const { writeMarker } = loadSink();
		writeMarker('{"a":1}');
		expect(nodes.get(`${DIR_KEY}/.session.json`)?.content).toBe('{"a":1}');
	});

	it("writeMarker overwrites an existing marker without re-creating it", () => {
		const n = ensureNode(`${DIR_KEY}/.session.json`, "file");
		n.exists = true;
		n.content = "old";
		const { writeMarker } = loadSink();
		writeMarker("new");
		expect(nodes.get(`${DIR_KEY}/.session.json`)?.content).toBe("new");
	});

	it("writeMarker swallows a write failure", () => {
		const n = ensureNode(`${DIR_KEY}/.session.json`, "file");
		n.exists = true;
		n.throwOn = new Set(["write"]);
		const { writeMarker } = loadSink();
		expect(() => writeMarker("x")).not.toThrow();
	});
});

describe("isAvailable", () => {
	it("is always true on native", () => {
		const { isAvailable } = loadSink();
		expect(isAvailable()).toBe(true);
	});
});
