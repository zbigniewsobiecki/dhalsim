import { Gadget, z } from "llmist";
import type { BrowserSessionManager } from "../session";

export class ExecuteScript extends Gadget({
	description:
		"Executes JavaScript code on the page and returns the result. The script runs in the page context and can access the DOM.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		script: z
			.string()
			.describe(
				"JavaScript code to execute. Use 'return' to return a value. Has access to document, window, etc.",
			),
	}),
	examples: [
		{
			params: { pageId: "p1", script: "return document.title" },
			output: '{"result":"My Page Title"}',
			comment: "Get page title",
		},
		{
			params: { pageId: "p1", script: "return document.querySelectorAll('a').length" },
			output: '{"result":15}',
			comment: "Count links on page",
		},
		{
			params: {
				pageId: "p1",
				script: "document.body.style.backgroundColor = 'red'; return 'done'",
			},
			output: '{"result":"done"}',
			comment: "Modify page and return confirmation",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);

			// Wrap the script in a function that we can call
			const wrappedScript = `
				(function() {
					${params.script}
				})()
			`;

			const result = await page.evaluate(wrappedScript);

			return JSON.stringify({ result });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
		}
	}
}
