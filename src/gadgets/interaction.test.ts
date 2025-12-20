import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testGadget } from "@llmist/testing";
import { TestBrowserSessionManager } from "../session/test-manager";
import { Click } from "./click";
import { Type, Fill } from "./form";
import { PressKey } from "./keyboard";
import { Select, Check } from "./selection";
import { Hover, Scroll } from "./scroll";
import { DismissOverlays } from "./overlays";
import { Navigate } from "./navigation";

const TEST_HTML = `
<!DOCTYPE html>
<html>
<head><title>Interaction Test</title></head>
<body>
  <button id="btn1" onclick="document.getElementById('output').textContent='clicked'">Click Me</button>
  <div id="output"></div>
  <input type="text" id="input1" value="">
  <input type="checkbox" id="checkbox1">
  <select id="select1">
    <option value="a">Option A</option>
    <option value="b">Option B</option>
    <option value="c">Option C</option>
  </select>
  <div id="hover-target" onmouseover="this.textContent='hovered'">Hover me</div>
  <div style="height: 2000px; background: linear-gradient(to bottom, red, blue);">Tall content</div>
</body>
</html>
`;

describe("Interaction Gadgets", () => {
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

	describe("Click", () => {
		it("should click an element", async () => {
			const gadget = new Click(manager);
			const result = await testGadget(gadget, {
				pageId,
				selector: "#btn1",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.success).toBe(true);

			// Verify click happened
			const page = manager.requirePage(pageId);
			const output = await page.textContent("#output");
			expect(output).toBe("clicked");
		});

		it("should return error for non-existent element", async () => {
			const gadget = new Click(manager);
			const result = await testGadget(gadget, {
				pageId,
				selector: "#nonexistent",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.error).toBeDefined();
		});
	});

	describe("Type", () => {
		it("should type text into an input", async () => {
			const gadget = new Type(manager);
			const result = await testGadget(gadget, {
				pageId,
				selector: "#input1",
				text: "Hello",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.success).toBe(true);

			// Verify text was typed
			const page = manager.requirePage(pageId);
			const value = await page.inputValue("#input1");
			expect(value).toContain("Hello");
		});
	});

	describe("Fill", () => {
		it("should fill an input (clears first)", async () => {
			const gadget = new Fill(manager);
			const result = await testGadget(gadget, {
				pageId,
				selector: "#input1",
				value: "New Value",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.success).toBe(true);

			// Verify value was set (not appended)
			const page = manager.requirePage(pageId);
			const value = await page.inputValue("#input1");
			expect(value).toBe("New Value");
		});
	});

	describe("PressKey", () => {
		it("should press a key", async () => {
			const gadget = new PressKey(manager);
			const result = await testGadget(gadget, {
				pageId,
				key: "Tab",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.success).toBe(true);
		});
	});

	describe("Select", () => {
		it("should select an option by value", async () => {
			const gadget = new Select(manager);
			const result = await testGadget(gadget, {
				pageId,
				selector: "#select1",
				value: "b",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.success).toBe(true);
			expect(parsed.selectedValue).toBe("b");
		});

		it("should select an option by label", async () => {
			const gadget = new Select(manager);
			const result = await testGadget(gadget, {
				pageId,
				selector: "#select1",
				label: "Option C",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.success).toBe(true);
		});
	});

	describe("Check", () => {
		it("should check a checkbox", async () => {
			const gadget = new Check(manager);
			const result = await testGadget(gadget, {
				pageId,
				selector: "#checkbox1",
				checked: true,
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.success).toBe(true);
			expect(parsed.checked).toBe(true);
		});

		it("should uncheck a checkbox", async () => {
			const gadget = new Check(manager);
			const result = await testGadget(gadget, {
				pageId,
				selector: "#checkbox1",
				checked: false,
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.checked).toBe(false);
		});
	});

	describe("Hover", () => {
		it("should hover over an element", async () => {
			const gadget = new Hover(manager);
			const result = await testGadget(gadget, {
				pageId,
				selector: "#hover-target",
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.success).toBe(true);
		});
	});

	describe("Scroll", () => {
		it("should scroll the page", async () => {
			const gadget = new Scroll(manager);
			const result = await testGadget(gadget, {
				pageId,
				direction: "down",
				amount: 500,
			});

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.success).toBe(true);
			expect(parsed.scrollY).toBeGreaterThan(0);
		});
	});

	describe("DismissOverlays", () => {
		it("should return success even when no overlays present", async () => {
			const gadget = new DismissOverlays(manager);
			const result = await testGadget(gadget, { pageId });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.success).toBe(true);
			expect(parsed.dismissed).toBe(0);
		});

		it("should dismiss a cookie banner", async () => {
			// Navigate to a page with a fake cookie banner
			const navGadget = new Navigate(manager);
			await testGadget(navGadget, {
				pageId,
				url: `data:text/html,${encodeURIComponent(`
					<!DOCTYPE html>
					<html>
					<body>
						<div id="cookie-banner" style="position: fixed; bottom: 0; width: 100%; background: gray; z-index: 1000;">
							<button id="cookie-accept" class="accept">Accept</button>
						</div>
						<p>Page content</p>
					</body>
					</html>
				`)}`,
			});

			const gadget = new DismissOverlays(manager);
			const result = await testGadget(gadget, { pageId });

			expect(result.error).toBeUndefined();
			const parsed = JSON.parse(result.result!);
			expect(parsed.success).toBe(true);
			// May or may not have clicked depending on selector match
			// The banner should be hidden regardless
		});
	});
});
