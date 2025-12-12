import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { testGadget } from "llmist/testing";
import { BrowserSessionManager } from "../session";
import { CloseBrowser, ListBrowsers, StartBrowser } from "./browser";

describe("Browser Gadgets", () => {
	let manager: BrowserSessionManager;

	beforeAll(() => {
		manager = new BrowserSessionManager();
	});

	afterAll(async () => {
		await manager.closeAll();
	});

	describe("StartBrowser", () => {
		it("should start a browser with default options", async () => {
			const gadget = new StartBrowser(manager);
			const result = await testGadget(gadget, {});

			expect(result.error).toBeUndefined();
			expect(result.result).toBeDefined();

			const parsed = JSON.parse(result.result!);
			expect(parsed.browserId).toMatch(/^b\d+$/);
			expect(parsed.pageId).toMatch(/^p\d+$/);
			expect(parsed.url).toBe("about:blank");
		});

		it("should start a browser with URL", async () => {
			const gadget = new StartBrowser(manager);
			const result = await testGadget(gadget, {
				url: "data:text/html,<h1>Hello</h1>",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.url).toContain("data:text/html");
		});
	});

	describe("ListBrowsers", () => {
		it("should list all browsers", async () => {
			const gadget = new ListBrowsers(manager);
			const result = await testGadget(gadget, {});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.browsers).toBeInstanceOf(Array);
			expect(parsed.browsers.length).toBeGreaterThan(0);
		});
	});

	describe("CloseBrowser", () => {
		it("should close a browser", async () => {
			// Start a fresh browser to close
			const startGadget = new StartBrowser(manager);
			const startResult = await testGadget(startGadget, {});
			const { browserId } = JSON.parse(startResult.result!);

			const closeGadget = new CloseBrowser(manager);
			const result = await testGadget(closeGadget, { browserId });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.success).toBe(true);
			expect(parsed.closedPages).toBeInstanceOf(Array);
		});

		it("should return error when closing non-existent browser", async () => {
			const gadget = new CloseBrowser(manager);
			const result = await testGadget(gadget, { browserId: "b999" });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.error).toContain("not found");
		});
	});
});
