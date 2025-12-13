/**
 * Test-only browser session manager using vanilla playwright-core.
 * This bypasses camoufox-js to avoid better-sqlite3 compatibility issues with Bun.
 */
import { chromium, type Page, type Browser, type BrowserContext } from "playwright-core";
import type { BrowserInfo, PageInfo } from "./types";
import type { StartBrowserOptions, StartBrowserResult, NewPageResult, CloseBrowserResult, ClosePageResult } from "./manager";

interface BrowserEntry {
	browser: Browser;
	context: BrowserContext;
	headless: boolean;
}

interface PageEntry {
	page: Page;
	browserId: string;
}

/**
 * Browser session manager for tests using vanilla playwright-core (chromium).
 * API-compatible with BrowserSessionManager.
 */
export class TestBrowserSessionManager {
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
		const { headless = true, url } = options;

		const browser = await chromium.launch({ headless });
		const context = await browser.newContext();
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
				title: "",
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
