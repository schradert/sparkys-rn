/** Shape of a Google Sheets `values.get` response for a single range. */
export interface SheetsResponse {
	range: string;
	majorDimension: string;
	values: string[][];
}

/** A fully-resolved audit log entry as exposed to the app. */
export interface AuditEvent {
	id: number;
	timestamp: string;
	event_type: "create" | "archive" | "unarchive" | "quantity_update" | "edit";
	object_type: "internal_product" | "external_product" | "metadata";
	object_id: string;
	object_name: string;
	changes: string; // JSON string - only actual changes
	before_state: string; // JSON string - old state of updated item
	sheet_name: string;
	user_email: string;
}

/** The raw, string-typed audit row layout in the `events` sheet. */
export interface AuditEventSheet {
	id: number;
	timestamp: string;
	event_type: string;
	object_type: string;
	object_id: string;
	object_name: string;
	changes: string;
	before_state: string;
	sheet_name: string;
	user_email: string;
}
