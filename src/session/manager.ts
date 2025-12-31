import type { LaunchOptions as CamoufoxOptions } from "camoufox-js";
import type { Browser, Page } from "playwright-core";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// Lazy-loaded to avoid loading browser automation code until needed
let CamoufoxModule: typeof import("camoufox-js") | null = null;

async function loadCamoufox(): Promise<typeof import("camoufox-js").Camoufox> {
	if (CamoufoxModule === null) {
		CamoufoxModule = await import("camoufox-js");
	}
	return CamoufoxModule.Camoufox;
}

import { defaultLogger } from "llmist";
import type { BrowserEntry, BrowserInfo, PageEntry, PageInfo } from "./types";

// Logger type - compatible with both llmist's defaultLogger and console
type Logger = {
	debug: (...args: unknown[]) => void;
	warn?: (...args: unknown[]) => void;
	info?: (...args: unknown[]) => void;
};

/**
 * Get the platform-specific cache directory for Camoufox
 * Matches the logic in camoufox-js/dist/pkgman.js
 */
function getCamoufoxCacheDir(): string {
	const platform = os.platform();
	if (platform === "win32") {
		return path.join(os.homedir(), "AppData", "Local", "camoufox", "camoufox", "Cache");
	} else if (platform === "darwin") {
		return path.join(os.homedir(), "Library", "Caches", "camoufox");
	} else {
		return path.join(os.homedir(), ".cache", "camoufox");
	}
}

/**
 * Check if camoufox browser binary is installed
 */
function isCamoufoxInstalled(): boolean {
	const cacheDir = getCamoufoxCacheDir();
	const versionFile = path.join(cacheDir, "version.json");
	return fs.existsSync(versionFile);
}

// Singleton promise to prevent concurrent installations
let browserInstallPromise: Promise<void> | null = null;

/**
 * Ensure camoufox browser is installed, downloading if necessary
 * Uses singleton pattern to prevent concurrent downloads
 */
async function ensureCamoufoxInstalled(logger: Logger): Promise<void> {
	// Return existing promise if installation is in progress
	if (browserInstallPromise) {
		return browserInstallPromise;
	}

	// Quick check - already installed
	if (isCamoufoxInstalled()) {
		logger.debug?.("[dhalsim] Camoufox browser already installed");
		return;
	}

	// Start installation
	browserInstallPromise = performCamoufoxInstall(logger);

	try {
		await browserInstallPromise;
	} finally {
		// Clear promise after completion (success or failure)
		browserInstallPromise = null;
	}
}

async function performCamoufoxInstall(logger: Logger): Promise<void> {
	const warn = logger.warn ?? logger.info ?? console.warn;

	warn.call(logger, "[dhalsim] ============================================");
	warn.call(logger, "[dhalsim] Camoufox browser not found. Starting download...");
	warn.call(logger, "[dhalsim] This is a one-time download (~1.3GB)");
	warn.call(logger, "[dhalsim] Future browser sessions will start immediately.");
	warn.call(logger, "[dhalsim] ============================================");

	try {
		// Dynamic import to avoid loading heavy modules until needed
		const { CamoufoxFetcher } = await import("camoufox-js/dist/pkgman.js");
		const fetcher = new CamoufoxFetcher();
		await fetcher.install();

		logger.debug?.("[dhalsim] Camoufox browser installed successfully");
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(
			`Failed to download Camoufox browser: ${errorMessage}\n` +
			"You can manually install by running: npx camoufox fetch"
		);
	}
}

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
	/** Disable browser cache to reduce memory usage */
	disableCache?: boolean;
	/** Navigation timeout in milliseconds (default: 60000) */
	navigationTimeoutMs?: number;
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
	private logger: Logger;

	constructor(logger?: Logger) {
		// Use provided logger or fall back to llmist's defaultLogger
		this.logger = logger ?? defaultLogger;
	}

	private nextBrowserId(): string {
		return `b${++this.browserCounter}`;
	}

	private nextPageId(): string {
		return `p${++this.pageCounter}`;
	}

	async startBrowser(options: StartBrowserOptions = {}): Promise<StartBrowserResult> {
		this.logger.debug(`[BrowserSessionManager] startBrowser headless=${options.headless ?? true} url=${options.url ?? "none"}`);
		const { headless = true, url, proxy, geoip = false, disableCache = false, navigationTimeoutMs = 60000 } = options;

		// Ensure camoufox browser is installed (lazy download if needed)
		await ensureCamoufoxInstalled(this.logger);

		const BROWSER_LAUNCH_TIMEOUT = 30000; // 30s timeout
		const MAX_RETRIES = 2;
		const RETRY_DELAY = 1000; // 1s between retries

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
			// Disable cache to reduce memory usage (helps prevent OOM in resource-constrained environments)
			...(disableCache && { enable_cache: false }),
		};

		// Launch Camoufox with timeout and retry logic
		// This handles transient resource contention when browsers are started sequentially
		const Camoufox = await loadCamoufox();
		let browser: Browser;
		for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
			try {
				browser = await Promise.race([
					Camoufox(camoufoxOptions),
					new Promise<never>((_, reject) =>
						setTimeout(() => reject(new Error("Browser launch timeout")), BROWSER_LAUNCH_TIMEOUT),
					),
				]);
				break; // Success, exit retry loop
			} catch (error) {
				const isTimeout = error instanceof Error && error.message.includes("timeout");
				if (attempt < MAX_RETRIES && isTimeout) {
					this.logger.debug(`[BrowserSessionManager] Browser launch timed out, retrying (${attempt + 1}/${MAX_RETRIES})...`);
					await new Promise((r) => setTimeout(r, RETRY_DELAY));
				} else {
					throw error;
				}
			}
		}

		// Get the default context (Camoufox creates one automatically)
		const contexts = browser!.contexts();
		const context = contexts[0] || (await browser!.newContext());
		const page = context.pages()[0] || (await context.newPage());

		const browserId = this.nextBrowserId();
		const pageId = this.nextPageId();

		this.browsers.set(browserId, { browser: browser!, context, headless });
		this.pages.set(pageId, { page, browserId });
		this.logger.debug(`[BrowserSessionManager] Browser started browserId=${browserId} pageId=${pageId}`);

		if (url) {
			await page.goto(url, { timeout: navigationTimeoutMs, waitUntil: "domcontentloaded" });
		}

		return {
			browserId,
			pageId,
			url: page.url(),
		};
	}

	async closeBrowser(browserId: string): Promise<CloseBrowserResult> {
		this.logger.debug(`[BrowserSessionManager] closeBrowser browserId=${browserId}`);
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
		this.logger.debug(`[BrowserSessionManager] Browser closed browserId=${browserId} closedPages=${closedPages.length}`);

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
		this.logger.debug(`[BrowserSessionManager] newPage browserId=${browserId} url=${url ?? "none"}`);
		const entry = this.browsers.get(browserId);
		if (!entry) {
			throw new Error(`Browser ${browserId} not found`);
		}

		const page = await entry.context.newPage();
		const pageId = this.nextPageId();

		this.pages.set(pageId, { page, browserId });
		this.logger.debug(`[BrowserSessionManager] Page created pageId=${pageId}`);


		if (url) {
			await page.goto(url, { timeout: 60000, waitUntil: "domcontentloaded" });
		}

		return {
			pageId,
			browserId,
			url: page.url(),
			title: await page.title(),
		};
	}

	async closePage(pageId: string): Promise<ClosePageResult> {
		this.logger.debug(`[BrowserSessionManager] closePage pageId=${pageId}`);
		const entry = this.pages.get(pageId);
		if (!entry) {
			throw new Error(`Page ${pageId} not found`);
		}

		await entry.page.close();
		this.pages.delete(pageId);
		this.logger.debug(`[BrowserSessionManager] Page closed pageId=${pageId}`);

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
		this.logger.debug(`[BrowserSessionManager] closeAll browsers=${this.browsers.size} pages=${this.pages.size}`);
		const CLOSE_TIMEOUT_MS = 5000;

		const closePromises = Array.from(this.browsers.values()).map(async (entry) => {
			try {
				// Close context first - browser.close() is like "pulling the power cord"
				// and won't properly clean up contexts
				// See: https://github.com/microsoft/playwright/issues/15163
				await entry.context.close();
			} catch (error) {
				this.logger.debug(`[BrowserSessionManager] Context close error (continuing):`, error);
			}

			try {
				const closePromise = entry.browser.close();
				const timeoutPromise = new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error("Browser close timeout")), CLOSE_TIMEOUT_MS),
				);

				await Promise.race([closePromise, timeoutPromise]);
			} catch (error) {
				this.logger.debug(`[BrowserSessionManager] Browser close error (continuing):`, error);
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
