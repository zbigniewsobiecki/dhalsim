# dhalsim

Browser automation for llmist agents using Camoufox anti-detect browser.

## Installation

### From npm
```bash
npm install dhalsim
```

### From GitHub (latest dev)
```bash
# In llmist CLI commands or cli.toml
git+https://github.com/zbigniewsobiecki/dhalsim.git
git+https://github.com/zbigniewsobiecki/dhalsim.git#dev
```

## Usage

### Via llmist CLI

```bash
# Use the BrowseWeb subagent
llmist agent "go to apple.com and find iPhone 16 Pro price" -g dhalsim/BrowseWeb

# Use all gadgets (for custom agent workflows)
llmist agent "navigate to example.com" -g dhalsim

# Use readonly preset
llmist agent "take a screenshot of google.com" -g dhalsim:readonly
```

### In cli.toml

```toml
[my-command]
gadgets = [
  "dhalsim/BrowseWeb",                                    # from npm
  "git+https://github.com/zbigniewsobiecki/dhalsim.git#dev",  # from git
]
```

## Configuration

Configure BrowseWeb subagent in `~/.llmist/cli.toml`:

```toml
[subagents.BrowseWeb]
model = "sonnet"           # LLM model for the subagent (default: sonnet)
maxIterations = 20         # Max agent loop iterations (default: 15)
headless = true            # Run browser in headless mode (default: true)
```

### Per-profile configuration

```toml
[develop.subagents.BrowseWeb]
headless = false           # Show browser during development

[research.subagents.BrowseWeb]
maxIterations = 30         # More iterations for deep research
```

### Using "inherit" for model

```toml
[subagents.BrowseWeb]
model = "inherit"          # Use parent agent's model
```

## Presets

- `all` (default) - All gadgets
- `readonly` - Navigate, Screenshot, GetFullPageContent, ListPages
- `minimal` - Navigate, Screenshot, GetFullPageContent
- `subagent` - BrowseWeb subagent only

## Available Gadgets

| Category | Gadgets |
|----------|---------|
| Browser | StartBrowser, CloseBrowser, ListBrowsers |
| Page | NewPage, ClosePage, ListPages |
| Navigation | Navigate, GoBack, GoForward, Reload |
| Content | GetFullPageContent, Screenshot, ListInteractiveElements |
| Interaction | Click, Type, Fill, PressKey, Select, Check, Hover, Scroll |
| Script | ExecuteScript |
| Wait | WaitForElement, Wait |

## Subagents

### BrowseWeb

Autonomous browser agent that can navigate, interact, and extract information from websites.

```bash
llmist agent "research latest news about AI" -g dhalsim/BrowseWeb
```
