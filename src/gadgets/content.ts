import { Gadget, z, resultWithImage, type GadgetExecuteResultWithMedia } from "llmist";
import sharp from "sharp";
import type { IBrowserSessionManager } from "../session";

/** Claude's max image dimension is 8000px */
const MAX_IMAGE_DIMENSION = 8000;

/**
 * Resize image buffer if it exceeds Claude's max dimension limit.
 * Maintains aspect ratio while fitting within MAX_IMAGE_DIMENSION.
 */
async function resizeIfNeeded(buffer: Buffer): Promise<Buffer> {
	const metadata = await sharp(buffer).metadata();
	const { width, height } = metadata;

	if (!width || !height) return buffer;

	// Check if resizing is needed
	if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
		return buffer;
	}

	// Calculate scale factor to fit within max dimensions
	const scale = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
	const newWidth = Math.round(width * scale);
	const newHeight = Math.round(height * scale);

	return sharp(buffer).resize(newWidth, newHeight).png().toBuffer();
}

export class GetFullPageContent extends Gadget({
	description:
		"Gets the full visible text content of a page or specific element(s) with no truncation. Use 'selectors' array to query multiple elements at once.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		selector: z
			.string()
			.optional()
			.describe("CSS selector to get content from specific element (default: entire page)"),
		selectors: z
			.array(z.string())
			.optional()
			.describe("Array of CSS selectors to query multiple elements at once."),
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
			comment: "Get text from h1 element",
		},
		{
			params: { pageId: "p1", selectors: ["#panel1", "#panel2", "#panel3"] },
			output: '{"results":[{"text":"Invoice 1..."},{"text":"Invoice 2..."},{"text":"Invoice 3..."}]}',
			comment: "Get text from multiple elements at once (results match selector order)",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);

			// Multi-selector mode: query multiple elements at once
			// Results are returned in same order as input selectors (no selector echoed back to avoid LLM learning to construct them)
			if (params.selectors && params.selectors.length > 0) {
				const results: Array<{ text?: string; error?: string }> = [];

				for (const selector of params.selectors) {
					try {
						const element = await page.$(selector);
						if (!element) {
							results.push({ error: "Element not found" });
							continue;
						}
						let text = (await element.textContent()) || "";
						text = text.replace(/\s+/g, " ").trim();
						results.push({ text });
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						results.push({ error: message });
					}
				}

				return JSON.stringify({ results });
			}

			// Single selector or whole page mode (backward compatible)
			let text: string;
			if (params.selector) {
				const element = await page.$(params.selector);
				if (!element) {
					return JSON.stringify({ error: `Element not found: ${params.selector}` });
				}
				text = (await element.textContent()) || "";
			} else {
				text = await page.innerText("body");
			}

			// Normalize whitespace
			text = text.replace(/\s+/g, " ").trim();

			return JSON.stringify({ text });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
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
		selector: z.string().optional().describe("Screenshot only a specific element"),
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
		try {
			const page = this.manager.requirePage(params.pageId);

			let buffer: Buffer;
			if (params.selector) {
				const element = await page.$(params.selector);
				if (!element) {
					return JSON.stringify({ error: `Element not found: ${params.selector}` });
				}
				buffer = await element.screenshot({ type: "png" });
			} else {
				buffer = await page.screenshot({
					type: "png",
					fullPage: params.fullPage,
				});
			}

			// Resize if exceeds Claude's max dimension (8000px)
			buffer = await resizeIfNeeded(buffer);

			const viewport = page.viewportSize();

			return resultWithImage(
				JSON.stringify({
					success: true,
					fullPage: params.fullPage ?? false,
					selector: params.selector,
					viewport,
				}),
				buffer,
				{
					mimeType: "image/png",
					description: "Browser screenshot",
					metadata: viewport ? { width: viewport.width, height: viewport.height } : undefined,
				},
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
		}
	}
}
