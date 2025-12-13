/**
 * Utility functions for element existence checking.
 */

import type { Locator } from "playwright-core";

/**
 * Checks if an element exists and returns an error JSON string if not found.
 * Returns null if the element exists.
 */
export async function checkElementExists(
	locator: Locator,
	selector: string,
): Promise<string | null> {
	const count = await locator.count();
	if (count === 0) {
		return JSON.stringify({ error: `Element not found: ${selector}` });
	}
	return null;
}

/**
 * Checks if an element exists and is visible.
 * Returns an error JSON string if not found or not visible.
 * Returns null if the element exists and is visible.
 */
export async function checkElementVisible(
	locator: Locator,
	selector: string,
): Promise<string | null> {
	const count = await locator.count();
	if (count === 0) {
		return JSON.stringify({ error: `Element not found: ${selector}` });
	}

	const isVisible = await locator.first().isVisible();
	if (!isVisible) {
		return JSON.stringify({ error: `Element not visible: ${selector}` });
	}

	return null;
}
