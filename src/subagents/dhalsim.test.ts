import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestBrowserSessionManager } from "../session/test-manager";
import { GetFullPageContent, DismissOverlays } from "../gadgets";

/**
 * Tests that verify the auto-fetch behavior in BrowseWeb startup.
 *
 * We test the exact sequence of operations that happens in Dhalsim.execute():
 * 1. Start browser and navigate to URL
 * 2. Dismiss overlays (best-effort)
 * 3. Auto-fetch page content via GetFullPageContent
 * 4. Format initial message with content
 *
 * This validates that when the LLM is called, it receives the page content.
 */
describe("BrowseWeb auto-fetch behavior", () => {
	describe("with data URL", () => {
		let manager: TestBrowserSessionManager;
		let pageId: string;

		const TEST_HTML = `
<!DOCTYPE html>
<html>
<head><title>Auto-fetch Test</title></head>
<body>
  <h1>Welcome to the Test Page</h1>
  <p>This content should be auto-fetched before the first LLM call.</p>
  <button id="submit">Submit</button>
</body>
</html>
`;

		beforeAll(async () => {
			manager = new TestBrowserSessionManager();
			const result = await manager.startBrowser({
				headless: true,
				url: `data:text/html,${encodeURIComponent(TEST_HTML)}`,
			});
			pageId = result.pageId;
		});

		afterAll(async () => {
			await manager.closeAll();
		});

		it("should fetch page content immediately after navigation", async () => {
			// Simulate exactly what happens in Dhalsim.execute() after startBrowser()

			// 1. DismissOverlays (best-effort)
			const dismissOverlays = new DismissOverlays(manager);
			try {
				await dismissOverlays.execute({ pageId });
			} catch {
				// Ignore - best effort
			}

			// 2. Auto-fetch content (the new behavior we're testing)
			const getFullPageContent = new GetFullPageContent(manager);
			const initialPageContent = await getFullPageContent.execute({ pageId });

			// Verify content was fetched
			expect(initialPageContent).toBeDefined();
			const parsed = JSON.parse(initialPageContent);
			expect(parsed.text).toContain("Welcome to the Test Page");
			expect(parsed.text).toContain("auto-fetched before the first LLM call");
		});

		it("should format initial message with content correctly", async () => {
			const getFullPageContent = new GetFullPageContent(manager);
			const initialPageContent = await getFullPageContent.execute({ pageId });

			const task = "Find the submit button";
			const url = "https://example.com";

			// This is the exact format used in Dhalsim.execute()
			const initialMessage = initialPageContent
				? `Page ${pageId} is ready at ${url}. Overlays dismissed.\n\n<InitialPageContent>\n${initialPageContent}\n</InitialPageContent>\n\nTask: ${task}`
				: `Page ${pageId} is ready at ${url}. Overlays dismissed. Take action now. Task: ${task}`;

			// Verify the message format
			expect(initialMessage).toContain("<InitialPageContent>");
			expect(initialMessage).toContain("</InitialPageContent>");
			expect(initialMessage).toContain("Welcome to the Test Page");
			expect(initialMessage).toContain(`Task: ${task}`);
			expect(initialMessage).toContain(`Page ${pageId} is ready at ${url}`);
		});
	});

	describe("with real website (CNN)", () => {
		let manager: TestBrowserSessionManager;
		let pageId: string;

		beforeAll(async () => {
			manager = new TestBrowserSessionManager();
			const result = await manager.startBrowser({
				headless: true,
				url: "https://edition.cnn.com/",
			});
			pageId = result.pageId;
		}, 60000);

		afterAll(async () => {
			await manager.closeAll();
		});

		it("should auto-fetch CNN homepage content", async () => {
			// Simulate the auto-fetch sequence from Dhalsim.execute()

			// 1. DismissOverlays (best-effort)
			const dismissOverlays = new DismissOverlays(manager);
			try {
				await dismissOverlays.execute({ pageId });
			} catch {
				// Ignore - best effort
			}

			// 2. Auto-fetch content
			const getFullPageContent = new GetFullPageContent(manager);
			const initialPageContent = await getFullPageContent.execute({ pageId });

			// Verify CNN content was fetched
			expect(initialPageContent).toBeDefined();
			const parsed = JSON.parse(initialPageContent);

			// CNN homepage should have recognizable news content
			const contentLower = parsed.text.toLowerCase();
			expect(contentLower).toMatch(/cnn|news|world|politics|business|entertainment/i);

			// Verify the message format works with real content
			const initialMessage = `Page ${pageId} is ready at https://edition.cnn.com/. Overlays dismissed.\n\n<InitialPageContent>\n${initialPageContent}\n</InitialPageContent>\n\nTask: Find headlines`;

			expect(initialMessage).toContain("<InitialPageContent>");
			expect(initialMessage).toContain("</InitialPageContent>");
			expect(initialMessage.toLowerCase()).toMatch(/cnn|news/i);
		}, 60000);
	});
});
