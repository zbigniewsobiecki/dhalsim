import { Camoufox, type LaunchOptions as CamoufoxOptions } from "camoufox-js";
import type { Page } from "playwright-core";
import type { BrowserEntry, BrowserInfo, PageEntry, PageInfo } from "./types";

export interface ProxyOptions {
	server: string;
	username?: string;
	password?: string;
}

export interface StartBrowserOptions {
	headless?: boolean;
	url?: string;
	/** Proxy server configuration */
	proxy?: ProxyOptions;
	/** Auto-detect timezone/locale from proxy IP */
	geoip?: boolean;
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
		const { headless = true, url, proxy, geoip = false } = options;

		const camoufoxOptions: CamoufoxOptions = {
			headless,
			humanize: true, // Human-like cursor movement
			block_webrtc: true, // Prevent WebRTC IP leaks
			geoip: geoip || !!proxy, // Auto-detect geo from IP if proxy set
			proxy: proxy
				? {
						server: proxy.server,
						username: proxy.username,
						password: proxy.password,
					}
				: undefined,
		};

		// Launch Camoufox (anti-detect Firefox)
		const browser = await Camoufox(camoufoxOptions);
		// Get the default context (Camoufox creates one automatically)
		const contexts = browser.contexts();
		const context = contexts[0] || (await browser.newContext());
		const page = context.pages()[0] || (await context.newPage());

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
		const CLOSE_TIMEOUT_MS = 5000;

		const closePromises = Array.from(this.browsers.values()).map(async (entry) => {
			try {
				await Promise.race([
					entry.browser.close(),
					new Promise<void>((_, reject) =>
						setTimeout(() => reject(new Error("Browser close timeout")), CLOSE_TIMEOUT_MS),
					),
				]);
			} catch {
				// Force continue if close hangs - the process will exit anyway
			}
		});

		await Promise.all(closePromises);
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
