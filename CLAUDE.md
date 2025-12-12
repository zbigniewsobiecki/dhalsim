# Webasto

Browser automation CLI powered by llmist with Playwright gadgets.

## Quick Start

```bash
# Run with a natural language task
bun src/cli.ts "go to google.com and search for 'playwright browser automation'"

# Run with visible browser
bun src/cli.ts --no-headless "navigate to example.com and take a screenshot"

# Use a different model
bun src/cli.ts -m gpt4 "go to amazon.com and find wireless earbuds under $50"
```

## Architecture

```
src/
├── cli.ts              # CLI entry point (commander.js)
├── index.ts            # Library exports
├── logging.ts          # LLM request/response logging utilities
├── session/
│   ├── index.ts        # Session exports
│   ├── manager.ts      # BrowserSessionManager (manages browsers/pages)
│   └── types.ts        # BrowserInfo, PageInfo types
└── gadgets/
    ├── index.ts        # Export all gadgets
    ├── browser.ts      # StartBrowser, CloseBrowser, ListBrowsers
    ├── page.ts         # NewPage, ClosePage, ListPages
    ├── navigation.ts   # Navigate, GoBack, GoForward, Reload
    ├── content.ts      # GetPageContent, Screenshot, ListInteractiveElements
    ├── interaction.ts  # Click, Type, Fill, PressKey, Select, Check, Hover, Scroll
    ├── script.ts       # ExecuteScript
    └── wait.ts         # WaitForElement, WaitForNavigation, Wait
```

## Key Concepts

### BrowserSessionManager

Singleton that tracks all browser instances and pages:
- Browser IDs: `b1`, `b2`, ... (sequential)
- Page IDs: `p1`, `p2`, ... (globally unique across all browsers)

```typescript
const manager = new BrowserSessionManager();
const { browserId, pageId } = await manager.startBrowser({ headless: true });
const page = manager.requirePage(pageId);
await manager.closeAll();
```

### Gadgets

All gadgets follow the llmist Gadget pattern with Zod schemas:

```typescript
export class Navigate extends Gadget({
  description: "Navigates to a URL",
  schema: z.object({
    pageId: z.string().describe("Page ID"),
    url: z.string().url().describe("URL to navigate to"),
  }),
}) {
  constructor(private manager: BrowserSessionManager) {
    super();
  }

  async execute(params: this["params"]): Promise<string> {
    const page = this.manager.requirePage(params.pageId);
    await page.goto(params.url);
    return JSON.stringify({ url: page.url(), title: await page.title() });
  }
}
```

## Commands

```bash
# Development
bun run dev             # Run CLI in dev mode
bun run typecheck       # TypeScript check
bun run lint            # Biome lint
bun run test            # Run tests
bun run precheck        # lint + typecheck + test (pre-commit)

# Build
bun run build           # Build for distribution
```

## Available Gadgets

| Category | Gadgets |
|----------|---------|
| Browser | StartBrowser, CloseBrowser, ListBrowsers |
| Page | NewPage, ClosePage, ListPages |
| Navigation | Navigate, GoBack, GoForward, Reload |
| Content | GetPageContent, Screenshot, ListInteractiveElements |
| Interaction | Click, Type, Fill, PressKey, Select, Check, Hover, Scroll |
| Script | ExecuteScript |
| Wait | WaitForElement, WaitForNavigation, Wait |

## Testing

Tests use `bun:test` with the `testGadget` helper from llmist:

```typescript
import { testGadget } from "llmist/testing";

const gadget = new Navigate(manager);
const result = await testGadget(gadget, {
  pageId: "p1",
  url: "data:text/html,<h1>Test</h1>",
});
```

All tests use `data:` URLs to avoid network dependencies.

## Debugging

### LLM Request/Response Logging

Save raw LLM requests and responses for debugging (shared with llmist):

```bash
bun src/cli.ts --log-llm-requests "go to google.com"
```

Output structure:
```
~/.llmist/logs/requests/
└── 2025-12-12_14-30-45/
    ├── 0001.request    # First LLM call - formatted messages
    ├── 0001.response   # First LLM response - raw text
    ├── 0002.request
    └── 0002.response
```
