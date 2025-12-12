import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { testGadget } from "llmist/testing";
import { BrowserSessionManager } from "../session";
import { StartBrowser } from "./browser";
import { Navigate } from "./navigation";
import { ExecuteScript } from "./script";

describe("Script Gadgets", () => {
	let manager: BrowserSessionManager;
	let pageId: string;

	beforeAll(async () => {
		manager = new BrowserSessionManager();
		const startGadget = new StartBrowser(manager);
		const result = await testGadget(startGadget, {});
		const parsed = JSON.parse(result.result!);
		pageId = parsed.pageId;

		const navGadget = new Navigate(manager);
		await testGadget(navGadget, {
			pageId,
			url: "data:text/html,<h1>Test</h1>",
		});
	});

	afterAll(async () => {
		await manager.closeAll();
	});

	describe("ExecuteScript", () => {
		it("should execute JavaScript and return result", async () => {
			const gadget = new ExecuteScript(manager);
			const result = await testGadget(gadget, {
				pageId,
				script: "return 2 + 2",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.result).toBe(4);
		});

		it("should access DOM", async () => {
			const gadget = new ExecuteScript(manager);
			const result = await testGadget(gadget, {
				pageId,
				script: "return document.querySelector('h1').textContent",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.result).toBe("Test");
		});

		it("should handle complex return values", async () => {
			const gadget = new ExecuteScript(manager);
			const result = await testGadget(gadget, {
				pageId,
				script: "return { title: document.title, url: window.location.href }",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.result).toHaveProperty("url");
		});

		it("should handle errors gracefully", async () => {
			const gadget = new ExecuteScript(manager);
			const result = await testGadget(gadget, {
				pageId,
				script: "throw new Error('test error')",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.error).toContain("test error");
		});
	});
});
