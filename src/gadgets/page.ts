import { Gadget, z } from "llmist";
import type { IBrowserSessionManager } from "../session";
import { getErrorMessage } from "../utils/errors";

export class NewPage extends Gadget({
	description:
		"Opens a new page (tab) in an existing browser. Use ListBrowsers to see available browser IDs.",
	schema: z.object({
		browserId: z.string().describe("Browser ID to open page in (e.g., 'b1')"),
		url: z.string().url().optional().describe("Initial URL to navigate to"),
	}),
	examples: [
		{
			params: { browserId: "b1" },
			output: '{"pageId":"p2","browserId":"b1","url":"about:blank","title":""}',
			comment: "Open a blank page in browser b1",
		},
		{
			params: { browserId: "b1", url: "https://example.com" },
			output:
				'{"pageId":"p2","browserId":"b1","url":"https://example.com/","title":"Example Domain"}',
			comment: "Open a page with URL",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const result = await this.manager.newPage(params.browserId, params.url);
			return JSON.stringify(result);
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}

export class ClosePage extends Gadget({
	description: "Closes a specific page (tab). Use ListPages to see available page IDs.",
	schema: z.object({
		pageId: z.string().describe("Page ID to close (e.g., 'p1')"),
	}),
	examples: [
		{
			params: { pageId: "p1" },
			output: '{"success":true}',
			comment: "Close page p1",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const result = await this.manager.closePage(params.pageId);
			return JSON.stringify(result);
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}

export class ListPages extends Gadget({
	description: "Lists all open pages across all browsers, or filtered by a specific browser.",
	schema: z.object({
		browserId: z.string().optional().describe("Filter pages by browser ID"),
	}),
	examples: [
		{
			params: {},
			output:
				'{"pages":[{"id":"p1","browserId":"b1","url":"https://example.com","title":"Example"}]}',
			comment: "List all pages",
		},
		{
			params: { browserId: "b1" },
			output: '{"pages":[{"id":"p1","browserId":"b1","url":"about:blank","title":""}]}',
			comment: "List pages in browser b1 only",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		const pages = this.manager.listPages(params.browserId);
		// Get titles for each page (async operation)
		const pagesWithTitles = await Promise.all(
			pages.map(async (page) => {
				const playwrightPage = this.manager.getPage(page.id);
				const title = playwrightPage ? await playwrightPage.title() : "";
				return { ...page, title };
			}),
		);
		return JSON.stringify({ pages: pagesWithTitles });
	}
}
