import type { Plugin } from '@opencode-ai/plugin'
import { createSkillMcpManager } from './skill-mcp-manager.js'
import { discoverSkills } from './skill-loader.js'
import { createSkillTool } from './tools/skill.js'
import { createSkillMcpTool } from './tools/skill-mcp.js'
import type { LoadedSkill } from './types.js'

function hasOhMyOpencode(plugins: string[]): boolean {
  return plugins.some(p => 
    p === 'oh-my-opencode' || 
    p.includes('/oh-my-opencode') ||
    p.startsWith('@code-yeongyu/oh-my-opencode')
  )
}

export const OpenCodeEmbeddedSkillMcp: Plugin = async ({ client }) => {
  if (process.env.OPENCODE_LAZY_LOADER_FORCE !== '1') {
    try {
      const { data: config } = await client.config.get()
      if (config?.plugin && hasOhMyOpencode(config.plugin)) {
        console.log('[opencode-lazy-loader] oh-my-opencode detected in config, auto-disabling to avoid conflicts')
        return {}
      }
    } catch {
    }
  }
  const manager = createSkillMcpManager()
  let loadedSkills: LoadedSkill[] = []
  let currentSessionID: string | null = null

  // Discover skills on initialization
  try {
    loadedSkills = await discoverSkills()
  } catch {
    loadedSkills = []
  }

  return {
    // Handle session lifecycle events
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        currentSessionID = event.properties.info.id
      }
      
      if (event.type === 'session.deleted' && currentSessionID) {
        // Cleanup MCP connections for the deleted session
        await manager.disconnectSession(currentSessionID)
        currentSessionID = null
      }
    },

    // Register tools
    tool: {
      skill: createSkillTool({
        skills: loadedSkills,
        mcpManager: manager,
        getSessionID: () => currentSessionID || 'unknown'
      }),
      skill_mcp: createSkillMcpTool({
        manager,
        getLoadedSkills: () => loadedSkills,
        getSessionID: () => currentSessionID || 'unknown'
      })
    }
  }
}

// Default export for plugin loading
export default OpenCodeEmbeddedSkillMcp

// Re-export types for external use
export type { LoadedSkill, McpServerConfig, SkillScope } from './types.js'
export { discoverSkills } from './skill-loader.js'
export { createSkillMcpManager } from './skill-mcp-manager.js'
