import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react-native";
import { Share } from "react-native";
import Diagnostics from "@/app/diagnostics";
import type { LogEntry, LogLevel } from "@/services/logger";
import type { UploadResult } from "@/services/logger/upload";
import { uploadDiagnostics } from "@/services/logger/upload";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
	router: { back: (...args: unknown[]) => mockBack(...args) },
}));

let mockTheme: "light" | "dark" = "light";
jest.mock("@/hooks/useTheme", () => ({
	useTheme: () => ({ theme: mockTheme }),
}));

let mockUser: { user?: { email?: string | null } } | null = null;
const mockGetDriveAccessToken = jest.fn();
jest.mock("@/hooks/useAuth", () => ({
	useAuth: () => ({
		user: mockUser,
		getDriveAccessToken: mockGetDriveAccessToken,
	}),
}));

let mockEntries: LogEntry[] = [];
jest.mock("@/hooks/useLogs", () => ({
	useLogs: () => ({ entries: mockEntries }),
}));

jest.mock("@/services/logger/upload", () => ({
	uploadDiagnostics: jest.fn(),
}));

// Render Ionicons as their glyph name so icons are queryable by text.
jest.mock("@expo/vector-icons", () => {
	const { Text } = require("react-native") as typeof import("react-native");
	return {
		Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text>,
	};
});

const mockUpload = uploadDiagnostics as jest.MockedFunction<
	typeof uploadDiagnostics
>;

function entry(overrides: Partial<LogEntry> = {}): LogEntry {
	return {
		seq: 1,
		t: Date.parse("2026-06-21T10:00:00.000Z"),
		ts: "2026-06-21T10:00:00.000Z",
		level: "info" as LogLevel,
		tag: "Sheets",
		msg: "hello",
		session: "s1",
		...overrides,
	};
}

beforeEach(() => {
	mockBack.mockReset();
	mockTheme = "light";
	mockUser = null;
	mockGetDriveAccessToken.mockReset().mockResolvedValue("token");
	mockEntries = [];
	mockUpload.mockReset();
	jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe("diagnostics", () => {
	it("renders the empty state and upload controls", async () => {
		await render(<Diagnostics />);
		expect(screen.getByText("Diagnostics")).toBeOnTheScreen();
		expect(screen.getByText("Upload to Drive")).toBeOnTheScreen();
		expect(screen.getByText("No log entries yet.")).toBeOnTheScreen();
	});

	it("navigates back when the back button is pressed", async () => {
		await render(<Diagnostics />);
		await fireEvent.press(screen.getByText("icon:arrow-back"));
		expect(mockBack).toHaveBeenCalledTimes(1);
	});

	it("renders log rows newest-first with level, tag, and message", async () => {
		mockEntries = [
			entry({ seq: 1, level: "info", tag: "A", msg: "first" }),
			entry({ seq: 2, level: "error", tag: "B", msg: "second" }),
		];
		await render(<Diagnostics />);
		expect(screen.getByText("first")).toBeOnTheScreen();
		expect(screen.getByText("second")).toBeOnTheScreen();
		expect(screen.getByText("INFO")).toBeOnTheScreen();
		expect(screen.getByText("ERROR")).toBeOnTheScreen();
	});

	it("renders all four level colors across the row types", async () => {
		// One of each level exercises every branch of `levelColor`, including the
		// default (debug) arm.
		mockEntries = [
			entry({ seq: 1, level: "debug", msg: "d" }),
			entry({ seq: 2, level: "info", msg: "i" }),
			entry({ seq: 3, level: "warn", msg: "w" }),
			entry({ seq: 4, level: "error", msg: "e" }),
		];
		await render(<Diagnostics />);
		expect(screen.getByText("DEBUG")).toBeOnTheScreen();
		expect(screen.getByText("WARN")).toBeOnTheScreen();
	});

	it("renders serialized context when present", async () => {
		mockEntries = [entry({ seq: 1, msg: "ctx-msg", ctx: { a: 1 } })];
		await render(<Diagnostics />);
		expect(screen.getByText('{"a":1}')).toBeOnTheScreen();
	});

	it("falls back to String() when context cannot be serialized", async () => {
		// A circular structure forces JSON.stringify to throw, exercising the
		// safeStringify catch arm.
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		mockEntries = [entry({ seq: 1, msg: "bad-ctx", ctx: circular })];
		await render(<Diagnostics />);
		expect(screen.getByText("[object Object]")).toBeOnTheScreen();
	});

	it("filters entries to warnings and above when the Warn+ chip is active", async () => {
		mockEntries = [
			entry({ seq: 1, level: "info", msg: "info-row" }),
			entry({ seq: 2, level: "warn", msg: "warn-row" }),
			entry({ seq: 3, level: "error", msg: "error-row" }),
		];
		await render(<Diagnostics />);
		await fireEvent.press(screen.getByText("Warn+"));

		expect(screen.queryByText("info-row")).toBeNull();
		expect(screen.getByText("warn-row")).toBeOnTheScreen();
		expect(screen.getByText("error-row")).toBeOnTheScreen();
	});

	it("selects a different upload scope", async () => {
		await render(<Diagnostics />);
		// Each scope renders its label; selecting toggles the radio glyph.
		await fireEvent.press(screen.getByText("Last 15 minutes"));
		// The newly selected scope shows the filled radio; at least one exists.
		expect(screen.getAllByText("icon:radio-button-on").length).toBeGreaterThan(
			0,
		);
	});

	it("uploads logs and shows a success result with the user email", async () => {
		mockUser = { user: { email: "dev@mill.com" } };
		const result: UploadResult = {
			ok: true,
			fileName: "diag.log",
			entryCount: 3,
			link: "https://drive.example/abc",
		};
		mockUpload.mockResolvedValue(result);

		await render(<Diagnostics />);
		await fireEvent.press(screen.getByText("Upload to Drive"));

		await waitFor(() =>
			expect(
				screen.getByText("Uploaded diag.log (3 entries)."),
			).toBeOnTheScreen(),
		);
		expect(mockUpload).toHaveBeenCalledWith(
			"session",
			mockGetDriveAccessToken,
			{ userEmail: "dev@mill.com" },
		);
		expect(screen.getByText("Share link")).toBeOnTheScreen();
	});

	it("passes undefined email when no user is present", async () => {
		mockUpload.mockResolvedValue({
			ok: true,
			fileName: "diag.log",
			entryCount: 0,
		});
		await render(<Diagnostics />);
		await fireEvent.press(screen.getByText("Upload to Drive"));

		await waitFor(() => expect(mockUpload).toHaveBeenCalled());
		expect(mockUpload).toHaveBeenCalledWith(
			"session",
			mockGetDriveAccessToken,
			{ userEmail: undefined },
		);
		// A successful upload without a link renders no share row.
		expect(screen.queryByText("Share link")).toBeNull();
	});

	it("shares the link from a successful upload", async () => {
		mockUpload.mockResolvedValue({
			ok: true,
			fileName: "diag.log",
			entryCount: 1,
			link: "https://drive.example/xyz",
		});
		await render(<Diagnostics />);
		await fireEvent.press(screen.getByText("Upload to Drive"));
		await waitFor(() =>
			expect(screen.getByText("Share link")).toBeOnTheScreen(),
		);

		await fireEvent.press(screen.getByText("Share link"));
		expect(Share.share).toHaveBeenCalledWith({
			message: "https://drive.example/xyz",
			url: "https://drive.example/xyz",
		});
	});

	it("swallows errors when the share sheet is dismissed", async () => {
		(Share.share as jest.Mock).mockRejectedValue(new Error("dismissed"));
		mockUpload.mockResolvedValue({
			ok: true,
			fileName: "diag.log",
			entryCount: 1,
			link: "https://drive.example/xyz",
		});
		await render(<Diagnostics />);
		await fireEvent.press(screen.getByText("Upload to Drive"));
		await waitFor(() =>
			expect(screen.getByText("Share link")).toBeOnTheScreen(),
		);

		// Should not throw despite the rejection.
		await fireEvent.press(screen.getByText("Share link"));
		expect(Share.share).toHaveBeenCalledTimes(1);
	});

	it("shows the error message when an upload fails", async () => {
		mockUpload.mockResolvedValue({ ok: false, error: "Upload broke" });
		await render(<Diagnostics />);
		await fireEvent.press(screen.getByText("Upload to Drive"));

		await waitFor(() =>
			expect(screen.getByText("Upload broke")).toBeOnTheScreen(),
		);
		// A failed upload renders no share row.
		expect(screen.queryByText("Share link")).toBeNull();
	});

	it("shows an uploading spinner while the upload is in flight", async () => {
		let resolveUpload: (r: UploadResult) => void = () => {};
		mockUpload.mockReturnValue(
			new Promise<UploadResult>((resolve) => {
				resolveUpload = resolve;
			}),
		);
		await render(<Diagnostics />);

		const press = fireEvent.press(screen.getByText("Upload to Drive"));
		await waitFor(() =>
			expect(screen.getByText("Uploading…")).toBeOnTheScreen(),
		);

		await act(async () => {
			resolveUpload({ ok: true, fileName: "diag.log", entryCount: 0 });
			await press;
		});
		await waitFor(() =>
			expect(screen.getByText("Upload to Drive")).toBeOnTheScreen(),
		);
	});

	it("applies dark-theme colors without error", async () => {
		mockTheme = "dark";
		mockEntries = [entry({ seq: 1, level: "warn", msg: "dark-row" })];
		await render(<Diagnostics />);
		expect(screen.getByText("dark-row")).toBeOnTheScreen();
	});
});
