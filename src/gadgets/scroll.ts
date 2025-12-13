import { Gadget, z } from "llmist";
import type { IBrowserSessionManager } from "../session";
import { selectorSchema, optionalSelectorSchema } from "./selector-validator";
import { getErrorMessage } from "../utils/errors";
import { checkElementExists } from "../utils/element-checks";

export class Hover extends Gadget({
	description: "Hovers over an element. Useful for revealing hidden menus or tooltips.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		selector: selectorSchema.describe("CSS selector of element to hover"),
	}),
	examples: [
		{
			params: { pageId: "p1", selector: "#dropdown-menu" },
			output: '{"success":true}',
			comment: "Hover to reveal dropdown",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			const locator = page.locator(params.selector);

			const notFoundError = await checkElementExists(locator, params.selector);
			if (notFoundError) return notFoundError;

			await locator.hover();

			return JSON.stringify({ success: true });
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}

export class Scroll extends Gadget({
	description: "Scrolls the page or a specific element.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		direction: z.enum(["up", "down", "left", "right"]).default("down").describe("Scroll direction"),
		amount: z.number().default(500).describe("Scroll amount in pixels"),
		selector: optionalSelectorSchema.describe("Scroll within a specific element (default: page)"),
	}),
	examples: [
		{
			params: { pageId: "p1", direction: "down", amount: 500 },
			output: '{"success":true,"scrollX":0,"scrollY":500}',
			comment: "Scroll down 500px",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);

			const deltaX =
				params.direction === "left"
					? -params.amount
					: params.direction === "right"
						? params.amount
						: 0;
			const deltaY =
				params.direction === "up"
					? -params.amount
					: params.direction === "down"
						? params.amount
						: 0;

			if (params.selector) {
				const locator = page.locator(params.selector);
				const notFoundError = await checkElementExists(locator, params.selector);
				if (notFoundError) return notFoundError;

				await locator.evaluate(
					(el: Element, delta: { x: number; y: number }) => {
						el.scrollBy(delta.x, delta.y);
					},
					{ x: deltaX, y: deltaY },
				);
			} else {
				await page.evaluate(
					(delta: { x: number; y: number }) => {
						window.scrollBy(delta.x, delta.y);
					},
					{ x: deltaX, y: deltaY },
				);
			}

			// Get current scroll position
			const scrollPos = await page.evaluate(() => ({
				scrollX: window.scrollX,
				scrollY: window.scrollY,
			}));

			return JSON.stringify({
				success: true,
				scrollX: scrollPos.scrollX,
				scrollY: scrollPos.scrollY,
			});
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}
