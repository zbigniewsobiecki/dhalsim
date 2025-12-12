import type { Browser, BrowserContext, Page } from "playwright";

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
