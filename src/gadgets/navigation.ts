import { Gadget, z, defaultLogger as logger, getErrorMessage } from "llmist";
import type { IBrowserSessionManager } from "../session";

export class Navigate extends Gadget({
	description: "Navigate a page to a specific URL.",
	schema: z.object({
		pageId: z.string().describe("Page ID to navigate (e.g., 'p1')"),
		url: z.string().url().describe("URL to navigate to"),
	}),
	examples: [
		{
			params: { pageId: "p1", url: "https://example.com" },
			output: '{"url":"https://example.com/","title":"Example Domain"}',
			comment: "Navigate to example.com",
		},
		{
			params: { pageId: "p1", url: "https://github.com/login" },
			output: '{"url":"https://github.com/login","title":"Sign in to GitHub"}',
			comment: "Navigate to login page",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		logger.debug(`[Navigate] pageId=${params.pageId} url="${params.url}"`);
		try {
			const page = this.manager.requirePage(params.pageId);

			// Skip navigation if already on the target URL (avoid wasted calls)
			const currentUrl = page.url();
			logger.debug(`[Navigate] currentUrl="${currentUrl}"`);

			if (this.urlsMatch(currentUrl, params.url)) {
				return JSON.stringify({
					url: currentUrl,
					title: await page.title(),
					alreadyOnPage: true,
				});
			}

			await page.goto(params.url); // Uses Playwright default 'load'
			return JSON.stringify({
				url: page.url(),
				title: await page.title(),
			});
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}

	/**
	 * Compare URLs accounting for trailing slashes and minor differences.
	 */
	private urlsMatch(current: string, target: string): boolean {
		try {
			const normalize = (url: string) => {
				const parsed = new URL(url);
				// Remove trailing slash from pathname
				parsed.pathname = parsed.pathname.replace(/\/$/, "") || "/";
				return parsed.href;
			};
			return normalize(current) === normalize(target);
		} catch {
			// If URL parsing fails, do exact match
			return current === target;
		}
	}
}

export class GoBack extends Gadget({
	description:
		"Navigate back in the browser history (like clicking the back button). Returns error if no history exists.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
	}),
	examples: [
		{
			params: { pageId: "p1" },
			output: '{"url":"https://previous-page.com/","title":"Previous Page","navigated":true}',
			comment: "Go back to previous page",
		},
		{
			params: { pageId: "p1" },
			output: '{"error":"No history to go back to","url":"https://current-page.com/","title":"Current Page"}',
			comment: "No history available",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		logger.debug(`[GoBack] pageId=${params.pageId}`);
		try {
			const page = this.manager.requirePage(params.pageId);
			const urlBefore = page.url();

			const response = await page.goBack();

			const urlAfter = page.url();
			const title = await page.title();

			// Check if navigation actually happened
			if (response === null && urlBefore === urlAfter) {
				return JSON.stringify({
					error: "No history to go back to",
					url: urlAfter,
					title,
				});
			}

			return JSON.stringify({
				url: urlAfter,
				title,
				navigated: urlBefore !== urlAfter,
			});
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}

export class GoForward extends Gadget({
	description:
		"Navigate forward in the browser history (like clicking the forward button). Returns error if no forward history exists.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
	}),
	examples: [
		{
			params: { pageId: "p1" },
			output: '{"url":"https://next-page.com/","title":"Next Page","navigated":true}',
			comment: "Go forward to next page",
		},
		{
			params: { pageId: "p1" },
			output: '{"error":"No forward history","url":"https://current-page.com/","title":"Current Page"}',
			comment: "No forward history available",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		logger.debug(`[GoForward] pageId=${params.pageId}`);
		try {
			const page = this.manager.requirePage(params.pageId);
			const urlBefore = page.url();

			const response = await page.goForward();

			const urlAfter = page.url();
			const title = await page.title();

			// Check if navigation actually happened
			if (response === null && urlBefore === urlAfter) {
				return JSON.stringify({
					error: "No forward history",
					url: urlAfter,
					title,
				});
			}

			return JSON.stringify({
				url: urlAfter,
				title,
				navigated: urlBefore !== urlAfter,
			});
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}

export class Reload extends Gadget({
	description: "Reload the current page.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
	}),
	examples: [
		{
			params: { pageId: "p1" },
			output: '{"success":true,"url":"https://example.com/","title":"Example Domain"}',
			comment: "Reload the page",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		logger.debug(`[Reload] pageId=${params.pageId}`);
		try {
			const page = this.manager.requirePage(params.pageId);
			await page.reload(); // Uses Playwright default 'load'
			return JSON.stringify({
				success: true,
				url: page.url(),
				title: await page.title(),
			});
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}
