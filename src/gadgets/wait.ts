import { Gadget, z } from "llmist";
import type { IBrowserSessionManager } from "../session";
import { selectorSchema } from "./selector-validator";

export class WaitForElement extends Gadget({
	description:
		"Waits for an element to reach a specific state (visible, hidden, attached, detached). Useful before interacting with dynamic content.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		selector: selectorSchema.describe("CSS selector of element to wait for"),
		state: z
			.enum(["visible", "hidden", "attached", "detached"])
			.default("visible")
			.describe("State to wait for"),
		timeout: z.number().default(30000).describe("Timeout in milliseconds"),
	}),
	examples: [
		{
			params: { pageId: "p1", selector: "#loading-spinner", state: "hidden", timeout: 30000 },
			output: '{"found":true}',
			comment: "Wait for loading spinner to disappear",
		},
		{
			params: { pageId: "p1", selector: "#results", state: "visible", timeout: 5000 },
			output: '{"found":true,"elementText":"Search results..."}',
			comment: "Wait for results to appear",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);

			await page.waitForSelector(params.selector, {
				state: params.state,
				timeout: params.timeout,
			});

			// Get element text if visible
			let elementText: string | undefined;
			if (params.state === "visible" || params.state === "attached") {
				const element = await page.$(params.selector);
				if (element) {
					elementText = ((await element.textContent()) || "").trim().slice(0, 100);
				}
			}

			return JSON.stringify({
				found: true,
				...(elementText ? { elementText } : {}),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
		}
	}
}

export class WaitForNavigation extends Gadget({
	description:
		"Waits for a navigation event to complete. Useful after clicking a link that causes page navigation.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		url: z.string().optional().describe("URL pattern to wait for (glob or regex)"),
		timeout: z.number().default(30000).describe("Timeout in milliseconds"),
	}),
	examples: [
		{
			params: { pageId: "p1", timeout: 30000 },
			output: '{"url":"https://example.com/new-page","title":"New Page"}',
			comment: "Wait for navigation to complete",
		},
		{
			params: { pageId: "p1", url: "**/success**", timeout: 30000 },
			output: '{"url":"https://example.com/success","title":"Success"}',
			comment: "Wait for specific URL pattern",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);

			await page.waitForURL(params.url || "**", {
				timeout: params.timeout,
			}); // Uses Playwright default 'load'

			return JSON.stringify({
				url: page.url(),
				title: await page.title(),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
		}
	}
}

export class Wait extends Gadget({
	description:
		"Waits for a specified amount of time. Use sparingly - prefer WaitForElement when possible.",
	schema: z.object({
		ms: z.number().min(0).max(30000).describe("Milliseconds to wait (max 30 seconds)"),
	}),
	examples: [
		{
			params: { ms: 1000 },
			output: '{"success":true,"waited":1000}',
			comment: "Wait for 1 second",
		},
	],
}) {
	// No manager needed for simple wait
	constructor(_manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		await new Promise((resolve) => setTimeout(resolve, params.ms));
		return JSON.stringify({ success: true, waited: params.ms });
	}
}
