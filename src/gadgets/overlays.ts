import { Gadget, z, defaultLogger as logger, getErrorMessage } from "llmist";
import type { Page } from "playwright-core";
import type { IBrowserSessionManager } from "../session";
import { CMP_ACCEPT_SELECTORS, OVERLAY_SELECTORS } from "../config/cmp-selectors";
import { OVERLAY_DISMISS_DELAY, BUTTON_SCORING } from "../utils/constants";

/**
 * Utility function to dismiss cookie banners and overlays on a page.
 * Exported for use by StartBrowser's autoDismissOverlays option.
 */
export async function dismissOverlaysOnPage(page: Page): Promise<number> {
	logger.debug(`[DismissOverlays] Starting overlay dismissal`);
	let dismissed = 0;

	// Step 1: Try CMP-specific selectors (most reliable, language-agnostic)
	for (const selector of CMP_ACCEPT_SELECTORS) {
		try {
			const btn = await page.$(selector);
			if (btn && (await btn.isVisible())) {
				logger.debug(`[DismissOverlays] Found CMP selector: ${selector}`);
				await btn.click({ force: true });
				dismissed++;
				await page.waitForTimeout(OVERLAY_DISMISS_DELAY);
				break; // Stop after first successful click
			}
		} catch {
			// Selector not found or click failed, continue
		}
	}

	// Step 2: If no CMP selector worked, use heuristic to find primary button in overlay
	if (dismissed === 0) {
		logger.debug(`[DismissOverlays] No CMP selector matched, trying heuristic`);

		const clickedButton = await page.evaluate(
			(scoring) => {
				// Find overlay containers by z-index + fixed position + consent-related class/id
				const consentPattern = /cookie|consent|gdpr|privacy|cmp|banner|notice/i;
				const overlayContainers: HTMLElement[] = [];

				document.querySelectorAll("*").forEach((el) => {
					const htmlEl = el as HTMLElement;
					const style = getComputedStyle(htmlEl);
					const zIndex = Number.parseInt(style.zIndex, 10) || 0;
					const isPositioned = style.position === "fixed" || style.position === "absolute";
					const classId = `${htmlEl.className || ""} ${htmlEl.id || ""}`.toLowerCase();
					const hasConsentPattern = consentPattern.test(classId);

					if (isPositioned && zIndex > 10 && hasConsentPattern && htmlEl.offsetWidth > 0) {
						overlayContainers.push(htmlEl);
					}
				});

				// For each container, find the most prominent button (usually "accept")
				for (const container of overlayContainers) {
					const buttons = container.querySelectorAll(
						'button, [role="button"], a.btn, a[class*="btn"]',
					);
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
								score += saturation * scoring.saturationWeight;
								// Bright backgrounds score higher
								if (max > scoring.brightnessThreshold) score += scoring.positionWeight;
							}
						}

						// Larger buttons score higher
						const area = htmlBtn.offsetWidth * htmlBtn.offsetHeight;
						score += Math.min(area / scoring.areaDivisor, 3);

						// First button in DOM often is "accept"
						const index = Array.from(buttons).indexOf(btn);
						score += Math.max(0, scoring.positionWeight - index * scoring.indexDecay);

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
			},
			BUTTON_SCORING,
		);

		if (clickedButton) {
			logger.debug(`[DismissOverlays] Heuristic found and clicked button`);
			dismissed++;
			await page.waitForTimeout(OVERLAY_DISMISS_DELAY);
		}
	}

	// Step 3: Last resort - hide fixed position overlays from DOM
	logger.debug(`[DismissOverlays] Hiding remaining fixed overlays`);

	await page.evaluate(
		(selectors) => {
			for (const selector of selectors) {
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
		},
		[...OVERLAY_SELECTORS],
	);

	logger.debug(`[DismissOverlays] Completed, dismissed=${dismissed}`);
	return dismissed;
}

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
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			const dismissed = await dismissOverlaysOnPage(page);
			return JSON.stringify({ dismissed, success: true });
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}
