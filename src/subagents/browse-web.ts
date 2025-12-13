import { Gadget, z, AgentBuilder, LLMist } from "llmist";
import type { ExecutionContext, GadgetMediaOutput } from "llmist";
import { BrowserSessionManager } from "../session";
import { PageStateScanner } from "../state";
import {
	Navigate,
	Click,
	ClickAndNavigate,
	Fill,
	FillForm,
	Select,
	Check,
	GetFullPageContent,
	Screenshot,
	DismissOverlays,
	Scroll,
	WaitForElement,
	Wait,
} from "../gadgets";
import { BROWSE_WEB_SYSTEM_PROMPT } from "./prompts";

/**
 * BrowseWeb subagent - a high-level gadget that runs its own agent loop
 * to accomplish web browsing tasks autonomously.
 *
 * This is the recommended way for most users to interact with webasto.
 * Instead of registering 26+ individual gadgets, just use BrowseWeb
 * and let it handle the complexity of web automation.
 *
 * @example
 * ```typescript
 * // In your agent
 * const browseWeb = new BrowseWeb();
 * registry.register('BrowseWeb', browseWeb);
 *
 * // The agent can now call:
 * // BrowseWeb(task="Find the price of iPhone 16 Pro", url="https://apple.com")
 * ```
 */
export class BrowseWeb extends Gadget({
	name: "BrowseWeb",
	description: `Browse a website and accomplish a task autonomously.
This gadget launches a browser, navigates to the URL, and uses AI to complete the task.
Returns the result and any screenshots taken.
Use this for web research, data extraction, form filling, or any web-based task.`,
	schema: z.object({
		task: z.string().describe("The task to accomplish, e.g., 'Find the price of iPhone 16 Pro' or 'Log in and check my balance'"),
		url: z.string().url().describe("Starting URL to navigate to"),
		maxIterations: z.number().optional().default(15).describe("Maximum number of steps before giving up"),
		model: z.string().optional().default("sonnet").describe("Model to use for the browser agent"),
		headless: z.boolean().optional().default(true).describe("Run browser in headless mode (no visible window)"),
	}),
	timeoutMs: 300000, // 5 minutes - web browsing can take time
}) {
	async execute(
		params: this["params"],
		ctx?: ExecutionContext,
	): Promise<{ result: string; media?: GadgetMediaOutput[] }> {
		const { task, url, maxIterations = 15, model = "sonnet", headless = true } = params;

		// Track collected screenshots and costs
		const collectedMedia: GadgetMediaOutput[] = [];
		let totalCost = 0;

		// Create a fresh session manager for isolation
		// Each BrowseWeb call gets its own browser instance
		const manager = new BrowserSessionManager();

		try {
			// Start browser with initial page
			const { pageId } = await manager.startBrowser({
				headless,
				url, // Navigate directly to the starting URL
			});

			// Create page state scanner for context injection
			const pageStateScanner = new PageStateScanner(manager);

			// Create gadgets with this session's manager
			const gadgets = [
				new Navigate(manager),
				new Click(manager),
				new ClickAndNavigate(manager),
				new Fill(manager),
				new FillForm(manager),
				new Select(manager),
				new Check(manager),
				new GetFullPageContent(manager),
				new Screenshot(manager),
				new DismissOverlays(manager),
				new Scroll(manager),
				new WaitForElement(manager),
				new Wait(manager),
			];

			// Create a new LLMist client for the subagent
			// We track costs manually and report them to the parent via ctx.reportCost
			const client = new LLMist();

			// Build the subagent with abort signal support
			const builder = new AgentBuilder(client)
				.withModel(model)
				.withSystem(BROWSE_WEB_SYSTEM_PROMPT)
				.withMaxIterations(maxIterations)
				.withGadgets(...gadgets)
				.withTrailingMessage(() => pageStateScanner.getCachedState())
				.withHooks({
					observers: {
						onLLMCallReady: async () => {
							// Refresh page state before each LLM call
							await pageStateScanner.refreshState();
						},
						onLLMCallComplete: (context) => {
							// Track LLM costs from usage data
							if (context.usage) {
								// Estimate cost based on token usage
								// Using approximate rates: $3/M input, $15/M output for Claude Sonnet
								const inputCost = (context.usage.inputTokens || 0) * 0.000003;
								const outputCost = (context.usage.outputTokens || 0) * 0.000015;
								totalCost += inputCost + outputCost;
							}
						},
						onGadgetExecutionComplete: (context) => {
							// Track gadget costs
							if (context.cost && context.cost > 0) {
								totalCost += context.cost;
							}
						},
					},
				});

			// Add abort signal if available
			if (ctx?.signal) {
				builder.withSignal(ctx.signal);
			}

			const agent = builder.ask(`You are on page ${pageId} at ${url}. Complete this task: ${task}`);

			// Run the subagent loop
			let finalResult = "";

			for await (const event of agent.run()) {
				// Abort check
				if (ctx?.signal?.aborted) {
					break;
				}

				if (event.type === "text") {
					// Capture the final text response
					finalResult = event.content;
				} else if (event.type === "gadget_result") {
					// Collect any screenshots from gadget results
					if (event.result.media) {
						for (const media of event.result.media) {
							collectedMedia.push(media);
						}
					}
					// Note: Gadget costs are tracked via onGadgetExecutionComplete hook
				}
			}

			// Report accumulated costs to parent
			if (totalCost > 0 && ctx?.reportCost) {
				ctx.reportCost(totalCost);
			}

			// Return result with collected media
			return {
				result: finalResult || "Task completed but no result text was generated.",
				media: collectedMedia.length > 0 ? collectedMedia : undefined,
			};
		} finally {
			// Always clean up the browser
			await manager.closeAll();
		}
	}
}
