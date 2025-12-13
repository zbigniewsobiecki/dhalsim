import { z } from "zod";

/**
 * Patterns that indicate selector construction (forbidden).
 * These are CSS patterns that agents use to "construct" selectors
 * instead of using them exactly as provided in CurrentBrowserState.
 */
const FORBIDDEN_PATTERNS: { pattern: RegExp; description: string }[] = [
	// Positional pseudo-selectors
	{
		pattern: /:nth-child\(/i,
		description: ":nth-child() positional selector",
	},
	{
		pattern: /:nth-of-type\(/i,
		description: ":nth-of-type() positional selector",
	},
	{ pattern: /:first-child(?![a-zA-Z-])/i, description: ":first-child selector" },
	{ pattern: /:last-child(?![a-zA-Z-])/i, description: ":last-child selector" },
	{
		pattern: /:first-of-type(?![a-zA-Z-])/i,
		description: ":first-of-type selector",
	},
	{
		pattern: /:last-of-type(?![a-zA-Z-])/i,
		description: ":last-of-type selector",
	},

	// Wildcard attribute selectors
	{
		pattern: /\[[\w-]+\*=/,
		description: "[attr*=...] wildcard attribute selector",
	},
	{
		pattern: /\[[\w-]+\^=/,
		description: "[attr^=...] prefix attribute selector",
	},
	{
		pattern: /\[[\w-]+\$=/,
		description: "[attr$=...] suffix attribute selector",
	},
];

export interface ValidationResult {
	valid: boolean;
	reason?: string;
}

/**
 * Validates a CSS selector to ensure it's not constructed.
 * Returns { valid: true } for allowed selectors, or { valid: false, reason: string } for forbidden ones.
 */
export function validateSelector(selector: string): ValidationResult {
	for (const { pattern, description } of FORBIDDEN_PATTERNS) {
		if (pattern.test(selector)) {
			return {
				valid: false,
				reason:
					`Selector "${selector}" appears to be constructed (${description}). ` +
					`Use ONLY selectors exactly as shown in <CurrentBrowserState>. ` +
					`Copy/paste selectors verbatim - do not modify or combine them.`,
			};
		}
	}
	return { valid: true };
}

/**
 * Validates an array of selectors.
 * Returns the first validation error found, or { valid: true } if all pass.
 */
export function validateSelectors(selectors: string[]): ValidationResult {
	for (const selector of selectors) {
		const result = validateSelector(selector);
		if (!result.valid) {
			return result;
		}
	}
	return { valid: true };
}

/**
 * Zod schema for a single selector string.
 * Allows all selectors (including :nth-child, wildcards, etc.)
 * Use validateSelector() separately for diagnostics if needed.
 */
export const selectorSchema = z.string();

/**
 * Zod schema for an optional selector string.
 */
export const optionalSelectorSchema = z.string().optional();

/**
 * Zod schema for an array of selectors.
 */
export const selectorsArraySchema = z.array(z.string()).optional();
