import type { McpServerConfig } from '../types.js'

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
