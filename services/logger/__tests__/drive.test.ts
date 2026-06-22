/// <reference types="jest" />
// Exercises the minimal Drive REST client. All network I/O is faked through a
// stubbed global.fetch returning Response-like objects; the logger is mocked so
// failure-path logging can be asserted without touching the real subsystem.

const mockLoggerError = jest.fn();

jest.mock("@/services/logger/logger", () => ({
	logger: {
		error: (...args: unknown[]) => mockLoggerError(...args),
		warn: jest.fn(),
		info: jest.fn(),
		debug: jest.fn(),
	},
}));

import { DriveService } from "@/services/logger/drive";

interface FakeResponseInit {
	ok: boolean;
	status?: number;
	statusText?: string;
	json?: unknown;
	text?: string;
	textThrows?: boolean;
}

function fakeResponse(init: FakeResponseInit): Response {
	return {
		ok: init.ok,
		status: init.status ?? (init.ok ? 200 : 500),
		statusText: init.statusText ?? "",
		json: async () => init.json,
		text: async () => {
			if (init.textThrows) throw new Error("body read failed");
			return init.text ?? "";
		},
	} as unknown as Response;
}

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>();
globalThis.fetch = fetchMock as unknown as typeof fetch;

/** Decode a request URL's query, restoring `+`-encoded spaces to literals. */
function decodeQuery(url: string): string {
	return decodeURIComponent(url.replace(/\+/g, " "));
}

const TOKEN = "tok-123";

beforeEach(() => {
	jest.clearAllMocks();
});

describe("findFolder", () => {
	it("returns the first matching folder id", async () => {
		fetchMock.mockResolvedValue(
			fakeResponse({ ok: true, json: { files: [{ id: "f1" }, { id: "f2" }] } }),
		);
		const id = await new DriveService().findFolder("Logs", TOKEN);
		expect(id).toBe("f1");

		const [url, opts] = fetchMock.mock.calls[0];
		expect(url).toContain("/drive/v3/files?");
		expect(url).toContain("trashed%3Dfalse");
		expect((opts?.headers as Record<string, string>).Authorization).toBe(
			`Bearer ${TOKEN}`,
		);
	});

	it("returns null when no folders match", async () => {
		fetchMock.mockResolvedValue(
			fakeResponse({ ok: true, json: { files: [] } }),
		);
		expect(await new DriveService().findFolder("Logs", TOKEN)).toBeNull();
	});

	it("returns null when the response omits the files array", async () => {
		fetchMock.mockResolvedValue(fakeResponse({ ok: true, json: {} }));
		expect(await new DriveService().findFolder("Logs", TOKEN)).toBeNull();
	});

	it("scopes the query to a parent folder when given", async () => {
		fetchMock.mockResolvedValue(
			fakeResponse({ ok: true, json: { files: [] } }),
		);
		await new DriveService().findFolder("Logs", TOKEN, "parent-1");
		expect(decodeQuery(fetchMock.mock.calls[0][0])).toContain(
			"'parent-1' in parents",
		);
	});

	it("escapes single quotes in the folder name", async () => {
		fetchMock.mockResolvedValue(
			fakeResponse({ ok: true, json: { files: [] } }),
		);
		await new DriveService().findFolder("Bob's Logs", TOKEN);
		expect(decodeQuery(fetchMock.mock.calls[0][0])).toContain(
			"name='Bob\\'s Logs'",
		);
	});

	it("logs and throws on a non-OK response", async () => {
		fetchMock.mockResolvedValue(
			fakeResponse({
				ok: false,
				status: 500,
				statusText: "Server Error",
				text: "boom",
			}),
		);
		await expect(new DriveService().findFolder("Logs", TOKEN)).rejects.toThrow(
			"Drive list failed: 500 Server Error",
		);
		expect(mockLoggerError).toHaveBeenCalledWith("Drive", "files.list failed", {
			status: 500,
			error: "boom",
		});
	});

	it("tolerates a failure to read the error body", async () => {
		fetchMock.mockResolvedValue(
			fakeResponse({ ok: false, status: 503, textThrows: true }),
		);
		await expect(new DriveService().findFolder("Logs", TOKEN)).rejects.toThrow(
			"Drive list failed: 503",
		);
		expect(mockLoggerError).toHaveBeenCalledWith(
			"Drive",
			"files.list failed",
			expect.objectContaining({ status: 503, error: "" }),
		);
	});
});

describe("createFolder", () => {
	it("creates a folder and returns its id", async () => {
		fetchMock.mockResolvedValue(
			fakeResponse({ ok: true, json: { id: "new" } }),
		);
		const id = await new DriveService().createFolder("Logs", TOKEN);
		expect(id).toBe("new");

		const [url, opts] = fetchMock.mock.calls[0];
		expect(url).toContain("fields=id,name");
		expect(opts?.method).toBe("POST");
		const body = JSON.parse(String(opts?.body));
		expect(body).toEqual({
			name: "Logs",
			mimeType: "application/vnd.google-apps.folder",
		});
	});

	it("nests under a parent folder when given", async () => {
		fetchMock.mockResolvedValue(
			fakeResponse({ ok: true, json: { id: "new" } }),
		);
		await new DriveService().createFolder("Logs", TOKEN, "parent-1");
		const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
		expect(body.parents).toEqual(["parent-1"]);
	});

	it("logs and throws on a non-OK response", async () => {
		fetchMock.mockResolvedValue(
			fakeResponse({ ok: false, status: 401, text: "denied" }),
		);
		await expect(
			new DriveService().createFolder("Logs", TOKEN),
		).rejects.toThrow("Drive folder create failed: 401");
		expect(mockLoggerError).toHaveBeenCalledWith(
			"Drive",
			"files.create (folder) failed",
			{ status: 401, error: "denied" },
		);
	});
});

describe("findOrCreateFolder", () => {
	it("returns an existing folder without creating one", async () => {
		fetchMock.mockResolvedValue(
			fakeResponse({ ok: true, json: { files: [{ id: "existing" }] } }),
		);
		const id = await new DriveService().findOrCreateFolder("Logs", TOKEN);
		expect(id).toBe("existing");
		expect(fetchMock).toHaveBeenCalledTimes(1); // only the find call
	});

	it("creates the folder when none is found", async () => {
		fetchMock
			.mockResolvedValueOnce(fakeResponse({ ok: true, json: { files: [] } }))
			.mockResolvedValueOnce(
				fakeResponse({ ok: true, json: { id: "created" } }),
			);
		const id = await new DriveService().findOrCreateFolder(
			"Logs",
			TOKEN,
			"parent",
		);
		expect(id).toBe("created");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});

describe("uploadTextFile", () => {
	it("uploads a multipart text file and returns the Drive result", async () => {
		fetchMock.mockResolvedValue(
			fakeResponse({
				ok: true,
				json: { id: "id1", name: "diag.log", webViewLink: "https://x/y" },
			}),
		);
		const result = await new DriveService().uploadTextFile({
			name: "diag.log",
			content: "hello",
			folderId: "folder-1",
			accessToken: TOKEN,
		});
		expect(result).toEqual({
			id: "id1",
			name: "diag.log",
			webViewLink: "https://x/y",
		});

		const [url, opts] = fetchMock.mock.calls[0];
		expect(url).toContain("/upload/drive/v3/files?");
		expect(url).toContain("uploadType=multipart");
		const contentType = (opts?.headers as Record<string, string>)[
			"Content-Type"
		];
		expect(contentType).toMatch(
			/^multipart\/related; boundary=----sparkysdiag/,
		);
		// Body carries the metadata (with the parent) and the file content.
		const body = String(opts?.body);
		expect(body).toContain('"parents":["folder-1"]');
		expect(body).toContain("hello");
	});

	it("omits parents from metadata when no folderId is given", async () => {
		fetchMock.mockResolvedValue(
			fakeResponse({ ok: true, json: { id: "id1", name: "diag.log" } }),
		);
		await new DriveService().uploadTextFile({
			name: "diag.log",
			content: "x",
			accessToken: TOKEN,
		});
		const body = String(fetchMock.mock.calls[0][1]?.body);
		expect(body).not.toContain('"parents"');
	});

	it("logs and throws on a non-OK upload response", async () => {
		fetchMock.mockResolvedValue(
			fakeResponse({
				ok: false,
				status: 413,
				statusText: "Payload Too Large",
				text: "too big",
			}),
		);
		await expect(
			new DriveService().uploadTextFile({
				name: "diag.log",
				content: "x",
				accessToken: TOKEN,
			}),
		).rejects.toThrow("Drive upload failed: 413 Payload Too Large");
		expect(mockLoggerError).toHaveBeenCalledWith(
			"Drive",
			"multipart upload failed",
			{ status: 413, error: "too big" },
		);
	});
});
