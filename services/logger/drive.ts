/**
 * Minimal Google Drive v3 REST client for uploading diagnostics logs.
 *
 * Mirrors `services/googleSheets.ts`: plain `fetch` with a Bearer access token,
 * `response.text()` + structured log on failure, then throw. Stateless w.r.t.
 * auth — every method takes the access token; the caller owns token acquisition
 * (see `getDriveAccessToken` in `hooks/useAuth.tsx`).
 *
 * Requires the broad `drive` scope so a user can write into a shared folder the
 * app itself did not create (`drive.file` would only expose app-created files).
 */

import { logger } from "./logger";

const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Metadata returned by Drive for an uploaded file. */
export interface DriveUploadResult {
	id: string;
	name: string;
	webViewLink?: string;
}

async function readError(response: Response): Promise<string> {
	try {
		return await response.text();
	} catch {
		return "";
	}
}

/** Minimal Drive v3 client for the find-or-create folder + upload flow. */
export class DriveService {
	private baseUrl = "https://www.googleapis.com/drive/v3";
	private uploadUrl = "https://www.googleapis.com/upload/drive/v3";

	/** Find a folder by name (optionally under a parent). Returns its id or null. */
	async findFolder(
		name: string,
		accessToken: string,
		parentId?: string,
	): Promise<string | null> {
		const clauses = [
			`mimeType='${FOLDER_MIME}'`,
			`name='${name.replace(/'/g, "\\'")}'`,
			"trashed=false",
		];
		if (parentId) clauses.push(`'${parentId}' in parents`);

		const params = new URLSearchParams({
			q: clauses.join(" and "),
			fields: "files(id,name)",
			spaces: "drive",
			pageSize: "10",
		});

		const response = await fetch(`${this.baseUrl}/files?${params.toString()}`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		if (!response.ok) {
			const error = await readError(response);
			logger.error("Drive", "files.list failed", {
				status: response.status,
				error,
			});
			throw new Error(
				`Drive list failed: ${response.status} ${response.statusText}`,
			);
		}
		const data = (await response.json()) as { files?: { id: string }[] };
		// Non-atomic find-or-create can produce duplicate names; pick the first.
		return data.files?.[0]?.id ?? null;
	}

	/** Create a folder (optionally under a parent) and return its id. */
	async createFolder(
		name: string,
		accessToken: string,
		parentId?: string,
	): Promise<string> {
		const body: { name: string; mimeType: string; parents?: string[] } = {
			name,
			mimeType: FOLDER_MIME,
		};
		if (parentId) body.parents = [parentId];

		const response = await fetch(`${this.baseUrl}/files?fields=id,name`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});
		if (!response.ok) {
			const error = await readError(response);
			logger.error("Drive", "files.create (folder) failed", {
				status: response.status,
				error,
			});
			throw new Error(`Drive folder create failed: ${response.status}`);
		}
		const data = (await response.json()) as { id: string };
		return data.id;
	}

	/** Return an existing folder's id, creating it if absent. */
	async findOrCreateFolder(
		name: string,
		accessToken: string,
		parentId?: string,
	): Promise<string> {
		const found = await this.findFolder(name, accessToken, parentId);
		if (found) return found;
		return this.createFolder(name, accessToken, parentId);
	}

	/**
	 * Upload a text file via a multipart/related request. The top-level
	 * Content-Type MUST be `multipart/related; boundary=…` (not JSON), the body
	 * is a plain string, and `fields` must request `webViewLink` to get it back.
	 * Multipart upload is for payloads up to 5 MB; the caller caps content size.
	 */
	async uploadTextFile(opts: {
		name: string;
		content: string;
		folderId?: string;
		accessToken: string;
	}): Promise<DriveUploadResult> {
		const { name, content, folderId, accessToken } = opts;
		const boundary = `----sparkysdiag${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
		const metadata: { name: string; parents?: string[] } = { name };
		if (folderId) metadata.parents = [folderId];

		const body =
			`--${boundary}\r\n` +
			"Content-Type: application/json; charset=UTF-8\r\n\r\n" +
			`${JSON.stringify(metadata)}\r\n` +
			`--${boundary}\r\n` +
			"Content-Type: text/plain; charset=UTF-8\r\n\r\n" +
			`${content}\r\n` +
			`--${boundary}--`;

		const params = new URLSearchParams({
			uploadType: "multipart",
			fields: "id,name,webViewLink",
		});

		const response = await fetch(
			`${this.uploadUrl}/files?${params.toString()}`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": `multipart/related; boundary=${boundary}`,
				},
				body,
			},
		);
		if (!response.ok) {
			const error = await readError(response);
			logger.error("Drive", "multipart upload failed", {
				status: response.status,
				error,
			});
			throw new Error(
				`Drive upload failed: ${response.status} ${response.statusText}`,
			);
		}
		return (await response.json()) as DriveUploadResult;
	}
}
