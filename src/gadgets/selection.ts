import { Gadget, z, defaultLogger as logger, getErrorMessage } from "llmist";
import type { IBrowserSessionManager } from "../session";
import { selectorSchema } from "./selector-validator";
import { checkElementExists } from "../utils/element-checks";

export class Select extends Gadget({
	description: "Selects an option in a dropdown (select element). Provide value, label, or index.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		selector: selectorSchema.describe("CSS selector of select element"),
		value: z.string().optional().describe("Option value attribute"),
		label: z.string().optional().describe("Option visible text"),
		index: z.number().optional().describe("Option index (0-based)"),
	}),
	examples: [
		{
			params: { pageId: "p1", selector: "#country", value: "us" },
			output: '{"success":true,"selectedValue":"us","selectedText":"United States"}',
			comment: "Select by value",
		},
		{
			params: { pageId: "p1", selector: "#country", label: "Canada" },
			output: '{"success":true,"selectedValue":"ca","selectedText":"Canada"}',
			comment: "Select by visible text",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		logger.debug(`[Select] pageId=${params.pageId} selector="${params.selector}" value=${params.value ?? "none"} label=${params.label ?? "none"} index=${params.index ?? "none"}`);
		try {
			const page = this.manager.requirePage(params.pageId);
			const locator = page.locator(params.selector);

			const notFoundError = await checkElementExists(locator, params.selector);
			if (notFoundError) return notFoundError;

			let selected: string[];
			if (params.value !== undefined) {
				selected = await locator.selectOption({ value: params.value });
			} else if (params.label !== undefined) {
				selected = await locator.selectOption({ label: params.label });
			} else if (params.index !== undefined) {
				selected = await locator.selectOption({ index: params.index });
			} else {
				return JSON.stringify({ error: "Must provide value, label, or index" });
			}

			// Get selected text
			const selectedOption = page.locator(`${params.selector} option:checked`);
			const selectedText =
				(await selectedOption.count()) > 0 ? await selectedOption.textContent() : "";

			return JSON.stringify({
				success: true,
				selectedValue: selected[0],
				selectedText: (selectedText || "").trim(),
			});
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}

export class Check extends Gadget({
	description: "Checks or unchecks a checkbox or radio button.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		selector: selectorSchema.describe("CSS selector of checkbox/radio"),
		checked: z.boolean().default(true).describe("Whether to check (true) or uncheck (false)"),
	}),
	examples: [
		{
			params: { pageId: "p1", selector: "#remember-me", checked: true },
			output: '{"success":true,"checked":true}',
			comment: "Check the checkbox",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		logger.debug(`[Check] pageId=${params.pageId} selector="${params.selector}" checked=${params.checked}`);
		try {
			const page = this.manager.requirePage(params.pageId);
			const locator = page.locator(params.selector);

			const notFoundError = await checkElementExists(locator, params.selector);
			if (notFoundError) return notFoundError;

			if (params.checked) {
				await locator.check();
			} else {
				await locator.uncheck();
			}

			const isChecked = await locator.isChecked();

			return JSON.stringify({ success: true, checked: isChecked });
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}
