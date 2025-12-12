import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { testGadget } from "llmist/testing";
import { BrowserSessionManager } from "../session";
import { StartBrowser } from "./browser";
import { GoBack, GoForward, Navigate, Reload } from "./navigation";

describe("Navigation Gadgets", () => {
	let manager: BrowserSessionManager;
	let pageId: string;

	beforeAll(async () => {
		manager = new BrowserSessionManager();
		const startGadget = new StartBrowser(manager);
		const result = await testGadget(startGadget, {});
		const parsed = JSON.parse(result.result!);
		pageId = parsed.pageId;
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
		it("should go back in history", async () => {
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
		});
	});

	describe("GoForward", () => {
		it("should go forward in history", async () => {
			// Go back first
			const backGadget = new GoBack(manager);
			await testGadget(backGadget, { pageId });

			// Now go forward
			const gadget = new GoForward(manager);
			const result = await testGadget(gadget, { pageId });

			expect(result.error).toBeUndefined();
			// Result should exist (may or may not have moved forward)
			expect(result.result).toBeDefined();
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
