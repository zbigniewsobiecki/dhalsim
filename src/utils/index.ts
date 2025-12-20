/**
 * Utility exports for dhalsim browser automation CLI.
 */

// Re-export from llmist for backwards compatibility
export { getErrorMessage, truncate, humanDelay, randomDelay } from "llmist";
export {
	ELEMENT_TEXT_MAX_LENGTH,
	ERROR_PREVIEW_LENGTH,
	RESULT_PREVIEW_LENGTH,
	TOOL_NAME_MAX_LENGTH,
	DEFAULT_CLICK_TIMEOUT,
	DEFAULT_NAVIGATION_TIMEOUT,
	OVERLAY_DISMISS_DELAY,
	BUTTON_SCORING,
	MAX_SELECTORS_PER_QUERY,
	MAX_INPUTS_TO_SCAN,
} from "./constants.js";
export { checkElementExists, checkElementVisible } from "./element-checks.js";
