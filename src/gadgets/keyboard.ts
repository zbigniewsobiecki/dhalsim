import { Gadget, z } from "llmist";
import type { IBrowserSessionManager } from "../session";
import { getErrorMessage } from "../utils/errors";

export class PressKey extends Gadget({
	description:
		"Presses a keyboard key. Supports special keys like Enter, Tab, Escape, ArrowUp, ArrowDown, etc.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		key: z
			.string()
			.describe("Key to press (e.g., Enter, Tab, Escape, ArrowUp, ArrowDown, Backspace, Delete)"),
	}),
	examples: [
		{
			params: { pageId: "p1", key: "Enter" },
			output: '{"success":true}',
			comment: "Press Enter key",
		},
		{
			params: { pageId: "p1", key: "Tab" },
			output: '{"success":true}',
			comment: "Press Tab to move focus",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			await page.keyboard.press(params.key);

			return JSON.stringify({ success: true });
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}
