# Changelog

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
