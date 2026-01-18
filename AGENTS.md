# Agent Guidelines for opencode-lazy-loader

## Project Overview

OpenCode Lazy Loader is a standalone OpenCode plugin that enables **Skill-Embedded MCP Support**. Skills (markdown files with YAML frontmatter) can define their own Model Context Protocol (MCP) servers, which are automatically discovered, lazily loaded, and managed by this plugin.

**Key Value Proposition**: Skills bring their own tools. No manual MCP server configuration required.

## Technical Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js >= 18 |
| Language | TypeScript (strict mode) |
| Module System | ESM (`"type": "module"`) |
| Plugin SDK | `@opencode-ai/plugin` |
| MCP SDK | `@modelcontextprotocol/sdk` |
| YAML Parser | `js-yaml` |

## Architecture

```
src/
├── index.ts              # Plugin entry point - registers tools, handles lifecycle
├── types.ts              # TypeScript interfaces and types
├── skill-loader.ts       # Skill discovery from filesystem
├── skill-mcp-manager.ts  # MCP client lifecycle management
├── tools/
│   ├── skill.ts          # `skill` tool - loads skill instructions
│   └── skill-mcp.ts      # `skill_mcp` tool - invokes MCP operations
└── utils/
    ├── env-vars.ts       # Environment variable expansion
    └── frontmatter.ts    # YAML frontmatter parsing
```

### Data Flow

```
1. Plugin loads → discoverSkills() scans filesystem
2. User calls skill(name="X") → loads instructions, connects MCP servers
3. User calls skill_mcp(mcp_name="Y", tool_name="Z") → invokes MCP tool
4. Session ends → disconnectSession() cleans up connections
5. Idle timeout (5min) → automatic connection cleanup
```

## Development Workflow

### Build & Test

```bash
# Install dependencies
npm install

# Build TypeScript to dist/
npm run build

# Watch mode during development
npm run watch

# Clean build artifacts
npm run clean
```

### Verification

Since this is a plugin loaded by OpenCode:

1. Build: `npm run build`
2. Restart OpenCode (or reload plugins if supported)
3. Test with: `skill(name="some-skill")` and `skill_mcp(...)`

### Publishing

```bash
# Verify package contents before publish
npm pack
tar -tzf opencode-lazy-loader-*.tgz | grep dist/

# Publish (prepack runs automatically)
npm publish
```

## Code Conventions

### TypeScript

- **Strict mode enabled** - no `any`, no implicit types
- **Factory functions over classes** - avoids `new` keyword issues in plugin sandbox
- **Explicit error types** - use `error instanceof Error ? error.message : String(error)`

### Error Handling

```typescript
// GOOD: Descriptive error with hints
throw new Error(
  `MCP server "${name}" not found.\n\n` +
  `Available servers:\n${list}\n\n` +
  `Hint: Load the skill first using the 'skill' tool.`
)

// BAD: Generic error
throw new Error('Server not found')
```

### MCP Configuration

Skills define MCP servers in two ways:

**1. YAML Frontmatter (in SKILL.md)**
```yaml
---
name: my-skill
description: Does something useful
mcp:
  server-name:
    command: ["npx", "-y", "@some/mcp-server"]
    env:
      API_KEY: "${MY_API_KEY}"
---
```

**2. Separate mcp.json file**
```json
{
  "mcpServers": {
    "server-name": {
      "command": ["npx", "-y", "@some/mcp-server"]
    }
  }
}
```

### Environment Variables

- Support `${VAR}` and `${VAR:-default}` syntax
- Essential vars are passed through: `PATH`, `HOME`, `USER`, `SHELL`, `TERM`, `NODE_ENV`, `TMPDIR`, `LANG`
- Custom vars from config are expanded and merged

## File Responsibilities

| File | Responsibility |
|------|----------------|
| `index.ts` | Plugin registration, tool wiring, session lifecycle |
| `types.ts` | All TypeScript interfaces - single source of truth |
| `skill-loader.ts` | Filesystem scanning, SKILL.md parsing, mcp.json loading |
| `skill-mcp-manager.ts` | Client pooling, connection lifecycle, idle cleanup |
| `tools/skill.ts` | `skill` tool - formats skill content and MCP capabilities |
| `tools/skill-mcp.ts` | `skill_mcp` tool - validates params, routes to MCP operations |
| `utils/env-vars.ts` | `${VAR}` expansion, clean environment creation |
| `utils/frontmatter.ts` | YAML frontmatter extraction |

## Key Implementation Details

### oh-my-opencode Auto-Detection

This plugin automatically disables itself when oh-my-opencode is detected to avoid conflicts (duplicate `skill` and `skill_mcp` tools).

**Detection Logic:**
1. Call `client.config.get()` via the OpenCode SDK to fetch the active config
2. Check if `oh-my-opencode` is in the `plugin` array
3. If found → return empty hooks (plugin does nothing)

**User's Config Setup:**
| Mode | Launch Command | Config File | Plugins |
|------|----------------|-------------|---------|
| Standard | `opencode` | `opencode.json` | `opencode-lazy-loader` (this plugin) |
| OMO | `OPENCODE_CONFIG=~/.config/opencode/omo.json opencode` | `omo.json` | `oh-my-opencode` |

**Developer Override:**
Set `OPENCODE_LAZY_LOADER_FORCE=1` to force-enable the plugin even when oh-my-opencode is detected (for testing).

### Connection Pooling

- Key format: `${sessionID}:${skillName}:${serverName}`
- Deduplication via `pendingConnections` Map
- Retry logic: if connection fails, cleanup and retry once

### Cleanup Strategy

1. **Session cleanup**: `disconnectSession(sessionID)` on `session.deleted` event
2. **Idle cleanup**: 60-second interval checks, 5-minute timeout
3. **Process cleanup**: SIGINT/SIGTERM handlers

### Skill Discovery Locations

| Priority | Location | Scope |
|----------|----------|-------|
| 1 (highest) | `.opencode/skill/` | Project-specific |
| 2 | `~/.config/opencode/skill/` | User global |

Project skills override global skills with the same name.

### Skill File Resolution

For a skill directory, checks in order:
1. `SKILL.md`
2. `{dirname}.md`

Standalone `.md` files in skill directories are also supported.

## Testing Checklist

Before releasing, verify:

- [ ] `npm run build` succeeds with no errors
- [ ] `npm pack` includes `dist/index.js`
- [ ] Fresh install works: `npm i opencode-lazy-loader@latest`
- [ ] `skill(name="...")` loads skill content
- [ ] `skill_mcp(...)` invokes MCP tools
- [ ] OpenCode doesn't hang on startup with plugin enabled
- [ ] Connections clean up after session ends

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| OpenCode hangs on startup | Missing `dist/` in npm package | Run `npm run build` before publish |
| `ERR_MODULE_NOT_FOUND` | Package published without build | Ensure `prepack` script exists |
| MCP connection fails | Command not found | Check PATH, ensure package installed |
| Skills not discovered | Wrong directory | Check `.opencode/skill/` or `~/.config/opencode/skill/` |
| Env vars not expanded | Wrong syntax | Use `${VAR}` not `$VAR` |

## Contributing

1. Make changes in `src/`
2. Run `npm run build` to verify TypeScript compiles
3. Test manually with OpenCode
4. Update types in `src/types.ts` if data structures change
5. Update CHANGELOG.md
