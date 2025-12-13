import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { testGadget } from "llmist/testing";
import { TestBrowserSessionManager } from "../session/test-manager";
import { GoBack, GoForward, Navigate, Reload } from "./navigation";

describe("Navigation Gadgets", () => {
	let manager: TestBrowserSessionManager;
	let pageId: string;

	beforeAll(async () => {
		manager = new TestBrowserSessionManager();
		const result = await manager.startBrowser({ headless: true });
		pageId = result.pageId;
	});

	afterAll(async () => {
		await manager.closeAll();
	});

	describe("Navigate", () => {
		it("should navigate to a URL", async () => {
			const gadget = new Navigate(manager);
			const result = await testGadget(gadget, {
				pageId,
				url: "data:text/html,<h1>Hello</h1>",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.url).toContain("data:text/html");
		});

		it("should return error for non-existent page", async () => {
			const gadget = new Navigate(manager);
			const result = await testGadget(gadget, {
				pageId: "p999",
				url: "data:text/html,<h1>Test</h1>",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.error).toContain("not found");
		});
	});

	describe("GoBack", () => {
		it("should go back in history and set navigated=true", async () => {
			// Navigate to create history
			const navGadget = new Navigate(manager);
			await testGadget(navGadget, {
				pageId,
				url: "data:text/html,<h1>Page1</h1>",
			});
			await testGadget(navGadget, {
				pageId,
				url: "data:text/html,<h1>Page2</h1>",
			});

			const gadget = new GoBack(manager);
			const result = await testGadget(gadget, { pageId });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.url).toContain("Page1");
			expect(parsed.navigated).toBe(true);
		});

		it("should return error when no history to go back to", async () => {
			// Create a new page with no history
			const newPage = await manager.newPage(
				manager.getBrowserIdForPage(pageId)!,
			);
			// Don't navigate - keep it at about:blank with no history

			const gadget = new GoBack(manager);
			const result = await testGadget(gadget, { pageId: newPage.pageId });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			// When there's no history, GoBack should report it
			// Check that either error is set OR navigated is false
			if (parsed.error) {
				expect(parsed.error).toBe("No history to go back to");
			} else {
				expect(parsed.navigated).toBe(false);
			}

			// Clean up
			await manager.closePage(newPage.pageId);
		});
	});

	describe("GoForward", () => {
		it("should go forward in history after going back", async () => {
			// Create history
			const navGadget = new Navigate(manager);
			await testGadget(navGadget, {
				pageId,
				url: "data:text/html,<h1>PageA</h1>",
			});
			await testGadget(navGadget, {
				pageId,
				url: "data:text/html,<h1>PageB</h1>",
			});

			// Go back first
			const backGadget = new GoBack(manager);
			await testGadget(backGadget, { pageId });

			// Now go forward
			const gadget = new GoForward(manager);
			const result = await testGadget(gadget, { pageId });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.url).toContain("PageB");
			expect(parsed.navigated).toBe(true);
		});

		it("should return error when no forward history", async () => {
			// Create a new page with no forward history
			const newPage = await manager.newPage(manager.getBrowserIdForPage(pageId)!);

			const gadget = new GoForward(manager);
			const result = await testGadget(gadget, { pageId: newPage.pageId });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			// When there's no forward history, should report it
			if (parsed.error) {
				expect(parsed.error).toBe("No forward history");
			} else {
				expect(parsed.navigated).toBe(false);
			}

			// Clean up
			await manager.closePage(newPage.pageId);
		});
	});

	describe("Reload", () => {
		it("should reload the page", async () => {
			const gadget = new Reload(manager);
			const result = await testGadget(gadget, { pageId });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.success).toBe(true);
		});
	});
});
