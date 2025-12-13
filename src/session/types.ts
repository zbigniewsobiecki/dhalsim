import type { Browser, BrowserContext, Page } from "playwright-core";

export interface BrowserInfo {
	id: string;
	headless: boolean;
	pageIds: string[];
}

export interface PageInfo {
	id: string;
	browserId: string;
	url: string;
	title: string;
}

export interface BrowserEntry {
	browser: Browser;
	context: BrowserContext;
	headless: boolean;
}

export interface PageEntry {
	page: Page;
	browserId: string;
}

/**
 * Interface for browser session managers.
 * Both BrowserSessionManager and TestBrowserSessionManager implement this.
 */
export interface IBrowserSessionManager {
	getPage(pageId: string): Page | undefined;
	requirePage(pageId: string): Page;
	getBrowserIdForPage(pageId: string): string | undefined;
	listPages(browserId?: string): PageInfo[];
	listBrowsers(): BrowserInfo[];
	newPage(browserId: string, url?: string): Promise<{ pageId: string; browserId: string; url: string; title: string }>;
	closePage(pageId: string): Promise<{ success: true }>;
}
