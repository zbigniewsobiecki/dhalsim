import { Gadget, z, getHostExports, resolveSubagentModel, resolveValue } from "llmist";
import type { ExecutionContext, GadgetMediaOutput } from "llmist";
import { BrowserSessionManager } from "../session";
import type { IBrowserSessionManager, StartBrowserOptions, StartBrowserResult } from "../session";
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
	RequestUserAssistance,
	type UserAssistanceReason,
} from "../gadgets";
import { createDhalsimSystemPrompt } from "./prompts";

/**
 * Session manager type with the required methods for browser automation.
 * Compatible with both BrowserSessionManager and TestBrowserSessionManager.
 */
export type DhalsimSessionManager = IBrowserSessionManager & {
	startBrowser(options: StartBrowserOptions): Promise<StartBrowserResult>;
	closeAll(): Promise<void>;
};

/**
 * Parameters passed to the custom user assistance callback.
 */
export interface UserAssistanceParams {
	/** Type of assistance needed */
	reason: UserAssistanceReason;
	/** Message describing what's needed */
	message: string;
}

/**
 * Custom callback for handling user assistance requests.
 * Return the user's response (e.g., 2FA code, "done" for captchas).
 */
export type UserAssistanceCallback = (
	params: UserAssistanceParams,
) => Promise<string>;

/**
 * Options for configuring the Dhalsim subagent.
 */
export interface DhalsimOptions {
	/** Custom session manager for Node.js compatibility or testing */
	sessionManager?: DhalsimSessionManager;
	/** Custom system prompt (defaults to DHALSIM_SYSTEM_PROMPT) */
	systemPrompt?: string;
	/** Overall timeout in milliseconds (default: 300000 = 5 min, 0 = disabled) */
	timeoutMs?: number;
	/**
	 * Enable or disable RequestUserAssistance gadget.
	 * - true: Always include the gadget
	 * - false: Never include the gadget (agent won't know it exists)
	 * - undefined (default): Auto-detect based on callback availability
	 */
	userAssistance?: boolean;
	/**
	 * Custom callback for handling user assistance requests.
	 * When provided, this receives structured params instead of the raw message.
	 * The callback's return value is passed back to the agent.
	 *
	 * If not provided but userAssistance is enabled, falls back to ctx.requestHumanInput.
	 */
	onUserAssistance?: UserAssistanceCallback;
}

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
 *
 * @example
 * ```typescript
 * // With custom session manager for Node.js compatibility
 * import { TestBrowserSessionManager } from "dhalsim";
 *
 * const dhalsim = new Dhalsim({
 *   sessionManager: new TestBrowserSessionManager(),
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With minimal prompt for simpler tasks
 * import { DHALSIM_MINIMAL_PROMPT } from "dhalsim";
 *
 * const dhalsim = new Dhalsim({
 *   systemPrompt: DHALSIM_MINIMAL_PROMPT,
 * });
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
		timeoutMs: z.number().optional().describe("Overall timeout in ms (default: 300000 = 5 min, 0 = disabled, configurable via CLI)"),
		disableCache: z.boolean().optional().describe("Disable browser cache for lower memory usage (default: false, configurable via CLI)"),
		navigationTimeoutMs: z.number().optional().describe("Navigation timeout in ms (default: 60000, configurable via CLI)"),
	}),
	timeoutMs: 300000, // 5 minutes - web browsing can take time
}) {
	private customSessionManager?: DhalsimSessionManager;
	private customSystemPrompt?: string;
	private userAssistanceEnabled?: boolean;
	private customUserAssistanceCallback?: UserAssistanceCallback;

	constructor(options?: DhalsimOptions) {
		super();
		this.customSessionManager = options?.sessionManager;
		this.customSystemPrompt = options?.systemPrompt;
		this.userAssistanceEnabled = options?.userAssistance;
		this.customUserAssistanceCallback = options?.onUserAssistance;
		// Set factory-configured timeout (overrides default 300000)
		if (options?.timeoutMs !== undefined) {
			this.timeoutMs = options.timeoutMs === 0 ? undefined : options.timeoutMs;
		}
	}

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

		const disableCache = resolveValue(ctx!, "BrowseWeb", {
			runtime: params.disableCache,
			subagentKey: "disableCache",
			defaultValue: false,
		});

		const navigationTimeoutMs = resolveValue(ctx!, "BrowseWeb", {
			runtime: params.navigationTimeoutMs,
			subagentKey: "navigationTimeoutMs",
			defaultValue: 60000,
		});

		// Determine if user assistance should be enabled
		// Priority: explicit option > custom callback > ctx.requestHumanInput availability
		const userAssistanceEnabled =
			this.userAssistanceEnabled ??
			(this.customUserAssistanceCallback !== undefined ||
				ctx?.requestHumanInput !== undefined);

		logger?.debug(`[BrowseWeb] User assistance enabled=${userAssistanceEnabled}`);

		// Track collected screenshots (costs are tracked automatically via ExecutionTree)
		const collectedMedia: GadgetMediaOutput[] = [];

		// Use custom session manager or create a fresh one for isolation
		const manager = this.customSessionManager ?? new BrowserSessionManager(logger);
		const isOwnedManager = !this.customSessionManager;

		try {
			// Start browser with initial page (only if we own the manager)
			let pageId: string;
			if (isOwnedManager) {
				logger?.debug(`[BrowseWeb] Starting browser headless=${headless} disableCache=${disableCache} navigationTimeoutMs=${navigationTimeoutMs}...`);
				const result = await manager.startBrowser({
					headless,
					url, // Navigate directly to the starting URL
					disableCache,
					navigationTimeoutMs,
				});
				pageId = result.pageId;
				logger?.debug(`[BrowseWeb] Browser started pageId=${pageId}`);
			} else {
				// Use existing page from custom session manager
				const pages = manager.listPages();
				if (pages.length === 0) {
					throw new Error("Custom session manager has no pages. Start a browser first.");
				}
				pageId = pages[0].id;
				logger?.debug(`[BrowseWeb] Using existing page pageId=${pageId}`);
			}

			// Pre-dismiss cookie banners to save an LLM call
			logger?.debug(`[BrowseWeb] Dismissing overlays...`);
			const dismissOverlays = new DismissOverlays(manager);
			let dismissResult: string | null = null;
			try {
				dismissResult = await dismissOverlays.execute({ pageId });
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
				// Conditionally include RequestUserAssistance
				...(userAssistanceEnabled ? [new RequestUserAssistance(manager)] : []),
			];

			// Get host's llmist exports to ensure proper tree sharing
			// This avoids the "dual-package problem" where different llmist versions
			// have incompatible classes
			const { AgentBuilder, LLMist } = getHostExports(ctx!);

			// Create a new LLMist client for the subagent
			// Costs are tracked automatically via the shared ExecutionTree
			const client = new LLMist();

			// Determine the system prompt
			// If custom prompt provided, use it; otherwise generate based on userAssistanceEnabled
			const systemPrompt =
				this.customSystemPrompt ??
				createDhalsimSystemPrompt({ includeUserAssistance: userAssistanceEnabled });

			// Build the subagent with abort signal support and automatic nested event forwarding
			const builder = new AgentBuilder(client)
				.withModel(model)
				.withSystem(systemPrompt)
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

				// Set up human input handling based on configuration
				if (userAssistanceEnabled) {
					if (this.customUserAssistanceCallback) {
						// Custom callback: wrap to parse the structured format
						builder.onHumanInput(async (prompt: string) => {
							// Parse the prompt format: "[REASON] message"
							const match = prompt.match(/^\[([A-Z0-9_]+)\]\s*(.*)$/s);
							if (match) {
								const reason = match[1].toLowerCase() as UserAssistanceReason;
								const message = match[2];
								return this.customUserAssistanceCallback!({ reason, message });
							}
							// Fallback: treat entire prompt as message with 'other' reason
							return this.customUserAssistanceCallback!({
								reason: "other",
								message: prompt,
							});
						});
					} else if (ctx.requestHumanInput) {
						// Inherit human input capability from parent context
						// This allows RequestUserAssistance to bubble up 2FA/CAPTCHA prompts to the CLI
						builder.onHumanInput(ctx.requestHumanInput);
					}
				}
			}

			// Add synthetic gadget calls to show the agent what was auto-executed
			if (dismissResult !== null) {
				builder.withSyntheticGadgetCall(
					"DismissOverlays",
					{ pageId },
					dismissResult,
					"auto_dismiss",
				);
			}
			if (initialPageContent !== null) {
				builder.withSyntheticGadgetCall(
					"GetFullPageContent",
					{ pageId },
					initialPageContent,
					"auto_content",
				);
			}

			const agent = builder.ask(`Page ${pageId} is ready at ${url}.\n\nTask: ${task}`);

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
			// Clean up the browser only if we created it
			if (isOwnedManager) {
				logger?.debug(`[BrowseWeb] Cleanup - closing browser`);
				await manager.closeAll();
				logger?.debug(`[BrowseWeb] Browser closed`);
			}
		}
	}
}
