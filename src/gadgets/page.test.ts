import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { testGadget } from "llmist/testing";
import { TestBrowserSessionManager } from "../session/test-manager";
import { ClosePage, ListPages, NewPage } from "./page";

describe("Page Gadgets", () => {
	let manager: TestBrowserSessionManager;
	let browserId: string;

	beforeAll(async () => {
		manager = new TestBrowserSessionManager();
		const result = await manager.startBrowser({ headless: true });
		browserId = result.browserId;
	});

	afterAll(async () => {
		await manager.closeAll();
	});

	describe("NewPage", () => {
		it("should open a new page in existing browser", async () => {
			const gadget = new NewPage(manager);
			const result = await testGadget(gadget, { browserId });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.pageId).toMatch(/^p\d+$/);
			expect(parsed.browserId).toBe(browserId);
			expect(parsed.url).toBe("about:blank");
		});

		it("should open a new page with URL", async () => {
			const gadget = new NewPage(manager);
			const result = await testGadget(gadget, {
				browserId,
				url: "data:text/html,<h1>Test</h1>",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.url).toContain("data:text/html");
		});

		it("should return error for non-existent browser", async () => {
			const gadget = new NewPage(manager);
			const result = await testGadget(gadget, { browserId: "b999" });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.error).toContain("not found");
		});
	});

	describe("ListPages", () => {
		it("should list all pages", async () => {
			const gadget = new ListPages(manager);
			const result = await testGadget(gadget, {});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.pages).toBeInstanceOf(Array);
			expect(parsed.pages.length).toBeGreaterThan(0);
		});

		it("should list pages filtered by browser", async () => {
			const gadget = new ListPages(manager);
			const result = await testGadget(gadget, { browserId });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.pages.every((p: { browserId: string }) => p.browserId === browserId)).toBe(
				true,
			);
		});
	});

	describe("ClosePage", () => {
		it("should close a page", async () => {
			// Create a page to close
			const newGadget = new NewPage(manager);
			const newResult = await testGadget(newGadget, { browserId });
			const { pageId } = JSON.parse(newResult.result!);

			const closeGadget = new ClosePage(manager);
			const result = await testGadget(closeGadget, { pageId });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.success).toBe(true);
		});

		it("should return error for non-existent page", async () => {
			const gadget = new ClosePage(manager);
			const result = await testGadget(gadget, { pageId: "p999" });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.error).toContain("not found");
		});
	});
});
