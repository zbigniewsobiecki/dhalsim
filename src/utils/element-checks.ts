/**
 * Utility functions for element existence checking.
 */

import type { Locator } from "playwright-core";
import { defaultLogger as logger } from "llmist";

/**
 * Builds a base selector from element attributes.
 * Returns the most specific selector possible based on available attributes.
 */
function buildBaseSelector(attrs: {
	tag: string;
	id: string;
	dataTestId: string | null;
	dataTest: string | null;
	name: string | null;
	type: string | null;
	text: string | undefined;
	ariaLabel: string | null;
}): string | null {
	// Priority order: most specific first
	if (attrs.dataTestId) return `[data-testid="${attrs.dataTestId}"]`;
	if (attrs.dataTest) return `[data-test="${attrs.dataTest}"]`;
	if (attrs.id) return `#${attrs.id}`;
	if (attrs.name) return `[name="${attrs.name}"]`;
	if (attrs.ariaLabel) return `${attrs.tag}[aria-label="${attrs.ariaLabel}"]`;
	if (attrs.text) {
		const escapedText = attrs.text.replace(/"/g, '\\"');
		if (attrs.type) {
			return `${attrs.tag}[type="${attrs.type}"]:has-text("${escapedText}")`;
		}
		return `${attrs.tag}:has-text("${escapedText}")`;
	}
	return null;
}

/**
 * Gathers distinguishing attributes from multiple matching elements
 * and generates valid Playwright selectors the agent can use directly.
 * Every suggestion includes `>> nth=N` to guarantee uniqueness.
 */
async function gatherDisambiguationHints(
	locator: Locator,
	count: number,
): Promise<{ hint: string; suggestions?: string[] }> {
	const suggestions: string[] = [];
	const limit = Math.min(count, 3);

	for (let i = 0; i < limit; i++) {
		try {
			const attrs = await locator.nth(i).evaluate((el) => ({
				tag: el.tagName.toLowerCase(),
				id: el.id,
				dataTestId: el.getAttribute("data-testid"),
				dataTest: el.getAttribute("data-test"),
				name: el.getAttribute("name"),
				type: el.getAttribute("type"),
				text: el.textContent?.trim().slice(0, 30),
				ariaLabel: el.getAttribute("aria-label"),
			}));

			const baseSelector = buildBaseSelector(attrs);
			if (baseSelector) {
				// Always append index to guarantee uniqueness
				suggestions.push(`${baseSelector} >> nth=${i}`);
			}
		} catch {
			logger.debug(`[gatherDisambiguationHints] Element detached at index ${i}`);
		}
	}

	return {
		hint:
			suggestions.length > 0
				? `Use one of these selectors: ${suggestions.join(", ")}`
				: "Try using :has-text() with the element's visible text",
		suggestions: suggestions.length > 0 ? suggestions : undefined,
	};
}

/**
 * Checks if an element exists and returns an error JSON string if not found or ambiguous.
 * Returns null if exactly one element matches.
 *
 * When multiple elements match, provides disambiguation hints to help select a specific element.
 */
export async function checkElementExists(
	locator: Locator,
	selector: string,
): Promise<string | null> {
	const count = await locator.count();

	if (count === 0) {
		return JSON.stringify({ error: `Element not found: ${selector}` });
	}

	if (count > 1) {
		const { hint, suggestions } = await gatherDisambiguationHints(locator, count);
		return JSON.stringify({
			error: `Selector "${selector}" matches ${count} elements. Use a more specific selector.`,
			count,
			hint,
			suggestions,
		});
	}

	return null;
}

/**
 * Checks if an element exists and is visible.
 * Returns an error JSON string if not found, ambiguous, or not visible.
 * Returns null if exactly one element matches and is visible.
 */
export async function checkElementVisible(
	locator: Locator,
	selector: string,
): Promise<string | null> {
	const count = await locator.count();

	if (count === 0) {
		return JSON.stringify({ error: `Element not found: ${selector}` });
	}

	if (count > 1) {
		const { hint, suggestions } = await gatherDisambiguationHints(locator, count);
		return JSON.stringify({
			error: `Selector "${selector}" matches ${count} elements. Use a more specific selector.`,
			count,
			hint,
			suggestions,
		});
	}

	const isVisible = await locator.first().isVisible();
	if (!isVisible) {
		return JSON.stringify({ error: `Element not visible: ${selector}` });
	}

	return null;
}
