import { Gadget, z } from "llmist";
import type { BrowserSessionManager } from "../session";

export class Navigate extends Gadget({
	description: "Navigate a page to a specific URL. Use ListPages to see available page IDs.",
	schema: z.object({
		pageId: z.string().describe("Page ID to navigate (e.g., 'p1')"),
		url: z.string().url().describe("URL to navigate to"),
		waitUntil: z
			.enum(["load", "domcontentloaded", "networkidle"])
			.default("networkidle")
			.describe("When to consider navigation finished (default: networkidle)"),
	}),
	examples: [
		{
			params: { pageId: "p1", url: "https://example.com", waitUntil: "networkidle" },
			output: '{"url":"https://example.com/","title":"Example Domain"}',
			comment: "Navigate to example.com",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			await page.goto(params.url, { waitUntil: params.waitUntil });
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

export class GoBack extends Gadget({
	description: "Navigate back in the browser history (like clicking the back button).",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
	}),
	examples: [
		{
			params: { pageId: "p1" },
			output: '{"url":"https://previous-page.com/","title":"Previous Page"}',
			comment: "Go back to previous page",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			await page.goBack();
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

export class GoForward extends Gadget({
	description: "Navigate forward in the browser history (like clicking the forward button).",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
	}),
	examples: [
		{
			params: { pageId: "p1" },
			output: '{"url":"https://next-page.com/","title":"Next Page"}',
			comment: "Go forward to next page",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			await page.goForward();
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

export class Reload extends Gadget({
	description: "Reload the current page.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		waitUntil: z
			.enum(["load", "domcontentloaded", "networkidle"])
			.default("networkidle")
			.describe("When to consider reload finished (default: networkidle)"),
	}),
	examples: [
		{
			params: { pageId: "p1", waitUntil: "networkidle" },
			output: '{"success":true,"url":"https://example.com/","title":"Example Domain"}',
			comment: "Reload the page",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			await page.reload({ waitUntil: params.waitUntil });
			return JSON.stringify({
				success: true,
				url: page.url(),
				title: await page.title(),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
		}
	}
}
