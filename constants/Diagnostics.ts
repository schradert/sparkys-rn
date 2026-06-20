/**
 * Configuration for uploading diagnostics logs to Google Drive.
 *
 * ONE-TIME SETUP (developer):
 *   1. In Google Drive, create a folder (e.g. "Sparky's Diagnostics").
 *   2. Share it with the trusted app users as **Editor** so everyone can read
 *      and write logs there (intentional — for shared traceability).
 *   3. Open the folder and copy the id from its URL:
 *        https://drive.google.com/drive/folders/<THIS_IS_THE_ID>
 *   4. Paste that id into `DIAGNOSTICS_FOLDER_ID` below.
 *
 * Until an id is set, uploads fall back to creating a personal
 * "Sparky's Diagnostics" folder in the uploader's own Drive (still works, but
 * not shared with the team). Uploading requires the broad Drive scope so any
 * trusted user can write into this shared, app-unmanaged folder — see
 * `getDriveAccessToken` in `hooks/useAuth.tsx`.
 */

/** Shared Drive folder id for diagnostics. Empty = personal-folder fallback. */
export const DIAGNOSTICS_FOLDER_ID = "";

/** Name used when creating the folder (fallback) or a missing subfolder. */
export const DIAGNOSTICS_FOLDER_NAME = "Sparky's Diagnostics";

/** Subfolder under the diagnostics folder that holds the log files. */
export const DIAGNOSTICS_LOGS_SUBFOLDER = "Logs";
