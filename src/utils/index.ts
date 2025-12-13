/**
 * Utility exports for webasto browser automation CLI.
 */

export { getErrorMessage, truncate } from "./errors.js";
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
