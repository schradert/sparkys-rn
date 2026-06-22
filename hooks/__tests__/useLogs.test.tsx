import { act, renderHook } from "@testing-library/react-native";
import type { LogEntry } from "@/services/logger";

// The global jest.setup mock only stubs `logger`/`flushLogs`; `useLogs` also
// needs `getLogEntries`/`subscribeToLogs`, so provide a self-contained mock
// that emulates the logger's subscriber ring-buffer idiom.
let entries: LogEntry[] = [];
const subscribers = new Set<() => void>();

const mockGetLogEntries = jest.fn<LogEntry[], []>(() => entries);
const mockSubscribeToLogs = jest.fn((cb: () => void) => {
	subscribers.add(cb);
	return () => {
		subscribers.delete(cb);
	};
});

jest.mock("@/services/logger", () => ({
	getLogEntries: () => mockGetLogEntries(),
	subscribeToLogs: (cb: () => void) => mockSubscribeToLogs(cb),
}));

// `require` (not dynamic `import`) — the jest VM here isn't running with
// --experimental-vm-modules, so ESM dynamic import is unavailable. The logger
// mock is already registered above, so this picks up the mocked dependencies.
const { useLogs } =
	require("@/hooks/useLogs") as typeof import("@/hooks/useLogs");

function emit(next: LogEntry[]) {
	entries = next;
	subscribers.forEach((cb) => {
		cb();
	});
}

function makeEntry(seq: number, msg: string): LogEntry {
	return {
		seq,
		t: seq,
		ts: new Date(seq).toISOString(),
		level: "info",
		tag: "Test",
		msg,
		session: "s1",
	};
}

describe("useLogs", () => {
	beforeEach(() => {
		entries = [];
		subscribers.clear();
		mockGetLogEntries.mockClear();
		mockSubscribeToLogs.mockClear();
	});

	it("seeds entries from the current ring buffer", async () => {
		entries = [makeEntry(1, "hello")];

		const { result } = await renderHook(() => useLogs());

		expect(result.current.entries).toEqual([makeEntry(1, "hello")]);
	});

	it("re-renders with new entries when the logger emits", async () => {
		const { result } = await renderHook(() => useLogs());

		expect(result.current.entries).toEqual([]);
		expect(mockSubscribeToLogs).toHaveBeenCalledTimes(1);

		await act(async () => {
			emit([makeEntry(1, "a"), makeEntry(2, "b")]);
		});

		expect(result.current.entries).toEqual([
			makeEntry(1, "a"),
			makeEntry(2, "b"),
		]);
	});

	it("unsubscribes on unmount", async () => {
		const { unmount } = await renderHook(() => useLogs());

		expect(subscribers.size).toBe(1);

		await unmount();

		expect(subscribers.size).toBe(0);
	});
});
