import { Gadget, z } from "llmist";
import type { BrowserSessionManager } from "../session";

export class StartBrowser extends Gadget({
	description:
		"Starts a new browser instance with anti-detection measures enabled by default. Returns browserId and pageId for the initial page. Use useCamoufox=true for sites with strong bot detection (e.g., Cloudflare).",
	schema: z.object({
		url: z.string().url().optional().describe("Initial URL to navigate to after starting"),
		headless: z
			.boolean()
			.default(true)
			.describe("Run browser in headless mode (invisible). Set to false for debugging."),
		stealth: z
			.boolean()
			.default(true)
			.describe("Enable anti-detection measures (realistic user agent, viewport, patches navigator.webdriver, etc.)"),
		useCamoufox: z
			.boolean()
			.default(false)
			.describe("Use Camoufox anti-detect browser (Firefox-based) for maximum bot evasion. Bypasses Cloudflare and similar protections."),
		proxy: z
			.object({
				server: z.string().describe("Proxy server URL (e.g., 'http://proxy.example.com:8080')"),
				username: z.string().optional().describe("Proxy username for authentication"),
				password: z.string().optional().describe("Proxy password for authentication"),
			})
			.optional()
			.describe("Proxy server configuration"),
		geoip: z
			.boolean()
			.default(false)
			.describe("Auto-detect timezone/locale from proxy IP (Camoufox only). Ensures browser settings match proxy location."),
	}),
	examples: [
		{
			params: { headless: true, stealth: true, useCamoufox: false, geoip: false },
			output: '{"browserId":"b1","pageId":"p1","url":"about:blank"}',
			comment: "Start a headless browser with stealth mode",
		},
		{
			params: { url: "https://example.com", headless: false, stealth: true, useCamoufox: false, geoip: false },
			output: '{"browserId":"b1","pageId":"p1","url":"https://example.com/"}',
			comment: "Start visible browser with stealth and navigate to URL",
		},
		{
			params: { url: "https://cloudflare-protected-site.com", headless: false, stealth: true, useCamoufox: true, geoip: false },
			output: '{"browserId":"b1","pageId":"p1","url":"https://cloudflare-protected-site.com/"}',
			comment: "Use Camoufox for sites with strong bot detection",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		const result = await this.manager.startBrowser({
			headless: params.headless,
			url: params.url,
			stealth: params.stealth,
			useCamoufox: params.useCamoufox,
			proxy: params.proxy,
			geoip: params.geoip,
		});
		return JSON.stringify(result);
	}
}

export class CloseBrowser extends Gadget({
	description:
		"Closes a browser instance and all its pages. Use ListBrowsers to see available browser IDs.",
	schema: z.object({
		browserId: z.string().describe("Browser ID to close (e.g., 'b1')"),
	}),
	examples: [
		{
			params: { browserId: "b1" },
			output: '{"success":true,"closedPages":["p1","p2"]}',
			comment: "Close browser b1 and its pages",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	async execute(params: this["params"]): Promise<string> {
		try {
			const result = await this.manager.closeBrowser(params.browserId);
			return JSON.stringify(result);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify({ error: message });
		}
	}
}

export class ListBrowsers extends Gadget({
	description: "Lists all active browser instances with their IDs and page counts.",
	schema: z.object({}),
	examples: [
		{
			params: {},
			output:
				'{"browsers":[{"id":"b1","headless":true,"pageIds":["p1","p2"]},{"id":"b2","headless":false,"pageIds":["p3"]}]}',
			comment: "List all browsers",
		},
	],
}) {
	constructor(private manager: BrowserSessionManager) {
		super();
	}

	execute(): string {
		const browsers = this.manager.listBrowsers();
		return JSON.stringify({ browsers });
	}
}
