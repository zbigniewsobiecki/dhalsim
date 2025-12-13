import { Gadget, z } from "llmist";
import type { IBrowserSessionManager } from "../session";
import { humanDelay } from "../stealth";
import { selectorSchema } from "./selector-validator";
import { getErrorMessage, truncate } from "../utils/errors";
import { checkElementExists } from "../utils/element-checks";
import { ELEMENT_TEXT_MAX_LENGTH, DEFAULT_CLICK_TIMEOUT } from "../utils/constants";

export class Click extends Gadget({
	description:
		"Clicks on an element. Use selectors from <CurrentBrowserState>. Auto-scrolls into view if needed. If click fails due to another element covering it, try force: true.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		selector: selectorSchema.describe("CSS selector of element to click"),
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
			.describe(
				"Force click even if element is covered by another (bypasses actionability checks)",
			),
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
		{
			params: {
				pageId: "p1",
				selector: "#offscreen-btn",
				button: "left",
				clickCount: 1,
				force: false,
			},
			output: '{"success":true,"elementText":"Offscreen","scrolledIntoView":true}',
			comment: "Element was scrolled into view before clicking",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			const locator = page.locator(params.selector);

			// Check if element exists
			const notFoundError = await checkElementExists(locator, params.selector);
			if (notFoundError) return notFoundError;

			const text = truncate(((await locator.textContent()) || "").trim(), ELEMENT_TEXT_MAX_LENGTH);
			let scrolledIntoView = false;

			// Check if element is in viewport, scroll if needed
			const isInViewport = await locator.evaluate((el) => {
				const rect = el.getBoundingClientRect();
				return (
					rect.top >= 0 &&
					rect.left >= 0 &&
					rect.bottom <= window.innerHeight &&
					rect.right <= window.innerWidth
				);
			});

			if (!isInViewport) {
				await locator.scrollIntoViewIfNeeded();
				scrolledIntoView = true;
			}

			// Human-like: small delay before clicking (simulates reaction time)
			await humanDelay(30, 80);

			// If force not requested, try with short timeout first, then auto-retry with force on interception
			if (!params.force) {
				try {
					await locator.click({
						button: params.button,
						clickCount: params.clickCount,
						timeout: DEFAULT_CLICK_TIMEOUT,
					});
					return JSON.stringify({
						success: true,
						elementText: text,
						...(scrolledIntoView ? { scrolledIntoView: true } : {}),
					});
				} catch (firstError) {
					const msg = getErrorMessage(firstError);
					// If intercepted by another element, auto-retry with force
					if (msg.includes("intercepts pointer events")) {
						await locator.click({
							button: params.button,
							clickCount: params.clickCount,
							force: true,
						});
						return JSON.stringify({
							success: true,
							elementText: text,
							forcedClick: true,
							...(scrolledIntoView ? { scrolledIntoView: true } : {}),
						});
					}
					throw firstError;
				}
			}

			// Force was explicitly requested
			await locator.click({
				button: params.button,
				clickCount: params.clickCount,
				force: true,
			});

			return JSON.stringify({
				success: true,
				elementText: text,
				...(scrolledIntoView ? { scrolledIntoView: true } : {}),
			});
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}
