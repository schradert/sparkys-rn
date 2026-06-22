/// <reference types="jest" />
// Exercises global capture installation. install.ts runs installLogging() on
// import, so each test configures the relevant globals (ErrorUtils, Hermes,
// addEventListener, __DEV__, the install guard) and then loads the module in an
// isolated registry to trigger and observe one scenario. The logger, file sink,
// AppState and expo-constants are all mocked so we can assert captured calls.

const mockLogger = {
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
};
const mockFlushLogs = jest.fn();
const mockGetSessionId = jest.fn(() => "sess-1");
const mockReadMarker = jest.fn<string | null, []>();
const mockWriteMarker = jest.fn<void, [string]>();

jest.mock("@/services/logger/logger", () => ({
	logger: mockLogger,
	flushLogs: () => mockFlushLogs(),
	getSessionId: () => mockGetSessionId(),
}));

jest.mock("@/services/logger/fileSink", () => ({
	readMarker: () => mockReadMarker(),
	writeMarker: (json: string) => mockWriteMarker(json),
}));

// install.ts subscribes via AppState.addEventListener at import time; spy on the
// real object (a live binding it shares) to capture the change handler.
import { AppState } from "react-native";

const mockAppStateAdd = jest.fn();

const mockConstants = {
	expoConfig: { version: "9.9.9" } as { version?: string } | undefined,
};
jest.mock("expo-constants", () => ({
	__esModule: true,
	get default() {
		return mockConstants;
	},
}));

type ErrorHandler = (error: unknown, isFatal?: boolean) => void;

interface TestGlobal {
	ErrorUtils?: {
		getGlobalHandler?: () => ErrorHandler;
		setGlobalHandler?: (h: ErrorHandler) => void;
	};
	HermesInternal?: {
		enablePromiseRejectionTracker?: (opts: {
			allRejections: boolean;
			onUnhandled: (id: number, error: unknown) => void;
			onHandled?: (id: number) => void;
		}) => void;
	};
	addEventListener?: (t: string, h: (e: unknown) => void) => void;
	__DEV__?: boolean;
	__sparkyLoggingInstalled?: boolean;
}

const g = globalThis as unknown as TestGlobal;

// Snapshot globals we mutate so each test starts from a clean slate.
let saved: TestGlobal;

let appStateSpy: jest.SpyInstance;

beforeEach(() => {
	jest.clearAllMocks();
	mockGetSessionId.mockReturnValue("sess-1");
	mockReadMarker.mockReturnValue(null);
	mockConstants.expoConfig = { version: "9.9.9" };
	appStateSpy = jest
		.spyOn(AppState, "addEventListener")
		.mockImplementation(
			(type, handler) =>
				mockAppStateAdd(type, handler) as unknown as ReturnType<
					typeof AppState.addEventListener
				>,
		);
	saved = {
		ErrorUtils: g.ErrorUtils,
		HermesInternal: g.HermesInternal,
		addEventListener: g.addEventListener,
		__DEV__: g.__DEV__,
		__sparkyLoggingInstalled: g.__sparkyLoggingInstalled,
	};
	// Default: clean environment with no native hooks present.
	g.ErrorUtils = undefined;
	g.HermesInternal = undefined;
	g.addEventListener = undefined;
	g.__sparkyLoggingInstalled = undefined;
});

afterEach(() => {
	appStateSpy.mockRestore();
	g.ErrorUtils = saved.ErrorUtils;
	g.HermesInternal = saved.HermesInternal;
	g.addEventListener = saved.addEventListener;
	g.__DEV__ = saved.__DEV__;
	g.__sparkyLoggingInstalled = saved.__sparkyLoggingInstalled;
});

type InstallModule = typeof import("@/services/logger/install");

/** Load install.ts fresh; installLogging() runs as an import side-effect. */
function load(): InstallModule {
	let mod: InstallModule = {} as InstallModule;
	jest.isolateModules(() => {
		mod = require("@/services/logger/install");
	});
	return mod;
}

describe("installLogging — idempotency", () => {
	it("installs once and logs initialization", () => {
		load();
		expect(g.__sparkyLoggingInstalled).toBe(true);
		expect(mockLogger.info).toHaveBeenCalledWith(
			"logger",
			"Logging initialized",
			{
				session: "sess-1",
				version: "9.9.9",
			},
		);
	});

	it("is a no-op when already installed", () => {
		g.__sparkyLoggingInstalled = true;
		const { installLogging } = load();
		installLogging();
		expect(mockLogger.info).not.toHaveBeenCalled();
		expect(mockAppStateAdd).not.toHaveBeenCalled();
	});

	it("calling installLogging again after a fresh install stays a no-op", () => {
		const { installLogging } = load();
		mockLogger.info.mockClear();
		installLogging();
		expect(mockLogger.info).not.toHaveBeenCalled();
	});
});

describe("global error handler", () => {
	it("does nothing when ErrorUtils has no setGlobalHandler", () => {
		g.ErrorUtils = {};
		load();
		// Nothing to assert beyond not throwing; lifecycle still installed.
		expect(mockAppStateAdd).toHaveBeenCalled();
	});

	it("chains the previous handler and logs uncaught errors with a message", () => {
		const previous = jest.fn();
		let installed: ErrorHandler | undefined;
		g.ErrorUtils = {
			getGlobalHandler: () => previous,
			setGlobalHandler: (h) => {
				installed = h;
			},
		};
		load();
		expect(installed).toBeDefined();

		const err = new Error("kaboom");
		installed?.(err, true);
		expect(mockLogger.error).toHaveBeenCalledWith("uncaught", "kaboom", {
			error: err,
			isFatal: true,
		});
		expect(mockFlushLogs).toHaveBeenCalled();
		expect(previous).toHaveBeenCalledWith(err, true);
	});

	it("falls back to String(error) when the error has no message", () => {
		let installed: ErrorHandler | undefined;
		g.ErrorUtils = { setGlobalHandler: (h) => (installed = h) };
		load();
		installed?.("just a string");
		expect(mockLogger.error).toHaveBeenCalledWith("uncaught", "just a string", {
			error: "just a string",
			isFatal: false,
		});
	});

	it("swallows a logger failure inside the handler and still chains", () => {
		const previous = jest.fn();
		let installed: ErrorHandler | undefined;
		g.ErrorUtils = {
			getGlobalHandler: () => previous,
			setGlobalHandler: (h) => (installed = h),
		};
		mockLogger.error.mockImplementationOnce(() => {
			throw new Error("logger down");
		});
		load();
		expect(() => installed?.(new Error("x"), false)).not.toThrow();
		expect(previous).toHaveBeenCalled();
	});

	it("works when there is no previous handler to chain", () => {
		let installed: ErrorHandler | undefined;
		g.ErrorUtils = {
			getGlobalHandler: () => undefined as unknown as ErrorHandler,
			setGlobalHandler: (h) => (installed = h),
		};
		load();
		expect(() => installed?.(new Error("x"))).not.toThrow();
	});
});

describe("promise rejection tracking", () => {
	it("registers the Hermes rejection tracker when available", () => {
		let opts:
			| {
					allRejections: boolean;
					onUnhandled: (id: number, e: unknown) => void;
			  }
			| undefined;
		g.HermesInternal = {
			enablePromiseRejectionTracker: (o) => {
				opts = o;
			},
		};
		g.__DEV__ = false;
		load();
		expect(opts?.allRejections).toBe(true);

		const err = new Error("rejected");
		opts?.onUnhandled(5, err);
		expect(mockLogger.error).toHaveBeenCalledWith(
			"unhandledRejection",
			"rejected",
			{ id: 5, error: err },
		);
	});

	it("uses String(error) for a message-less rejection and warns in __DEV__", () => {
		let opts: { onUnhandled: (id: number, e: unknown) => void } | undefined;
		g.HermesInternal = {
			enablePromiseRejectionTracker: (o) => (opts = o),
		};
		g.__DEV__ = true;
		const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
		try {
			load();
			opts?.onUnhandled(7, "boom-string");
			expect(mockLogger.error).toHaveBeenCalledWith(
				"unhandledRejection",
				"boom-string",
				{ id: 7, error: "boom-string" },
			);
			expect(warnSpy).toHaveBeenCalledWith(
				"Unhandled promise rejection (id 7)",
				"boom-string",
			);
		} finally {
			warnSpy.mockRestore();
		}
	});

	it("swallows a logger failure inside onUnhandled", () => {
		let opts: { onUnhandled: (id: number, e: unknown) => void } | undefined;
		g.HermesInternal = { enablePromiseRejectionTracker: (o) => (opts = o) };
		g.__DEV__ = false;
		mockLogger.error.mockImplementationOnce(() => {
			throw new Error("nope");
		});
		load();
		expect(() => opts?.onUnhandled(1, new Error("x"))).not.toThrow();
	});

	it("falls back to a web unhandledrejection listener when Hermes is absent", () => {
		const listeners: Record<string, (e: unknown) => void> = {};
		g.addEventListener = (type, handler) => {
			listeners[type] = handler;
		};
		g.__DEV__ = false;
		load();
		expect(typeof listeners.unhandledrejection).toBe("function");

		// event.reason is unwrapped and forwarded to onUnhandled (id -1).
		listeners.unhandledrejection({ reason: new Error("web-reject") });
		expect(mockLogger.error).toHaveBeenCalledWith(
			"unhandledRejection",
			"web-reject",
			{ id: -1, error: expect.any(Error) },
		);
	});

	it("forwards the event itself when it carries no reason", () => {
		const listeners: Record<string, (e: unknown) => void> = {};
		g.addEventListener = (type, handler) => (listeners[type] = handler);
		g.__DEV__ = false;
		load();
		listeners.unhandledrejection("bare-event");
		expect(mockLogger.error).toHaveBeenCalledWith(
			"unhandledRejection",
			"bare-event",
			{ id: -1, error: "bare-event" },
		);
	});

	it("does nothing for rejections when neither Hermes nor addEventListener exists", () => {
		// Both absent (default beforeEach state). Should install without error.
		load();
		expect(mockAppStateAdd).toHaveBeenCalled();
	});
});

describe("console tee", () => {
	let origError: typeof console.error;
	let origWarn: typeof console.warn;

	beforeEach(() => {
		origError = console.error;
		origWarn = console.warn;
	});

	afterEach(() => {
		console.error = origError;
		console.warn = origWarn;
	});

	it("tees console.error into logger.error and preserves the original", () => {
		const spyError = jest.fn();
		console.error = spyError;
		load();
		console.error("boom", { code: 42 });
		// Original console.error still receives the raw args first.
		expect(spyError).toHaveBeenCalledWith("boom", { code: 42 });
		// The object also appears in the message as "[obj]" and as the ctx.
		expect(mockLogger.error).toHaveBeenCalledWith("console", "boom [obj]", {
			code: 42,
		});
	});

	it("tees console.warn into logger.warn", () => {
		console.warn = jest.fn();
		load();
		console.warn("watch out");
		expect(mockLogger.warn).toHaveBeenCalledWith(
			"console",
			"watch out",
			undefined,
		);
	});

	it("describes mixed arg types; a single object becomes the ctx directly", () => {
		console.error = jest.fn();
		load();
		console.error("text", 7, true, null, undefined, "tail", { a: 1 });
		// Exactly one object arg → ctx is that object (not wrapped in an array).
		expect(mockLogger.error).toHaveBeenCalledWith(
			"console",
			"text 7 true null undefined tail [obj]",
			{ a: 1 },
		);
	});

	it("joins multiple object args (including Errors) into a ctx array", () => {
		console.error = jest.fn();
		load();
		const err = new Error("err-msg");
		const o2 = { b: 2 };
		console.error("text", err, o2);
		expect(mockLogger.error).toHaveBeenCalledWith(
			"console",
			"text err-msg [obj]",
			[err, o2],
		);
	});

	it("guards against re-entrant console.error logging", () => {
		console.error = jest.fn();
		// Simulate the logger re-invoking console.error synchronously.
		mockLogger.error.mockImplementationOnce(() => {
			console.error("re-entrant!");
		});
		load();
		console.error("first");
		// The re-entrant console.error keeps the original but does NOT re-log.
		expect(mockLogger.error).toHaveBeenCalledTimes(1);
	});

	it("guards against re-entrant console.warn logging", () => {
		console.warn = jest.fn();
		mockLogger.warn.mockImplementationOnce(() => {
			console.warn("re-entrant!");
		});
		load();
		console.warn("first");
		expect(mockLogger.warn).toHaveBeenCalledTimes(1);
	});
});

describe("lifecycle + session marker", () => {
	function captureAppStateHandler(): (s: string) => void {
		const call = mockAppStateAdd.mock.calls.find(([type]) => type === "change");
		return call?.[1] as (s: string) => void;
	}

	it("writes an initial unclean marker and registers an AppState listener", () => {
		jest.spyOn(Date, "now").mockReturnValue(1_234);
		load();
		expect(mockWriteMarker).toHaveBeenCalledWith(
			JSON.stringify({
				session: "sess-1",
				startedAt: 1_234,
				clean: false,
				version: "9.9.9",
			}),
		);
		expect(mockAppStateAdd).toHaveBeenCalledWith(
			"change",
			expect.any(Function),
		);
		(Date.now as jest.Mock).mockRestore?.();
	});

	it("warns when the previous session ended without a clean exit", () => {
		mockReadMarker.mockReturnValue(JSON.stringify({ clean: false }));
		load();
		expect(mockLogger.warn).toHaveBeenCalledWith(
			"session",
			expect.stringContaining("without a clean exit"),
			{ previous: { clean: false } },
		);
	});

	it("does not warn when the previous session exited cleanly", () => {
		mockReadMarker.mockReturnValue(JSON.stringify({ clean: true }));
		load();
		expect(mockLogger.warn).not.toHaveBeenCalled();
	});

	it("tolerates an unparsable previous marker", () => {
		mockReadMarker.mockReturnValue("{not json");
		expect(() => load()).not.toThrow();
		expect(mockLogger.warn).not.toHaveBeenCalled();
	});

	it("flushes and marks clean when the app goes to the background", () => {
		load();
		mockFlushLogs.mockClear();
		mockWriteMarker.mockClear();
		captureAppStateHandler()("background");
		expect(mockFlushLogs).toHaveBeenCalled();
		const written = JSON.parse(mockWriteMarker.mock.calls[0][0]);
		expect(written.clean).toBe(true);
	});

	it("marks clean on inactive too", () => {
		load();
		mockWriteMarker.mockClear();
		captureAppStateHandler()("inactive");
		expect(JSON.parse(mockWriteMarker.mock.calls[0][0]).clean).toBe(true);
	});

	it("marks unclean again when the app returns to active", () => {
		load();
		mockWriteMarker.mockClear();
		captureAppStateHandler()("active");
		expect(JSON.parse(mockWriteMarker.mock.calls[0][0]).clean).toBe(false);
	});

	it("ignores other AppState values without writing a marker", () => {
		load();
		mockWriteMarker.mockClear();
		captureAppStateHandler()("unknown-state");
		expect(mockWriteMarker).not.toHaveBeenCalled();
	});

	it("swallows a failure thrown inside the AppState handler", () => {
		load();
		mockFlushLogs.mockImplementationOnce(() => {
			throw new Error("flush failed");
		});
		expect(() => captureAppStateHandler()("background")).not.toThrow();
	});
});

describe("installLogging — resilience", () => {
	it("never lets a setup failure escape (outer try/catch)", () => {
		// Make the very first install step throw by giving ErrorUtils a
		// getGlobalHandler that explodes.
		g.ErrorUtils = {
			getGlobalHandler: () => {
				throw new Error("explode during setup");
			},
			setGlobalHandler: jest.fn(),
		};
		expect(() => load()).not.toThrow();
		// Initialization log is skipped because setup threw before it.
		expect(mockLogger.info).not.toHaveBeenCalled();
		// The guard was still set, so a second call is a no-op.
		expect(g.__sparkyLoggingInstalled).toBe(true);
	});
});
