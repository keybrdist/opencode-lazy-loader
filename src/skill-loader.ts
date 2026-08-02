import { promises as fs, Dirent } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'
import type { LoadedSkill, McpServerConfig, SkillScope, LazyContent } from './types.js'
import { parseFrontmatter, parseSkillMcpConfigFromFrontmatter } from './utils/frontmatter.js'

/**
 * Check if a file is a markdown file
 */
function isMarkdownFile(entry: { name: string }): boolean {
  return entry.name.endsWith('.md')
}

/**
 * Resolve symlink to its target path
 */
async function resolveSymlinkAsync(entryPath: string): Promise<string> {
  try {
    const realPath = await fs.realpath(entryPath)
    return realPath
  } catch {
    return entryPath
  }
}

/**
 * Load MCP config from mcp.json file in skill directory
 */
export async function loadMcpJsonFromDir(
  skillDir: string
): Promise<Record<string, McpServerConfig> | undefined> {
  const mcpJsonPath = join(skillDir, 'mcp.json')
  
  try {
    const content = await fs.readFile(mcpJsonPath, 'utf-8')
    const parsed = JSON.parse(content) as Record<string, unknown>

    // Support { mcpServers: { ... } } format
    if (parsed && typeof parsed === 'object' && 'mcpServers' in parsed && parsed.mcpServers) {
      return parsed.mcpServers as Record<string, McpServerConfig>
    }

    // Support { mcp: { ... } } format (OpenCode config style)
    if (parsed && typeof parsed === 'object' && 'mcp' in parsed && parsed.mcp) {
      return parsed.mcp as Record<string, McpServerConfig>
    }

    // Support direct { serverName: { command: ... } } or { serverName: { type: "remote", url: ... } } format
    if (parsed && typeof parsed === 'object' && !('mcpServers' in parsed) && !('mcp' in parsed)) {
      const hasCommandField = Object.values(parsed).some(
        (v) => v && typeof v === 'object' && 'command' in (v as Record<string, unknown>)
      )
      const hasRemoteConfig = Object.values(parsed).some(
        (v) => v && typeof v === 'object' && 'type' in (v as Record<string, unknown>) && (v as Record<string, unknown>).type === 'remote'
      )
      if (hasCommandField || hasRemoteConfig) {
        return parsed as unknown as Record<string, McpServerConfig>
      }
    }
  } catch {
    return undefined
  }

  return undefined
}

/**
 * Load a skill from a markdown file path
 */
export async function loadSkillFromPath(
  skillPath: string,
  resolvedPath: string,
  defaultName: string,
  scope: SkillScope
): Promise<LoadedSkill | null> {
  try {
    const content = await fs.readFile(skillPath, 'utf-8')
    const { data } = parseFrontmatter(content)

    // Load MCP config from frontmatter or mcp.json
    const frontmatterMcp = parseSkillMcpConfigFromFrontmatter(content)
    const mcpJsonMcp = await loadMcpJsonFromDir(resolvedPath)
    const mcpConfig = mcpJsonMcp || frontmatterMcp // mcp.json takes priority

    const skillName = data.name || defaultName
    const originalDescription = data.description || ''
    const formattedDescription = `(${scope} - Skill) ${originalDescription}`

    // Create lazy content loader
    const lazyContent: LazyContent = {
      loaded: false,
      content: undefined,
      load: async () => {
        if (!lazyContent.loaded) {
          const fileContent = await fs.readFile(skillPath, 'utf-8')
          const { body } = parseFrontmatter(fileContent)
          lazyContent.content = `<skill-instruction>
Base directory for this skill: ${resolvedPath}/
File references (@path) in this skill are relative to this directory.

${body.trim()}
</skill-instruction>

<user-request>
$ARGUMENTS
</user-request>`
          lazyContent.loaded = true
        }
        return lazyContent.content!
      }
    }

    return {
      name: skillName,
      path: skillPath,
      resolvedPath,
      definition: {
        name: skillName,
        description: formattedDescription,
        template: ''
      },
      scope,
      mcpConfig,
      lazyContent
    }
  } catch {
    return null
  }
}

/**
 * Load all skills from a directory
 */
export async function loadSkillsFromDir(
  skillsDir: string,
  scope: SkillScope
): Promise<LoadedSkill[]> {
  const entries: Dirent<string>[] = await fs.readdir(skillsDir, { withFileTypes: true }).catch(() => [])
  const skills: LoadedSkill[] = []

  for (const entry of entries) {
    // Skip hidden files
    if (entry.name.startsWith('.')) {
      continue
    }

    const entryPath = join(skillsDir, entry.name)

    // Handle directories (skill folders)
    if (entry.isDirectory() || entry.isSymbolicLink()) {
      const resolvedPath = await resolveSymlinkAsync(entryPath)
      const dirName = entry.name

      // Try SKILL.md first
      const skillMdPath = join(resolvedPath, 'SKILL.md')
      try {
        await fs.access(skillMdPath)
        const skill = await loadSkillFromPath(skillMdPath, resolvedPath, dirName, scope)
        if (skill) {
          skills.push(skill)
        }
        continue
      } catch {
        // SKILL.md not found, try {dirname}.md
      }

      // Try {dirname}.md
      const namedSkillMdPath = join(resolvedPath, `${dirName}.md`)
      try {
        await fs.access(namedSkillMdPath)
        const skill = await loadSkillFromPath(namedSkillMdPath, resolvedPath, dirName, scope)
        if (skill) {
          skills.push(skill)
        }
        continue
      } catch {
        // Named skill file not found
      }

      continue
    }

    // Handle standalone markdown files
    if (isMarkdownFile(entry)) {
      const skillName = basename(entry.name, '.md')
      const skill = await loadSkillFromPath(entryPath, skillsDir, skillName, scope)
      if (skill) {
        skills.push(skill)
      }
    }
  }

  return skills
}

/**
 * Discover skills from opencode global directory (~/.config/opencode/skills/)
 */
export async function discoverOpencodeGlobalSkills(): Promise<LoadedSkill[]> {
  const opencodeSkillsDir = join(homedir(), '.config', 'opencode', 'skills')
  return loadSkillsFromDir(opencodeSkillsDir, 'opencode')
}

/**
 * Discover skills from opencode project directory (.opencode/skills/)
 */
export async function discoverOpencodeProjectSkills(): Promise<LoadedSkill[]> {
  const opencodeProjectDir = join(process.cwd(), '.opencode', 'skills')
  return loadSkillsFromDir(opencodeProjectDir, 'opencode-project')
}

/**
 * Discover all skills from both opencode locations
 * Priority: project > global
 */
export async function discoverSkills(): Promise<LoadedSkill[]> {
  const [projectSkills, globalSkills] = await Promise.all([
    discoverOpencodeProjectSkills(),
    discoverOpencodeGlobalSkills()
  ])

  // Project skills take priority - dedupe by name
  const skillMap = new Map<string, LoadedSkill>()
  
  // Add global skills first
  for (const skill of globalSkills) {
    skillMap.set(skill.name, skill)
  }
  
  // Project skills override global
  for (const skill of projectSkills) {
    skillMap.set(skill.name, skill)
  }

  return Array.from(skillMap.values())
}
