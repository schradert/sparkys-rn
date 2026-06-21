/**
 * Installs global error/log capture as early as possible (imported first from
 * the custom `index.js` entry, before `expo-router/entry`). Idempotent.
 *
 * Captures, so nothing is ever silently lost:
 *  - Uncaught JS exceptions    → `ErrorUtils.setGlobalHandler` (chained).
 *  - Unhandled promise rejections → Hermes rejection tracker (web fallback).
 *  - `console.error` / `console.warn` → teed into the logger (originals kept).
 *  - Abnormal termination (native crash / force-kill) → inferred next launch
 *    via a clean-exit session marker. NOTE: managed Expo cannot capture native
 *    crashes directly without a native crash reporter; this is best-effort
 *    inference, labelled honestly (not "native crash").
 *
 * React render-phase errors are caught separately by `LogErrorBoundary`.
 */

import Constants from "expo-constants";
import { AppState, type AppStateStatus } from "react-native";
import { readMarker, writeMarker } from "./fileSink";
import { flushLogs, getSessionId, logger } from "./logger";

type ErrorHandler = (error: unknown, isFatal?: boolean) => void;

interface ErrorUtilsShim {
	getGlobalHandler?: () => ErrorHandler;
	setGlobalHandler?: (handler: ErrorHandler) => void;
}

interface HermesShim {
	enablePromiseRejectionTracker?: (options: {
		allRejections: boolean;
		onUnhandled: (id: number, error: unknown) => void;
		onHandled?: (id: number) => void;
	}) => void;
}

const g = globalThis as typeof globalThis & {
	ErrorUtils?: ErrorUtilsShim;
	HermesInternal?: HermesShim;
	__sparkyLoggingInstalled?: boolean;
};

let marker: {
	session: string;
	startedAt: number;
	clean: boolean;
	version?: string;
} | null = null;

function persistMarker(clean: boolean): void {
	if (!marker) return;
	marker = { ...marker, clean };
	writeMarker(JSON.stringify(marker));
}

function installGlobalErrorHandler(): void {
	const eu = g.ErrorUtils;
	if (!eu?.setGlobalHandler) return;
	const previous = eu.getGlobalHandler?.();
	eu.setGlobalHandler((error: unknown, isFatal?: boolean) => {
		try {
			const err = error as { message?: string } | undefined;
			logger.error(
				"uncaught",
				err?.message ? String(err.message) : String(error),
				{
					error,
					isFatal: Boolean(isFatal),
				},
			);
			flushLogs(); // synchronous — persist before the process may die
		} catch {}
		// Preserve default behavior (RedBox in dev, native fatal handling).
		previous?.(error, isFatal);
	});
}

function installRejectionTracking(): void {
	const onUnhandled = (id: number, error: unknown) => {
		try {
			const err = error as { message?: string } | undefined;
			logger.error(
				"unhandledRejection",
				err?.message ? String(err.message) : String(error),
				{ id, error },
			);
		} catch {}
		if (typeof __DEV__ !== "undefined" && __DEV__) {
			// Keep dev visibility, since enabling our tracker replaces RN's.
			console.warn(`Unhandled promise rejection (id ${id})`, error);
		}
	};

	const hermes = g.HermesInternal;
	if (hermes?.enablePromiseRejectionTracker) {
		hermes.enablePromiseRejectionTracker({ allRejections: true, onUnhandled });
		return;
	}
	// Web (react-native-web) fallback.
	const addEventListener = (
		globalThis as {
			addEventListener?: (t: string, h: (e: unknown) => void) => void;
		}
	).addEventListener;
	if (typeof addEventListener === "function") {
		addEventListener("unhandledrejection", (event: unknown) => {
			const reason = (event as { reason?: unknown })?.reason ?? event;
			onUnhandled(-1, reason);
		});
	}
}

function teeConsole(): void {
	const origError = console.error.bind(console);
	const origWarn = console.warn.bind(console);
	let reentrant = false;

	const describe = (args: unknown[]): { msg: string; ctx?: unknown } => {
		const msg = args
			.map((a) => {
				if (typeof a === "string") return a;
				if (a instanceof Error) return a.message;
				if (typeof a === "number" || typeof a === "boolean") return String(a);
				if (a == null) return String(a);
				return "[obj]";
			})
			.join(" ");
		const objs = args.filter((a) => a !== null && typeof a === "object");
		const ctx =
			objs.length === 0 ? undefined : objs.length === 1 ? objs[0] : objs;
		return { msg, ctx };
	};

	console.error = (...args: unknown[]) => {
		origError(...args); // keep native console / LogBox first
		if (reentrant) return;
		reentrant = true;
		try {
			const { msg, ctx } = describe(args);
			logger.error("console", msg, ctx);
		} finally {
			reentrant = false;
		}
	};

	console.warn = (...args: unknown[]) => {
		origWarn(...args);
		if (reentrant) return;
		reentrant = true;
		try {
			const { msg, ctx } = describe(args);
			logger.warn("console", msg, ctx);
		} finally {
			reentrant = false;
		}
	};
}

function installLifecycle(): void {
	// Inspect the previous session's marker before overwriting it.
	try {
		const prevRaw = readMarker();
		if (prevRaw) {
			const prev = JSON.parse(prevRaw) as { clean?: boolean };
			if (prev && prev.clean === false) {
				logger.warn(
					"session",
					"Previous session ended without a clean exit (possible native crash or force-kill)",
					{ previous: prev },
				);
			}
		}
	} catch {}

	marker = {
		session: getSessionId(),
		startedAt: Date.now(),
		clean: false,
		version: Constants.expoConfig?.version,
	};
	persistMarker(false);

	const onAppStateChange = (state: AppStateStatus) => {
		try {
			if (state === "background" || state === "inactive") {
				flushLogs();
				persistMarker(true); // graceful pause → mark clean
			} else if (state === "active") {
				persistMarker(false); // running again
			}
		} catch {}
	};
	AppState.addEventListener("change", onAppStateChange);
}

/** Idempotently install all global capture. Safe to call more than once. */
export function installLogging(): void {
	if (g.__sparkyLoggingInstalled) return;
	g.__sparkyLoggingInstalled = true;
	try {
		installGlobalErrorHandler();
		installRejectionTracking();
		teeConsole();
		installLifecycle();
		logger.info("logger", "Logging initialized", {
			session: getSessionId(),
			version: Constants.expoConfig?.version,
		});
	} catch {
		// Never let logging setup crash app startup.
	}
}

// Run on import so a side-effect import from the entry installs capture before
// the router evaluates. The guard makes Fast Refresh re-imports harmless.
installLogging();
