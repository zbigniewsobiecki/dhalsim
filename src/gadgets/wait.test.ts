import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { testGadget } from "llmist/testing";
import { TestBrowserSessionManager } from "../session/test-manager";
import { Navigate } from "./navigation";
import { Wait, WaitForElement } from "./wait";

describe("Wait Gadgets", () => {
	let manager: TestBrowserSessionManager;
	let pageId: string;

	beforeAll(async () => {
		manager = new TestBrowserSessionManager();
		const result = await manager.startBrowser({ headless: true });
		pageId = result.pageId;

		const navGadget = new Navigate(manager);
		await testGadget(navGadget, {
			pageId,
			url: "data:text/html,<h1 id='visible'>Hello</h1><div id='hidden' style='display:none'>Hidden</div>",
		});
	});

	afterAll(async () => {
		await manager.closeAll();
	});

	describe("WaitForElement", () => {
		it("should wait for visible element", async () => {
			const gadget = new WaitForElement(manager);
			const result = await testGadget(gadget, {
				pageId,
				selector: "#visible",
				state: "visible",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.found).toBe(true);
		});

		it("should wait for hidden element", async () => {
			const gadget = new WaitForElement(manager);
			const result = await testGadget(gadget, {
				pageId,
				selector: "#hidden",
				state: "hidden",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.found).toBe(true);
		});

		it("should timeout for non-existent element", async () => {
			const gadget = new WaitForElement(manager);
			const result = await testGadget(gadget, {
				pageId,
				selector: "#nonexistent",
				timeout: 1000,
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.error).toContain("Timeout");
		});
	});

	describe("Wait", () => {
		it("should wait for specified milliseconds", async () => {
			const gadget = new Wait(manager);
			const start = Date.now();
			const result = await testGadget(gadget, { ms: 100 });
			const elapsed = Date.now() - start;

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.success).toBe(true);
			expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some tolerance
		});
	});
});
