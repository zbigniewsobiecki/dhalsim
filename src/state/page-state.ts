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

interface CollapsedSection {
	/** Selector for the toggle button/header that expands this section */
	toggleSelector: string;
	/** Label/text of the collapsed section */
	label: string;
	/** Items inside the collapsed section (checkboxes, options, etc.) */
	items: string[];
}

interface SelectWithOptions {
	/** Selector for the select element */
	selector: string;
	/** Label or placeholder for the select */
	label: string;
	/** Available options with their values */
	options: Array<{ value: string; text: string }>;
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
	collapsedSections: CollapsedSection[];
	selectOptions: SelectWithOptions[];
	/** Errors encountered during scanning (partial state indicator) */
	scanErrors: string[];
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
	 * Uses proper locking to avoid concurrent scans and handles errors correctly.
	 */
	async refreshState(): Promise<void> {
		// If a scan is already in progress, just wait for it
		if (this.scanPromise) {
			await this.scanPromise;
			return;
		}

		// Start a new scan with proper cleanup in finally block
		this.scanPromise = this.doRefresh();
		try {
			await this.scanPromise;
		} finally {
			// Always clear the promise, even if doRefresh throws
			this.scanPromise = null;
		}
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
		const scanErrors: string[] = [];

		// Wrap each scan operation to capture errors
		const safeCall = async <T>(
			fn: () => Promise<T>,
			fallback: T,
			errorLabel: string,
		): Promise<T> => {
			try {
				return await fn();
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				scanErrors.push(`${errorLabel}: ${msg}`);
				return fallback;
			}
		};

		const [url, title] = await Promise.all([page.url(), page.title()]);

		const [content, structure, elements, dataAttributes, collapsedSections, selectOptions] =
			await Promise.all([
				safeCall(() => this.getContentSummary(page), "[Error reading content]", "content"),
				safeCall(() => this.getStructure(page), "", "structure"),
				safeCall(
					() => this.getInteractiveElements(page),
					{ inputs: [], buttons: [], links: [], selects: [], textareas: [], menuitems: [], checkboxes: [] },
					"elements",
				),
				safeCall(() => this.getDataAttributes(page), [], "dataAttributes"),
				safeCall(() => this.getCollapsedSections(page), [], "collapsedSections"),
				safeCall(() => this.getSelectOptions(page), [], "selectOptions"),
			]);

		return {
			pageId,
			url,
			title,
			content,
			structure,
			...elements,
			dataAttributes,
			collapsedSections,
			selectOptions,
			scanErrors,
		};
	}

	/**
	 * Get all data-test attribute values from the page.
	 */
	private async getDataAttributes(page: Page): Promise<string[]> {
		return await page.evaluate(() => {
			const attrs = new Set<string>();
			document.querySelectorAll("[data-test]").forEach((el) => {
				const val = el.getAttribute("data-test");
				if (val) attrs.add(val);
			});
			return [...attrs].sort();
		});
	}

	/**
	 * Get visible text content from page.
	 */
	private async getContentSummary(page: Page): Promise<string> {
		let text = await page.innerText("body");
		// Normalize whitespace
		text = text.replace(/\s+/g, " ").trim();

		if (this.config.maxContentLength > 0 && text.length > this.config.maxContentLength) {
			text = `${text.slice(0, this.config.maxContentLength)}... [truncated - use GetFullPageContent for full text]`;
		}

		return text;
	}

	/**
	 * Get simplified DOM structure (forms, main sections).
	 */
	private async getStructure(page: Page): Promise<string> {
		if (!this.config.includeStructure) return "";

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

						// Check visibility using DOM properties
						const htmlField = field as HTMLElement;
						const isHidden =
							htmlField.offsetWidth === 0 ||
							htmlField.offsetHeight === 0 ||
							getComputedStyle(htmlField).visibility === "hidden" ||
							getComputedStyle(htmlField).display === "none";
						const hiddenMarker = isHidden ? " [hidden]" : "";

						result.push(`${indent(1)}<${tag}${fieldId}${fieldName}${type}>${hiddenMarker}`);
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
	}

	/**
	 * Get all interactive elements.
	 * Processes all selector types in parallel for better performance.
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
		const typeSelectors: Record<string, string> = {
			input: "input:not([type='button']):not([type='submit']):not([type='hidden']):not([type='checkbox']):not([type='radio'])",
			button: "button, input[type='button'], input[type='submit'], [role='button']",
			link: "a[href]",
			select: "select",
			textarea: "textarea",
			menuitem: [
				// ARIA-based menus
				"[role='option']",
				"[role='menuitem']",
				"[role='listbox'] li",
				"[role='menu'] li",
				// Custom dropdown patterns (Bootstrap, common conventions)
				".dropdown-menu > *",
				".dropdown-item",
				"[class*='dropdown'] li",
				"[class*='menu-item']",
				"ul[class*='dropdown'] > li",
				"div[class*='dropdown'] > *",
			].join(", "),
			// Checkboxes: native checkboxes, labels wrapping checkboxes, ARIA checkboxes/switches
			checkbox: "input[type='checkbox'], input[type='radio'], label:has(input[type='checkbox']), label:has(input[type='radio']), [role='checkbox'], [role='switch']",
		};

		// Process all selector types in parallel for better performance
		const processType = async (type: string, selector: string): Promise<ElementInfo[]> => {
			const results: ElementInfo[] = [];
			try {
				const els = await page.$$(selector);

				// Process elements with Promise.all for parallelism
				const elementPromises = els.map(async (el) => {
					try {
						const isVisible = await el.isVisible();
						if (!isVisible) return null;
						return await this.extractElementInfo(el, type as ElementInfo["type"]);
					} catch {
						// Element may have detached, skip
						return null;
					}
				});

				const infos = await Promise.all(elementPromises);
				for (const info of infos) {
					if (info) results.push(info);
				}
			} catch {
				// Selector failed, return empty
			}
			return results;
		};

		// Run all type scans in parallel
		const [inputs, buttons, links, selects, textareas, menuitems, checkboxes] = await Promise.all([
			processType("input", typeSelectors.input),
			processType("button", typeSelectors.button),
			processType("link", typeSelectors.link),
			processType("select", typeSelectors.select),
			processType("textarea", typeSelectors.textarea),
			processType("menuitem", typeSelectors.menuitem),
			processType("checkbox", typeSelectors.checkbox),
		]);

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

		const [id, name, className, dataTestId, ariaLabel, placeholder, inputType, href, textContent, tagName] = await Promise.all([
			el.getAttribute("id"),
			el.getAttribute("name"),
			el.getAttribute("class"),
			el.getAttribute("data-testid"),
			el.getAttribute("aria-label"),
			el.getAttribute("placeholder"),
			type === "input" ? el.getAttribute("type") : null,
			type === "link" ? el.getAttribute("href") : null,
			el.textContent(),
			el.evaluate((e) => e.tagName.toLowerCase()),
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
				selector = this.getFallbackSelector(type, tagName);
			}
		} else {
			selector = this.getFallbackSelector(type, tagName);
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

			// If selector has duplicates, provide indexed version using Playwright's >> nth= syntax
			// This is more reliable than CSS :nth-of-type() which counts by tag type, not class
			if (count > 1) {
				displaySelector = `${el.selector} >> nth=${idx}`;
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

		// Show scan errors prominently if any occurred
		if (state.scanErrors.length > 0) {
			lines.push("");
			lines.push("⚠️ PARTIAL STATE (some data may be missing):");
			for (const err of state.scanErrors) {
				lines.push(`  - ${err}`);
			}
		}

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

		// Show collapsed sections so agent can see options before expanding
		if (state.collapsedSections.length > 0) {
			lines.push("");
			lines.push("COLLAPSED SECTIONS (click to expand, then interact with items):");
			for (const section of state.collapsedSections) {
				lines.push(`  ${section.toggleSelector} "${section.label}"`);
				lines.push(`    Items: ${section.items.join(", ")}`);
			}
		}

		// Show select options so agent can see dropdown choices before opening
		if (state.selectOptions.length > 0) {
			lines.push("");
			lines.push("SELECT OPTIONS (use SelectOption gadget):");
			for (const select of state.selectOptions) {
				lines.push(`  ${select.selector} "${select.label}"`);
				const optionList = select.options.map((o) => o.text || o.value).join(", ");
				lines.push(`    Options: ${optionList}`);
			}
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

	/**
	 * Scan for collapsed sections (accordions, panels) and extract their contents.
	 * This allows the agent to see what options are available BEFORE expanding.
	 */
	private async getCollapsedSections(page: Page): Promise<CollapsedSection[]> {
		return await page.evaluate(() => {
				const sections: Array<{
					toggleSelector: string;
					label: string;
					items: string[];
				}> = [];

				// Find elements with aria-expanded="false" (collapsed accordions/panels)
				const toggles = Array.from(document.querySelectorAll('[aria-expanded="false"]'));

				for (const toggle of toggles) {
					// Build selector for the toggle button
					let toggleSelector = "";
					const toggleId = toggle.id;
					const dataTestId = toggle.getAttribute("data-testid");
					const ariaLabel = toggle.getAttribute("aria-label");
					const toggleText = (toggle.textContent || "").trim().slice(0, 50);

					if (dataTestId) {
						toggleSelector = `[data-testid="${dataTestId}"]`;
					} else if (toggleId) {
						toggleSelector = `#${toggleId}`;
					} else if (ariaLabel) {
						toggleSelector = `[aria-label="${ariaLabel}"]`;
					} else if (toggleText) {
						toggleSelector = `text="${toggleText}"`;
					} else {
						continue; // Can't identify this toggle
					}

					// Find the controlled content area
					const controlsId = toggle.getAttribute("aria-controls");
					let contentEl: Element | null = null;

					if (controlsId) {
						contentEl = document.getElementById(controlsId);
					} else {
						// Try to find adjacent sibling or parent's next sibling
						contentEl = toggle.nextElementSibling;
						if (!contentEl) {
							const parent = toggle.parentElement;
							if (parent) {
								contentEl = parent.nextElementSibling;
							}
						}
					}

					if (!contentEl) continue;

					// Extract items from the collapsed content
					const items: string[] = [];

					// Look for checkboxes
					contentEl.querySelectorAll("input[type='checkbox'], input[type='radio'], [role='checkbox']").forEach((checkbox) => {
						const label = checkbox.getAttribute("aria-label") ||
							(checkbox.parentElement?.textContent || "").trim();
						if (label) items.push(label.slice(0, 60));
					});

					// Look for labels containing checkboxes
					contentEl.querySelectorAll("label").forEach((label) => {
						const hasCheckbox = label.querySelector("input[type='checkbox'], input[type='radio']");
						if (hasCheckbox) {
							const text = (label.textContent || "").trim();
							if (text && !items.includes(text.slice(0, 60))) {
								items.push(text.slice(0, 60));
							}
						}
					});

					// Look for options/links/list items
					contentEl.querySelectorAll("a, [role='option'], [role='menuitem'], li").forEach((item) => {
						const text = (item.textContent || "").trim();
						if (text && text.length > 1 && !items.includes(text.slice(0, 60))) {
							items.push(text.slice(0, 60));
						}
					});

					if (items.length > 0) {
						sections.push({
							toggleSelector,
							label: toggleText || ariaLabel || "Collapsed Section",
							items: items.slice(0, 20), // Limit items per section
						});
					}
				}

				return sections;
		});
	}

	/**
	 * Get all <select> elements with their available options.
	 * This allows the agent to see dropdown options BEFORE opening them.
	 */
	private async getSelectOptions(page: Page): Promise<SelectWithOptions[]> {
		return await page.evaluate(() => {
				const results: Array<{
					selector: string;
					label: string;
					options: Array<{ value: string; text: string }>;
				}> = [];

				const selects = Array.from(document.querySelectorAll("select"));

				for (const select of selects) {
					// Build selector
					let selector = "";
					const id = select.id;
					const name = select.getAttribute("name");
					const dataTestId = select.getAttribute("data-testid");
					const ariaLabel = select.getAttribute("aria-label");

					if (dataTestId) {
						selector = `[data-testid="${dataTestId}"]`;
					} else if (id) {
						selector = `#${id}`;
					} else if (name) {
						selector = `select[name="${name}"]`;
					} else {
						continue; // Can't reliably identify this select
					}

					// Get label from associated <label> element or aria-label
					let label = ariaLabel || "";
					if (!label) {
						const labelEl = id
							? document.querySelector(`label[for="${id}"]`)
							: select.closest("label");
						if (labelEl) {
							label = (labelEl.textContent || "").trim();
						}
					}

					// Extract options
					const options: Array<{ value: string; text: string }> = [];
					Array.from(select.querySelectorAll("option")).forEach((option: HTMLOptionElement) => {
						const value = option.value;
						const text = (option.textContent || "").trim();
						// Skip placeholder options
						if (value || (text && !text.match(/^(select|choose|--)/i))) {
							options.push({ value, text: text.slice(0, 50) });
						}
					});

					if (options.length > 0) {
						results.push({
							selector,
							label: label || "Select",
							options: options.slice(0, 30), // Limit options
						});
					}
				}

				return results;
		});
	}

	/**
	 * Get a valid CSS selector for element type when no better selector is available.
	 * Maps our internal type names to actual valid CSS selectors.
	 */
	private getFallbackSelector(type: ElementInfo["type"], tagName: string): string {
		switch (type) {
			case "link":
				return "a";
			case "checkbox":
				// Handle different checkbox implementations
				if (tagName === "input") {
					return "input[type='checkbox']";
				}
				if (tagName === "label") {
					return "label";
				}
				return "[role='checkbox']";
			case "menuitem":
				return "[role='menuitem']";
			case "button":
				return tagName === "button" ? "button" : "[role='button']";
			case "input":
				return "input";
			case "select":
				return "select";
			case "textarea":
				return "textarea";
			default:
				// Use actual tag name as last resort
				return tagName || "*";
		}
	}
}
