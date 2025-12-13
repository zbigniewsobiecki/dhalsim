// Session management
export { BrowserSessionManager, getSessionManager } from "./session";
export type { IBrowserSessionManager } from "./session";

// All gadgets
export * from "./gadgets";

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
export { Dhalsim, DHALSIM_SYSTEM_PROMPT, DHALSIM_MINIMAL_PROMPT } from "./subagents";
