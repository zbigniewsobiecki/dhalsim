// Package version
export const VERSION = "1.2.0";

// Session management
export { BrowserSessionManager, getSessionManager, TestBrowserSessionManager } from "./session";
export type { IBrowserSessionManager } from "./session";

// NOTE: Raw gadget classes are NOT exported to prevent broken instantiation
// when llmist loads the module. Use createDhalsimGadgets() for individual gadgets.

// Factory functions for dependency injection
export {
	createDhalsimGadgets,
	createGadgetsByPreset,
	createGadgetsByName,
	type DhalsimConfig,
	type DhalsimGadgets,
	type DhalsimPreset,
} from "./factory";

// Subagents (high-level gadgets with internal agent loops)
export {
	Dhalsim,
	DHALSIM_SYSTEM_PROMPT,
	DHALSIM_MINIMAL_PROMPT,
	createDhalsimSystemPrompt,
} from "./subagents";
export type {
	DhalsimOptions,
	DhalsimSessionManager,
	UserAssistanceParams,
	UserAssistanceCallback,
} from "./subagents";

// Export reason type for custom callback typing
export type { UserAssistanceReason } from "./gadgets/user-input";
export { USER_ASSISTANCE_REASONS } from "./gadgets/user-input";
