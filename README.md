# dhalsim

Browser automation for llmist agents using Camoufox anti-detect browser.

## Using with llmist CLI

Use dhalsim gadgets directly from the command line for quick tasks and testing.

### Quick Start

```bash
# Use the BrowseWeb subagent
llmist agent "go to apple.com and find iPhone 16 Pro price" -g dhalsim/BrowseWeb

# Use all gadgets (for custom agent workflows)
llmist agent "navigate to example.com" -g dhalsim

# Use readonly preset
llmist agent "take a screenshot of google.com" -g dhalsim:readonly

# Use latest dev from GitHub
llmist agent "search google for llmist" -g git+https://github.com/zbigniewsobiecki/dhalsim.git#dev
```

### Configuration

Configure BrowseWeb subagent in `~/.llmist/cli.toml`:

```toml
[subagents.BrowseWeb]
model = "sonnet"           # LLM model for the subagent (default: sonnet)
maxIterations = 20         # Max agent loop iterations (default: 15)
headless = true            # Run browser in headless mode (default: true)
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

### Custom Commands in cli.toml

```toml
[my-research-command]
gadgets = [
  "dhalsim/BrowseWeb",                                        # from npm
  "git+https://github.com/zbigniewsobiecki/dhalsim.git#dev",  # from git
]
```

---

## Using in Projects

Install dhalsim as a dependency and use gadgets programmatically.

### Installation

```bash
npm install dhalsim
# or
bun add dhalsim
```

### Using BrowseWeb Subagent

```typescript
import { LLMist } from 'llmist';
import { BrowseWeb } from 'dhalsim';

const result = await LLMist.createAgent()
  .withModel('sonnet')
  .withGadgets(new BrowseWeb())
  .askAndCollect('Go to google.com and search for "playwright"');
```

### Using Individual Gadgets

```typescript
import { LLMist } from 'llmist';
import { createGadgetFactory } from 'dhalsim';

const factory = createGadgetFactory();
const gadgets = factory();

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
