/**
 * Live view of recent in-memory log entries. Mirrors the codebase's subscriber
 * idiom (see `useAuth` / `useSheetsData`): subscribes to the logger's ring
 * buffer and re-renders on each new entry.
 */

import { useEffect, useState } from "react";
import {
	getLogEntries,
	type LogEntry,
	subscribeToLogs,
} from "@/services/logger";

/** Returns `{ entries }`, the current log buffer, re-rendering as logs arrive. */
export function useLogs() {
	const [entries, setEntries] = useState<LogEntry[]>(() => getLogEntries());

	useEffect(() => {
		return subscribeToLogs(() => setEntries(getLogEntries()));
	}, []);

	return { entries };
}
