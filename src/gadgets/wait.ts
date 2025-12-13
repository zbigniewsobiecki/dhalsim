import { Gadget, z } from "llmist";
import type { IBrowserSessionManager } from "../session";
import { selectorSchema } from "./selector-validator";
import { getErrorMessage, truncate } from "../utils/errors";
import { ELEMENT_TEXT_MAX_LENGTH } from "../utils/constants";

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
				const locator = page.locator(params.selector);
				const count = await locator.count();
				if (count > 0) {
					elementText = truncate(((await locator.textContent()) || "").trim(), ELEMENT_TEXT_MAX_LENGTH);
				}
			}

			return JSON.stringify({
				found: true,
				...(elementText ? { elementText } : {}),
			});
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
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
	// Note: manager is required for consistent factory API but not used by this simple gadget
	constructor(manager: IBrowserSessionManager) {
		super();
		// Prevent unused variable warning
		void manager;
	}

	async execute(params: this["params"]): Promise<string> {
		await new Promise((resolve) => setTimeout(resolve, params.ms));
		return JSON.stringify({ success: true, waited: params.ms });
	}
}
