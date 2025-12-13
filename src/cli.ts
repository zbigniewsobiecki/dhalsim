#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";
import * as readline from "node:readline";
import { LLMist, AgentBuilder } from "llmist";
import { BrowserSessionManager } from "./session";
import { PageStateScanner } from "./state";
import {
	resolveLogDir,
	createSessionDir,
	writeLogFile,
	formatLlmRequest,
	formatCallNumber,
} from "./logging";
import {
	NewPage,
	ClosePage,
	ListPages,
	Navigate,
	GoBack,
	GoForward,
	Reload,
	GetFullPageContent,
	Screenshot,
	Click,
	Type,
	Fill,
	FillForm,
	FillPinCode,
	PressKey,
	Select,
	Check,
	Hover,
	Scroll,
	DismissOverlays,
	ExecuteScript,
	WaitForElement,
	Wait,
	RequestUserAssistance,
} from "./gadgets";

interface CLIOptions {
	model: string;
	headed?: boolean;
	maxIterations: number;
	verbose: boolean;
	logLlmRequests?: boolean;
}

/**
 * Format bytes into human-readable size
 */
function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Format parameters inline for display (key=value, ...)
 */
function formatParams(params: Record<string, unknown>): string {
	const entries = Object.entries(params);
	if (entries.length === 0) return "";

	const formatted = entries
		.slice(0, 3) // Show max 3 params
		.map(([key, value]) => {
			let v = String(value);
			if (v.length > 30) v = `${v.slice(0, 27)}...`;
			return `${chalk.dim(key)}${chalk.dim("=")}${chalk.cyan(v)}`;
		})
		.join(chalk.dim(", "));

	const suffix = entries.length > 3 ? chalk.dim(", ...") : "";
	return `${chalk.dim("(")}${formatted}${suffix}${chalk.dim(")")}`;
}

/**
 * Format gadget result like llmist: ✓ Navigate(url=...) → 1.2KB 234ms
 */
function formatGadgetResult(
	gadgetName: string,
	params: Record<string, unknown>,
	result: string | undefined,
	error: string | undefined,
	executionTimeMs: number,
	verbose: boolean,
): string {
	const name = chalk.magenta.bold(gadgetName);
	const paramsStr = formatParams(params);
	const time = chalk.dim(`${Math.round(executionTimeMs)}ms`);

	if (error) {
		const errMsg = error.length > 60 ? `${error.slice(0, 57)}...` : error;
		return `\n${chalk.red("✗")} ${name}${paramsStr} ${chalk.red("error:")} ${errMsg} ${time}`;
	}

	const outputSize = result ? formatBytes(Buffer.byteLength(result, "utf-8")) : "0B";
	const sizeLabel = chalk.green(outputSize);

	if (verbose && result) {
		const preview = result.length > 100 ? `${result.slice(0, 97)}...` : result;
		return `\n${chalk.green("✓")} ${name}${paramsStr} ${chalk.dim("→")} ${sizeLabel} ${time}\n${chalk.dim(preview)}`;
	}

	return `\n${chalk.green("✓")} ${name}${paramsStr} ${chalk.dim("→")} ${sizeLabel} ${time}`;
}

const SYSTEM_PROMPT = `You are a browser automation assistant controlling a web browser.

## Browser State (<CurrentBrowserState>)
After each message, you receive a <CurrentBrowserState> block showing the LIVE state of the browser RIGHT NOW.
This is your source of truth for what's on screen. It contains:
- OPEN PAGES: List of available pageIds (e.g., "p1" or "p1, p2") - use these for gadget calls
- URL and title of each page
- INPUTS: Form fields with their CSS selectors
- BUTTONS: Clickable buttons with their CSS selectors
- LINKS: Navigation links with their CSS selectors
- CHECKBOXES: Checkbox/radio inputs, filter chips, toggle switches
- MENUITEMS: Dropdown/menu options (only visible when a dropdown is open)

## CRITICAL Rules
1. Use pageId "p1" which is ALREADY OPEN. Do NOT use NewPage unless you need multiple tabs.
2. ONLY use selectors EXACTLY as shown in <CurrentBrowserState> - copy/paste them verbatim
3. NEVER modify, combine, or construct selectors:
   - NO :nth-child(), :first-child, :last-child (these don't exist in CurrentBrowserState)
   - NO wildcard attributes like [href*=...] or [class*=...]
   - NO combining selectors like ".class1 .class2" unless shown exactly that way
4. If the selector you need isn't listed, use GetFullPageContent to read text content instead

## Cookie Banners & Overlays
Use DismissOverlays FIRST when you encounter cookie consent popups or blocking overlays.
It handles common patterns automatically. Only try manual clicking if DismissOverlays fails.

## Gadgets
- Navigation: Navigate (go to URL), GoBack, GoForward
- Forms: FillForm (multiple fields + submit), FillPinCode (2FA codes)
- Interaction: Click, Fill, Type, Select, Check, Hover, Scroll, DismissOverlays
- Content: GetFullPageContent (batch read with selectors array), Screenshot
- Pages: NewPage (only for new tabs), ClosePage, ListPages
- Waiting: WaitForElement (wait for element to appear), Wait
- User input: RequestUserAssistance (captchas, 2FA)

## Click Behavior
Click uses Playwright's auto-waiting - it waits for elements to be actionable before clicking.
Click also auto-scrolls elements into view if they're outside the viewport.
Just Click, then the next action will auto-wait for new elements.

## Patterns
- Start: Navigate to URL on p1 (already open)
- Cookie banner: DismissOverlays → then continue
- Login: FillForm with selectors FROM <CurrentBrowserState>
- Dropdown: Click to open → check MENUITEMS in next state → Click option
- Read data: GetFullPageContent with selectors array`;


async function main() {
	const program = new Command();

	program
		.name("webasto")
		.description("Browser automation CLI powered by llmist with Playwright gadgets")
		.version("0.1.0")
		.argument("[task]", "Natural language task to perform")
		.option("-m, --model <model>", "Model to use", "sonnet")
		.option("--headed", "Run browser in visible mode (default: headless)")
		.option("--max-iterations <n>", "Maximum agent iterations", "50")
		.option("-v, --verbose", "Show detailed gadget results", false)
		.option("--log-llm-requests", "Save LLM requests/responses to ~/.llmist/logs/requests/")
		.action(async (task: string | undefined, options: CLIOptions) => {
			if (!task) {
				console.error(chalk.red("Error: task argument is required"));
				process.exit(1);
			}
			const manager = new BrowserSessionManager();
			const pageStateScanner = new PageStateScanner(manager);

			// Auto-start browser for this session
			console.error(chalk.dim("Starting browser..."));
			const { pageId } = await manager.startBrowser({
				headless: !options.headed,
			});
			console.error(chalk.dim(`Browser ready (page: ${pageId})`));

			// Prime the state cache so first LLM call has valid state
			await pageStateScanner.refreshState();

			// Create all gadget instances with the shared manager
			const gadgets = [
				new NewPage(manager),
				new ClosePage(manager),
				new ListPages(manager),
				new Navigate(manager),
				new GoBack(manager),
				new GoForward(manager),
				new Reload(manager),
				new GetFullPageContent(manager),
				new Screenshot(manager),
				new Click(manager),
				new Type(manager),
				new Fill(manager),
				new FillForm(manager),
				new FillPinCode(manager),
				new PressKey(manager),
				new Select(manager),
				new Check(manager),
				new Hover(manager),
				new Scroll(manager),
				new DismissOverlays(manager),
				new ExecuteScript(manager),
				new WaitForElement(manager),
				new Wait(manager),
				new RequestUserAssistance(manager),
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
			console.error(chalk.dim(`Model: ${options.model} | Headed: ${options.headed || false} | Max iterations: ${options.maxIterations}`));
			console.error(chalk.dim("─".repeat(50)));

			// Set up LLM request/response logging
			const logDir = resolveLogDir(options.logLlmRequests, "requests");
			let sessionDir: string | undefined;
			let callCounter = 0;

			if (logDir) {
				console.error(chalk.dim(`Logging LLM requests to: ${logDir}`));
			}

			// Human input handler for interactive prompts (captchas, 2FA codes, etc.)
			const humanInputHandler = (question: string): Promise<string> => {
				return new Promise((resolve) => {
					const rl = readline.createInterface({
						input: process.stdin,
						output: process.stderr,
					});
					console.error(chalk.yellow(`\n${question}`));
					rl.question(chalk.cyan("➤ "), (answer) => {
						rl.close();
						resolve(answer.trim());
					});
				});
			};

			const client = new LLMist();
			const builder = new AgentBuilder(client)
				.withModel(options.model)
				.withSystem(SYSTEM_PROMPT)
				.withMaxIterations(Number.parseInt(String(options.maxIterations), 10))
				.withGadgets(...gadgets)
				.onHumanInput(humanInputHandler)
				.withTrailingMessage(() => {
					// Return cached page state (sync)
					return pageStateScanner.getCachedState();
				})
				.withHooks({
					observers: {
						onLLMCallReady: async (ctx) => {
							// Refresh page state before each LLM call
							await pageStateScanner.refreshState();

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
						const { gadgetName, parameters, result, error, executionTimeMs } = event.result;
						console.error(formatGadgetResult(gadgetName, parameters, result, error, executionTimeMs, options.verbose));
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

main().catch((error) => {
	console.error(chalk.red(`Fatal error: ${error}`));
	process.exit(1);
});
