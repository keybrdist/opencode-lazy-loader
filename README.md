# OpenCode Embedded Skill MCP Plugin

A standalone OpenCode plugin that enables skills to bundle and manage their own [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers.

This allows skills to bring their own tools, resources, and prompts without requiring manual server configuration in `opencode.json`.

## Why use this?

- **🔌 Plug-and-Play Skills**: Skills bring their own tools. No need to manually register servers in your global config.
- **🧠 Cleaner Context**: Tools are loaded on-demand only when the skill is active, keeping your agent's context window focused and efficient.
- **📦 Team Portability**: Commit skills to your project repo; anyone with the plugin gets the tools automatically.
- **⚡ Efficient Resources**: Servers start only when used and shut down automatically after 5 minutes of inactivity.

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

Add the plugin to your `opencode.json`:

```json
{
  "plugin": ["opencode-embedded-skill-mcp"]
}
```

Or install it locally:

```json
{
  "plugin": ["./path/to/opencode-embedded-skill-mcp"]
}
```

## Usage

### 1. Create a Skill with Embedded MCP

You can define MCP servers in the skill's YAML frontmatter:

**`~/.config/opencode/skill/my-skill/SKILL.md`**

```markdown
---
name: my-skill
description: "A skill that uses a custom MCP server"
mcp:
  my-server:
    command: ["npx", "-y", "@some/mcp-server"]
    environment:
      API_KEY: "${MY_API_KEY}"
---

# My Skill

This skill provides tools via the `my-server` MCP.
```

Alternatively, place an `mcp.json` file in the skill directory:

**`~/.config/opencode/skill/my-skill/mcp.json`**

```json
{
  "mcpServers": {
    "my-server": {
      "command": ["npx", "-y", "@some/mcp-server"]
    }
  }
}
```

### 2. Load the Skill

In OpenCode:

```
skill(name="my-skill")
```

**Pro Tip:** You don't always need to call the tool explicitly. Just ask for the skill by name in chat, and OpenCode will usually find and load it for you:

> "Use the my-skill skill to do X"

The plugin will load the skill and discover the capabilities of the embedded MCP server.

### 3. Use MCP Tools

Invoke tools, read resources, or get prompts using `skill_mcp`:

```
skill_mcp(mcp_name="my-server", tool_name="some-tool", arguments='{"key": "value"}')
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

The MCP configuration supports the standard format:

```typescript
interface McpServerConfig {
  command: string | string[];          // Command to execute (array recommended for args)
  environment?: Record<string, string> // Environment variables
}
```

## License

MIT
