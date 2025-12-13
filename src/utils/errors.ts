/**
 * Utility functions for error handling and text processing.
 */

/**
 * Extracts a string message from an unknown error type.
 * Safely handles both Error objects and other thrown values.
 */
export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Truncates text to a maximum length, adding ellipsis if truncated.
 */
export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength)}...`;
}
