# Dhalsim

Browser automation gadgets for llmist using Camoufox anti-detect browser.

## Usage

See [README.md](./README.md) for usage instructions with llmist CLI and configuration options.

## Architecture

```
src/
├── index.ts            # Library exports
├── factory.ts          # Gadget factory functions
├── session/
│   ├── index.ts        # Session exports
│   ├── manager.ts      # BrowserSessionManager (manages browsers/pages)
│   └── types.ts        # BrowserInfo, PageInfo types
├── gadgets/
│   ├── index.ts        # Export all gadgets
│   ├── browser.ts      # StartBrowser, CloseBrowser, ListBrowsers
│   ├── page.ts         # NewPage, ClosePage, ListPages
│   ├── navigation.ts   # Navigate, GoBack, GoForward, Reload
│   ├── content.ts      # GetFullPageContent, Screenshot, ListInteractiveElements
│   ├── interaction.ts  # Click, Type, Fill, PressKey, Select, Check, Hover, Scroll
│   ├── script.ts       # ExecuteScript
│   └── wait.ts         # WaitForElement, Wait
├── subagents/
│   └── dhalsim.ts      # BrowseWeb subagent (autonomous browser agent)
└── state/
    └── scanner.ts      # Page state scanning utilities
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
bun run typecheck       # TypeScript check
bun run lint            # Biome lint
bun run test            # Run tests
bun run precheck        # lint + typecheck + test (pre-commit)
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
| Wait | WaitForElement, Wait |

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
