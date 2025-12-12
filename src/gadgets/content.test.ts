import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { testGadget } from "llmist/testing";
import { BrowserSessionManager } from "../session";
import { StartBrowser } from "./browser";
import { GetPageContent, ListInteractiveElements, Screenshot } from "./content";
import { Navigate } from "./navigation";

const TEST_HTML = `
<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
  <h1>Hello World</h1>
  <p>This is a test paragraph.</p>
  <button id="btn1">Click Me</button>
  <a href="https://example.com">Example Link</a>
  <input type="text" id="input1" placeholder="Enter text">
  <select id="select1">
    <option value="a">Option A</option>
    <option value="b">Option B</option>
  </select>
  <textarea id="textarea1">Some text</textarea>
</body>
</html>
`;

describe("Content Gadgets", () => {
	let manager: BrowserSessionManager;
	let pageId: string;

	beforeAll(async () => {
		manager = new BrowserSessionManager();
		const startGadget = new StartBrowser(manager);
		const result = await testGadget(startGadget, {});
		const parsed = JSON.parse(result.result!);
		pageId = parsed.pageId;

		// Navigate to test page
		const navGadget = new Navigate(manager);
		await testGadget(navGadget, {
			pageId,
			url: `data:text/html,${encodeURIComponent(TEST_HTML)}`,
		});
	});

	afterAll(async () => {
		await manager.closeAll();
	});

	describe("GetPageContent", () => {
		it("should get page text content", async () => {
			const gadget = new GetPageContent(manager);
			const result = await testGadget(gadget, { pageId });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.text).toContain("Hello World");
			expect(parsed.text).toContain("test paragraph");
		});

		it("should get content from specific selector", async () => {
			const gadget = new GetPageContent(manager);
			const result = await testGadget(gadget, {
				pageId,
				selector: "h1",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.text).toBe("Hello World");
		});

		it("should return error for non-existent page", async () => {
			const gadget = new GetPageContent(manager);
			const result = await testGadget(gadget, { pageId: "p999" });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.error).toContain("not found");
		});
	});

	describe("Screenshot", () => {
		it("should take a screenshot with media output", async () => {
			const gadget = new Screenshot(manager);
			// Call execute directly to get the full result with media
			const result = await gadget.execute({ pageId, fullPage: false, selector: undefined });

			// result is GadgetExecuteResultWithMedia
			expect(typeof result).toBe("object");
			expect(result).not.toBe(null);

			const mediaResult = result as {
				result: string;
				media: Array<{ kind: string; mimeType: string; data: string }>;
			};

			const parsed = JSON.parse(mediaResult.result);
			expect(parsed.success).toBe(true);
			expect(parsed.viewport).toBeDefined();

			// Check media output
			expect(mediaResult.media).toBeDefined();
			expect(mediaResult.media.length).toBe(1);
			expect(mediaResult.media[0].kind).toBe("image");
			expect(mediaResult.media[0].mimeType).toBe("image/png");
			expect(mediaResult.media[0].data).toBeDefined();
		});

		it("should take full page screenshot with media output", async () => {
			const gadget = new Screenshot(manager);
			const result = await gadget.execute({ pageId, fullPage: true, selector: undefined });

			const mediaResult = result as {
				result: string;
				media: Array<{ kind: string; mimeType: string; data: string }>;
			};

			const parsed = JSON.parse(mediaResult.result);
			expect(parsed.success).toBe(true);
			expect(parsed.fullPage).toBe(true);
			expect(mediaResult.media).toBeDefined();
			expect(mediaResult.media[0].data).toBeDefined();
		});
	});

	describe("ListInteractiveElements", () => {
		it("should list all interactive elements", async () => {
			const gadget = new ListInteractiveElements(manager);
			const result = await testGadget(gadget, { pageId });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.elements).toBeInstanceOf(Array);
			expect(parsed.elements.length).toBeGreaterThanOrEqual(5);

			// Should have button, link, input, select, textarea
			const types = parsed.elements.map((e: { type: string }) => e.type);
			expect(types).toContain("button");
			expect(types).toContain("link");
			expect(types).toContain("input");
			expect(types).toContain("select");
			expect(types).toContain("textarea");
		});

		it("should return error for non-existent page", async () => {
			const gadget = new ListInteractiveElements(manager);
			const result = await testGadget(gadget, { pageId: "p999" });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.error).toContain("not found");
		});

		it("should filter elements by type", async () => {
			const gadget = new ListInteractiveElements(manager);
			const result = await testGadget(gadget, {
				pageId,
				types: ["button", "link"],
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(
				parsed.elements.every((e: { type: string }) => ["button", "link"].includes(e.type)),
			).toBe(true);
		});
	});
});
