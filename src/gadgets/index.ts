// Content extraction
export { GetFullPageContent, Screenshot } from "./content";
// Interactions
export {
	Check,
	Click,
	DismissOverlays,
	Fill,
	FillForm,
	FillPinCode,
	Hover,
	PressKey,
	Scroll,
	Select,
	Type,
	dismissOverlaysOnPage,
} from "./interaction";
// Navigation
export { GoBack, GoForward, Navigate, Reload } from "./navigation";
// Page management
export { ClosePage, ListPages, NewPage } from "./page";

// JavaScript execution
export { ExecuteScript } from "./script";

// Waiting
export { Wait, WaitForElement, WaitForNavigation } from "./wait";

// User input
export { RequestUserAssistance } from "./user-input";
