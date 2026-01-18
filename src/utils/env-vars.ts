import type { McpServerConfig, NormalizedCommand, NormalizedEnv } from '../types.js'

/**
 * Expand environment variables in a string
 * Supports ${VAR} and ${VAR:-default} syntax
 */
export function expandEnvVars(value: string): string {
  return value.replace(
    /\$\{([^}:]+)(?::-([^}]*))?\}/g,
    (_, varName: string, defaultValue?: string) => {
      return process.env[varName] ?? defaultValue ?? ''
    }
  )
}

/**
 * Recursively expand environment variables in an object
 */
export function expandEnvVarsInObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return expandEnvVars(obj) as T
  }
  
  if (Array.isArray(obj)) {
    return obj.map(expandEnvVarsInObject) as T
  }
  
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = expandEnvVarsInObject(value)
    }
    return result as T
  }
  
  return obj
}

/**
 * Create a clean environment for MCP processes
 * Merges process.env with custom env vars, expanding variables
 */
export function createCleanMcpEnvironment(
  customEnv?: Record<string, string>
): Record<string, string> {
  const baseEnv: Record<string, string> = {}
  
  // Copy essential environment variables
  const essentialVars = [
    'PATH',
    'HOME',
    'USER',
    'SHELL',
    'TERM',
    'NODE_ENV',
    'TMPDIR',
    'LANG',
    'LC_ALL',
    'npm_config_registry',
    'npm_config_cache'
  ]
  
  for (const varName of essentialVars) {
    if (process.env[varName]) {
      baseEnv[varName] = process.env[varName]!
    }
  }
  
  // Merge custom env vars with expansion
  if (customEnv) {
    for (const [key, value] of Object.entries(customEnv)) {
      baseEnv[key] = expandEnvVars(value)
    }
  }
  
  return baseEnv
}

export function normalizeCommand(config: McpServerConfig): NormalizedCommand {
  if (Array.isArray(config.command)) {
    if (config.command.length === 0) {
      throw new Error('Invalid MCP command configuration: command array must not be empty')
    }
    const [cmd, ...cmdArgs] = config.command.map(String)
    return { command: cmd, args: cmdArgs }
  }

  if (typeof config.command === 'string') {
    return {
      command: config.command,
      args: config.args?.map(String) ?? []
    }
  }

  throw new Error('Invalid MCP command configuration: command must be a string or array')
}

export function normalizeEnv(config: McpServerConfig): NormalizedEnv {
  const envValue = config.env ?? config.environment
  
  if (!envValue) {
    return { env: {} }
  }

  if (Array.isArray(envValue)) {
    const env: Record<string, string> = {}
    for (const entry of envValue) {
      const eqIndex = entry.indexOf('=')
      if (eqIndex > 0) {
        const key = entry.slice(0, eqIndex)
        const value = entry.slice(eqIndex + 1)
        env[key] = value
      }
    }
    return { env }
  }

  if (typeof envValue === 'object') {
    return { env: envValue }
  }

  return { env: {} }
}
