import { Gadget, z } from "llmist";
import type { ConsoleMessage } from "playwright-core";
import type { IBrowserSessionManager } from "../session";

export class ExecuteScript extends Gadget({
	description:
		"Executes JavaScript on the page. Use console.log() for debugging - output is captured and returned.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		script: z
			.string()
			.describe(
				"JavaScript code to execute. Use 'return' for result. Use console.log() to debug - all output is captured.",
			),
	}),
	examples: [
		{
			params: { pageId: "p1", script: "return document.title" },
			output: '{"result":"My Page Title"}',
			comment: "Get page title",
		},
		{
			params: {
				pageId: "p1",
				script: `const items = document.querySelectorAll('.item');
console.log('Found', items.length, 'items');
return items.length;`,
			},
			output: '{"result":5,"console":["[log] Found 5 items"]}',
			comment: "Debug with console.log - output is captured",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		const page = this.manager.requirePage(params.pageId);

		// Capture console output for debugging
		const logs: string[] = [];
		const maxLogs = 50;
		const maxLogLength = 500;

		const consoleHandler = (msg: ConsoleMessage) => {
			if (logs.length >= maxLogs) return;
			const type = msg.type();
			let text = msg.text();
			if (text.length > maxLogLength) {
				text = `${text.slice(0, maxLogLength)}...`;
			}
			logs.push(`[${type}] ${text}`);
		};

		page.on("console", consoleHandler);

		try {
			const wrappedScript = `(function() { ${params.script} })()`;
			const result = await page.evaluate(wrappedScript);

			return JSON.stringify({
				result,
				...(logs.length > 0 && { console: logs }),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({
				error: message,
				...(logs.length > 0 && { console: logs }),
			});
		} finally {
			page.off("console", consoleHandler);
		}
	}
}
