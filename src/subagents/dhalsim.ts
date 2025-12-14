import { Gadget, z, AgentBuilder, LLMist } from "llmist";
import type { ExecutionContext, GadgetMediaOutput } from "llmist";
import { BrowserSessionManager } from "../session";
import { PageStateScanner } from "../state";
import {
	Navigate,
	Click,
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
import { DHALSIM_SYSTEM_PROMPT } from "./prompts";

/**
 * Dhalsim subagent - a high-level gadget that runs its own agent loop
 * to accomplish web browsing tasks autonomously.
 *
 * This is the recommended way for most users to interact with dhalsim.
 * Instead of registering 26+ individual gadgets, just use Dhalsim
 * and let it handle the complexity of web automation.
 *
 * @example
 * ```typescript
 * // In your agent
 * const dhalsim = new Dhalsim();
 * registry.register('Dhalsim', dhalsim);
 *
 * // The agent can now call:
 * // Dhalsim(task="Find the price of iPhone 16 Pro", url="https://apple.com")
 * ```
 */
export class Dhalsim extends Gadget({
	name: "BrowseWeb",
	description: `Browse a website and accomplish a task autonomously.
This gadget launches a browser, navigates to the URL, and uses AI to complete the task.
Returns the result and any screenshots taken.
Use this for web research, data extraction, form filling, or any web-based task.`,
	schema: z.object({
		task: z.string().describe("The task to accomplish, e.g., 'Find the price of iPhone 16 Pro' or 'Log in and check my balance'"),
		url: z.string().url().describe("Starting URL to navigate to"),
		maxIterations: z.number().optional().describe("Maximum number of steps before giving up (default: 15, configurable via CLI)"),
		model: z.string().optional().describe("Model to use for the browser agent (default: inherit from parent agent, configurable via CLI)"),
		headless: z.boolean().optional().describe("Run browser in headless mode (default: true, configurable via CLI)"),
	}),
	timeoutMs: 300000, // 5 minutes - web browsing can take time
}) {
	async execute(
		params: this["params"],
		ctx?: ExecutionContext,
	): Promise<{ result: string; media?: GadgetMediaOutput[] }> {
		const { task, url } = params;

		// Resolve configuration with priority:
		// 1. Explicit params (runtime override)
		// 2. Subagent config from context (CLI [subagents.Dhalsim] or [profile.subagents.Dhalsim])
		// 3. Parent agent model from context (for model inheritance)
		// 4. Hardcoded fallback defaults
		//
		// Note: agentConfig and subagentConfig are new ExecutionContext properties added in llmist 2.7+
		// Using type assertion until dhalsim updates to the new llmist version
		const extendedCtx = ctx as ExecutionContext & {
			agentConfig?: { model: string; temperature?: number };
			subagentConfig?: Record<string, Record<string, unknown>>;
		};
		const subagentConfig = extendedCtx?.subagentConfig?.Dhalsim ?? {};
		const parentModel = extendedCtx?.agentConfig?.model;

		const model = params.model
			?? (subagentConfig.model as string | undefined)
			?? parentModel
			?? "sonnet";

		const maxIterations = params.maxIterations
			?? (subagentConfig.maxIterations as number | undefined)
			?? 15;

		const headless = params.headless
			?? (subagentConfig.headless as boolean | undefined)
			?? true;

		// Track collected screenshots and costs
		const collectedMedia: GadgetMediaOutput[] = [];
		let totalCost = 0;

		// Create a fresh session manager for isolation
		// Each Dhalsim call gets its own browser instance
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

			// Build the subagent with abort signal support and automatic nested event forwarding
			const builder = new AgentBuilder(client)
				.withModel(model)
				.withSystem(DHALSIM_SYSTEM_PROMPT)
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

			// Enable automatic nested event forwarding to parent (if available)
			// This ONE LINE replaces all manual event forwarding boilerplate!
			if (ctx) {
				builder.withParentContext(ctx);
			}

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

				// Events are automatically forwarded to parent via withParentContext()
				// Just handle local processing here
				if (event.type === "gadget_result") {
					// Collect any screenshots from gadget results
					if (event.result.media) {
						for (const media of event.result.media) {
							collectedMedia.push(media);
						}
					}
				} else if (event.type === "text") {
					// Capture the final text response
					finalResult = event.content;
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
