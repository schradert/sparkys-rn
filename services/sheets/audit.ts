import { logger } from "@/services/logger";
import type { SheetsClient } from "./client";
import type { AuditEvent } from "./types";

/** Append an audit row to the `events` sheet, swallowing any failure. */
export async function logEvent(
	client: SheetsClient,
	event: Omit<AuditEvent, "id" | "user_email">,
	accessToken: string,
): Promise<void> {
	try {
		const [nextId, userEmail] = await Promise.all([
			client.getNextId("events", accessToken),
			client.getUserEmail(accessToken),
		]);

		const newRow = [
			nextId.toString(),
			event.timestamp,
			event.event_type,
			event.object_type,
			event.object_id,
			event.object_name,
			event.changes,
			event.before_state || "",
			event.sheet_name,
			userEmail,
		];

		await client.appendToSheet("events", [newRow], accessToken);
		logger.debug(
			"Sheets",
			`Logged audit event: ${event.event_type} ${event.object_type} ${event.object_name} by ${userEmail}`,
		);
	} catch (error) {
		logger.error("Sheets", "Failed to log audit event:", error);
	}
}

/** Read audit events, most-recent first, with pagination. */
export async function getAuditEvents(
	client: SheetsClient,
	accessToken: string,
	limit: number = 50,
	offset: number = 0,
): Promise<AuditEvent[]> {
	try {
		const values = await client.getSheetData("events", accessToken);

		if (values.length <= 1) return [];

		const events: AuditEvent[] = [];
		for (let i = 1; i < values.length; i++) {
			const row = values[i];
			if (row.length >= 10) {
				events.push({
					id: parseInt(row[0] || "0", 10),
					timestamp: row[1] || "",
					event_type: row[2] as AuditEvent["event_type"],
					object_type: row[3] as AuditEvent["object_type"],
					object_id: row[4] || "",
					object_name: row[5] || "",
					changes: row[6] || "",
					before_state: row[7] || "",
					sheet_name: row[8] || "",
					user_email: row[9] || "unknown",
				});
			}
		}

		// Sort by ID descending (most recent first)
		events.sort((a, b) => b.id - a.id);

		// Apply pagination
		return events.slice(offset, offset + limit);
	} catch (error) {
		logger.error("Sheets", "Failed to fetch audit events:", error);
		return [];
	}
}
