/**
 * Centralized constants for the dhalsim browser automation CLI.
 */

// Text truncation limits
export const ELEMENT_TEXT_MAX_LENGTH = 100;
export const ERROR_PREVIEW_LENGTH = 57;
export const RESULT_PREVIEW_LENGTH = 97;
export const TOOL_NAME_MAX_LENGTH = 27;

// Timeouts (in milliseconds)
export const DEFAULT_CLICK_TIMEOUT = 5000;
export const DEFAULT_NAVIGATION_TIMEOUT = 30000;
export const OVERLAY_DISMISS_DELAY = 300;
export const UI_SETTLE_DELAY = 150; // Allow dropdowns/animations to render after click

// Button scoring algorithm weights for overlay dismissal heuristics
export const BUTTON_SCORING = {
	saturationWeight: 5,
	brightnessThreshold: 100,
	positionWeight: 2,
	indexDecay: 0.5,
	areaDivisor: 5000,
} as const;

// Input limits to prevent DoS
export const MAX_SELECTORS_PER_QUERY = 50;
export const MAX_INPUTS_TO_SCAN = 100;
