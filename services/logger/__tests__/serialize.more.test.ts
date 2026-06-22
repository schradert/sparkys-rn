/// <reference types="jest" />
// Supplements serialize.test.ts: drives the primitive, container, depth, size,
// and failure branches of the serializer that the original suite doesn't reach.
import { formatEntry, serializeContext } from "@/services/logger/serialize";
import type { LogEntry } from "@/services/logger/types";

const asRecord = (v: unknown) => v as Record<string, unknown>;

describe("serializeContext — primitives", () => {
	it("passes finite numbers through and stringifies non-finite ones", () => {
		const out = asRecord(
			serializeContext({ ok: 42, inf: Infinity, ninf: -Infinity, nan: NaN }),
		);
		expect(out.ok).toBe(42);
		expect(out.inf).toBe("Infinity");
		expect(out.ninf).toBe("-Infinity");
		expect(out.nan).toBe("NaN");
	});

	it("preserves booleans and undefined", () => {
		const out = asRecord(
			serializeContext({ yes: true, no: false, u: undefined }),
		);
		expect(out.yes).toBe(true);
		expect(out.no).toBe(false);
		expect(out.u).toBeUndefined();
	});

	it("represents bigint with an 'n' suffix", () => {
		const out = asRecord(serializeContext({ big: 10n }));
		expect(out.big).toBe("10n");
	});

	it("labels functions by name, falling back to 'anonymous'", () => {
		function named(): void {}
		// A function returned from a factory has no contextual binding → name "".
		const makeAnon = (): (() => void) => () => undefined;
		const out = asRecord(serializeContext({ a: named, anon: makeAnon() }));
		expect(out.a).toBe("[Function named]");
		expect(out.anon).toBe("[Function anonymous]");
	});

	it("stringifies symbols", () => {
		const out = asRecord(serializeContext({ s: Symbol("tag") }));
		expect(out.s).toBe("Symbol(tag)");
	});

	it("returns null as-is at the top level", () => {
		expect(serializeContext(null)).toBeNull();
	});
});

describe("serializeContext — depth + size limits", () => {
	it("truncates beyond the max depth", () => {
		// Depth 0..5 are serialized; the 7th level trips the limit.
		const deep = { a: { b: { c: { d: { e: { f: { g: "deep" } } } } } } };
		const out = serializeContext(deep);
		const at = (o: unknown, k: string) => asRecord(o)[k];
		const f = at(at(at(at(at(at(out, "a"), "b"), "c"), "d"), "e"), "f");
		expect(f).toBe("[Truncated: max depth]");
	});

	it("caps long arrays and notes how many were dropped", () => {
		const arr = Array.from({ length: 150 }, (_, i) => i);
		const out = serializeContext(arr) as unknown[];
		expect(out).toHaveLength(101); // 100 items + the overflow marker
		expect(out[100]).toBe("[+50 more]");
	});

	it("does not add an overflow marker for an at-limit array", () => {
		const arr = Array.from({ length: 100 }, (_, i) => i);
		const out = serializeContext(arr) as unknown[];
		expect(out).toHaveLength(100);
		expect(out).not.toContain("[+0 more]");
	});

	it("caps objects with many keys and notes the remainder", () => {
		const obj: Record<string, number> = {};
		for (let i = 0; i < 130; i++) obj[`k${i}`] = i;
		const out = asRecord(serializeContext(obj));
		// 100 keys serialized + a single "…" overflow key.
		expect(Object.keys(out)).toHaveLength(101);
		expect(out["…"]).toBe("[+30 more]");
	});
});

describe("serializeContext — Map and Set", () => {
	it("serializes a Map as an object, redacting secret-shaped keys", () => {
		const m = new Map<string, unknown>([
			["name", "ok"],
			["accessToken", "ya29.secret"],
			["nested", { value: 1 }],
		]);
		const out = asRecord(serializeContext(m));
		expect(out.name).toBe("ok");
		expect(out.accessToken).toBe("[REDACTED]");
		expect(asRecord(out.nested).value).toBe(1);
	});

	it("caps a large Map and notes the remainder", () => {
		const m = new Map<string, number>();
		for (let i = 0; i < 130; i++) m.set(`k${i}`, i);
		const out = asRecord(serializeContext(m));
		expect(out["…"]).toBe("[+30 more]");
		expect(Object.keys(out)).toHaveLength(101);
	});

	it("serializes a Set as an array of its values", () => {
		const out = serializeContext(new Set([1, 2, 3])) as unknown[];
		expect(out).toEqual([1, 2, 3]);
	});
});

describe("serializeContext — failure handling", () => {
	it("marks a property whose getter throws as [Unserializable]", () => {
		const obj = {
			good: 1,
			get bad(): never {
				throw new Error("getter boom");
			},
		};
		const out = asRecord(serializeContext(obj));
		expect(out.good).toBe(1);
		expect(out.bad).toBe("[Unserializable]");
	});

	it("marks an Error's own property whose getter throws as [Unserializable]", () => {
		const err = new Error("base");
		Object.defineProperty(err, "detail", {
			enumerable: true,
			get(): never {
				throw new Error("nope");
			},
		});
		const out = asRecord(serializeContext(err));
		expect(out.name).toBe("Error");
		expect(out.detail).toBe("[Unserializable]");
	});

	it("handles an Error with no message and no stack, skipping reserved keys", () => {
		const err = new Error();
		// Force the nullish-message and absent-stack branches.
		(err as { message: unknown }).message = undefined;
		(err as { stack?: unknown }).stack = undefined;
		// A custom own-key alongside the reserved ones (name/message/stack).
		Object.assign(err, { code: "E_OOPS" });
		const out = asRecord(serializeContext(err));
		expect(out.name).toBe("Error");
		expect(out.message).toBe(""); // String(undefined ?? "") → ""
		expect(out.stack).toBeUndefined(); // no stack key added
		expect(out.code).toBe("E_OOPS");
	});

	it("expands an Error's cause chain", () => {
		const root = new Error("root cause");
		const wrapper = new Error("wrapper");
		(wrapper as { cause?: unknown }).cause = root;
		const out = asRecord(serializeContext(wrapper));
		expect(out.message).toBe("wrapper");
		expect(asRecord(out.cause).message).toBe("root cause");
	});

	it("returns a sentinel when the whole context cannot be walked", () => {
		// A Proxy whose ownKeys/typeof access throws makes safe() throw before
		// the per-property guard, exercising serializeContext's outer catch.
		const hostile = new Proxy(
			{},
			{
				ownKeys() {
					throw new Error("ownKeys boom");
				},
				getOwnPropertyDescriptor() {
					throw new Error("descriptor boom");
				},
			},
		);
		expect(serializeContext(hostile)).toBe("[Unserializable context]");
	});
});

describe("formatEntry — failure handling", () => {
	it("produces a fallback NDJSON line when the entry cannot be stringified", () => {
		const circularCtx: Record<string, unknown> = {};
		circularCtx.self = circularCtx;
		const entry: LogEntry = {
			seq: 9,
			t: 1_700_000_000_000,
			ts: "2023-11-14T22:13:20.000Z",
			level: "error",
			tag: "Tag",
			msg: "real message",
			session: "abc",
			// serializeContext normally prevents cycles, but formatEntry must also
			// survive a raw cyclic ctx slipped straight onto the entry.
			ctx: circularCtx,
		};
		const line = formatEntry(entry);
		const parsed = JSON.parse(line);
		expect(parsed.msg).toBe("[Unserializable entry]");
		expect(parsed.seq).toBe(9);
		expect(parsed.level).toBe("error");
		expect(parsed.tag).toBe("Tag");
		// The fallback intentionally drops ctx.
		expect(parsed.ctx).toBeUndefined();
	});
});
