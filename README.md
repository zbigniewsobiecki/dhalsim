<img src="dhalsim-icon.png" width="120" align="right" alt="dhalsim" />

# dhalsim

[![npm version](https://img.shields.io/npm/v/dhalsim.svg)](https://www.npmjs.com/package/dhalsim)
[![CI](https://github.com/zbigniewsobiecki/dhalsim/actions/workflows/ci.yml/badge.svg)](https://github.com/zbigniewsobiecki/dhalsim/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Browser automation gadgets for [llmist](https://llmist.dev) agents using [Camoufox](https://camoufox.com) anti-detect browser.

## Using with llmist CLI

Use dhalsim gadgets directly from the command line for quick tasks and testing.

### Quick Start

```bash
# Use the BrowseWeb subagent
npx @llmist/cli agent "go to apple.com and find iPhone 16 Pro price" -g dhalsim:subagent

# Use all gadgets (for custom agent workflows)
npx @llmist/cli agent "navigate to example.com" -g dhalsim

# Use readonly preset
npx @llmist/cli agent "take a screenshot of google.com" -g dhalsim:readonly

# Use latest dev from GitHub (with BrowseWeb subagent)
npx @llmist/cli agent "search google for llmist" -g git+https://github.com/zbigniewsobiecki/dhalsim.git#dev:subagent
```

### Configuration

Configure BrowseWeb subagent in `~/.llmist/cli.toml`:

```toml
[subagents.BrowseWeb]
model = "sonnet"              # LLM model for the subagent (default: sonnet)
maxIterations = 20            # Max agent loop iterations (default: 15)
headless = true               # Run browser in headless mode (default: true)
timeoutMs = 600000            # Overall timeout in ms (default: 300000 = 5 min, 0 = disabled)
disableCache = false          # Disable browser cache for lower memory usage (default: false)
navigationTimeoutMs = 60000   # Navigation timeout in ms (default: 60000)
```

#### Per-profile configuration

```toml
[develop.subagents.BrowseWeb]
headless = false           # Show browser during development

[research.subagents.BrowseWeb]
maxIterations = 30         # More iterations for deep research
```

#### Using "inherit" for model

```toml
[subagents.BrowseWeb]
model = "inherit"          # Use parent agent's model
```

#### Production Deployment

For production environments, consider the following settings:

```toml
[production.subagents.BrowseWeb]
headless = true               # Always run headless in production
disableCache = true           # Reduces memory per browser instance (~100-200MB savings)
navigationTimeoutMs = 90000   # 90s for slow networks or heavy sites
maxIterations = 20            # More iterations for reliability
```

**Resource requirements:**
- Each browser instance uses ~300-500MB RAM
- Running multiple concurrent `BrowseWeb` calls multiplies memory usage
- Use `disableCache = true` for environments with <1GB RAM per browser

### Custom Commands in cli.toml

```toml
[my-research-command]
gadgets = [
  "dhalsim:subagent",                                                  # from npm
  "git+https://github.com/zbigniewsobiecki/dhalsim.git#dev:subagent",  # from git
]
```

---

## Using in Projects

Install dhalsim as a dependency and use gadgets programmatically.

### Installation

```bash
npm install dhalsim
```

### Using Dhalsim Subagent

```typescript
import { LLMist } from 'llmist';
import { Dhalsim } from 'dhalsim';

const result = await LLMist.createAgent()
  .withModel('sonnet')
  .withGadgets(new Dhalsim())
  .askAndCollect('Go to google.com and search for "playwright"');

// With custom timeout (10 minutes)
const dhalsim = new Dhalsim({ timeoutMs: 600000 });

// Disable timeout for debugging
const debugDhalsim = new Dhalsim({ timeoutMs: 0 });
```

### Using Individual Gadgets

```typescript
import { LLMist } from 'llmist';
import { createGadgetsByPreset } from 'dhalsim';

const gadgets = createGadgetsByPreset('all');

const agent = LLMist.createAgent()
  .withGadgets(...gadgets)
  .ask('Navigate to example.com and take a screenshot');

for await (const event of agent.run()) {
  // handle events
}
```

---

## Presets

- `all` (default) - All gadgets
- `readonly` - Navigate, Screenshot, GetFullPageContent, ListPages
- `minimal` - Navigate, Screenshot, GetFullPageContent
- `subagent` - BrowseWeb subagent only

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

## Subagents

### BrowseWeb

Autonomous browser agent that can navigate, interact, and extract information from websites. Runs its own agent loop internally, making it suitable for complex multi-step web tasks.
