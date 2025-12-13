import type { Page } from "playwright-core";
import type { BrowserSessionManager } from "../session";

export interface FormatConfig {
	/** Max length for content summary (0 = no limit) */
	maxContentLength: number;
	/** Include DOM structure hints */
	includeStructure: boolean;
	/** Include content summary */
	includeSummary: boolean;
	/** Max number of links to show (0 = no limit). Default: 50 */
	maxLinks: number;
}

export const DEFAULT_CONFIG: FormatConfig = {
	maxContentLength: 0, // No limit - show full content
	includeStructure: true,
	includeSummary: true,
	maxLinks: 50, // Limit links to prevent context flooding
};

interface ElementInfo {
	type: "input" | "button" | "link" | "select" | "textarea" | "menuitem" | "checkbox";
	selector: string;
	text: string;
	inputType?: string;
	placeholder?: string;
	href?: string;
}

interface PageState {
	pageId: string;
	url: string;
	title: string;
	content: string;
	structure: string;
	inputs: ElementInfo[];
	buttons: ElementInfo[];
	links: ElementInfo[];
	selects: ElementInfo[];
	textareas: ElementInfo[];
	menuitems: ElementInfo[];
	checkboxes: ElementInfo[];
	dataAttributes: string[];
}

/**
 * Scans pages and formats state for LLM context injection.
 */
export class PageStateScanner {
	private cachedState: string = "[No browser open]";
	private scanPromise: Promise<void> | null = null;

	constructor(
		private manager: BrowserSessionManager,
		private config: FormatConfig = DEFAULT_CONFIG,
	) {}

	/**
	 * Get cached state synchronously (for trailing message).
	 * Call refreshState() to update the cache.
	 */
	getCachedState(): string {
		return this.cachedState;
	}

	/**
	 * Refresh the cached state (call after state-changing operations).
	 */
	async refreshState(): Promise<void> {
		// Avoid concurrent scans
		if (this.scanPromise) {
			await this.scanPromise;
			return;
		}

		this.scanPromise = this.doRefresh();
		await this.scanPromise;
		this.scanPromise = null;
	}

	private async doRefresh(): Promise<void> {
		this.cachedState = await this.scanAllPages();
	}

	/**
	 * Scan all open pages and format as compact string for trailing message.
	 * Output is wrapped in <CurrentBrowserState> tags for clear LLM context.
	 */
	async scanAllPages(): Promise<string> {
		const pages = this.manager.listPages();

		if (pages.length === 0) {
			return "<CurrentBrowserState>\n[No pages open]\n</CurrentBrowserState>";
		}

		// List open pages at the top for quick reference
		const pageIds = pages.map((p) => p.id).join(", ");
		const header = `OPEN PAGES: ${pageIds}\nUse these pageId values for all gadget calls.\n`;

		const states: string[] = [];

		for (const pageInfo of pages) {
			const page = this.manager.getPage(pageInfo.id);
			if (!page) continue;

			try {
				const state = await this.scanPage(pageInfo.id, page);
				states.push(this.formatPageState(state));
			} catch (error) {
				states.push(`=== PAGE: ${pageInfo.id} ===\n[Error scanning: ${error}]`);
			}
		}

		return `<CurrentBrowserState>\n${header}\n${states.join("\n\n")}\n</CurrentBrowserState>`;
	}

	/**
	 * Scan a single page for state.
	 */
	private async scanPage(pageId: string, page: Page): Promise<PageState> {
		const [url, title, content, structure, elements, dataAttributes] = await Promise.all([
			page.url(),
			page.title(),
			this.getContentSummary(page),
			this.getStructure(page),
			this.getInteractiveElements(page),
			this.getDataAttributes(page),
		]);

		return {
			pageId,
			url,
			title,
			content,
			structure,
			...elements,
			dataAttributes,
		};
	}

	/**
	 * Get all data-test attribute values from the page.
	 */
	private async getDataAttributes(page: Page): Promise<string[]> {
		try {
			return await page.evaluate(() => {
				const attrs = new Set<string>();
				document.querySelectorAll("[data-test]").forEach((el) => {
					const val = el.getAttribute("data-test");
					if (val) attrs.add(val);
				});
				return [...attrs].sort();
			});
		} catch {
			return [];
		}
	}

	/**
	 * Get visible text content from page.
	 */
	private async getContentSummary(page: Page): Promise<string> {
		try {
			let text = await page.innerText("body");
			// Normalize whitespace
			text = text.replace(/\s+/g, " ").trim();

			if (this.config.maxContentLength > 0 && text.length > this.config.maxContentLength) {
				text = `${text.slice(0, this.config.maxContentLength)}... [truncated - use GetFullPageContent for full text]`;
			}

			return text;
		} catch {
			return "[Unable to read content]";
		}
	}

	/**
	 * Get simplified DOM structure (forms, main sections).
	 */
	private async getStructure(page: Page): Promise<string> {
		if (!this.config.includeStructure) return "";

		try {
			return await page.evaluate(() => {
				const result: string[] = [];
				const indent = (level: number) => "  ".repeat(level);

				// Find forms
				document.querySelectorAll("form").forEach((form) => {
					const id = form.id ? `#${form.id}` : "";
					const name = form.getAttribute("name") ? `[name="${form.getAttribute("name")}"]` : "";
					result.push(`${indent(0)}<form${id}${name}>`);

					// List form fields
					form.querySelectorAll("input, select, textarea, button").forEach((field) => {
						const tag = field.tagName.toLowerCase();
						const fieldId = field.id ? `#${field.id}` : "";
						const fieldName = field.getAttribute("name") ? `[name="${field.getAttribute("name")}"]` : "";
						const type =
							field.getAttribute("type") && tag === "input" ? `[type="${field.getAttribute("type")}"]` : "";
						result.push(`${indent(1)}<${tag}${fieldId}${fieldName}${type}>`);
					});

					result.push(`${indent(0)}</form>`);
				});

				// Find main content areas
				const mainSelectors = ["main", "article", "[role='main']", "#content", ".content"];
				for (const selector of mainSelectors) {
					const main = document.querySelector(selector);
					if (main) {
						const id = main.id ? `#${main.id}` : "";
						const tag = main.tagName.toLowerCase();
						result.push(`<${tag}${id}> (main content area)`);
						break;
					}
				}

				// Find tables
				document.querySelectorAll("table").forEach((table) => {
					const id = table.id ? `#${table.id}` : "";
					const className = table.className ? `.${table.className.split(" ")[0]}` : "";
					const rows = table.querySelectorAll("tr").length;
					result.push(`<table${id}${className}> (${rows} rows)`);
				});

				return result.join("\n");
			});
		} catch {
			return "";
		}
	}

	/**
	 * Get all interactive elements.
	 */
	private async getInteractiveElements(page: Page): Promise<{
		inputs: ElementInfo[];
		buttons: ElementInfo[];
		links: ElementInfo[];
		selects: ElementInfo[];
		textareas: ElementInfo[];
		menuitems: ElementInfo[];
		checkboxes: ElementInfo[];
	}> {
		const inputs: ElementInfo[] = [];
		const buttons: ElementInfo[] = [];
		const links: ElementInfo[] = [];
		const selects: ElementInfo[] = [];
		const textareas: ElementInfo[] = [];
		const menuitems: ElementInfo[] = [];
		const checkboxes: ElementInfo[] = [];

		const typeSelectors: Record<string, string> = {
			input: "input:not([type='button']):not([type='submit']):not([type='hidden']):not([type='checkbox']):not([type='radio'])",
			button: "button, input[type='button'], input[type='submit'], [role='button']",
			link: "a[href]",
			select: "select",
			textarea: "textarea",
			menuitem: "[role='option'], [role='menuitem'], [role='listbox'] li, [role='menu'] li",
			// Checkboxes: native checkboxes, labels wrapping checkboxes, ARIA checkboxes/switches
			checkbox: "input[type='checkbox'], input[type='radio'], label:has(input[type='checkbox']), label:has(input[type='radio']), [role='checkbox'], [role='switch']",
		};

		for (const [type, selector] of Object.entries(typeSelectors)) {
			try {
				const els = await page.$$(selector);

				for (const el of els) {
					try {
						const isVisible = await el.isVisible();
						if (!isVisible) continue;

						const info = await this.extractElementInfo(el, type as ElementInfo["type"]);
						if (!info) continue;

						switch (type) {
							case "input":
								inputs.push(info);
								break;
							case "button":
								buttons.push(info);
								break;
							case "link":
								links.push(info);
								break;
							case "select":
								selects.push(info);
								break;
							case "textarea":
								textareas.push(info);
								break;
							case "menuitem":
								menuitems.push(info);
								break;
							case "checkbox":
								checkboxes.push(info);
								break;
						}
					} catch {
						// Element may have detached, skip
					}
				}
			} catch {
				// Selector failed, skip
			}
		}

		return { inputs, buttons, links, selects, textareas, menuitems, checkboxes };
	}

	/**
	 * Extract info from a single element.
	 */
	private async extractElementInfo(
		el: Awaited<ReturnType<Page["$"]>>,
		type: ElementInfo["type"],
	): Promise<ElementInfo | null> {
		if (!el) return null;

		const [id, name, className, dataTestId, ariaLabel, placeholder, inputType, href, textContent] = await Promise.all([
			el.getAttribute("id"),
			el.getAttribute("name"),
			el.getAttribute("class"),
			el.getAttribute("data-testid"),
			el.getAttribute("aria-label"),
			el.getAttribute("placeholder"),
			type === "input" ? el.getAttribute("type") : null,
			type === "link" ? el.getAttribute("href") : null,
			el.textContent(),
		]);

		// Generate selector (priority order)
		let selector: string;
		if (dataTestId) {
			selector = `[data-testid="${dataTestId}"]`;
		} else if (id && !this.isGarbageId(id)) {
			selector = `#${this.escapeCSSSelector(id)}`;
		} else if (name) {
			selector = `[name="${name}"]`;
		} else if (placeholder && (type === "input" || type === "textarea")) {
			selector = `${type}[placeholder="${placeholder}"]`;
		} else if (ariaLabel) {
			selector = `[aria-label="${ariaLabel}"]`;
		} else if (href && type === "link" && !href.startsWith("javascript:") && href.length < 100) {
			selector = `a[href="${href}"]`;
		} else if (className) {
			const classes = className.split(/\s+/).filter((c) => this.isMeaningfulClass(c));
			if (classes.length > 0) {
				selector = `.${this.escapeCSSSelector(classes[0])}`;
			} else {
				selector = type === "link" ? "a" : type;
			}
		} else {
			selector = type === "link" ? "a" : type;
		}

		// Get display text
		let text = (textContent || "").trim().replace(/\s+/g, " ");
		if (!text && ariaLabel) text = `[${ariaLabel}]`;
		if (!text && placeholder) text = `[${placeholder}]`;

		return {
			type,
			selector,
			text,
			inputType: inputType || undefined,
			placeholder: placeholder || undefined,
			href: href || undefined,
		};
	}

	/**
	 * Format elements with unique indexed selectors when duplicates exist.
	 * Returns array of formatted lines.
	 */
	private formatElements(elements: ElementInfo[], maxItems = 0): string[] {
		if (elements.length === 0) return [];

		// Count selector occurrences
		const selectorCounts = new Map<string, number>();
		for (const el of elements) {
			selectorCounts.set(el.selector, (selectorCounts.get(el.selector) || 0) + 1);
		}

		// Track which index we're at for each selector
		const selectorIndex = new Map<string, number>();

		const lines: string[] = [];
		const limit = maxItems > 0 ? Math.min(maxItems, elements.length) : elements.length;

		for (let i = 0; i < limit; i++) {
			const el = elements[i];
			const count = selectorCounts.get(el.selector) || 1;
			const idx = selectorIndex.get(el.selector) || 0;
			selectorIndex.set(el.selector, idx + 1);

			let displaySelector = el.selector;

			// If selector has duplicates, provide indexed version
			if (count > 1) {
				// Use :nth-of-type for class selectors, or >> nth= for complex selectors
				if (el.selector.startsWith(".") && !el.selector.includes(" ")) {
					displaySelector = `${el.selector}:nth-of-type(${idx + 1})`;
				} else {
					displaySelector = `${el.selector} >> nth=${idx}`;
				}
			}

			const textStr = el.text ? ` "${el.text.slice(0, 60)}${el.text.length > 60 ? "..." : ""}"` : "";
			const typeStr = el.inputType ? ` [${el.inputType}]` : "";
			lines.push(`  ${displaySelector}${typeStr}${textStr}`);
		}

		// Show hidden count
		if (elements.length > limit) {
			lines.push(`  [${elements.length - limit} more hidden - use GetFullPageContent for complete data]`);
		}

		return lines;
	}

	/**
	 * Format page state as compact string.
	 */
	private formatPageState(state: PageState): string {
		const lines: string[] = [];

		lines.push(`=== PAGE: ${state.pageId} ===`);
		lines.push(`URL: ${state.url}`);
		lines.push(`Title: ${state.title}`);

		if (this.config.includeSummary && state.content) {
			lines.push("");
			lines.push("CONTENT:");
			lines.push(state.content);
		}

		if (this.config.includeStructure && state.structure) {
			lines.push("");
			lines.push("STRUCTURE:");
			lines.push(state.structure);
		}

		if (state.inputs.length > 0) {
			lines.push("");
			lines.push("INPUTS:");
			lines.push(...this.formatElements(state.inputs));
		}

		if (state.buttons.length > 0) {
			lines.push("");
			lines.push("BUTTONS:");
			lines.push(...this.formatElements(state.buttons));
		}

		if (state.links.length > 0) {
			lines.push("");
			lines.push(`LINKS (${state.links.length}):`);
			lines.push(...this.formatElements(state.links, this.config.maxLinks));
		}

		if (state.selects.length > 0) {
			lines.push("");
			lines.push("SELECTS:");
			lines.push(...this.formatElements(state.selects));
		}

		if (state.textareas.length > 0) {
			lines.push("");
			lines.push("TEXTAREAS:");
			lines.push(...this.formatElements(state.textareas));
		}

		if (state.menuitems.length > 0) {
			lines.push("");
			lines.push("MENUITEMS:");
			lines.push(...this.formatElements(state.menuitems));
		}

		if (state.checkboxes.length > 0) {
			lines.push("");
			lines.push("CHECKBOXES:");
			lines.push(...this.formatElements(state.checkboxes));
		}

		// Show data-test attributes for ExecuteScript use
		if (state.dataAttributes.length > 0) {
			lines.push("");
			const maxAttrs = 30;
			const showAll = state.dataAttributes.length <= maxAttrs;
			const attrsToShow = showAll ? state.dataAttributes : state.dataAttributes.slice(0, maxAttrs);
			const hiddenCount = state.dataAttributes.length - attrsToShow.length;

			lines.push(`DATA_ATTRIBUTES (${state.dataAttributes.length}):`);
			lines.push(`  ${attrsToShow.join(", ")}`);
			if (hiddenCount > 0) {
				lines.push(`  [${hiddenCount} more - use GetFullPageContent with structure=true]`);
			}
		}

		return lines.join("\n");
	}

	/**
	 * Check if an ID looks like garbage (dynamically generated).
	 */
	private isGarbageId(id: string): boolean {
		if (/[«»]/.test(id)) return true;
		if (/^[a-zA-Z0-9_-]{20,}$/.test(id) && !/[A-Z][a-z]|[a-z][A-Z]/.test(id)) return true;
		if (/^(rc-|mui-|react-|:r[a-z0-9]+:)/.test(id)) return true;
		return false;
	}

	/**
	 * Check if a class name is meaningful (not framework garbage).
	 */
	private isMeaningfulClass(c: string): boolean {
		return (
			c.length > 2 &&
			!c.startsWith("Mui") &&
			!c.startsWith("css-") &&
			!c.startsWith("sc-") &&
			!/^[a-z]{1,3}-[a-z0-9]+$/.test(c)
		);
	}

	/**
	 * Escape special characters for CSS selector.
	 */
	private escapeCSSSelector(str: string): string {
		return str.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
	}
}
