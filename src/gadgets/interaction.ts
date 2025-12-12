import { Gadget, z } from "llmist";
import type { BrowserSessionManager } from "../session";
import { humanDelay, randomDelay } from "../stealth";

// Language-agnostic CMP accept button selectors (from CHI 2025 research paper)
// These work regardless of language because they target CMP-specific class/id patterns
const CMP_ACCEPT_SELECTORS = [
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
];

export class DismissOverlays extends Gadget({
	description:
		"Dismisses cookie banners, popups, and overlay dialogs that block interaction. Use this when clicks fail due to overlays intercepting them.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
	}),
	examples: [
		{
			params: { pageId: "p1" },
			output: '{"dismissed":1,"success":true}',
			comment: "Dismissed a cookie banner",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			let dismissed = 0;

			// Step 1: Try CMP-specific selectors (most reliable, language-agnostic)
			for (const selector of CMP_ACCEPT_SELECTORS) {
				try {
					const btn = await page.$(selector);
					if (btn && (await btn.isVisible())) {
						await btn.click({ force: true });
						dismissed++;
						await page.waitForTimeout(300);
						break; // Stop after first successful click
					}
				} catch {
					// Selector not found or click failed, continue
				}
			}

			// Step 2: If no CMP selector worked, use heuristic to find primary button in overlay
			if (dismissed === 0) {
				const clickedButton = await page.evaluate(() => {
					// Find overlay containers by z-index + fixed position + consent-related class/id
					const consentPattern = /cookie|consent|gdpr|privacy|cmp|banner|notice/i;
					const overlayContainers: HTMLElement[] = [];

					document.querySelectorAll("*").forEach((el) => {
						const htmlEl = el as HTMLElement;
						const style = getComputedStyle(htmlEl);
						const zIndex = Number.parseInt(style.zIndex, 10) || 0;
						const isPositioned = style.position === "fixed" || style.position === "absolute";
						const classId = ((htmlEl.className || "") + " " + (htmlEl.id || "")).toLowerCase();
						const hasConsentPattern = consentPattern.test(classId);

						if (isPositioned && zIndex > 10 && hasConsentPattern && htmlEl.offsetWidth > 0) {
							overlayContainers.push(htmlEl);
						}
					});

					// For each container, find the most prominent button (usually "accept")
					for (const container of overlayContainers) {
						const buttons = container.querySelectorAll('button, [role="button"], a.btn, a[class*="btn"]');
						if (buttons.length === 0) continue;

						// Score buttons by visual prominence
						let bestButton: HTMLElement | null = null;
						let bestScore = -1;

						buttons.forEach((btn) => {
							const htmlBtn = btn as HTMLElement;
							if (!htmlBtn.offsetWidth) return; // Not visible

							const style = getComputedStyle(htmlBtn);
							const bgColor = style.backgroundColor;
							let score = 0;

							// Colored background = higher score (accept buttons are usually colored)
							if (bgColor && bgColor !== "transparent" && bgColor !== "rgba(0, 0, 0, 0)") {
								// Check if it's a saturated color (not gray)
								const rgbMatch = bgColor.match(/\d+/g);
								if (rgbMatch) {
									const [r, g, b] = rgbMatch.map(Number);
									const max = Math.max(r, g, b);
									const min = Math.min(r, g, b);
									const saturation = max === 0 ? 0 : (max - min) / max;
									score += saturation * 5;
									// Bright backgrounds score higher
									if (max > 100) score += 2;
								}
							}

							// Larger buttons score higher
							const area = htmlBtn.offsetWidth * htmlBtn.offsetHeight;
							score += Math.min(area / 5000, 3);

							// First button in DOM often is "accept"
							const index = Array.from(buttons).indexOf(btn);
							score += Math.max(0, 2 - index * 0.5);

							if (score > bestScore) {
								bestScore = score;
								bestButton = htmlBtn;
							}
						});

						// Click the best button
						if (bestButton !== null && bestScore > 0) {
							(bestButton as HTMLElement).click();
							return true;
						}
					}
					return false;
				});

				if (clickedButton) {
					dismissed++;
					await page.waitForTimeout(300);
				}
			}

			// Step 3: Last resort - remove fixed position overlays from DOM
			await page.evaluate(() => {
				const consentPattern = /cookie|consent|gdpr|privacy|cmp|banner|notice/i;
				const overlaySelectors = [
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
				];

				for (const selector of overlaySelectors) {
					document.querySelectorAll(selector).forEach((el) => {
						const htmlEl = el as HTMLElement;
						const style = getComputedStyle(htmlEl);
						if (style.position === "fixed" || style.position === "absolute") {
							const zIndex = Number.parseInt(style.zIndex, 10);
							if (zIndex > 100 || style.zIndex === "auto") {
								htmlEl.style.display = "none";
							}
						}
					});
				}
			});

			return JSON.stringify({ dismissed, success: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
		}
	}
}

export class Click extends Gadget({
	description:
		"Clicks on an element. Use ListInteractiveElements to find the selector for the element you want to click. If click fails due to another element covering it, try force: true.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		selector: z.string().describe("CSS selector of element to click"),
		button: z.enum(["left", "right", "middle"]).default("left").describe("Mouse button"),
		clickCount: z
			.number()
			.min(1)
			.max(3)
			.default(1)
			.describe("Number of clicks (2 for double-click)"),
		force: z
			.boolean()
			.default(false)
			.describe("Force click even if element is covered by another (bypasses actionability checks)"),
	}),
	examples: [
		{
			params: { pageId: "p1", selector: "#login-btn", button: "left", clickCount: 1, force: false },
			output: '{"success":true,"elementText":"Login"}',
			comment: "Click the login button",
		},
		{
			params: { pageId: "p1", selector: "#menu-item", button: "left", clickCount: 1, force: true },
			output: '{"success":true,"elementText":"Menu Item"}',
			comment: "Force click when element is partially covered",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			const element = await page.$(params.selector);

			if (!element) {
				return JSON.stringify({ error: `Element not found: ${params.selector}` });
			}

			const text = ((await element.textContent()) || "").trim().slice(0, 100);

			// Human-like: small delay before clicking (simulates reaction time)
			await humanDelay(30, 80);

			// If force not requested, try with short timeout first, then auto-retry with force on interception
			if (!params.force) {
				try {
					await element.click({
						button: params.button,
						clickCount: params.clickCount,
						timeout: 5000, // Short timeout - fail fast if intercepted
					});
					return JSON.stringify({ success: true, elementText: text });
				} catch (firstError) {
					const msg = firstError instanceof Error ? firstError.message : String(firstError);
					// If intercepted by another element, auto-retry with force
					if (msg.includes("intercepts pointer events")) {
						await element.click({
							button: params.button,
							clickCount: params.clickCount,
							force: true,
						});
						return JSON.stringify({ success: true, elementText: text, forcedClick: true });
					}
					throw firstError;
				}
			}

			// Force was explicitly requested
			await element.click({
				button: params.button,
				clickCount: params.clickCount,
				force: true,
			});

			return JSON.stringify({ success: true, elementText: text });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
		}
	}
}

export class Type extends Gadget({
	description:
		"Types text into an input element character by character with human-like timing. Use Fill for faster input that clears the field first.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		selector: z.string().describe("CSS selector of input element"),
		text: z.string().describe("Text to type"),
		delay: z
			.number()
			.default(50)
			.describe("Base delay between keystrokes in ms (actual delay varies ±30% for human-like effect)"),
	}),
	examples: [
		{
			params: { pageId: "p1", selector: "#email", text: "user@example.com", delay: 50 },
			output: '{"success":true}',
			comment: "Type email address with human-like timing",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			const element = await page.$(params.selector);

			if (!element) {
				return JSON.stringify({ error: `Element not found: ${params.selector}` });
			}

			// Human-like: click to focus with small delay
			// Use force: true to bypass overlay interception (common with MUI placeholder text)
			await humanDelay(20, 60);
			await element.click({ force: true });
			await humanDelay(30, 80);

			// Type with variable delays (±30% of base delay)
			const baseDelay = params.delay;
			for (const char of params.text) {
				const variedDelay = baseDelay > 0 ? randomDelay(baseDelay * 0.7, baseDelay * 1.3) : 0;
				await page.keyboard.type(char, { delay: variedDelay });
			}

			return JSON.stringify({ success: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
		}
	}
}

export class Fill extends Gadget({
	description:
		"Fills an input field with text, clearing any existing value first. Faster than Type but less human-like.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		selector: z.string().describe("CSS selector of input element"),
		value: z.string().describe("Value to fill"),
	}),
	examples: [
		{
			params: { pageId: "p1", selector: "#search", value: "search query" },
			output: '{"success":true}',
			comment: "Fill search field",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			const element = await page.$(params.selector);

			if (!element) {
				return JSON.stringify({ error: `Element not found: ${params.selector}` });
			}

			// Human-like: small delay before filling
			await humanDelay(30, 80);
			await element.fill(params.value);

			return JSON.stringify({ success: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
		}
	}
}

export class PressKey extends Gadget({
	description:
		"Presses a keyboard key. Supports special keys like Enter, Tab, Escape, ArrowUp, ArrowDown, etc.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		key: z
			.string()
			.describe("Key to press (e.g., Enter, Tab, Escape, ArrowUp, ArrowDown, Backspace, Delete)"),
	}),
	examples: [
		{
			params: { pageId: "p1", key: "Enter" },
			output: '{"success":true}',
			comment: "Press Enter key",
		},
		{
			params: { pageId: "p1", key: "Tab" },
			output: '{"success":true}',
			comment: "Press Tab to move focus",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			await page.keyboard.press(params.key);

			return JSON.stringify({ success: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
		}
	}
}

export class Select extends Gadget({
	description: "Selects an option in a dropdown (select element). Provide value, label, or index.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		selector: z.string().describe("CSS selector of select element"),
		value: z.string().optional().describe("Option value attribute"),
		label: z.string().optional().describe("Option visible text"),
		index: z.number().optional().describe("Option index (0-based)"),
	}),
	examples: [
		{
			params: { pageId: "p1", selector: "#country", value: "us" },
			output: '{"success":true,"selectedValue":"us","selectedText":"United States"}',
			comment: "Select by value",
		},
		{
			params: { pageId: "p1", selector: "#country", label: "Canada" },
			output: '{"success":true,"selectedValue":"ca","selectedText":"Canada"}',
			comment: "Select by visible text",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			const element = await page.$(params.selector);

			if (!element) {
				return JSON.stringify({ error: `Element not found: ${params.selector}` });
			}

			let selected: string[];
			if (params.value !== undefined) {
				selected = await element.selectOption({ value: params.value });
			} else if (params.label !== undefined) {
				selected = await element.selectOption({ label: params.label });
			} else if (params.index !== undefined) {
				selected = await element.selectOption({ index: params.index });
			} else {
				return JSON.stringify({ error: "Must provide value, label, or index" });
			}

			// Get selected text
			const selectedOption = await page.$(`${params.selector} option:checked`);
			const selectedText = selectedOption ? await selectedOption.textContent() : "";

			return JSON.stringify({
				success: true,
				selectedValue: selected[0],
				selectedText: (selectedText || "").trim(),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
		}
	}
}

export class Check extends Gadget({
	description: "Checks or unchecks a checkbox or radio button.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		selector: z.string().describe("CSS selector of checkbox/radio"),
		checked: z.boolean().default(true).describe("Whether to check (true) or uncheck (false)"),
	}),
	examples: [
		{
			params: { pageId: "p1", selector: "#remember-me", checked: true },
			output: '{"success":true,"checked":true}',
			comment: "Check the checkbox",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			const element = await page.$(params.selector);

			if (!element) {
				return JSON.stringify({ error: `Element not found: ${params.selector}` });
			}

			if (params.checked) {
				await element.check();
			} else {
				await element.uncheck();
			}

			const isChecked = await element.isChecked();

			return JSON.stringify({ success: true, checked: isChecked });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
		}
	}
}

export class Hover extends Gadget({
	description: "Hovers over an element. Useful for revealing hidden menus or tooltips.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		selector: z.string().describe("CSS selector of element to hover"),
	}),
	examples: [
		{
			params: { pageId: "p1", selector: "#dropdown-menu" },
			output: '{"success":true}',
			comment: "Hover to reveal dropdown",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			const element = await page.$(params.selector);

			if (!element) {
				return JSON.stringify({ error: `Element not found: ${params.selector}` });
			}

			await element.hover();

			return JSON.stringify({ success: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
		}
	}
}

export class Scroll extends Gadget({
	description: "Scrolls the page or a specific element.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		direction: z.enum(["up", "down", "left", "right"]).default("down").describe("Scroll direction"),
		amount: z.number().default(500).describe("Scroll amount in pixels"),
		selector: z.string().optional().describe("Scroll within a specific element (default: page)"),
	}),
	examples: [
		{
			params: { pageId: "p1", direction: "down", amount: 500 },
			output: '{"success":true,"scrollX":0,"scrollY":500}',
			comment: "Scroll down 500px",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);

			const deltaX =
				params.direction === "left"
					? -params.amount
					: params.direction === "right"
						? params.amount
						: 0;
			const deltaY =
				params.direction === "up"
					? -params.amount
					: params.direction === "down"
						? params.amount
						: 0;

			if (params.selector) {
				const element = await page.$(params.selector);
				if (!element) {
					return JSON.stringify({ error: `Element not found: ${params.selector}` });
				}
				await element.evaluate(
					(el, delta) => {
						el.scrollBy(delta.x, delta.y);
					},
					{ x: deltaX, y: deltaY },
				);
			} else {
				await page.evaluate(
					(delta) => {
						window.scrollBy(delta.x, delta.y);
					},
					{ x: deltaX, y: deltaY },
				);
			}

			// Get current scroll position
			const scrollPos = await page.evaluate(() => ({
				scrollX: window.scrollX,
				scrollY: window.scrollY,
			}));

			return JSON.stringify({
				success: true,
				scrollX: scrollPos.scrollX,
				scrollY: scrollPos.scrollY,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
		}
	}
}
