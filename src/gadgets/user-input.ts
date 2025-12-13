import { Gadget, z, HumanInputException } from "llmist";
import type { IBrowserSessionManager } from "../session";

export class RequestUserAssistance extends Gadget({
	description:
		"Requests input or confirmation from the user. Use when encountering captchas, 2FA codes, or other challenges requiring human intervention. The browser should be in headed mode (headless=false) if user needs to interact with it.",
	schema: z.object({
		reason: z
			.enum(["captcha", "2fa_code", "sms_code", "manual_action", "confirmation", "other"])
			.describe("Type of assistance needed"),
		message: z.string().describe("Message to display to the user explaining what's needed"),
	}),
	examples: [
		{
			params: { reason: "2fa_code", message: "Enter the 2FA code sent to your email" },
			output: "123456",
			comment: "Request 2FA code from user",
		},
		{
			params: { reason: "captcha", message: "Please solve the captcha in the browser window, then type 'done'" },
			output: "done",
			comment: "Wait for user to solve captcha manually",
		},
	],
}) {
	constructor(_manager: IBrowserSessionManager) {
		super();
	}

	execute(params: this["params"]): string {
		// Format prompt with context
		const prompt = `[${params.reason.toUpperCase()}] ${params.message}`;

		// Throw HumanInputException - llmist handles the rest
		throw new HumanInputException(prompt);
	}
}
