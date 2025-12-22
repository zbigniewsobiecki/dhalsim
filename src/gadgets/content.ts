import { Gadget, z, resultWithImage, type GadgetExecuteResultWithMedia, defaultLogger as logger, getErrorMessage } from "llmist";
import type { IBrowserSessionManager } from "../session";
import { optionalSelectorSchema, selectorsArraySchema } from "./selector-validator";
import { MAX_SELECTORS_PER_QUERY } from "../utils/constants";

/** Claude's max image dimension is 8000px */
const MAX_IMAGE_DIMENSION = 8000;

export class GetFullPageContent extends Gadget({
	description:
		"Gets the full visible text content of a page or specific element(s) with no truncation. Use 'selectors' array to query multiple elements at once. Use 'structure=true' to get DOM structure info for ExecuteScript.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		selector: optionalSelectorSchema.describe(
			"CSS selector to get content from specific element (default: entire page)",
		),
		selectors: selectorsArraySchema.describe("Array of CSS selectors to query multiple elements at once."),
		structure: z
			.boolean()
			.optional()
			.describe(
				"Return DOM structure info (data-test attrs, class samples, element counts) instead of text content. Useful for writing ExecuteScript.",
			),
	}),
	examples: [
		{
			params: { pageId: "p1" },
			output: '{"text":"Hello World\\nWelcome to our site..."}',
			comment: "Get all text from page",
		},
		{
			params: { pageId: "p1", selector: "h1" },
			output: '{"text":"Hello World"}',
			comment: "Get text from single h1 element",
		},
		{
			params: { pageId: "p1", selector: ".invoice-row" },
			output: '{"texts":["Invoice 1...","Invoice 2...","Invoice 3..."],"count":3}',
			comment: "When selector matches multiple elements, returns all as array",
		},
		{
			params: { pageId: "p1", selectors: ["#panel1", ".items"] },
			output: '{"results":[{"text":"Panel content"},{"texts":["Item 1","Item 2"],"count":2}]}',
			comment: "Multi-selector mode: each result can be single or array",
		},
		{
			params: { pageId: "p1", structure: true },
			output:
				'{"dataAttributes":["offer-title","link-offer"],"sampleClasses":{"section":["tiles_c6logt4"]},"elementCounts":{"section":50,"a":337}}',
			comment: "Get DOM structure for ExecuteScript",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		logger.debug(`[GetFullPageContent] pageId=${params.pageId} selector=${params.selector ?? "none"} selectors=${params.selectors?.length ?? 0} structure=${params.structure ?? false}`);
		try {
			const page = this.manager.requirePage(params.pageId);

			// Structure mode: return DOM info for ExecuteScript
			if (params.structure) {
				const info = await page.evaluate(() => {
					// Collect all data-test attributes
					const dataAttrs = new Set<string>();
					document.querySelectorAll("[data-test]").forEach((el) => {
						const val = el.getAttribute("data-test");
						if (val) dataAttrs.add(val);
					});

					// Sample class names by tag type (first 10 per tag, filter garbage)
					const sampleClasses: Record<string, string[]> = {};
					const tags = ["section", "div", "article", "a", "span", "ul", "li"];
					for (const tag of tags) {
						const classes = new Set<string>();
						document.querySelectorAll(`${tag}[class]`).forEach((el) => {
							if (classes.size < 10) {
								const cls = el.className
									.split(" ")
									.find(
										(c) =>
											c.length > 2 &&
											!c.startsWith("_") &&
											!c.startsWith("css-") &&
											!c.startsWith("sc-") &&
											!/^[a-z]{1,3}-[a-z0-9]+$/.test(c),
									);
								if (cls) classes.add(cls);
							}
						});
						if (classes.size > 0) sampleClasses[tag] = [...classes];
					}

					// Element counts
					const counts: Record<string, number> = {};
					const countTags = ["section", "article", "div", "a", "button", "form", "ul", "li", "table", "tr"];
					for (const tag of countTags) {
						counts[tag] = document.querySelectorAll(tag).length;
					}

					return {
						dataAttributes: [...dataAttrs].sort(),
						sampleClasses,
						elementCounts: counts,
					};
				});

				return JSON.stringify(info);
			}

			// Multi-selector mode: query multiple elements at once
			// Results are returned in same order as input selectors
			// When a selector matches multiple elements, returns all matches as array
			if (params.selectors && params.selectors.length > 0) {
				// Limit selectors to prevent DoS
				const selectors = params.selectors.slice(0, MAX_SELECTORS_PER_QUERY);
				const results: Array<{ text?: string; texts?: string[]; count?: number; error?: string }> = [];

				for (const selector of selectors) {
					try {
						const locator = page.locator(selector);
						const count = await locator.count();
						if (count === 0) {
							results.push({ error: "Element not found" });
							continue;
						}
						// When multiple elements match, return all as array
						if (count > 1) {
							const texts: string[] = [];
							for (let i = 0; i < count; i++) {
								const text = await locator.nth(i).textContent();
								texts.push((text || "").replace(/\s+/g, " ").trim());
							}
							results.push({ texts, count });
						} else {
							let text = (await locator.textContent()) || "";
							text = text.replace(/\s+/g, " ").trim();
							results.push({ text });
						}
					} catch (error) {
						results.push({ error: getErrorMessage(error) });
					}
				}

				return JSON.stringify({
					results,
					...(params.selectors.length > MAX_SELECTORS_PER_QUERY
						? { warning: `Truncated to ${MAX_SELECTORS_PER_QUERY} selectors` }
						: {}),
				});
			}

			// Single selector or whole page mode
			if (params.selector) {
				const locator = page.locator(params.selector);
				const count = await locator.count();
				if (count === 0) {
					return JSON.stringify({ error: `Element not found: ${params.selector}` });
				}
				// When multiple elements match, return all as array
				if (count > 1) {
					const texts: string[] = [];
					for (let i = 0; i < count; i++) {
						const text = await locator.nth(i).textContent();
						texts.push((text || "").replace(/\s+/g, " ").trim());
					}
					return JSON.stringify({ texts, count });
				}
				let text = (await locator.textContent()) || "";
				text = text.replace(/\s+/g, " ").trim();
				return JSON.stringify({ text });
			}

			// Whole page mode
			let text = await page.innerText("body");
			text = text.replace(/\s+/g, " ").trim();
			return JSON.stringify({ text });
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}

export class Screenshot extends Gadget({
	description:
		"Takes a screenshot of the page. The image is sent to the model for visual inspection of page layout, content, and UI elements.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		fullPage: z
			.boolean()
			.default(false)
			.describe("Capture full scrollable page instead of just viewport"),
		selector: optionalSelectorSchema.describe("Screenshot only a specific element"),
	}),
	examples: [
		{
			params: { pageId: "p1", fullPage: false },
			output: '{"success":true,"fullPage":false,"viewport":{"width":1280,"height":720}}',
			comment: "Screenshot viewport (image sent to model)",
		},
		{
			params: { pageId: "p1", fullPage: true },
			output: '{"success":true,"fullPage":true,"viewport":{"width":1280,"height":720}}',
			comment: "Screenshot full page",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string | GadgetExecuteResultWithMedia> {
		logger.debug(`[Screenshot] pageId=${params.pageId} fullPage=${params.fullPage ?? false} selector=${params.selector ?? "none"}`);
		try {
			const page = this.manager.requirePage(params.pageId);
			const viewport = page.viewportSize();

			let buffer: Buffer;
			let clipped = false;

			if (params.selector) {
				const locator = page.locator(params.selector);
				const count = await locator.count();
				if (count === 0) {
					return JSON.stringify({ error: `Element not found: ${params.selector}` });
				}
				buffer = await locator.screenshot({ type: "png" });
			} else if (params.fullPage) {
				// For full page screenshots, clip to Claude's max dimension (8000px)
				const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
				const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
				const width = Math.min(scrollWidth, viewport?.width ?? 1280);

				if (scrollHeight > MAX_IMAGE_DIMENSION) {
					// Clip to max height
					buffer = await page.screenshot({
						type: "png",
						clip: { x: 0, y: 0, width, height: MAX_IMAGE_DIMENSION },
					});
					clipped = true;
				} else {
					buffer = await page.screenshot({ type: "png", fullPage: true });
				}
			} else {
				buffer = await page.screenshot({ type: "png" });
			}

			return resultWithImage(
				JSON.stringify({
					success: true,
					fullPage: params.fullPage ?? false,
					selector: params.selector,
					viewport,
					...(clipped ? { clipped: true, maxHeight: MAX_IMAGE_DIMENSION } : {}),
				}),
				buffer,
				{
					mimeType: "image/png",
					description: "Browser screenshot",
					metadata: viewport ? { width: viewport.width, height: viewport.height } : undefined,
				},
			);
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}
