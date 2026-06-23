/** Small helpers for normalizing thrown values into displayable messages. */

/** Extract a message from an unknown thrown value, stringifying non-Errors. */
export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
