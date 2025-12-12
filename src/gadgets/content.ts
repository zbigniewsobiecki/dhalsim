import { Gadget, z, resultWithImage, type GadgetExecuteResultWithMedia } from "llmist";
import sharp from "sharp";
import type { BrowserSessionManager } from "../session";

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

export class GetPageContent extends Gadget({
	description:
		"Gets the visible text content of a page or specific element. Useful for understanding what's on the page.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		selector: z
			.string()
			.optional()
			.describe("CSS selector to get content from specific element (default: entire page)"),
	}),
	examples: [
		{
			params: { pageId: "p1" },
			output: '{"text":"Hello World\\nWelcome to our site...","truncated":false}',
			comment: "Get all text from page",
		},
		{
			params: { pageId: "p1", selector: "h1" },
			output: '{"text":"Hello World","truncated":false}',
			comment: "Get text from h1 element",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);

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

			// Truncate if too long
			const MAX_LENGTH = 50000;
			const truncated = text.length > MAX_LENGTH;
			if (truncated) {
				text = text.slice(0, MAX_LENGTH);
			}

			return JSON.stringify({ text, truncated });
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
	constructor(private manager: BrowserSessionManager) {
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

interface InteractiveElement {
	index: number;
	type: "button" | "link" | "input" | "select" | "textarea";
	selector: string;
	text: string;
	visible: boolean;
	enabled: boolean;
	attributes?: Record<string, string>;
}

/**
 * Check if an ID looks like garbage (dynamically generated, contains special chars, etc.)
 */
function isGarbageId(id: string): boolean {
	// IDs with special Unicode characters
	if (/[«»]/.test(id)) return true;
	// IDs that are just long random-looking alphanumeric strings (20+ chars)
	if (/^[a-zA-Z0-9_-]{20,}$/.test(id) && !/[A-Z][a-z]|[a-z][A-Z]/.test(id)) return true;
	// IDs starting with special prefixes common in frameworks
	if (/^(rc-|mui-|react-|:r[a-z0-9]+:)/.test(id)) return true;
	return false;
}

/**
 * Escape a string for use in a CSS selector (handles special characters)
 */
function escapeCSSSelector(str: string): string {
	return str.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
}

export class ListInteractiveElements extends Gadget({
	description:
		"Lists all interactive elements on the page (buttons, links, inputs, selects, textareas). Use the returned index or selector with Click, Type, or other interaction gadgets.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		types: z
			.array(z.enum(["button", "link", "input", "select", "textarea"]))
			.optional()
			.describe("Filter by element types"),
	}),
	examples: [
		{
			params: { pageId: "p1" },
			output:
				'{"elements":[{"index":0,"type":"button","selector":"#login-btn","text":"Login","visible":true,"enabled":true},{"index":1,"type":"link","selector":"a[href=\\"/signup\\"]","text":"Sign Up","visible":true,"enabled":true}]}',
			comment: "List all interactive elements",
		},
		{
			params: { pageId: "p1", types: ["input"] },
			output:
				'{"elements":[{"index":0,"type":"input","selector":"#email","text":"","visible":true,"enabled":true,"attributes":{"type":"email","placeholder":"Email"}}]}',
			comment: "List only input elements",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		let page: Awaited<ReturnType<BrowserSessionManager["requirePage"]>>;
		try {
			page = this.manager.requirePage(params.pageId);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
		}

		// Wait for page to stabilize (helps with SPAs)
		await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

		// Retry logic for dynamic content that may detach
		let lastError: Error | null = null;
		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				const elements = await this.collectElements(page, params.types);
				return JSON.stringify({ elements });
			} catch (error) {
				lastError = error as Error;
				const message = error instanceof Error ? error.message : String(error);
				if (message.includes("not attached") || message.includes("detached")) {
					await page.waitForTimeout(500);
					continue;
				}
				return JSON.stringify({ error: message });
			}
		}
		return JSON.stringify({ error: lastError?.message || "Failed after retries" });
	}

	private async collectElements(
		page: Awaited<ReturnType<BrowserSessionManager["requirePage"]>>,
		types?: ("button" | "link" | "input" | "select" | "textarea")[],
	): Promise<InteractiveElement[]> {
		const elements: InteractiveElement[] = [];
		let index = 0;

		// Track selector usage counts to make duplicates unique
		const selectorCounts = new Map<string, number>();

		const typeSelectors: Record<string, string> = {
			button: "button, input[type='button'], input[type='submit'], [role='button']",
			link: "a[href]",
			input: "input:not([type='button']):not([type='submit']):not([type='hidden'])",
			select: "select",
			textarea: "textarea",
		};

		const typesToCheck = types || (Object.keys(typeSelectors) as Array<keyof typeof typeSelectors>);

		for (const type of typesToCheck) {
			const selector = typeSelectors[type];
			const els = await page.$$(selector);

			for (const el of els) {
				try {
					const isVisible = await el.isVisible();
					const isEnabled = await el.isEnabled();
					let text = ((await el.textContent()) || "").trim();

					// Gather attributes for selector generation and display
					const id = await el.getAttribute("id");
					const name = await el.getAttribute("name");
					const className = await el.getAttribute("class");
					const dataTestId = await el.getAttribute("data-testid");
					const ariaLabel = await el.getAttribute("aria-label");
					const title = await el.getAttribute("title");
					const placeholder = await el.getAttribute("placeholder");
					const inputType = type === "input" ? await el.getAttribute("type") : null;
					const href = type === "link" ? await el.getAttribute("href") : null;

					// If text is empty, try aria-label or title for display
					if (!text && ariaLabel) {
						text = `[${ariaLabel}]`;
					} else if (!text && title) {
						text = `[${title}]`;
					}

					// Generate a unique selector with priority:
					// 1. data-testid (most stable)
					// 2. Good ID (not garbage)
					// 3. name attribute
					// 4. For inputs: placeholder-based selector
					// 5. aria-label
					// 6. For links: href-based if unique enough
					// 7. Class (if reasonably specific)
					// 8. Fallback to nth-of-type
					let baseSelector: string;
					if (dataTestId) {
						baseSelector = `[data-testid="${dataTestId}"]`;
					} else if (id && !isGarbageId(id)) {
						baseSelector = `#${escapeCSSSelector(id)}`;
					} else if (name) {
						baseSelector = `[name="${name}"]`;
					} else if (placeholder && (type === "input" || type === "textarea")) {
						baseSelector = `${type}[placeholder="${placeholder}"]`;
					} else if (ariaLabel) {
						baseSelector = `[aria-label="${ariaLabel}"]`;
					} else if (href && type === "link" && !href.startsWith("javascript:") && href.length < 100) {
						baseSelector = `a[href="${href}"]`;
					} else if (className) {
						// Pick a meaningful class (not generic MUI/framework classes)
						const classes = className.split(/\s+/).filter((c) => {
							// Skip generic framework classes
							return (
								c.length > 2 &&
								!c.startsWith("Mui") &&
								!c.startsWith("css-") &&
								!c.startsWith("sc-") &&
								!/^[a-z]{1,3}-[a-z0-9]+$/.test(c)
							);
						});
						if (classes.length > 0) {
							baseSelector = `.${escapeCSSSelector(classes[0])}`;
						} else {
							baseSelector = `${type === "link" ? "a" : type}:nth-of-type(${index + 1})`;
						}
					} else {
						baseSelector = `${type === "link" ? "a" : type}:nth-of-type(${index + 1})`;
					}

					// Make selector unique if it's been used before
					const count = selectorCounts.get(baseSelector) || 0;
					selectorCounts.set(baseSelector, count + 1);

					let uniqueSelector: string;
					if (count === 0) {
						uniqueSelector = baseSelector;
					} else {
						// Add nth-of-type to make it unique (count+1 because CSS is 1-indexed)
						const tagName = type === "link" ? "a" : type;
						if (baseSelector.startsWith(".") || baseSelector.startsWith("[")) {
							uniqueSelector = `${tagName}${baseSelector}:nth-of-type(${count + 1})`;
						} else {
							uniqueSelector = `${baseSelector}:nth-of-type(${count + 1})`;
						}
					}

					// Get relevant attributes for inputs
					const attributes: Record<string, string> = {};
					if (type === "input" || type === "textarea") {
						if (inputType) attributes.type = inputType;
						if (placeholder) attributes.placeholder = placeholder;
					}

					elements.push({
						index,
						type: type as InteractiveElement["type"],
						selector: uniqueSelector,
						text: text.slice(0, 100),
						visible: isVisible,
						enabled: isEnabled,
						...(Object.keys(attributes).length > 0 ? { attributes } : {}),
					});
					index++;
				} catch {
					// Element detached during iteration, skip it
				}
			}
		}

		return elements;
	}
}
