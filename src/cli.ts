#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";
import { LLMist, AgentBuilder } from "llmist";
import { BrowserSessionManager } from "./session";
import {
	resolveLogDir,
	createSessionDir,
	writeLogFile,
	formatLlmRequest,
	formatCallNumber,
} from "./logging";
import {
	StartBrowser,
	CloseBrowser,
	ListBrowsers,
	NewPage,
	ClosePage,
	ListPages,
	Navigate,
	GoBack,
	GoForward,
	Reload,
	GetPageContent,
	Screenshot,
	ListInteractiveElements,
	Click,
	Type,
	Fill,
	PressKey,
	Select,
	Check,
	Hover,
	Scroll,
	DismissOverlays,
	ExecuteScript,
	WaitForElement,
	WaitForNavigation,
	Wait,
} from "./gadgets";

interface CLIOptions {
	model: string;
	headless: boolean;
	maxIterations: number;
	verbose: boolean;
	logLlmRequests?: boolean;
}

const SYSTEM_PROMPT = `You are a browser automation assistant. You control a web browser to accomplish tasks for the user.

You have access to gadgets for:
- Browser management: StartBrowser, CloseBrowser, ListBrowsers
- Page management: NewPage, ClosePage, ListPages
- Navigation: Navigate, GoBack, GoForward, Reload
- Content extraction: GetPageContent, Screenshot, ListInteractiveElements
- Interaction: Click, Type, Fill, PressKey, Select, Check, Hover, Scroll, DismissOverlays
- JavaScript execution: ExecuteScript
- Waiting: WaitForElement, WaitForNavigation, Wait

Workflow:
1. Start with StartBrowser. If you provide a URL, the browser opens directly to that page - don't call Navigate afterward (it's redundant)
2. If you encounter cookie banners or popups blocking interaction, use DismissOverlays
3. Look for category links, filter buttons, or navigation menus before using search - they're often more reliable
4. Use ListInteractiveElements to find elements you can interact with
5. Use GetPageContent to read page text
6. Use Screenshot for visual inspection when needed
7. Use Click, Fill, Type for interactions
8. If Click fails with "element intercepted by another element", try using force: true to bypass the actionability check
9. Prefer WaitForElement or WaitForNavigation over fixed Wait times

Be methodical and verify your actions succeeded before proceeding.`;

async function main() {
	const program = new Command();

	program
		.name("webasto")
		.description("Browser automation CLI powered by llmist with Playwright gadgets")
		.version("0.1.0")
		.argument("[task]", "Natural language task to perform")
		.option("-m, --model <model>", "Model to use", "sonnet")
		.option("--headless", "Run browser in headless mode", true)
		.option("--no-headless", "Run browser in visible mode")
		.option("--max-iterations <n>", "Maximum agent iterations", "50")
		.option("-v, --verbose", "Show detailed gadget results", false)
		.option("--log-llm-requests", "Save LLM requests/responses to ~/.llmist/logs/requests/")
		.action(async (task: string | undefined, options: CLIOptions) => {
			if (!task) {
				console.error(chalk.red("Error: task argument is required"));
				process.exit(1);
			}
			const manager = new BrowserSessionManager();

			// Create all gadget instances with the shared manager
			const gadgets = [
				new StartBrowser(manager),
				new CloseBrowser(manager),
				new ListBrowsers(manager),
				new NewPage(manager),
				new ClosePage(manager),
				new ListPages(manager),
				new Navigate(manager),
				new GoBack(manager),
				new GoForward(manager),
				new Reload(manager),
				new GetPageContent(manager),
				new Screenshot(manager),
				new ListInteractiveElements(manager),
				new Click(manager),
				new Type(manager),
				new Fill(manager),
				new PressKey(manager),
				new Select(manager),
				new Check(manager),
				new Hover(manager),
				new Scroll(manager),
				new DismissOverlays(manager),
				new ExecuteScript(manager),
				new WaitForElement(manager),
				new WaitForNavigation(manager),
				new Wait(manager),
			];

			// Set up graceful cleanup
			const cleanup = async () => {
				console.error(chalk.yellow("\nCleaning up..."));
				await manager.closeAll();
				process.exit(0);
			};

			process.on("SIGINT", cleanup);
			process.on("SIGTERM", cleanup);

			console.error(chalk.blue(`Task: ${task}`));
			console.error(chalk.dim(`Model: ${options.model} | Headless: ${options.headless} | Max iterations: ${options.maxIterations}`));
			console.error(chalk.dim("─".repeat(50)));

			// Set up LLM request/response logging
			const logDir = resolveLogDir(options.logLlmRequests, "requests");
			let sessionDir: string | undefined;
			let callCounter = 0;

			if (logDir) {
				console.error(chalk.dim(`Logging LLM requests to: ${logDir}`));
			}

			const client = new LLMist();
			const builder = new AgentBuilder(client)
				.withModel(options.model)
				.withSystem(SYSTEM_PROMPT)
				.withMaxIterations(Number.parseInt(String(options.maxIterations), 10))
				.withGadgets(...gadgets)
				.withHooks({
					observers: {
						onLLMCallReady: async (ctx) => {
							if (logDir) {
								callCounter++;
								if (!sessionDir) {
									sessionDir = await createSessionDir(logDir);
								}
								if (sessionDir) {
									const filename = `${formatCallNumber(callCounter)}.request`;
									await writeLogFile(sessionDir, filename, formatLlmRequest(ctx.options.messages));
								}
							}
						},
						onLLMCallComplete: async (ctx) => {
							if (sessionDir) {
								const filename = `${formatCallNumber(callCounter)}.response`;
								await writeLogFile(sessionDir, filename, ctx.rawResponse);
							}
						},
					},
				});

			const agent = builder.ask(task);

			try {
				for await (const event of agent.run()) {
					if (event.type === "text") {
						process.stdout.write(event.content);
					} else if (event.type === "gadget_result") {
						const { gadgetName, result, error } = event.result;

						if (error) {
							console.error(chalk.red(`\n[${gadgetName}] Error: ${error}`));
						} else if (options.verbose) {
							console.error(chalk.green(`\n[${gadgetName}] ${truncate(result || "", 200)}`));
						} else {
							console.error(chalk.dim(`\n[${gadgetName}] done`));
						}
					}
				}
			} catch (error) {
				if (error instanceof Error && error.name === "AbortError") {
					console.error(chalk.yellow("\nAborted"));
				} else {
					console.error(chalk.red(`\nError: ${error}`));
					process.exitCode = 1;
				}
			} finally {
				// Always clean up browsers
				await manager.closeAll();
			}

			console.error(chalk.dim("\n─".repeat(50)));
			console.error(chalk.green("Done"));
		});

	await program.parseAsync(process.argv);
}

function truncate(str: string, maxLen: number): string {
	if (str.length <= maxLen) return str;
	return `${str.slice(0, maxLen)}...`;
}

main().catch((error) => {
	console.error(chalk.red(`Fatal error: ${error}`));
	process.exit(1);
});
