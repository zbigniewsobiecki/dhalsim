import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testGadget } from "@llmist/testing";
import { TestBrowserSessionManager } from "../session/test-manager";
import { GetFullPageContent, Screenshot } from "./content";
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
	let manager: TestBrowserSessionManager;
	let pageId: string;

	beforeAll(async () => {
		manager = new TestBrowserSessionManager();
		const result = await manager.startBrowser({ headless: true });
		pageId = result.pageId;

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

	// Reset page state before each test for isolation
	beforeEach(async () => {
		await manager.resetPage(pageId, TEST_HTML);
	});

	describe("GetFullPageContent", () => {
		it("should get page text content", async () => {
			const gadget = new GetFullPageContent(manager);
			const result = await testGadget(gadget, { pageId });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.text).toContain("Hello World");
			expect(parsed.text).toContain("test paragraph");
		});

		it("should get content from specific selector", async () => {
			const gadget = new GetFullPageContent(manager);
			const result = await testGadget(gadget, {
				pageId,
				selector: "h1",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.text).toBe("Hello World");
		});

		it("should return error for non-existent page", async () => {
			const gadget = new GetFullPageContent(manager);
			const result = await testGadget(gadget, { pageId: "p999" });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.error).toContain("not found");
		});

		it("should return DOM structure info when structure=true", async () => {
			// Create a page with data-test attributes and various elements
			const structureHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>Structure Test</title></head>
				<body>
					<section class="joblisting" data-test="section-job">
						<div class="jobcard" data-test="offer-title">Job Title</div>
						<a class="applybtn" data-test="link-offer" href="/apply">Apply</a>
					</section>
					<section class="sidebar">
						<div class="filterbox">Filters</div>
					</section>
					<button data-test="submit">Submit</button>
				</body>
				</html>
			`;

			const navGadget = new Navigate(manager);
			await testGadget(navGadget, {
				pageId,
				url: `data:text/html,${encodeURIComponent(structureHtml)}`,
			});

			const gadget = new GetFullPageContent(manager);
			const result = await testGadget(gadget, { pageId, structure: true });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);

			// Should have dataAttributes
			expect(parsed.dataAttributes).toBeDefined();
			expect(parsed.dataAttributes).toContain("link-offer");
			expect(parsed.dataAttributes).toContain("offer-title");
			expect(parsed.dataAttributes).toContain("section-job");
			expect(parsed.dataAttributes).toContain("submit");

			// Should have sampleClasses (check they exist, specific values may vary due to filtering)
			expect(parsed.sampleClasses).toBeDefined();
			expect(parsed.sampleClasses.section).toBeDefined();
			expect(parsed.sampleClasses.section.length).toBeGreaterThan(0);
			expect(parsed.sampleClasses.div).toBeDefined();
			expect(parsed.sampleClasses.div.length).toBeGreaterThan(0);

			// Should have elementCounts
			expect(parsed.elementCounts).toBeDefined();
			expect(parsed.elementCounts.section).toBe(2);
			expect(parsed.elementCounts.div).toBeGreaterThan(0);
			expect(parsed.elementCounts.button).toBe(1);
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
});
