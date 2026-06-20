/**
 * Orchestrates an on-demand diagnostics upload:
 *   collect relevant logs → get a Drive-scoped token → find/create the shared
 *   folder tree (Diagnostics / Logs / <user>) → multipart-upload one file.
 *
 * The token-getter is injected (rather than importing `useAuth`) to avoid an
 * import cycle. Uploads are single-flighted and resolved folder ids are cached
 * for the session, so a double-tap can't create duplicate folders/files.
 */

import {
	DIAGNOSTICS_FOLDER_ID,
	DIAGNOSTICS_FOLDER_NAME,
	DIAGNOSTICS_LOGS_SUBFOLDER,
} from "@/constants/Diagnostics";
import { collectLogs, type LogScope } from "./collect";
import { DriveService } from "./drive";
import { logger } from "./logger";

export type UploadResult =
	| { ok: true; fileName: string; link?: string; entryCount: number }
	| { ok: false; error: string };

type GetToken = () => Promise<string | null>;

let inFlight: Promise<UploadResult> | null = null;
const folderCache = new Map<string, string>();

async function resolveFolder(
	drive: DriveService,
	token: string,
	name: string,
	parentId?: string,
): Promise<string> {
	const key = `${parentId ?? "root"}/${name}`;
	const cached = folderCache.get(key);
	if (cached) return cached;
	const id = await drive.findOrCreateFolder(name, token, parentId);
	folderCache.set(key, id);
	return id;
}

async function run(
	scope: LogScope,
	getToken: GetToken,
	opts?: { userEmail?: string },
): Promise<UploadResult> {
	try {
		const collected = await collectLogs(scope, opts);
		const token = await getToken();
		if (!token) {
			return {
				ok: false,
				error:
					"Couldn't access Google Drive. Please approve Drive access and try again.",
			};
		}

		const drive = new DriveService();
		const parent =
			DIAGNOSTICS_FOLDER_ID ||
			(await resolveFolder(drive, token, DIAGNOSTICS_FOLDER_NAME));
		const logsFolder = await resolveFolder(
			drive,
			token,
			DIAGNOSTICS_LOGS_SUBFOLDER,
			parent,
		);
		const userFolder = await resolveFolder(
			drive,
			token,
			opts?.userEmail || "unknown",
			logsFolder,
		);

		const content = `${collected.header}\n${collected.body}`;
		const result = await drive.uploadTextFile({
			name: collected.fileName,
			content,
			folderId: userFolder,
			accessToken: token,
		});

		logger.info("Diagnostics", "Uploaded diagnostics to Drive", {
			fileName: result.name,
			entryCount: collected.entryCount,
		});
		return {
			ok: true,
			fileName: result.name,
			link: result.webViewLink,
			entryCount: collected.entryCount,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error("Diagnostics", "Upload failed", { error });
		const friendly = message.includes("403")
			? "Google Drive permission was denied. Tap Upload again and approve Drive access."
			: `Upload failed: ${message}`;
		return { ok: false, error: friendly };
	}
}

export function uploadDiagnostics(
	scope: LogScope,
	getToken: GetToken,
	opts?: { userEmail?: string },
): Promise<UploadResult> {
	if (inFlight) return inFlight;
	inFlight = run(scope, getToken, opts).finally(() => {
		inFlight = null;
	});
	return inFlight;
}
