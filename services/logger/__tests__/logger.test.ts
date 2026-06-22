/// <reference types="jest" />
// The global setup (jest.setup.ts) mocks "@/services/logger"; this suite
// exercises the real implementation, so unmock it and stub only the leaf deps
// (disk sink + serialization) so we can assert behaviour deterministically.
jest.unmock("@/services/logger");

jest.mock("@/services/logger/fileSink", () => ({
	appendLines: jest.fn(),
}));

jest.mock("@/services/logger/serialize", () => ({
	formatEntry: jest.fn((entry: { msg: string }) => `formatted:${entry.msg}`),
	redactString: jest.fn((s: string) => s),
	serializeContext: jest.fn((c: unknown) => c),
}));

import { appendLines } from "@/services/logger/fileSink";
import {
	formatEntry,
	redactString,
	serializeContext,
} from "@/services/logger/serialize";

const appendMock = appendLines as jest.Mock;
const formatMock = formatEntry as jest.Mock;
const redactMock = redactString as jest.Mock;
const serializeMock = serializeContext as jest.Mock;

type LoggerModule = typeof import("@/services/logger/logger");

/** Fresh module instance so module-global state (ring/seq/timers) is isolated. */
function loadLogger(): LoggerModule {
	let mod: LoggerModule = {} as LoggerModule;
	jest.isolateModules(() => {
		mod = require("@/services/logger/logger");
	});
	return mod;
}

beforeEach(() => {
	jest.useFakeTimers();
	appendMock.mockReset().mockImplementation(() => {});
	formatMock
		.mockReset()
		.mockImplementation((e: { msg: string }) => `f:${e.msg}`);
	redactMock.mockReset().mockImplementation((s: string) => s);
	serializeMock.mockReset().mockImplementation((c: unknown) => c);
});

afterEach(() => {
	jest.clearAllTimers();
	jest.useRealTimers();
});

describe("session + level configuration", () => {
	it("exposes a stable session id of the expected shape", () => {
		const { getSessionId } = loadLogger();
		const id = getSessionId();
		expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]{6}$/);
		expect(getSessionId()).toBe(id);
	});

	it("defaults minLevel to debug under __DEV__", () => {
		const prev = (globalThis as { __DEV__?: boolean }).__DEV__;
		(globalThis as { __DEV__?: boolean }).__DEV__ = true;
		const { getMinLevel } = loadLogger();
		expect(getMinLevel()).toBe("debug");
		(globalThis as { __DEV__?: boolean }).__DEV__ = prev;
	});

	it("defaults minLevel to info when not in __DEV__", () => {
		const prev = (globalThis as { __DEV__?: boolean }).__DEV__;
		(globalThis as { __DEV__?: boolean }).__DEV__ = false;
		const { getMinLevel } = loadLogger();
		expect(getMinLevel()).toBe("info");
		(globalThis as { __DEV__?: boolean }).__DEV__ = prev;
	});

	it("setMinLevel updates the threshold and filters lower levels", () => {
		const { setMinLevel, getMinLevel, logger, getLogEntries } = loadLogger();
		setMinLevel("warn");
		expect(getMinLevel()).toBe("warn");
		logger.info("Tag", "below threshold");
		logger.warn("Tag", "at threshold");
		const entries = getLogEntries();
		expect(entries).toHaveLength(1);
		expect(entries[0].level).toBe("warn");
	});
});

describe("emit / log entries", () => {
	it("records all four levels with redacted msg and serialized ctx", () => {
		const { logger, getLogEntries } = loadLogger();
		logger.debug("D", "d-msg", { a: 1 });
		logger.info("I", "i-msg");
		logger.warn("W", "w-msg");
		logger.error("E", "e-msg");

		const entries = getLogEntries();
		expect(entries.map((e) => e.level)).toEqual([
			"debug",
			"info",
			"warn",
			"error",
		]);
		// seq increments monotonically.
		expect(entries.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
		// First entry carries serialized ctx; second has none.
		expect(entries[0].ctx).toEqual({ a: 1 });
		expect(entries[1].ctx).toBeUndefined();
		expect(redactMock).toHaveBeenCalledWith("d-msg");
		expect(serializeMock).toHaveBeenCalledWith({ a: 1 });
		// ts is an ISO string derived from t.
		expect(entries[0].ts).toBe(new Date(entries[0].t).toISOString());
	});

	it("getLogEntries returns a copy, not the live ring", () => {
		const { logger, getLogEntries } = loadLogger();
		logger.info("Tag", "one");
		const snap = getLogEntries();
		snap.push({} as never);
		expect(getLogEntries()).toHaveLength(1);
	});

	it("does not serialize context when ctx is undefined", () => {
		const { logger } = loadLogger();
		logger.info("Tag", "no ctx");
		expect(serializeMock).not.toHaveBeenCalled();
	});

	it("caps the in-memory ring at RING_MAX (300) entries", () => {
		const { logger, getLogEntries } = loadLogger();
		for (let i = 0; i < 305; i++) logger.info("Tag", `m${i}`);
		const entries = getLogEntries();
		expect(entries).toHaveLength(300);
		// Oldest entries were dropped; newest retained.
		expect(entries[entries.length - 1].msg).toBe("m304");
		expect(entries[0].msg).toBe("m5");
	});

	it("swallows errors thrown during emit (never throws)", () => {
		const { logger, getLogEntries } = loadLogger();
		redactMock.mockImplementationOnce(() => {
			throw new Error("redact blew up");
		});
		expect(() => logger.info("Tag", "boom")).not.toThrow();
		// Nothing was recorded because the throw happened mid-emit.
		expect(getLogEntries()).toHaveLength(0);
	});
});

describe("subscriptions", () => {
	it("notifies subscribers on each entry and supports unsubscribe", () => {
		const { logger, subscribeToLogs } = loadLogger();
		const cb = jest.fn();
		const unsub = subscribeToLogs(cb);
		logger.info("Tag", "one");
		expect(cb).toHaveBeenCalledTimes(1);
		unsub();
		logger.info("Tag", "two");
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it("isolates a throwing subscriber from others", () => {
		const { logger, subscribeToLogs } = loadLogger();
		const good = jest.fn();
		subscribeToLogs(() => {
			throw new Error("bad subscriber");
		});
		subscribeToLogs(good);
		expect(() => logger.info("Tag", "x")).not.toThrow();
		expect(good).toHaveBeenCalledTimes(1);
	});
});

describe("flush + scheduling", () => {
	it("debounces non-error flushes and writes formatted lines on timeout", () => {
		const { logger } = loadLogger();
		logger.info("Tag", "a");
		logger.info("Tag", "b");
		// Buffered, not yet flushed.
		expect(appendMock).not.toHaveBeenCalled();
		jest.advanceTimersByTime(2500);
		expect(appendMock).toHaveBeenCalledTimes(1);
		expect(appendMock).toHaveBeenCalledWith(["f:a", "f:b"]);
	});

	it("coalesces multiple scheduled flushes into one timer", () => {
		const { logger } = loadLogger();
		logger.info("Tag", "a");
		logger.info("Tag", "b"); // second call hits the early-return in scheduleFlush
		jest.advanceTimersByTime(2500);
		expect(appendMock).toHaveBeenCalledTimes(1);
	});

	it("flushes immediately on an error entry", () => {
		const { logger } = loadLogger();
		logger.error("Tag", "kaboom");
		expect(appendMock).toHaveBeenCalledTimes(1);
		expect(appendMock).toHaveBeenCalledWith(["f:kaboom"]);
	});

	it("an error flush also drains previously buffered non-error lines", () => {
		const { logger } = loadLogger();
		logger.info("Tag", "buffered");
		logger.error("Tag", "now");
		expect(appendMock).toHaveBeenCalledTimes(1);
		expect(appendMock).toHaveBeenCalledWith(["f:buffered", "f:now"]);
	});

	it("flushLogs is a no-op when there is nothing pending", () => {
		const { flushLogs } = loadLogger();
		flushLogs();
		expect(appendMock).not.toHaveBeenCalled();
	});

	it("explicit flushLogs clears a pending debounce timer", () => {
		const { logger, flushLogs } = loadLogger();
		logger.info("Tag", "a");
		flushLogs();
		expect(appendMock).toHaveBeenCalledTimes(1);
		// Timer was cleared, so advancing produces no second flush.
		jest.advanceTimersByTime(5000);
		expect(appendMock).toHaveBeenCalledTimes(1);
	});

	it("swallows errors thrown by the disk sink during flush", () => {
		const { logger, flushLogs } = loadLogger();
		appendMock.mockImplementationOnce(() => {
			throw new Error("disk full");
		});
		logger.info("Tag", "a");
		expect(() => flushLogs()).not.toThrow();
	});

	it("stops buffering once PENDING_MAX (2000) is reached but keeps the ring live", () => {
		const { logger, flushLogs } = loadLogger();
		// Emit > PENDING_MAX without ever flushing (use debounce, never advance).
		for (let i = 0; i < 2001; i++) logger.info("Tag", `m${i}`);
		flushLogs();
		// Exactly PENDING_MAX lines were buffered; the overflow line was dropped.
		expect(appendMock).toHaveBeenCalledTimes(1);
		expect(appendMock.mock.calls[0][0]).toHaveLength(2000);
	});
});
