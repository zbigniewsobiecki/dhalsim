/**
 * Language-agnostic CMP accept button selectors (from CHI 2025 research paper).
 * These work regardless of language because they target CMP-specific class/id patterns.
 */
export const CMP_ACCEPT_SELECTORS = [
	// consentmanager.net
	"#cmpwelcomebtnyes",
	".cmpboxbtnyes",
	'[class*="cmpbox"] .cmpboxbtnyes',
	'[class*="cmpbox"] button:first-of-type',

	// Usercentrics/Cookiebot
	"#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
	"#CybotCookiebotDialogBodyButtonAccept",
	'[data-testid="uc-accept-all-button"]',
	".uc-accept-all-btn",
	'button[class*="usercentrics"][class*="accept"]',

	// OneTrust
	"#onetrust-accept-btn-handler",
	".onetrust-accept-btn-handler",
	'button[class*="onetrust"][class*="accept"]',

	// CookieYes
	'[data-cky-tag="accept-button"]',
	".cky-btn-accept",
	'button[class*="cky"][class*="accept"]',

	// Osano
	".osano-cm-accept-all",
	".cc-accept",
	".cc-btn.cc-allow",

	// Cookie Information
	'[class*="coi-"] button[class*="accept"]',
	".coi-banner__accept",

	// Didomi
	"#didomi-notice-agree-button",
	'[class*="didomi"] button[class*="agree"]',

	// iubenda
	".iubenda-cs-accept-btn",
	'[class*="iubenda"] button[class*="accept"]',

	// tarteaucitron
	"#tarteaucitronAllAllowed",
	".tarteaucitronAllow",

	// Complianz
	".cmplz-accept",
	'button[class*="cmplz"][class*="accept"]',

	// InMobi/Quantcast
	".qc-cmp2-summary-buttons button:first-child",
	'[class*="qc-cmp"] button[class*="accept"]',

	// Cookie-Script
	"#cookiescript_accept",
	".cookiescript_accept",

	// TermsFeed
	".cc_btn.cc_btn_accept_all",
	'[class*="termsfeed"] button[class*="accept"]',

	// Moove
	".moove-gdpr-infobar-allow-all",
	'[class*="moove-gdpr"] button[class*="allow"]',

	// Borlabs
	'[class*="borlabs"] button[class*="accept"]',
	".BorlabsCookie .accept",

	// CIVIC
	".ccc-accept-button",

	// Generic patterns (language-agnostic CSS selectors)
	'[class*="consent"][class*="accept"]',
	'[id*="consent"][id*="accept"]',
	'[class*="cookie"][class*="accept"]',
	'[id*="cookie"][id*="accept"]',
	'[class*="gdpr"][class*="accept"]',
	'[id*="gdpr"][id*="accept"]',
	'[class*="privacy"][class*="accept"]',
	'[data-testid*="accept"]',
	'[data-action*="accept"]',

	// Close buttons on modals (fallback)
	'[class*="modal"] button[class*="close"]',
	'[class*="overlay"] button[class*="close"]',
	'[aria-label="Close"]',
	'button[aria-label="Dismiss"]',
] as const;

/**
 * Overlay selectors for last resort DOM hiding.
 */
export const OVERLAY_SELECTORS = [
	'[id*="cookie"]',
	'[class*="cookie"]',
	'[id*="consent"]',
	'[class*="consent"]',
	'[id*="cmp"]',
	'[class*="cmp"]',
	'[class*="gdpr"]',
	'[class*="privacy"]',
	'[class*="overlay"]',
	'[class*="modal"]',
	'[class*="popup"]',
	'[class*="banner"]',
] as const;
