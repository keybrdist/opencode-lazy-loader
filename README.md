# OpenCode Lazy Loader Plugin

This is the OpenCode plugin that lazy-loads skill-embedded MCP servers. It lets skills bundle their own MCP servers so they can be loaded on-demand instead of being configured globally.

Note: This package was renamed from `opencode-embedded-skill-mcp` to `opencode-lazy-loader`. If you still have the old package, upgrade to the new name.

This is a standalone OpenCode plugin that enables skills to bundle and manage their own [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers, then lazy-load them on demand.

This allows skills to bring their own tools, resources, and prompts without requiring manual server configuration in `opencode.json`.

## Why use this?

- **Plug-and-Play Skills**: Skills bring their own tools. No need to manually register servers in your global config.
- **Cleaner Context**: Tools are loaded on-demand only when the skill is active, keeping your agent's context window focused and efficient.
- **Team Portability**: Commit skills to your project repo; anyone with the plugin gets the tools automatically.
- **Efficient Resources**: Servers start only when used and shut down automatically after 5 minutes of inactivity.

---

## Technical Features

- **Skill-Embedded MCPs**: Configure MCP servers directly within skill definitions (markdown frontmatter or `mcp.json`).
- **Zero Configuration**: Skills manage their own MCP connections; just load the skill and use the tools.
- **Connection Management**:
  - Connection pooling per session/skill/server.
  - Lazy connection initialization (connects on first use).
  - Automatic idle cleanup (disconnects after 5 minutes of inactivity).
  - Session-scoped resource cleanup.
- **Environment Variable Support**: Full support for `${VAR}` and `${VAR:-default}` expansion in MCP configurations.

## Installation

Deprecation notice: The package was renamed from `opencode-embedded-skill-mcp` to `opencode-lazy-loader`. If you installed the old name, update to the new package.

Add the plugin to your `opencode.json`:

```json
{
  "plugin": ["opencode-lazy-loader"]
}
```

Or install it locally:

```json
{
  "plugin": ["./path/to/opencode-lazy-loader"]
}
```

## Quick Start

This repo includes a working example skill. After installing the plugin, try:

```
skill(name="playwright-example")
```

Then use the embedded MCP:

```
skill_mcp(mcp_name="playwright", tool_name="browser_navigate", arguments='{"url": "https://example.com"}')
```

See [`.opencode/skill/playwright-example/SKILL.md`](.opencode/skill/playwright-example/SKILL.md) for the full example.

## Usage

### 1. Create a Skill with Embedded MCP

You can define MCP servers in the skill's YAML frontmatter:

**`~/.config/opencode/skill/my-skill/SKILL.md`**

```markdown
---
name: browser-automation
description: "A skill for automating browser interactions"
mcp:
  playwright:
    command: ["npx", "-y", "@playwright/mcp@latest"]
---

# Browser Automation

This skill provides browser automation tools via the `playwright` MCP.
```

Alternatively, place an `mcp.json` file in the skill directory:

**`~/.config/opencode/skill/browser-automation/mcp.json`**

```json
{
  "mcpServers": {
    "playwright": {
      "command": ["npx", "-y", "@playwright/mcp@latest"]
    }
  }
}
```

### 2. Load the Skill

In OpenCode:

```
skill(name="browser-automation")
```

**Pro Tip:** You don't always need to call the tool explicitly. Just ask for the skill by name in chat, and OpenCode will usually find and load it for you:

> "Use the browser-automation skill to take a screenshot of google.com"

The plugin will load the skill and discover the capabilities of the embedded MCP server.

### 3. Use MCP Tools

Invoke tools, read resources, or get prompts using `skill_mcp`:

```
skill_mcp(mcp_name="playwright", tool_name="screenshot", arguments='{"url": "https://google.com"}')
```

## Tools Provided

### `skill`

Loads a skill and displays its instructions along with any available MCP capabilities (tools, resources, prompts).

- **name**: The name of the skill to load.

### `skill_mcp`

Invokes an operation on a skill-embedded MCP server.

- **mcp_name**: The name of the MCP server (defined in the skill config).
- **tool_name**: (Optional) The name of the tool to call.
- **resource_name**: (Optional) The URI of the resource to read.
- **prompt_name**: (Optional) The name of the prompt to get.
- **arguments**: (Optional) JSON string of arguments for the operation.
- **grep**: (Optional) Regex pattern to filter the output.

## Configuration Format

The MCP configuration supports multiple formats for compatibility with both OpenCode and oh-my-opencode:

```typescript
interface McpServerConfig {
  // Command formats (both supported):
  command: string | string[]   // Array: ["npx", "-y", "@some/mcp"] or String: "npx"
  args?: string[]              // Used with string command: ["-y", "@some/mcp"]
  
  // Environment variable formats (both supported):
  env?: Record<string, string> | string[]  // Object: { "KEY": "val" } or Array: ["KEY=val"]
}
```

### Examples

**Object format for env (recommended):**
```json
{
  "my-server": {
    "command": "npx",
    "args": ["-y", "@some/mcp-server"],
    "env": {
      "API_KEY": "${MY_API_KEY}",
      "DEBUG": "true"
    }
  }
}
```

**Array format for env (OpenCode style):**
```json
{
  "my-server": {
    "command": ["npx", "-y", "@some/mcp-server"],
    "env": ["API_KEY=${MY_API_KEY}", "DEBUG=true"]
  }
}
```

## Example Skill

Here's a complete example of a skill with an embedded MCP server (from [`.opencode/skill/playwright-example/SKILL.md`](.opencode/skill/playwright-example/SKILL.md)):

```markdown
---
name: playwright-example
description: Browser automation skill for web testing, scraping, and interaction. Use for end-to-end testing, screenshots, and browser automation tasks.
argument-hint: describe what you want to do (e.g., "take a screenshot of homepage", "test login flow", "fill out a form")
mcp:
  playwright:
    command: ["npx", "-y", "@playwright/mcp@latest"]
---

# Playwright Browser Automation

This skill provides browser automation capabilities via the Playwright MCP server.

## Available Operations

- **Navigation**: Navigate to URLs, go back/forward, reload pages
- **Screenshots**: Capture full page or element screenshots
- **Interactions**: Click, type, select, hover, and other user interactions
- **Forms**: Fill out forms, submit data, handle file uploads

## Example Tasks

- "Navigate to the login page and take a screenshot"
- "Fill out the registration form with test data"
- "Extract all product names from the catalog page"
```

## License

MIT
