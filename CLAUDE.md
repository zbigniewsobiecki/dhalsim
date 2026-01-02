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
│   ├── click.ts        # Click
│   ├── content.ts      # GetFullPageContent, Screenshot
│   ├── form.ts         # Type, Fill, FillForm, FillPinCode
│   ├── keyboard.ts     # PressKey
│   ├── navigation.ts   # Navigate, GoBack, GoForward, Reload
│   ├── overlays.ts     # DismissOverlays
│   ├── page.ts         # NewPage, ClosePage, ListPages
│   ├── script.ts       # ExecuteScript
│   ├── scroll.ts       # Hover, Scroll
│   ├── selection.ts    # Select, Check
│   ├── user-input.ts   # RequestUserAssistance
│   └── wait.ts         # WaitForElement, Wait
├── subagents/
│   └── dhalsim.ts      # BrowseWeb subagent (autonomous browser agent)
└── state/
    └── page-state.ts   # Page state scanning utilities
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
npm run typecheck       # TypeScript check
npm run lint            # Biome lint
npm test                # Run tests
npm run precheck        # lint + typecheck + test (pre-commit)
npm run build           # Build for distribution
```

## Available Gadgets

| Category | Gadgets |
|----------|---------|
| Page | NewPage, ClosePage, ListPages |
| Navigation | Navigate, GoBack, GoForward, Reload |
| Content | GetFullPageContent, Screenshot |
| Interaction | Click, Type, Fill, FillForm, PressKey, Select, Check, Hover, Scroll, DismissOverlays |
| Script | ExecuteScript |
| Wait | WaitForElement, Wait |
| User Input | RequestUserAssistance |

## Testing

Tests use `vitest` with the `testGadget` helper from llmist:

```typescript
import { testGadget } from "llmist/testing";

const gadget = new Navigate(manager);
const result = await testGadget(gadget, {
  pageId: "p1",
  url: "data:text/html,<h1>Test</h1>",
});
```

All tests use `data:` URLs to avoid network dependencies.
