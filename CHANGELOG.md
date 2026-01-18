# Changelog

## [1.0.3] - 2025-01-18

### Fixed
- Fix startup hang caused by `client.config.get()` not responding during plugin init
- Read config file directly via `OPENCODE_CONFIG` env var for fast oh-my-opencode detection
- Add 1s timeout fallback when using SDK for config check

### Added
- Debug logging via `OPENCODE_LAZY_LOADER_DEBUG=1` (writes to `/tmp/opencode-lazy-loader.log`)

## [1.0.2] - 2025-01-18

### Fixed
- Use explicit `@opencode-ai/plugin/tool` subpath import instead of `@opencode-ai/plugin`
- Fixes Node ESM module resolution error with `@opencode-ai/plugin@1.1.25`

## [1.0.1] - 2025-01-18

### Fixed
- Add `prepack` script to ensure `dist/` is included in npm tarball
- Use `npx tsc` instead of `tsc` to avoid requiring global TypeScript installation
- Fixes `ERR_MODULE_NOT_FOUND` error when installing from npm

### Added
- `engines` field specifying Node.js >= 18 requirement
- `exports` field for proper ESM module resolution

## [1.0.0] - 2025-01-17

### Changed
- Renamed package from `opencode-embedded-skill-mcp` to `opencode-lazy-loader`

### Features
- Skill-embedded MCP support for OpenCode
- Automatic skill discovery from `.opencode/skill/` and `~/.config/opencode/skill/`
- YAML frontmatter and `mcp.json` configuration support
- Connection pooling with lazy initialization
- Automatic idle cleanup (5 minute timeout)
- Session-scoped resource management
- Environment variable expansion (`${VAR}` and `${VAR:-default}` syntax)
- `skill` tool for loading skill instructions
- `skill_mcp` tool for invoking MCP operations (tools, resources, prompts)
