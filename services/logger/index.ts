/**
 * Public surface of the logging subsystem.
 *
 * App code should import the logger from here:
 *   import { logger } from "@/services/logger";
 *   logger.info("Sheets", "loaded products", { count });
 */

export {
	flushLogs,
	getLogEntries,
	getMinLevel,
	getSessionId,
	type Logger,
	logger,
	setMinLevel,
	subscribeToLogs,
} from "./logger";
export type { LogEntry, LogLevel, SegmentInfo } from "./types";
