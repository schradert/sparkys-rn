/// <reference types="jest" />
import {
	formatEntry,
	redactString,
	serializeContext,
} from "@/services/logger/serialize";
import type { LogEntry } from "@/services/logger/types";

describe("redactString", () => {
	it("scrubs Google OAuth access tokens", () => {
		const out = redactString("token=ya29.A0ARrdaM-FAKE_tokEN_value-123");
		expect(out).toBe("token=[REDACTED_TOKEN]");
	});

	it("scrubs JWTs / id tokens", () => {
		const jwt = "eyJhbGciOi.eyJzdWIiOiI.SflKxwRJSMeKKF2QT4";
		expect(redactString(`id=${jwt}`)).toBe("id=[REDACTED_JWT]");
	});

	it("scrubs Bearer tokens but keeps the scheme", () => {
		expect(redactString("Authorization: Bearer abc.def-123")).toBe(
			"Authorization: Bearer [REDACTED]",
		);
	});

	it("leaves ordinary text untouched", () => {
		expect(redactString("loaded 12 products")).toBe("loaded 12 products");
	});
});

describe("serializeContext", () => {
	it("redacts secret-shaped keys regardless of casing/separators", () => {
		const out = serializeContext({
			accessToken: "ya29.secret",
			Authorization: "Bearer x",
			refresh_token: "r",
			nested: { password: "hunter2", note: "ok" },
			count: 3,
		}) as Record<string, unknown>;

		expect(out.accessToken).toBe("[REDACTED]");
		expect(out.Authorization).toBe("[REDACTED]");
		expect(out.refresh_token).toBe("[REDACTED]");
		expect((out.nested as Record<string, unknown>).password).toBe("[REDACTED]");
		expect((out.nested as Record<string, unknown>).note).toBe("ok");
		expect(out.count).toBe(3);
	});

	it("expands Error objects (which JSON.stringify would drop)", () => {
		const out = serializeContext(new Error("boom")) as Record<string, unknown>;
		expect(out.name).toBe("Error");
		expect(out.message).toBe("boom");
		expect(typeof out.stack).toBe("string");
	});

	it("captures custom Error fields and redacts secrets within them", () => {
		const err = Object.assign(new Error("denied"), {
			status: 403,
			accessToken: "ya29.leak",
		});
		const out = serializeContext(err) as Record<string, unknown>;
		expect(out.status).toBe(403);
		expect(out.accessToken).toBe("[REDACTED]");
	});

	it("handles circular references without throwing", () => {
		const a: Record<string, unknown> = { name: "a" };
		a.self = a;
		const out = serializeContext(a) as Record<string, unknown>;
		expect(out.name).toBe("a");
		expect(out.self).toBe("[Circular]");
	});

	it("truncates very long strings", () => {
		const long = "x".repeat(10_000);
		const out = serializeContext({ blob: long }) as Record<string, string>;
		expect(out.blob.length).toBeLessThan(long.length);
		expect(out.blob).toMatch(/\[\+\d+ chars\]$/);
	});

	it("scrubs token-shaped values even under non-secret keys", () => {
		const out = serializeContext({ url: "https://x?token=ya29.abc" }) as Record<
			string,
			string
		>;
		expect(out.url).toBe("https://x?token=[REDACTED_TOKEN]");
	});
});

describe("formatEntry", () => {
	it("produces a single-line, parseable NDJSON object", () => {
		const entry: LogEntry = {
			seq: 1,
			t: 1_700_000_000_000,
			ts: "2023-11-14T22:13:20.000Z",
			level: "info",
			tag: "Sheets",
			msg: "ok",
			session: "abc-123",
			ctx: { count: 2 },
		};
		const line = formatEntry(entry);
		expect(line).not.toContain("\n");
		const parsed = JSON.parse(line);
		expect(parsed.level).toBe("info");
		expect(parsed.ctx.count).toBe(2);
	});
});
