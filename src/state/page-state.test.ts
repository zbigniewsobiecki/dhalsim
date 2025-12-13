import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestBrowserSessionManager } from "../session/test-manager";
import { PageStateScanner, DEFAULT_CONFIG, type FormatConfig } from "./page-state";
import type { BrowserSessionManager } from "../session";

const TEST_HTML = `
<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
  <h1>Hello World</h1>
  <p>This is test content for the scanner.</p>

  <form id="login-form">
    <input id="email" type="email" placeholder="Email address">
    <input name="password" type="password">
    <button data-testid="submit-btn">Login</button>
  </form>

  <a href="/register" aria-label="Register account">Sign up</a>
  <a href="/about">About Us</a>

  <select id="country">
    <option value="us">USA</option>
    <option value="uk">UK</option>
  </select>

  <textarea id="notes" placeholder="Enter notes">Some text</textarea>

  <!-- Hidden elements (should be skipped) -->
  <input type="hidden" name="csrf" value="token123">
  <button style="display:none">Hidden Button</button>

  <!-- Garbage IDs (should use fallback selectors) -->
  <button id="rc-btn-123">React Button</button>
  <input id=":r1:" type="text" placeholder="React ID Input">
  <button class="MuiButton-root">MUI Button</button>
</body>
</html>
`;

describe("PageStateScanner", () => {
	let manager: TestBrowserSessionManager;
	let scanner: PageStateScanner;
	let pageId: string;

	beforeAll(async () => {
		manager = new TestBrowserSessionManager();
		// Cast to BrowserSessionManager - API is compatible
		scanner = new PageStateScanner(manager as unknown as BrowserSessionManager);

		const result = await manager.startBrowser({ headless: true });
		pageId = result.pageId;

		// Navigate to test page
		const page = manager.getPage(pageId);
		await page?.goto(`data:text/html,${encodeURIComponent(TEST_HTML)}`);
		// Wait for page to be fully loaded
		await page?.waitForLoadState("domcontentloaded");
	});

	afterAll(async () => {
		await manager.closeAll();
	});

	// Note: No beforeEach reset needed - tests are read-only and don't modify page state
	// The beforeAll already sets up the page with the correct URL (data:text/html,...)

	describe("initialization and caching", () => {
		it("should return '[No browser open]' initially before any refresh", () => {
			const freshManager = new TestBrowserSessionManager();
			const freshScanner = new PageStateScanner(freshManager as unknown as BrowserSessionManager);
			expect(freshScanner.getCachedState()).toBe("[No browser open]");
		});

		it("should update cached state after refreshState()", async () => {
			await scanner.refreshState();
			const state = scanner.getCachedState();

			expect(state).toContain("=== PAGE:");
			expect(state).toContain("URL:");
			expect(state).toContain("Title:");
		});

		it("should handle concurrent refreshState() calls", async () => {
			// Call multiple times concurrently - should not error
			await Promise.all([scanner.refreshState(), scanner.refreshState(), scanner.refreshState()]);

			const state = scanner.getCachedState();
			expect(state).toContain("=== PAGE:");
		});
	});

	describe("scanAllPages()", () => {
		it("should return wrapped empty state when no browsers exist", async () => {
			const emptyManager = new TestBrowserSessionManager();
			const emptyScanner = new PageStateScanner(emptyManager as unknown as BrowserSessionManager);

			const state = await emptyScanner.scanAllPages();
			expect(state).toContain("<CurrentBrowserState>");
			expect(state).toContain("[No pages open]");
			expect(state).toContain("</CurrentBrowserState>");
		});

		it("should format state for single page wrapped in XML tags", async () => {
			const state = await scanner.scanAllPages();

			expect(state).toContain("<CurrentBrowserState>");
			expect(state).toContain(`=== PAGE: ${pageId} ===`);
			expect(state).toContain("data:text/html");
			expect(state).toContain("Title: Test Page");
			expect(state).toContain("</CurrentBrowserState>");
		});

		it("should handle multiple pages", async () => {
			const { pageId: page2Id } = await manager.newPage(
				manager.listBrowsers()[0].id,
				`data:text/html,${encodeURIComponent("<html><head><title>Page 2</title></head><body>Page 2</body></html>")}`,
			);

			const state = await scanner.scanAllPages();

			expect(state).toContain(`=== PAGE: ${pageId} ===`);
			expect(state).toContain(`=== PAGE: ${page2Id} ===`);
			expect(state).toContain("Title: Page 2");

			// Clean up
			await manager.closePage(page2Id);
		});
	});

	describe("format output structure", () => {
		it("should include page header with ID", async () => {
			const state = await scanner.scanAllPages();
			expect(state).toMatch(/=== PAGE: p\d+ ===/);
		});

		it("should include URL", async () => {
			const state = await scanner.scanAllPages();
			expect(state).toContain("URL: data:text/html");
		});

		it("should include Title", async () => {
			const state = await scanner.scanAllPages();
			expect(state).toContain("Title: Test Page");
		});

		it("should include CONTENT section by default", async () => {
			const state = await scanner.scanAllPages();
			expect(state).toContain("CONTENT:");
			expect(state).toContain("Hello World");
			expect(state).toContain("test content");
		});

		it("should include STRUCTURE section by default", async () => {
			const state = await scanner.scanAllPages();
			expect(state).toContain("STRUCTURE:");
			expect(state).toContain("<form#login-form>");
		});

		it("should include INPUTS section", async () => {
			const state = await scanner.scanAllPages();
			expect(state).toContain("INPUTS:");
		});

		it("should include BUTTONS section", async () => {
			const state = await scanner.scanAllPages();
			expect(state).toContain("BUTTONS:");
		});

		it("should include LINKS section", async () => {
			const state = await scanner.scanAllPages();
			expect(state).toContain("LINKS");
		});

		it("should include SELECTS section", async () => {
			const state = await scanner.scanAllPages();
			expect(state).toContain("SELECTS:");
		});

		it("should include TEXTAREAS section", async () => {
			const state = await scanner.scanAllPages();
			expect(state).toContain("TEXTAREAS:");
		});
	});

	describe("interactive elements detection", () => {
		it("should detect visible inputs with type and placeholder", async () => {
			const state = await scanner.scanAllPages();
			// Email input with id
			expect(state).toContain("#email");
			expect(state).toContain("[email]");
			// Password input with name
			expect(state).toContain('[name="password"]');
		});

		it("should detect visible buttons", async () => {
			const state = await scanner.scanAllPages();
			expect(state).toContain('[data-testid="submit-btn"]');
			expect(state).toContain('"Login"');
		});

		it("should detect visible links with href", async () => {
			const state = await scanner.scanAllPages();
			// /register link has aria-label, so it uses that
			// /about link has no aria-label, so it uses href
			expect(state).toContain('a[href="/about"]');
		});

		it("should detect visible selects", async () => {
			const state = await scanner.scanAllPages();
			expect(state).toContain("#country");
		});

		it("should detect visible textareas", async () => {
			const state = await scanner.scanAllPages();
			expect(state).toContain("#notes");
		});

		it("should skip hidden elements", async () => {
			const state = await scanner.scanAllPages();
			// Hidden input should not be in inputs (type=hidden is excluded by selector)
			expect(state).not.toContain('[name="csrf"]');
			// display:none button should be skipped (visibility check)
			expect(state).not.toContain("Hidden Button");
		});
	});

	describe("selector generation priority", () => {
		it("should prioritize data-testid", async () => {
			const state = await scanner.scanAllPages();
			// The submit button has data-testid="submit-btn"
			expect(state).toContain('[data-testid="submit-btn"]');
		});

		it("should use id for non-garbage IDs", async () => {
			const state = await scanner.scanAllPages();
			expect(state).toContain("#email");
			expect(state).toContain("#country");
			expect(state).toContain("#notes");
		});

		it("should fallback to name when no id", async () => {
			const state = await scanner.scanAllPages();
			expect(state).toContain('[name="password"]');
		});

		it("should use placeholder for inputs without id/name", async () => {
			const state = await scanner.scanAllPages();
			// The :r1: garbage ID input should fallback to placeholder
			expect(state).toContain('input[placeholder="React ID Input"]');
		});

		it("should use aria-label when available", async () => {
			const state = await scanner.scanAllPages();
			// Link with aria-label
			expect(state).toContain('[aria-label="Register account"]');
		});

		it("should skip garbage IDs (rc-, mui-, :r:)", async () => {
			const state = await scanner.scanAllPages();
			// Should NOT use garbage IDs as selectors
			expect(state).not.toContain("#rc-btn-123");
			expect(state).not.toContain("#:r1:");
		});
	});

	describe("configuration options", () => {
		it("should truncate content when maxContentLength is set", async () => {
			const config: FormatConfig = {
				maxContentLength: 50,
				includeStructure: true,
				includeSummary: true,
				maxLinks: 50,
			};
			const customScanner = new PageStateScanner(manager as unknown as BrowserSessionManager, config);
			const state = await customScanner.scanAllPages();

			// Content should be truncated and end with ...
			expect(state).toContain("...");
		});

		it("should omit structure when includeStructure is false", async () => {
			const config: FormatConfig = {
				maxContentLength: 0,
				includeStructure: false,
				includeSummary: true,
				maxLinks: 50,
			};
			const customScanner = new PageStateScanner(manager as unknown as BrowserSessionManager, config);
			const state = await customScanner.scanAllPages();

			expect(state).not.toContain("STRUCTURE:");
		});

		it("should omit content when includeSummary is false", async () => {
			const config: FormatConfig = {
				maxContentLength: 0,
				includeStructure: true,
				includeSummary: false,
				maxLinks: 50,
			};
			const customScanner = new PageStateScanner(manager as unknown as BrowserSessionManager, config);
			const state = await customScanner.scanAllPages();

			expect(state).not.toContain("CONTENT:");
		});

		it("should use DEFAULT_CONFIG when not specified", () => {
			expect(DEFAULT_CONFIG.maxContentLength).toBe(0);
			expect(DEFAULT_CONFIG.includeStructure).toBe(true);
			expect(DEFAULT_CONFIG.includeSummary).toBe(true);
			expect(DEFAULT_CONFIG.maxLinks).toBe(50);
		});

		it("should limit links when maxLinks is set", async () => {
			// Create a page with many links
			const manyLinksHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>Many Links</title></head>
				<body>
					${Array.from({ length: 100 }, (_, i) => `<a href="/link${i}">Link ${i}</a>`).join("\n")}
				</body>
				</html>
			`;
			const { pageId: testPageId } = await manager.newPage(
				manager.listBrowsers()[0].id,
				`data:text/html,${encodeURIComponent(manyLinksHtml)}`,
			);

			const config: FormatConfig = {
				maxContentLength: 0,
				includeStructure: true,
				includeSummary: true,
				maxLinks: 5,
			};
			const customScanner = new PageStateScanner(manager as unknown as BrowserSessionManager, config);
			const state = await customScanner.scanAllPages();

			// Should show total count
			expect(state).toContain("LINKS (100):");
			// Should show first 5 links
			expect(state).toContain('a[href="/link0"]');
			expect(state).toContain('a[href="/link4"]');
			// Should NOT show link 5+
			expect(state).not.toContain('a[href="/link5"]');
			// Should show hidden message
			expect(state).toContain("[95 more hidden - use GetFullPageContent for complete data]");

			// Clean up
			await manager.closePage(testPageId);
		});

		it("should show all links when maxLinks is 0", async () => {
			// Create a page with a few links
			const fewLinksHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>Few Links</title></head>
				<body>
					${Array.from({ length: 10 }, (_, i) => `<a href="/test${i}">Test ${i}</a>`).join("\n")}
				</body>
				</html>
			`;
			const { pageId: testPageId } = await manager.newPage(
				manager.listBrowsers()[0].id,
				`data:text/html,${encodeURIComponent(fewLinksHtml)}`,
			);

			const config: FormatConfig = {
				maxContentLength: 0,
				includeStructure: true,
				includeSummary: true,
				maxLinks: 0, // No limit
			};
			const customScanner = new PageStateScanner(manager as unknown as BrowserSessionManager, config);
			const state = await customScanner.scanAllPages();

			// Should show all 10 links
			expect(state).toContain("LINKS (10):");
			expect(state).toContain('a[href="/test9"]');
			expect(state).not.toContain("more links hidden");

			// Clean up
			await manager.closePage(testPageId);
		});

		it("should show DATA_ATTRIBUTES section with data-test values", async () => {
			// Create a page with data-test attributes
			const dataTestHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>Data Test</title></head>
				<body>
					<div data-test="offer-title">Job Title</div>
					<a data-test="link-offer" href="/job">Apply</a>
					<span data-test="salary-box">50k</span>
					<button data-test="submit-btn">Submit</button>
				</body>
				</html>
			`;
			const { pageId: testPageId } = await manager.newPage(
				manager.listBrowsers()[0].id,
				`data:text/html,${encodeURIComponent(dataTestHtml)}`,
			);

			const state = await scanner.scanAllPages();

			// Should show DATA_ATTRIBUTES section
			expect(state).toContain("DATA_ATTRIBUTES (4):");
			expect(state).toContain("link-offer");
			expect(state).toContain("offer-title");
			expect(state).toContain("salary-box");
			expect(state).toContain("submit-btn");

			// Clean up
			await manager.closePage(testPageId);
		});

		it("should limit DATA_ATTRIBUTES and show hint for more", async () => {
			// Create a page with many data-test attributes (more than 30)
			const manyAttrsHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>Many Attrs</title></head>
				<body>
					${Array.from({ length: 40 }, (_, i) => `<div data-test="attr-${String(i).padStart(2, "0")}">Item ${i}</div>`).join("\n")}
				</body>
				</html>
			`;
			const { pageId: testPageId } = await manager.newPage(
				manager.listBrowsers()[0].id,
				`data:text/html,${encodeURIComponent(manyAttrsHtml)}`,
			);

			const state = await scanner.scanAllPages();

			// Should show total count
			expect(state).toContain("DATA_ATTRIBUTES (40):");
			// Should show first 30 (sorted alphabetically)
			expect(state).toContain("attr-00");
			expect(state).toContain("attr-29");
			// Should show hint for more (which confirms attr-30+ are hidden)
			expect(state).toContain("[10 more - use GetFullPageContent with structure=true]");

			// Clean up
			await manager.closePage(testPageId);
		});
	});

	describe("collapsed sections detection", () => {
		it("should detect collapsed sections with aria-expanded=false and show their items", async () => {
			const collapsedHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>Collapsed Sections</title></head>
				<body>
					<button id="filter-toggle" aria-expanded="false" aria-controls="filter-panel">
						Filters
					</button>
					<div id="filter-panel" style="display:none;">
						<label><input type="checkbox" value="remote"> Remote work</label>
						<label><input type="checkbox" value="hybrid"> Hybrid</label>
						<label><input type="checkbox" value="onsite"> On-site</label>
					</div>
				</body>
				</html>
			`;
			const { pageId: testPageId } = await manager.newPage(
				manager.listBrowsers()[0].id,
				`data:text/html,${encodeURIComponent(collapsedHtml)}`,
			);

			const state = await scanner.scanAllPages();

			// Should show COLLAPSED SECTIONS
			expect(state).toContain("COLLAPSED SECTIONS");
			expect(state).toContain("#filter-toggle");
			expect(state).toContain("Filters");
			// Should show items inside the collapsed section
			expect(state).toContain("Remote work");
			expect(state).toContain("Hybrid");
			expect(state).toContain("On-site");

			// Clean up
			await manager.closePage(testPageId);
		});

		it("should detect collapsed sections using data-testid for toggle selector", async () => {
			const collapsedHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>Collapsed with data-testid</title></head>
				<body>
					<button data-testid="salary-toggle" aria-expanded="false" aria-controls="salary-options">
						Salary Range
					</button>
					<div id="salary-options" style="display:none;">
						<label><input type="checkbox"> $50k - $75k</label>
						<label><input type="checkbox"> $75k - $100k</label>
					</div>
				</body>
				</html>
			`;
			const { pageId: testPageId } = await manager.newPage(
				manager.listBrowsers()[0].id,
				`data:text/html,${encodeURIComponent(collapsedHtml)}`,
			);

			const state = await scanner.scanAllPages();

			// Should use data-testid as selector
			expect(state).toContain('[data-testid="salary-toggle"]');
			expect(state).toContain("Salary Range");

			// Clean up
			await manager.closePage(testPageId);
		});

		it("should not show COLLAPSED SECTIONS when none exist", async () => {
			const noCollapsedHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>No Collapsed</title></head>
				<body>
					<button aria-expanded="true">Already Expanded</button>
					<p>No collapsed sections here</p>
				</body>
				</html>
			`;
			const { pageId: testPageId } = await manager.newPage(
				manager.listBrowsers()[0].id,
				`data:text/html,${encodeURIComponent(noCollapsedHtml)}`,
			);

			const state = await scanner.scanAllPages();

			// Should NOT show COLLAPSED SECTIONS
			expect(state).not.toContain("COLLAPSED SECTIONS");

			// Clean up
			await manager.closePage(testPageId);
		});
	});

	describe("select options detection", () => {
		it("should show SELECT OPTIONS with available options from <select> elements", async () => {
			const selectHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>Select Options</title></head>
				<body>
					<label for="country-select">Country</label>
					<select id="country-select">
						<option value="">-- Select --</option>
						<option value="us">United States</option>
						<option value="uk">United Kingdom</option>
						<option value="de">Germany</option>
					</select>
				</body>
				</html>
			`;
			const { pageId: testPageId } = await manager.newPage(
				manager.listBrowsers()[0].id,
				`data:text/html,${encodeURIComponent(selectHtml)}`,
			);

			const state = await scanner.scanAllPages();

			// Should show SELECT OPTIONS section
			expect(state).toContain("SELECT OPTIONS");
			expect(state).toContain("#country-select");
			expect(state).toContain("Country");
			// Should list the options
			expect(state).toContain("United States");
			expect(state).toContain("United Kingdom");
			expect(state).toContain("Germany");

			// Clean up
			await manager.closePage(testPageId);
		});

		it("should use name attribute when no id for select", async () => {
			const selectHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>Select with name</title></head>
				<body>
					<select name="language">
						<option value="en">English</option>
						<option value="es">Spanish</option>
					</select>
				</body>
				</html>
			`;
			const { pageId: testPageId } = await manager.newPage(
				manager.listBrowsers()[0].id,
				`data:text/html,${encodeURIComponent(selectHtml)}`,
			);

			const state = await scanner.scanAllPages();

			// Should use name attribute
			expect(state).toContain('select[name="language"]');
			expect(state).toContain("English");
			expect(state).toContain("Spanish");

			// Clean up
			await manager.closePage(testPageId);
		});

		it("should skip placeholder options that match select/choose/--", async () => {
			const selectHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>Select with placeholder</title></head>
				<body>
					<select id="size">
						<option value="">Select size...</option>
						<option value="">-- Choose one --</option>
						<option value="s">Small</option>
						<option value="m">Medium</option>
					</select>
				</body>
				</html>
			`;
			const { pageId: testPageId } = await manager.newPage(
				manager.listBrowsers()[0].id,
				`data:text/html,${encodeURIComponent(selectHtml)}`,
			);

			const state = await scanner.scanAllPages();

			// Find the page section for this test page
			const pageSection = state.split("=== PAGE:").find((s) => s.includes("Select with placeholder"));
			expect(pageSection).toBeDefined();

			// The SELECT OPTIONS should only show Small, Medium (not the placeholder options)
			// The Options line should NOT contain "Select size" or "Choose one"
			const optionsLine = pageSection!.split("\n").find((l) => l.includes("Options:"));
			expect(optionsLine).toBeDefined();
			expect(optionsLine).not.toContain("Select size");
			expect(optionsLine).not.toContain("Choose one");
			expect(optionsLine).toContain("Small");
			expect(optionsLine).toContain("Medium");

			// Clean up
			await manager.closePage(testPageId);
		});

		it("should not show SELECT OPTIONS when no select elements exist", async () => {
			const noSelectHtml = `
				<!DOCTYPE html>
				<html>
				<head><title>No Selects</title></head>
				<body>
					<p>No select elements here</p>
				</body>
				</html>
			`;
			const { pageId: testPageId } = await manager.newPage(
				manager.listBrowsers()[0].id,
				`data:text/html,${encodeURIComponent(noSelectHtml)}`,
			);

			const state = await scanner.scanAllPages();

			// Find the page section for this test page
			const pageSection = state.split("=== PAGE:").find((s) => s.includes("No Selects"));
			expect(pageSection).toBeDefined();

			// This specific page should NOT have SELECT OPTIONS
			expect(pageSection).not.toContain("SELECT OPTIONS");

			// Clean up
			await manager.closePage(testPageId);
		});
	});
});
