/**
 * Configuration for an MCP server
 *
 * Command formats:
 * 1. Array format: command: ["npx", "-y", "@some/mcp-server"]
 * 2. String + args: command: "npx", args: ["-y", "@some/mcp-server"]
 *
 * Environment variable formats:
 * 1. Object format (oh-my-opencode): env: { "KEY": "value" }
 * 2. Array format (OpenCode): env: ["KEY=value"]
 */
export interface McpServerConfig {
  command?: string | string[]
  args?: string[]
  env?: Record<string, string> | string[]
}

export interface NormalizedCommand {
  command: string
  args: string[]
}

export interface NormalizedEnv {
  env: Record<string, string>
}

/**
 * Skill scope - where the skill was loaded from
 */
export type SkillScope = 'opencode' | 'opencode-project'

/**
 * Lazy content loader for skill templates
 */
export interface LazyContent {
  loaded: boolean
  content?: string
  load: () => Promise<string>
}

/**
 * Skill definition stored with the skill
 */
export interface SkillDefinition {
  name: string
  description: string
  template: string
}

/**
 * A loaded skill with all metadata
 */
export interface LoadedSkill {
  name: string
  path?: string
  resolvedPath?: string
  definition: SkillDefinition
  scope: SkillScope
  mcpConfig?: Record<string, McpServerConfig>
  lazyContent?: LazyContent
}

/**
 * Information needed to identify an MCP client connection
 */
export interface McpClientInfo {
  sessionID: string
  skillName: string
  serverName: string
}

/**
 * Context for MCP operations
 */
export interface McpContext {
  config: McpServerConfig
  skillName: string
}

/**
 * Parsed frontmatter data from skill markdown
 */
export interface SkillFrontmatter {
  name?: string
  description?: string
  mcp?: Record<string, McpServerConfig>
}

/**
 * Result of parsing a markdown file with frontmatter
 */
export interface ParsedFrontmatter {
  data: SkillFrontmatter
  body: string
}
