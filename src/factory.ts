import type { BaseGadget } from "llmist";
import type { IBrowserSessionManager } from "./session/types";
import { getSessionManager } from "./session";

// Content gadgets
import { GetFullPageContent, Screenshot } from "./gadgets/content";
// Interaction gadgets
import { Click } from "./gadgets/click";
import { Type, Fill, FillForm, FillPinCode } from "./gadgets/form";
import { PressKey } from "./gadgets/keyboard";
import { Select, Check } from "./gadgets/selection";
import { Hover, Scroll } from "./gadgets/scroll";
import { DismissOverlays } from "./gadgets/overlays";
// Navigation gadgets
import { GoBack, GoForward, Navigate, Reload } from "./gadgets/navigation";
// Page management gadgets
import { ClosePage, ListPages, NewPage } from "./gadgets/page";
// Script gadgets
import { ExecuteScript } from "./gadgets/script";
// User input gadgets
import { RequestUserAssistance } from "./gadgets/user-input";
// Wait gadgets
import { Wait, WaitForElement } from "./gadgets/wait";

/**
 * Configuration for creating webasto gadgets.
 */
export interface WebastoConfig {
	/**
	 * Browser session manager to use. If not provided, uses the default singleton.
	 */
	sessionManager?: IBrowserSessionManager;
}

/**
 * All webasto gadgets as a record keyed by name.
 */
export interface WebastoGadgets {
	// Content
	GetFullPageContent: GetFullPageContent;
	Screenshot: Screenshot;
	// Interaction
	Check: Check;
	Click: Click;
	DismissOverlays: DismissOverlays;
	Fill: Fill;
	FillForm: FillForm;
	FillPinCode: FillPinCode;
	Hover: Hover;
	PressKey: PressKey;
	Scroll: Scroll;
	Select: Select;
	Type: Type;
	// Navigation
	GoBack: GoBack;
	GoForward: GoForward;
	Navigate: Navigate;
	Reload: Reload;
	// Page
	ClosePage: ClosePage;
	ListPages: ListPages;
	NewPage: NewPage;
	// Script
	ExecuteScript: ExecuteScript;
	// User input
	RequestUserAssistance: RequestUserAssistance;
	// Wait
	Wait: Wait;
	WaitForElement: WaitForElement;
}

/**
 * Create all webasto gadgets with dependency injection.
 *
 * @param config - Optional configuration (sessionManager)
 * @returns Record of all gadgets keyed by name
 *
 * @example
 * ```typescript
 * // Use default session manager (CLI usage)
 * const gadgets = createWebastoGadgets();
 *
 * // Use custom session manager (library usage)
 * const gadgets = createWebastoGadgets({
 *   sessionManager: myCustomSessionManager,
 * });
 *
 * // Access individual gadgets
 * registry.register('Navigate', gadgets.Navigate);
 * ```
 */
export function createWebastoGadgets(config?: WebastoConfig): WebastoGadgets {
	const manager = config?.sessionManager ?? getSessionManager();

	return {
		// Content
		GetFullPageContent: new GetFullPageContent(manager),
		Screenshot: new Screenshot(manager),
		// Interaction
		Check: new Check(manager),
		Click: new Click(manager),
		DismissOverlays: new DismissOverlays(manager),
		Fill: new Fill(manager),
		FillForm: new FillForm(manager),
		FillPinCode: new FillPinCode(manager),
		Hover: new Hover(manager),
		PressKey: new PressKey(manager),
		Scroll: new Scroll(manager),
		Select: new Select(manager),
		Type: new Type(manager),
		// Navigation
		GoBack: new GoBack(manager),
		GoForward: new GoForward(manager),
		Navigate: new Navigate(manager),
		Reload: new Reload(manager),
		// Page
		ClosePage: new ClosePage(manager),
		ListPages: new ListPages(manager),
		NewPage: new NewPage(manager),
		// Script
		ExecuteScript: new ExecuteScript(manager),
		// User input
		RequestUserAssistance: new RequestUserAssistance(manager),
		// Wait
		Wait: new Wait(manager),
		WaitForElement: new WaitForElement(manager),
	};
}

/**
 * Preset names for common gadget combinations.
 */
export type WebastoPreset = "all" | "subagent" | "readonly" | "minimal";

/**
 * Get gadgets by preset name.
 *
 * @param preset - Preset name
 * @param config - Optional configuration
 * @returns Array of gadgets for the preset
 *
 * @example
 * ```typescript
 * // Get all gadgets as array
 * const allGadgets = createGadgetsByPreset('all');
 *
 * // Get read-only gadgets (Navigate, Screenshot, GetFullPageContent, ListPages)
 * const readonlyGadgets = createGadgetsByPreset('readonly');
 *
 * // Get minimal gadgets (Navigate, Screenshot, GetFullPageContent)
 * const minimalGadgets = createGadgetsByPreset('minimal');
 * ```
 */
export function createGadgetsByPreset(
	preset: WebastoPreset,
	config?: WebastoConfig,
): BaseGadget[] {
	const gadgets = createWebastoGadgets(config);

	switch (preset) {
		case "all":
			return Object.values(gadgets);

		case "subagent":
			// Returns an empty array - the BrowseWeb subagent should be imported separately
			// This preset is used by the manifest to indicate subagent-only usage
			return [];

		case "readonly":
			return [
				gadgets.Navigate,
				gadgets.Screenshot,
				gadgets.GetFullPageContent,
				gadgets.ListPages,
			];

		case "minimal":
			return [
				gadgets.Navigate,
				gadgets.Screenshot,
				gadgets.GetFullPageContent,
			];

		default:
			throw new Error(`Unknown preset: ${preset}`);
	}
}

/**
 * Get gadgets by name(s).
 *
 * @param names - Array of gadget names to include
 * @param config - Optional configuration
 * @returns Array of matching gadgets
 *
 * @example
 * ```typescript
 * const gadgets = createGadgetsByName(['Navigate', 'Click', 'Screenshot']);
 * ```
 */
export function createGadgetsByName(
	names: string[],
	config?: WebastoConfig,
): BaseGadget[] {
	const allGadgets = createWebastoGadgets(config);
	const result: BaseGadget[] = [];

	for (const name of names) {
		const gadget = allGadgets[name as keyof WebastoGadgets];
		if (gadget) {
			result.push(gadget);
		} else {
			throw new Error(`Unknown gadget: ${name}`);
		}
	}

	return result;
}
