/// <reference types="jest" />
// Exercises the diagnostics upload orchestrator: token gating, folder
// find-or-create (with per-session caching), the shared-folder-id shortcut,
// single-flighting, and the success / error result shapes. collect + drive +
// logger are mocked; the Diagnostics constants are made mutable so the
// "configured shared folder" branch can be toggled per test.

const mockCollectLogs = jest.fn();
const mockFindOrCreateFolder = jest.fn();
const mockUploadTextFile = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();

const mockDiagnostics = {
	DIAGNOSTICS_FOLDER_ID: "",
	DIAGNOSTICS_FOLDER_NAME: "Sparky's Diagnostics",
	DIAGNOSTICS_LOGS_SUBFOLDER: "Logs",
};

jest.mock("@/constants/Diagnostics", () => ({
	get DIAGNOSTICS_FOLDER_ID() {
		return mockDiagnostics.DIAGNOSTICS_FOLDER_ID;
	},
	get DIAGNOSTICS_FOLDER_NAME() {
		return mockDiagnostics.DIAGNOSTICS_FOLDER_NAME;
	},
	get DIAGNOSTICS_LOGS_SUBFOLDER() {
		return mockDiagnostics.DIAGNOSTICS_LOGS_SUBFOLDER;
	},
}));

jest.mock("@/services/logger/collect", () => ({
	collectLogs: (...args: unknown[]) => mockCollectLogs(...args),
}));

jest.mock("@/services/logger/drive", () => ({
	DriveService: jest.fn().mockImplementation(() => ({
		findOrCreateFolder: (...args: unknown[]) => mockFindOrCreateFolder(...args),
		uploadTextFile: (...args: unknown[]) => mockUploadTextFile(...args),
	})),
}));

jest.mock("@/services/logger/logger", () => ({
	logger: {
		info: (...args: unknown[]) => mockLoggerInfo(...args),
		error: (...args: unknown[]) => mockLoggerError(...args),
		warn: jest.fn(),
		debug: jest.fn(),
	},
}));

type UploadModule = typeof import("@/services/logger/upload");

function loadUpload(): UploadModule {
	let mod: UploadModule = {} as UploadModule;
	jest.isolateModules(() => {
		mod = require("@/services/logger/upload");
	});
	return mod;
}

const COLLECTED = {
	header: "# header",
	body: "line1\nline2",
	fileName: "diag.log",
	entryCount: 7,
};

beforeEach(() => {
	jest.clearAllMocks();
	mockDiagnostics.DIAGNOSTICS_FOLDER_ID = "";
	mockCollectLogs.mockResolvedValue(COLLECTED);
	mockFindOrCreateFolder.mockImplementation(
		async (name: string) => `id:${name}`,
	);
	mockUploadTextFile.mockResolvedValue({
		id: "file-1",
		name: "diag.log",
		webViewLink: "https://drive/x",
	});
});

describe("uploadDiagnostics — success", () => {
	it("creates the folder tree and uploads, returning the link + count", async () => {
		const { uploadDiagnostics } = loadUpload();
		const getToken = jest.fn().mockResolvedValue("tok");

		const result = await uploadDiagnostics("session", getToken, {
			userEmail: "a@b.com",
		});

		expect(result).toEqual({
			ok: true,
			fileName: "diag.log",
			link: "https://drive/x",
			entryCount: 7,
		});

		// Folder tree: Diagnostics → Logs → <user>.
		expect(mockFindOrCreateFolder).toHaveBeenNthCalledWith(
			1,
			"Sparky's Diagnostics",
			"tok",
			undefined,
		);
		expect(mockFindOrCreateFolder).toHaveBeenNthCalledWith(
			2,
			"Logs",
			"tok",
			"id:Sparky's Diagnostics",
		);
		expect(mockFindOrCreateFolder).toHaveBeenNthCalledWith(
			3,
			"a@b.com",
			"tok",
			"id:Logs",
		);

		// Upload payload joins header + body and targets the user folder.
		expect(mockUploadTextFile).toHaveBeenCalledWith({
			name: "diag.log",
			content: "# header\nline1\nline2",
			folderId: "id:a@b.com",
			accessToken: "tok",
		});
		expect(mockLoggerInfo).toHaveBeenCalledWith(
			"Diagnostics",
			"Uploaded diagnostics to Drive",
			{ fileName: "diag.log", entryCount: 7 },
		);
	});

	it("uses the 'unknown' user folder when no email is supplied", async () => {
		const { uploadDiagnostics } = loadUpload();
		await uploadDiagnostics("allRetained", jest.fn().mockResolvedValue("tok"));
		expect(mockFindOrCreateFolder).toHaveBeenNthCalledWith(
			3,
			"unknown",
			"tok",
			"id:Logs",
		);
	});

	it("skips creating the top folder when a shared folder id is configured", async () => {
		mockDiagnostics.DIAGNOSTICS_FOLDER_ID = "shared-root";
		const { uploadDiagnostics } = loadUpload();
		await uploadDiagnostics("session", jest.fn().mockResolvedValue("tok"));

		// First resolved folder is "Logs" under the configured root (no top-level
		// find-or-create for the Diagnostics folder).
		expect(mockFindOrCreateFolder).toHaveBeenNthCalledWith(
			1,
			"Logs",
			"tok",
			"shared-root",
		);
		expect(mockFindOrCreateFolder).not.toHaveBeenCalledWith(
			"Sparky's Diagnostics",
			expect.anything(),
			expect.anything(),
		);
	});

	it("caches resolved folder ids so a second upload re-creates nothing", async () => {
		const { uploadDiagnostics } = loadUpload();
		const getToken = jest.fn().mockResolvedValue("tok");
		await uploadDiagnostics("session", getToken, { userEmail: "a@b.com" });
		expect(mockFindOrCreateFolder).toHaveBeenCalledTimes(3);

		mockFindOrCreateFolder.mockClear();
		await uploadDiagnostics("session", getToken, { userEmail: "a@b.com" });
		// All three folder keys are cached → no further find-or-create calls.
		expect(mockFindOrCreateFolder).not.toHaveBeenCalled();
	});
});

describe("uploadDiagnostics — failures", () => {
	it("returns a friendly error when no Drive token is available", async () => {
		const { uploadDiagnostics } = loadUpload();
		const result = await uploadDiagnostics(
			"session",
			jest.fn().mockResolvedValue(null),
		);
		expect(result).toEqual({
			ok: false,
			error:
				"Couldn't access Google Drive. Please approve Drive access and try again.",
		});
		expect(mockUploadTextFile).not.toHaveBeenCalled();
	});

	it("maps a 403 error to an approve-access message", async () => {
		mockUploadTextFile.mockRejectedValue(new Error("Drive upload failed: 403"));
		const { uploadDiagnostics } = loadUpload();
		const result = await uploadDiagnostics(
			"session",
			jest.fn().mockResolvedValue("tok"),
		);
		expect(result).toEqual({
			ok: false,
			error:
				"Google Drive permission was denied. Tap Upload again and approve Drive access.",
		});
		expect(mockLoggerError).toHaveBeenCalledWith(
			"Diagnostics",
			"Upload failed",
			{
				error: expect.any(Error),
			},
		);
	});

	it("surfaces other errors verbatim in the failure message", async () => {
		mockCollectLogs.mockRejectedValue(new Error("disk exploded"));
		const { uploadDiagnostics } = loadUpload();
		const result = await uploadDiagnostics(
			"session",
			jest.fn().mockResolvedValue("tok"),
		);
		expect(result).toEqual({
			ok: false,
			error: "Upload failed: disk exploded",
		});
	});

	it("stringifies a non-Error thrown value", async () => {
		mockCollectLogs.mockRejectedValue("plain failure");
		const { uploadDiagnostics } = loadUpload();
		const result = await uploadDiagnostics(
			"session",
			jest.fn().mockResolvedValue("tok"),
		);
		expect(result).toEqual({
			ok: false,
			error: "Upload failed: plain failure",
		});
	});
});

describe("uploadDiagnostics — single-flighting", () => {
	it("returns the same in-flight promise for concurrent calls", async () => {
		let release!: (v: typeof COLLECTED) => void;
		mockCollectLogs.mockReturnValue(
			new Promise((resolve) => {
				release = resolve;
			}),
		);
		const { uploadDiagnostics } = loadUpload();
		const getToken = jest.fn().mockResolvedValue("tok");

		const p1 = uploadDiagnostics("session", getToken);
		const p2 = uploadDiagnostics("session", getToken);
		expect(p1).toBe(p2); // second call coalesced into the first

		release(COLLECTED);
		await p1;
		// collectLogs ran once for the single shared run.
		expect(mockCollectLogs).toHaveBeenCalledTimes(1);
	});

	it("clears the in-flight slot so a later upload starts fresh", async () => {
		const { uploadDiagnostics } = loadUpload();
		const getToken = jest.fn().mockResolvedValue("tok");
		await uploadDiagnostics("session", getToken);
		await uploadDiagnostics("session", getToken);
		// Two sequential runs → collectLogs invoked twice.
		expect(mockCollectLogs).toHaveBeenCalledTimes(2);
	});
});
