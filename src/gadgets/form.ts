import { Gadget, z } from "llmist";
import type { IBrowserSessionManager } from "../session";
import { humanDelay, randomDelay } from "../stealth";
import { selectorSchema, optionalSelectorSchema } from "./selector-validator";
import { getErrorMessage } from "../utils/errors";
import { checkElementExists } from "../utils/element-checks";
import { DEFAULT_NAVIGATION_TIMEOUT, MAX_INPUTS_TO_SCAN } from "../utils/constants";

export class Type extends Gadget({
	description:
		"Types text into an input element character by character with human-like timing. Use Fill for faster input that clears the field first.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		selector: selectorSchema.describe("CSS selector of input element"),
		text: z.string().describe("Text to type"),
		delay: z
			.number()
			.default(50)
			.describe(
				"Base delay between keystrokes in ms (actual delay varies ±30% for human-like effect)",
			),
	}),
	examples: [
		{
			params: { pageId: "p1", selector: "#email", text: "user@example.com", delay: 50 },
			output: '{"success":true}',
			comment: "Type email address with human-like timing",
		},
		{
			params: { pageId: "p1", selector: "#password", text: "securePass123", delay: 80 },
			output: '{"success":true}',
			comment: "Type password with slower timing for realism",
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

			// Human-like: click to focus with small delay
			// Use force: true to bypass overlay interception (common with MUI placeholder text)
			await humanDelay(20, 60);
			await locator.click({ force: true });
			await humanDelay(30, 80);

			// Type with variable delays (±30% of base delay)
			const baseDelay = params.delay;
			for (const char of params.text) {
				const variedDelay = baseDelay > 0 ? randomDelay(baseDelay * 0.7, baseDelay * 1.3) : 0;
				await page.keyboard.type(char, { delay: variedDelay });
			}

			return JSON.stringify({ success: true });
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}

export class Fill extends Gadget({
	description:
		"Fills an input field with text, clearing any existing value first. Faster than Type but less human-like.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		selector: selectorSchema.describe("CSS selector of input element"),
		value: z.string().describe("Value to fill"),
	}),
	examples: [
		{
			params: { pageId: "p1", selector: "#search", value: "search query" },
			output: '{"success":true}',
			comment: "Fill search field",
		},
		{
			params: { pageId: "p1", selector: "input[name='email']", value: "user@example.com" },
			output: '{"success":true}',
			comment: "Fill email using name attribute selector",
		},
		{
			params: { pageId: "p1", selector: "input[placeholder='Enter username']", value: "myuser" },
			output: '{"success":true}',
			comment: "Fill using placeholder selector",
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

			// Human-like: small delay before filling
			await humanDelay(30, 80);
			await locator.fill(params.value);

			return JSON.stringify({ success: true });
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}

export class FillForm extends Gadget({
	description:
		"Fills multiple form fields at once and optionally submits the form. More efficient than calling Fill multiple times. Use for login forms, registration forms, search with filters, etc.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		fields: z
			.array(
				z.object({
					selector: selectorSchema.describe("CSS selector of the input field"),
					value: z.string().describe("Value to fill"),
				}),
			)
			.min(1)
			.describe("Array of fields to fill"),
		submit: optionalSelectorSchema.describe(
			"CSS selector of submit button to click after filling fields (optional)",
		),
		waitForNavigation: z
			.boolean()
			.default(false)
			.describe("Wait for navigation after clicking submit button"),
	}),
	examples: [
		{
			params: {
				pageId: "p1",
				fields: [
					{ selector: "#email", value: "user@example.com" },
					{ selector: "#password", value: "secret123" },
				],
				submit: "button[type=submit]",
				waitForNavigation: true,
			},
			output:
				'{"success":true,"filledCount":2,"submitted":true,"url":"https://example.com/dashboard"}',
			comment: "Fill login form and submit",
		},
		{
			params: {
				pageId: "p1",
				fields: [
					{ selector: "#search", value: "query" },
					{ selector: "#location", value: "NYC" },
				],
				submit: undefined,
				waitForNavigation: false,
			},
			output: '{"success":true,"filledCount":2,"submitted":false}',
			comment: "Fill multiple fields without submitting",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			let filledCount = 0;
			const errors: string[] = [];

			// Fill each field
			for (const field of params.fields) {
				try {
					const locator = page.locator(field.selector);
					const count = await locator.count();
					if (count === 0) {
						errors.push(`Field not found: ${field.selector}`);
						continue;
					}
					await humanDelay(30, 80);
					await locator.fill(field.value);
					filledCount++;
				} catch (err) {
					errors.push(`Failed to fill ${field.selector}: ${getErrorMessage(err)}`);
				}
			}

			// Submit if requested
			let submitted = false;
			let url: string | undefined;
			let navigationError: string | undefined;

			if (params.submit) {
				const submitLocator = page.locator(params.submit);
				const submitError = await checkElementExists(submitLocator, params.submit);
				if (submitError) {
					return JSON.stringify({
						success: filledCount === params.fields.length && errors.length === 0,
						filledCount,
						submitted: false,
						submitError: JSON.parse(submitError),
						fieldErrors: errors.length > 0 ? errors : undefined,
					});
				}

				await humanDelay(50, 100);

				if (params.waitForNavigation) {
					// Start navigation wait and click in parallel - navigation must be awaited AFTER click initiates
					const [navResult] = await Promise.all([
						page
							.waitForNavigation({ timeout: DEFAULT_NAVIGATION_TIMEOUT })
							.then(() => ({ success: true as const }))
							.catch((e) => ({ success: false as const, error: getErrorMessage(e) })),
						submitLocator.click(),
					]);

					if (!navResult.success) {
						navigationError = navResult.error;
					}
				} else {
					await submitLocator.click();
				}

				submitted = true;
				url = page.url();
			}

			const allFieldsFilled = filledCount === params.fields.length && errors.length === 0;

			return JSON.stringify({
				success: allFieldsFilled,
				filledCount,
				submitted,
				...(url ? { url } : {}),
				...(errors.length > 0 ? { fieldErrors: errors } : {}),
				...(navigationError ? { navigationError } : {}),
			});
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}

export class FillPinCode extends Gadget({
	description:
		"Fills a PIN/OTP code into multiple single-digit input fields (common pattern for 2FA/SMS codes). Auto-detects consecutive inputs or uses a selector pattern. Much more efficient than calling Fill for each digit.",
	schema: z.object({
		pageId: z.string().describe("Page ID"),
		code: z.string().describe("The PIN/OTP code to fill (e.g., '134320')"),
		selectorPattern: z
			.string()
			.optional()
			.describe(
				"CSS selector pattern with {i} placeholder for index (e.g., '[name=\"pin_{i}\"]'). If omitted, auto-detects PIN inputs.",
			),
		startIndex: z.number().default(0).describe("Starting index for the pattern (default: 0)"),
		submit: optionalSelectorSchema.describe("CSS selector of submit button to click after filling"),
		waitForNavigation: z.boolean().default(false).describe("Wait for navigation after submit"),
	}),
	examples: [
		{
			params: {
				pageId: "p1",
				code: "134320",
				selectorPattern: '[name="x-pinlogin_pinlogin_{i}"]',
				startIndex: 0,
				waitForNavigation: false,
			},
			output: '{"success":true,"filledDigits":6,"detectedInputs":6}',
			comment: "Fill 6-digit PIN into named inputs",
		},
		{
			params: {
				pageId: "p1",
				code: "1234",
				submit: "button[type=submit]",
				waitForNavigation: true,
				startIndex: 0,
			},
			output: '{"success":true,"filledDigits":4,"detectedInputs":4,"submitted":true,"url":"https://..."}',
			comment: "Auto-detect PIN inputs, fill, and submit",
		},
	],
}) {
	constructor(private manager: IBrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const page = this.manager.requirePage(params.pageId);
			const digits = params.code.split("");
			let filledDigits = 0;
			let detectedInputs = 0;

			if (params.selectorPattern) {
				// Use provided pattern
				for (let i = 0; i < digits.length; i++) {
					const selector = params.selectorPattern.replace("{i}", String(params.startIndex + i));
					const locator = page.locator(selector);
					const count = await locator.count();
					if (count > 0) {
						detectedInputs++;
						await humanDelay(30, 80);
						await locator.fill(digits[i]);
						filledDigits++;
					}
				}
			} else {
				// Auto-detect PIN inputs: look for consecutive single-char inputs
				const inputsLocator = page.locator(
					'input[type="tel"], input[type="text"], input[type="number"], input[type="password"]',
				);

				// Filter to visible, single-char inputs that look like PIN fields
				const pinInputs: ReturnType<typeof page.locator>[] = [];
				let inputCount = await inputsLocator.count();

				// Limit inputs to scan to prevent DoS
				if (inputCount > MAX_INPUTS_TO_SCAN) {
					inputCount = MAX_INPUTS_TO_SCAN;
				}

				for (let i = 0; i < inputCount; i++) {
					const input = inputsLocator.nth(i);
					try {
						const isVisible = await input.isVisible();
						const maxLength = await input.getAttribute("maxlength");
						const size = await input.getAttribute("size");

						// PIN inputs typically have maxlength=1 or size=1, or are type=tel
						const looksLikePinInput =
							maxLength === "1" || size === "1" || (await input.getAttribute("type")) === "tel";

						if (isVisible && looksLikePinInput) {
							pinInputs.push(input);
						}
					} catch {
						// Skip detached elements
					}
				}

				detectedInputs = pinInputs.length;

				// Fill digits into detected inputs
				for (let i = 0; i < Math.min(digits.length, pinInputs.length); i++) {
					const input = pinInputs[i];
					if (input) {
						await humanDelay(30, 80);
						await input.fill(digits[i]);
						filledDigits++;
					}
				}
			}

			// Submit if requested
			let submitted = false;
			let url: string | undefined;
			let navigationError: string | undefined;

			if (params.submit) {
				const submitLocator = page.locator(params.submit);
				const submitError = await checkElementExists(submitLocator, params.submit);
				if (submitError) {
					return JSON.stringify({
						success: filledDigits > 0,
						filledDigits,
						detectedInputs,
						submitted: false,
						submitError: JSON.parse(submitError),
					});
				}

				await humanDelay(50, 100);

				if (params.waitForNavigation) {
					// Start navigation wait and click in parallel - navigation must be awaited AFTER click initiates
					const [navResult] = await Promise.all([
						page
							.waitForNavigation({ timeout: DEFAULT_NAVIGATION_TIMEOUT })
							.then(() => ({ success: true as const }))
							.catch((e) => ({ success: false as const, error: getErrorMessage(e) })),
						submitLocator.click(),
					]);

					if (!navResult.success) {
						navigationError = navResult.error;
					}
				} else {
					await submitLocator.click();
				}

				submitted = true;
				url = page.url();
			}

			return JSON.stringify({
				success: filledDigits === digits.length,
				filledDigits,
				detectedInputs,
				...(submitted ? { submitted, url } : {}),
				...(navigationError ? { navigationError } : {}),
				...(filledDigits < digits.length
					? { warning: `Only filled ${filledDigits}/${digits.length} digits` }
					: {}),
			});
		} catch (error) {
			return JSON.stringify({ error: getErrorMessage(error) });
		}
	}
}
