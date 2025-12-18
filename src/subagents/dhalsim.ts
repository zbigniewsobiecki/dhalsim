import { Gadget, z, getHostExports, resolveSubagentModel, resolveValue } from "llmist";
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
 * Internal gadget for the browser agent to report its final result.
 * This gadget captures the result text so it can be returned to the caller.
 */
class ReportResult extends Gadget({
	name: "ReportResult",
	description:
		"Report the final result of your task. Call this when you have completed the task to return your findings to the caller.",
	schema: z.object({
		result: z
			.string()
			.describe(
				"Your findings to return to the caller. Include all relevant extracted data, URLs, and key information.",
			),
	}),
}) {
	result: string | null = null;

	execute(params: this["params"]): string {
		this.result = params.result;
		return "Result reported successfully.";
	}
}

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

		// Get logger from context (respects CLI's log level/file config)
		const logger = ctx?.logger;
		logger?.debug(`[BrowseWeb] Starting task="${task.slice(0, 50)}..." url="${url}"`);

		// Resolve configuration using llmist's config resolver
		// Priority: runtime params > subagent config > parent config > defaults
		const model = resolveSubagentModel(ctx!, "BrowseWeb", params.model, "sonnet");

		const maxIterations = resolveValue(ctx!, "BrowseWeb", {
			runtime: params.maxIterations,
			subagentKey: "maxIterations",
			defaultValue: 15,
		});

		const headless = resolveValue(ctx!, "BrowseWeb", {
			runtime: params.headless,
			subagentKey: "headless",
			defaultValue: true,
		});

		// Track collected screenshots (costs are tracked automatically via ExecutionTree)
		const collectedMedia: GadgetMediaOutput[] = [];

		// Create a fresh session manager for isolation
		// Each Dhalsim call gets its own browser instance
		const manager = new BrowserSessionManager(logger);

		try {
			// Start browser with initial page
			logger?.debug(`[BrowseWeb] Starting browser headless=${headless}...`);
			const { pageId } = await manager.startBrowser({
				headless,
				url, // Navigate directly to the starting URL
			});
			logger?.debug(`[BrowseWeb] Browser started pageId=${pageId}`);

			// Pre-dismiss cookie banners to save an LLM call
			logger?.debug(`[BrowseWeb] Dismissing overlays...`);
			const dismissOverlays = new DismissOverlays(manager);
			try {
				await dismissOverlays.execute({ pageId });
			} catch {
				// Ignore - overlay dismissal is best-effort
			}
			logger?.debug(`[BrowseWeb] Overlays dismissed`);

			// Auto-fetch initial page content to save an LLM round-trip
			logger?.debug(`[BrowseWeb] Auto-fetching page content...`);
			const getFullPageContent = new GetFullPageContent(manager);
			let initialPageContent: string | null = null;
			try {
				initialPageContent = await getFullPageContent.execute({ pageId });
			} catch {
				// Ignore - initial content fetch is best-effort
			}
			logger?.debug(`[BrowseWeb] Content fetched length=${initialPageContent?.length ?? 0}`);

			// Create page state scanner for context injection
			const pageStateScanner = new PageStateScanner(manager);

			// Create ReportResult gadget to capture the agent's findings
			const reportResult = new ReportResult();

			// Create gadgets with this session's manager
			const gadgets = [
				reportResult, // First so it's prominent in the list
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

			// Get host's llmist exports to ensure proper tree sharing
			// This avoids the "dual-package problem" where different llmist versions
			// have incompatible classes
			const { AgentBuilder, LLMist } = getHostExports(ctx!);

			// Create a new LLMist client for the subagent
			// Costs are tracked automatically via the shared ExecutionTree
			const client = new LLMist();

			// Build the subagent with abort signal support and automatic nested event forwarding
			const builder = new AgentBuilder(client)
				.withModel(model)
				.withSystem(DHALSIM_SYSTEM_PROMPT)
				.withMaxIterations(maxIterations)
				.withGadgets(...gadgets)
				.withTrailingMessage((trailingCtx) => [
					pageStateScanner.getCachedState(),
					"",
					`[Iteration ${trailingCtx.iteration + 1}/${trailingCtx.maxIterations}]`,
					"Think carefully: 1. What gadget invocations should we make next? 2. How do they depend on each other so we can run independent ones in parallel?",
				].join("\n"))
				.withHooks({
					observers: {
						onLLMCallReady: async () => {
							// Refresh page state before each LLM call
							await pageStateScanner.refreshState();
						},
						// Cost tracking is automatic via ExecutionTree - no hooks needed!
					},
				});

			// Enable automatic nested event forwarding to parent
			// withParentContext handles: tree sharing, cost tracking, and signal forwarding
			if (ctx) {
				builder.withParentContext(ctx);
			}

			const initialMessage = initialPageContent
				? `Page ${pageId} is ready at ${url}. Overlays dismissed.\n\n<InitialPageContent>\n${initialPageContent}\n</InitialPageContent>\n\nTask: ${task}`
				: `Page ${pageId} is ready at ${url}. Overlays dismissed. Take action now. Task: ${task}`;

			const agent = builder.ask(initialMessage);

			// Run the subagent loop
			logger?.debug(`[BrowseWeb] Starting agent loop model=${model} maxIterations=${maxIterations}`);
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
					// Break early if ReportResult was called
					if (reportResult.result !== null) {
						break;
					}
				} else if (event.type === "text") {
					// Capture the final text response
					finalResult = event.content;
				}
			}

			// Return result with collected media
			// Note: costs are automatically tracked in the shared ExecutionTree via withParentContext()
			// Priority: ReportResult gadget > text events > fallback message
			return {
				result:
					reportResult.result ||
					finalResult ||
					"Task completed but no result text was generated.",
				media: collectedMedia.length > 0 ? collectedMedia : undefined,
			};
		} finally {
			// Always clean up the browser
			logger?.debug(`[BrowseWeb] Cleanup - closing browser`);
			await manager.closeAll();
			logger?.debug(`[BrowseWeb] Browser closed`);
		}
	}
}
