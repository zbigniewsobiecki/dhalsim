import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { testGadget } from "llmist/testing";
import { TestBrowserSessionManager } from "../session/test-manager";
import { Navigate } from "./navigation";
import { ExecuteScript } from "./script";

describe("Script Gadgets", () => {
	let manager: TestBrowserSessionManager;
	let pageId: string;

	beforeAll(async () => {
		manager = new TestBrowserSessionManager();
		const result = await manager.startBrowser({ headless: true });
		pageId = result.pageId;

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

		it("should capture console.log output", async () => {
			const gadget = new ExecuteScript(manager);
			const result = await testGadget(gadget, {
				pageId,
				script: `
					console.log('hello world');
					return 42;
				`,
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.result).toBe(42);
			expect(parsed.console).toBeDefined();
			expect(parsed.console).toContain("[log] hello world");
		});

		it("should capture multiple console types", async () => {
			const gadget = new ExecuteScript(manager);
			const result = await testGadget(gadget, {
				pageId,
				script: `
					console.log('info message');
					console.warn('warning message');
					console.error('error message');
					return 'done';
				`,
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.console).toContain("[log] info message");
			expect(parsed.console).toContain("[warning] warning message");
			expect(parsed.console).toContain("[error] error message");
		});

		it("should capture console output even when script throws", async () => {
			const gadget = new ExecuteScript(manager);
			const result = await testGadget(gadget, {
				pageId,
				script: `
					console.log('before error');
					throw new Error('oops');
				`,
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.error).toContain("oops");
			expect(parsed.console).toContain("[log] before error");
		});

		it("should not include console field when no logs", async () => {
			const gadget = new ExecuteScript(manager);
			const result = await testGadget(gadget, {
				pageId,
				script: "return 'silent'",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.result).toBe("silent");
			expect(parsed.console).toBeUndefined();
		});

		it("should truncate long console messages", async () => {
			const gadget = new ExecuteScript(manager);
			const longMessage = "x".repeat(1000);
			const result = await testGadget(gadget, {
				pageId,
				script: `console.log('${longMessage}'); return true;`,
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.console).toBeDefined();
			expect(parsed.console[0].length).toBeLessThan(600); // 500 + prefix + "..."
			expect(parsed.console[0]).toContain("...");
		});
	});
});
