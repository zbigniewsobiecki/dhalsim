import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { TestBrowserSessionManager } from "./test-manager";

describe("BrowserSessionManager", () => {
	// Use a single shared manager for faster tests
	let manager: TestBrowserSessionManager;
	let sharedBrowserId: string;
	let sharedPageId: string;

	beforeAll(async () => {
		manager = new TestBrowserSessionManager();
		// Start one shared browser for most tests
		const result = await manager.startBrowser({ headless: true });
		sharedBrowserId = result.browserId;
		sharedPageId = result.pageId;
	});

	afterAll(async () => {
		await manager.closeAll();
	});

	describe("browser management", () => {
		it("should have started with browser/page IDs", () => {
			expect(sharedBrowserId).toMatch(/^b\d+$/);
			expect(sharedPageId).toMatch(/^p\d+$/);
		});

		it("should list browsers", () => {
			const browsers = manager.listBrowsers();
			expect(browsers.length).toBeGreaterThanOrEqual(1);
			expect(browsers[0].pageIds.length).toBeGreaterThanOrEqual(1);
		});

		it("should throw when closing non-existent browser", async () => {
			await expect(manager.closeBrowser("b999")).rejects.toThrow("Browser b999 not found");
		});
	});

	describe("page management", () => {
		it("should open new page in existing browser", async () => {
			const page = await manager.newPage(sharedBrowserId);

			expect(page.pageId).toMatch(/^p\d+$/);
			expect(page.browserId).toBe(sharedBrowserId);
		});

		it("should open new page with URL", async () => {
			const page = await manager.newPage(sharedBrowserId, "data:text/html,<h1>Test</h1>");

			expect(page.url).toContain("data:text/html");
		});

		it("should throw when opening page in non-existent browser", async () => {
			await expect(manager.newPage("b999")).rejects.toThrow("Browser b999 not found");
		});

		it("should close a page", async () => {
			const { pageId: newPageId } = await manager.newPage(sharedBrowserId);
			const pagesBefore = manager.listPages().length;

			const result = await manager.closePage(newPageId);

			expect(result.success).toBe(true);
			expect(manager.listPages()).toHaveLength(pagesBefore - 1);
		});

		it("should throw when closing non-existent page", async () => {
			await expect(manager.closePage("p999")).rejects.toThrow("Page p999 not found");
		});

		it("should list all pages", () => {
			const pages = manager.listPages();
			expect(pages.length).toBeGreaterThanOrEqual(1);
		});

		it("should list pages filtered by browser", () => {
			const pages = manager.listPages(sharedBrowserId);

			expect(pages.length).toBeGreaterThanOrEqual(1);
			expect(pages.every((p) => p.browserId === sharedBrowserId)).toBe(true);
		});
	});

	describe("page access", () => {
		it("should get page by ID", () => {
			const page = manager.getPage(sharedPageId);
			expect(page).toBeDefined();
		});

		it("should return undefined for non-existent page", () => {
			const page = manager.getPage("p999");
			expect(page).toBeUndefined();
		});

		it("should require page and throw if not found", () => {
			const page = manager.requirePage(sharedPageId);
			expect(page).toBeDefined();

			expect(() => manager.requirePage("p999")).toThrow("Page p999 not found");
		});
	});
});

// Separate test suite for operations that need isolated browsers
describe("BrowserSessionManager - isolated operations", () => {
	it("should start browser with initial URL", async () => {
		const manager = new TestBrowserSessionManager();
		try {
			const result = await manager.startBrowser({
				headless: true,
				url: "data:text/html,<h1>Test</h1>",
			});

			expect(result.url).toContain("data:text/html");
		} finally {
			await manager.closeAll();
		}
	});

	it("should track multiple browsers and close them with their pages", async () => {
		const manager = new TestBrowserSessionManager();
		try {
			const b1 = await manager.startBrowser({ headless: true });
			const b2 = await manager.startBrowser({ headless: true });

			expect(b1.browserId).not.toBe(b2.browserId);
			expect(manager.listBrowsers()).toHaveLength(2);

			// Add extra page to b1
			await manager.newPage(b1.browserId);

			// Close b1
			const result = await manager.closeBrowser(b1.browserId);

			expect(result.success).toBe(true);
			expect(result.closedPages).toContain(b1.pageId);
			expect(result.closedPages).toHaveLength(2);
			expect(manager.listBrowsers()).toHaveLength(1);
		} finally {
			await manager.closeAll();
		}
	});

	it("should close all browsers", async () => {
		const manager = new TestBrowserSessionManager();
		try {
			await manager.startBrowser({ headless: true });
			await manager.startBrowser({ headless: true });

			await manager.closeAll();

			expect(manager.listBrowsers()).toHaveLength(0);
			expect(manager.listPages()).toHaveLength(0);
		} finally {
			// Already closed, but ensure cleanup
			await manager.closeAll();
		}
	});
});
