import type { Plugin } from '@opencode-ai/plugin'
import { appendFileSync, readFileSync, existsSync } from 'fs'
import { createSkillMcpManager } from './skill-mcp-manager.js'
import { discoverSkills } from './skill-loader.js'
import { createSkillTool } from './tools/skill.js'
import { createSkillMcpTool } from './tools/skill-mcp.js'
import type { LoadedSkill } from './types.js'

const DEBUG_LOG = process.env.OPENCODE_LAZY_LOADER_DEBUG === '1'
function debugLog(msg: string) {
  if (DEBUG_LOG) {
    const line = `[${new Date().toISOString()}] ${msg}\n`
    appendFileSync('/tmp/opencode-lazy-loader.log', line)
  }
}

/**
 * Read plugins from config file directly (sync, fast)
 */
function getPluginsFromConfigFile(): string[] | null {
  const configPath = process.env.OPENCODE_CONFIG
  if (!configPath) {
    debugLog('No OPENCODE_CONFIG env var')
    return null
  }
  
  // Expand ~ to home dir
  const expandedPath = configPath.replace(/^~/, process.env.HOME || '')
  
  if (!existsSync(expandedPath)) {
    debugLog(`Config file not found: ${expandedPath}`)
    return null
  }
  
  try {
    const content = readFileSync(expandedPath, 'utf-8')
    const config = JSON.parse(content)
    debugLog(`Read config from ${expandedPath}, plugins: ${JSON.stringify(config.plugin)}`)
    return config.plugin || null
  } catch (e) {
    debugLog(`Error reading config: ${e}`)
    return null
  }
}

function hasOhMyOpencode(plugins: string[]): boolean {
  return plugins.some(p =>
    p === 'oh-my-opencode' ||
    p === '@code-yeongyu/oh-my-opencode' ||
    p.endsWith('/oh-my-opencode')
  )
}

// Helper to race a promise against a timeout
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
  ])
}

export const OpenCodeEmbeddedSkillMcp: Plugin = async ({ client }) => {
  debugLog('Plugin initializing...')
  
  // Check for oh-my-opencode conflict
  if (process.env.OPENCODE_LAZY_LOADER_FORCE !== '1') {
    debugLog('Checking for oh-my-opencode conflict...')
    
    // First try reading config file directly (fast, sync)
    const filePlugins = getPluginsFromConfigFile()
    if (filePlugins && hasOhMyOpencode(filePlugins)) {
      debugLog('oh-my-opencode detected in config file, auto-disabling')
      console.log('[opencode-lazy-loader] oh-my-opencode detected in config, auto-disabling to avoid conflicts')
      return {}
    }
    
    // Fallback: try SDK with timeout (in case OPENCODE_CONFIG not set)
    if (!filePlugins) {
      try {
        const result = await withTimeout(client.config.get(), 1000)
        debugLog(`config.get result: ${JSON.stringify(result?.data?.plugin || 'null')}`)
        if (result?.data?.plugin && hasOhMyOpencode(result.data.plugin)) {
          debugLog('oh-my-opencode detected via SDK, auto-disabling')
          console.log('[opencode-lazy-loader] oh-my-opencode detected in config, auto-disabling to avoid conflicts')
          return {}
        }
      } catch (e) {
        debugLog(`Error checking config via SDK: ${e}`)
      }
    }
    
    debugLog('No conflict detected, proceeding...')
  } else {
    debugLog('FORCE mode enabled, skipping conflict check')
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
