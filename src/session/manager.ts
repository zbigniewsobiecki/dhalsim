import { chromium, type Page } from "playwright";
import type { BrowserEntry, BrowserInfo, PageEntry, PageInfo } from "./types";
import {
	STEALTH_ARGS,
	STEALTH_VIEWPORT,
	STEALTH_INIT_SCRIPT,
	getRealisticUserAgent,
} from "../stealth";

export interface StartBrowserOptions {
	headless?: boolean;
	url?: string;
	stealth?: boolean;
}

export interface StartBrowserResult {
	browserId: string;
	pageId: string;
	url: string;
}

export interface NewPageResult {
	pageId: string;
	browserId: string;
	url: string;
	title: string;
}

export interface CloseBrowserResult {
	success: true;
	closedPages: string[];
}

export interface ClosePageResult {
	success: true;
}

export class BrowserSessionManager {
	private browsers = new Map<string, BrowserEntry>();
	private pages = new Map<string, PageEntry>();
	private browserCounter = 0;
	private pageCounter = 0;

	private nextBrowserId(): string {
		return `b${++this.browserCounter}`;
	}

	private nextPageId(): string {
		return `p${++this.pageCounter}`;
	}

	async startBrowser(options: StartBrowserOptions = {}): Promise<StartBrowserResult> {
		const { headless = true, url, stealth = true } = options;

		// Launch with stealth args if enabled
		const browser = await chromium.launch({
			headless,
			args: stealth ? STEALTH_ARGS : [],
		});

		// Create context with realistic settings if stealth enabled
		const context = await browser.newContext(
			stealth
				? {
						viewport: STEALTH_VIEWPORT,
						userAgent: getRealisticUserAgent(),
						locale: "en-US",
						timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
					}
				: {},
		);

		// Inject stealth scripts before any page loads
		if (stealth) {
			await context.addInitScript(STEALTH_INIT_SCRIPT);
		}

		const page = await context.newPage();

		const browserId = this.nextBrowserId();
		const pageId = this.nextPageId();

		this.browsers.set(browserId, { browser, context, headless });
		this.pages.set(pageId, { page, browserId });

		if (url) {
			await page.goto(url);
		}

		return {
			browserId,
			pageId,
			url: page.url(),
		};
	}

	async closeBrowser(browserId: string): Promise<CloseBrowserResult> {
		const entry = this.browsers.get(browserId);
		if (!entry) {
			throw new Error(`Browser ${browserId} not found`);
		}

		// Find and remove all pages for this browser
		const closedPages: string[] = [];
		for (const [pageId, pageEntry] of this.pages) {
			if (pageEntry.browserId === browserId) {
				closedPages.push(pageId);
				this.pages.delete(pageId);
			}
		}

		await entry.browser.close();
		this.browsers.delete(browserId);

		return { success: true, closedPages };
	}

	listBrowsers(): BrowserInfo[] {
		const result: BrowserInfo[] = [];

		for (const [id, entry] of this.browsers) {
			const pageIds: string[] = [];
			for (const [pageId, pageEntry] of this.pages) {
				if (pageEntry.browserId === id) {
					pageIds.push(pageId);
				}
			}
			result.push({
				id,
				headless: entry.headless,
				pageIds,
			});
		}

		return result;
	}

	async newPage(browserId: string, url?: string): Promise<NewPageResult> {
		const entry = this.browsers.get(browserId);
		if (!entry) {
			throw new Error(`Browser ${browserId} not found`);
		}

		const page = await entry.context.newPage();
		const pageId = this.nextPageId();

		this.pages.set(pageId, { page, browserId });

		if (url) {
			await page.goto(url);
		}

		return {
			pageId,
			browserId,
			url: page.url(),
			title: await page.title(),
		};
	}

	async closePage(pageId: string): Promise<ClosePageResult> {
		const entry = this.pages.get(pageId);
		if (!entry) {
			throw new Error(`Page ${pageId} not found`);
		}

		await entry.page.close();
		this.pages.delete(pageId);

		return { success: true };
	}

	listPages(browserId?: string): PageInfo[] {
		const result: PageInfo[] = [];

		for (const [id, entry] of this.pages) {
			if (browserId && entry.browserId !== browserId) {
				continue;
			}
			result.push({
				id,
				browserId: entry.browserId,
				url: entry.page.url(),
				title: "", // Title requires async, we'll handle this in gadgets
			});
		}

		return result;
	}

	getPage(pageId: string): Page | undefined {
		return this.pages.get(pageId)?.page;
	}

	requirePage(pageId: string): Page {
		const page = this.getPage(pageId);
		if (!page) {
			throw new Error(`Page ${pageId} not found`);
		}
		return page;
	}

	getBrowserIdForPage(pageId: string): string | undefined {
		return this.pages.get(pageId)?.browserId;
	}

	async closeAll(): Promise<void> {
		for (const [, entry] of this.browsers) {
			await entry.browser.close();
		}
		this.browsers.clear();
		this.pages.clear();
	}
}

// Singleton instance
let instance: BrowserSessionManager | null = null;

export function getSessionManager(): BrowserSessionManager {
	if (!instance) {
		instance = new BrowserSessionManager();
	}
	return instance;
}

export function resetSessionManager(): void {
	instance = null;
}
