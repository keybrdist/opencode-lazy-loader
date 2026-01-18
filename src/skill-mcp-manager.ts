import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { McpClientInfo, McpContext, McpServerConfig } from './types.js'
import { expandEnvVarsInObject, createCleanMcpEnvironment, normalizeCommand, normalizeEnv } from './utils/env-vars.js'

interface ManagedClient {
  client: Client
  transport: StdioClientTransport
  skillName: string
  lastUsedAt: number
}

export interface SkillMcpManager {
  getOrCreateClient(info: McpClientInfo, config: McpServerConfig): Promise<Client>
  disconnectSession(sessionID: string): Promise<void>
  disconnectAll(): Promise<void>
  listTools(info: McpClientInfo, context: McpContext): Promise<unknown[]>
  listResources(info: McpClientInfo, context: McpContext): Promise<unknown[]>
  listPrompts(info: McpClientInfo, context: McpContext): Promise<unknown[]>
  callTool(
    info: McpClientInfo,
    context: McpContext,
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown>
  readResource(info: McpClientInfo, context: McpContext, uri: string): Promise<unknown>
  getPrompt(
    info: McpClientInfo,
    context: McpContext,
    name: string,
    args: Record<string, string>
  ): Promise<unknown>
  getConnectedServers(): string[]
  isConnected(info: McpClientInfo): boolean
}

/**
 * Create a SkillMcpManager instance
 *
 * Features:
 * - Connection pooling keyed by session/skill/server
 * - Lazy connection creation
 * - Idle cleanup after 5 minutes
 * - Session/process cleanup
 */
export function createSkillMcpManager(): SkillMcpManager {
  const clients = new Map<string, ManagedClient>()
  const pendingConnections = new Map<string, Promise<Client>>()
  let cleanupRegistered = false
  let cleanupInterval: NodeJS.Timeout | null = null
  const IDLE_TIMEOUT = 5 * 60 * 1000 // 5 minutes

  const getClientKey = (info: McpClientInfo): string => {
    return `${info.sessionID}:${info.skillName}:${info.serverName}`
  }

  const registerProcessCleanup = (): void => {
    if (cleanupRegistered) {
      return
    }

    cleanupRegistered = true

    const cleanup = async () => {
      for (const [, managed] of clients) {
        try {
          await managed.client.close()
        } catch {
          // Ignore cleanup errors
        }
        try {
          await managed.transport.close()
        } catch {
          // Ignore cleanup errors
        }
      }
      clients.clear()
      pendingConnections.clear()
    }

    process.on('SIGINT', async () => {
      await cleanup()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      await cleanup()
      process.exit(0)
    })

    if (process.platform === 'win32') {
      process.on('SIGBREAK', async () => {
        await cleanup()
        process.exit(0)
      })
    }
  }

  const createClient = async (
    info: McpClientInfo,
    config: McpServerConfig
  ): Promise<Client> => {
    const key = getClientKey(info)

    if (!config.command) {
      throw new Error(
        `MCP server "${info.serverName}" is missing required 'command' field.\n\n` +
        `The MCP configuration in skill "${info.skillName}" must specify a command to execute.\n\n` +
        `Supported formats:\n` +
        `  Format A (array):  command: ["npx", "-y", "@some/mcp-server"]\n` +
        `  Format B (string): command: "npx", args: ["-y", "@some/mcp-server"]`
      )
    }

    const { command, args } = normalizeCommand(config)
    const { env } = normalizeEnv(config)
    const mergedEnv = createCleanMcpEnvironment(env)

    registerProcessCleanup()

    const transport = new StdioClientTransport({
      command,
      args,
      env: mergedEnv,
      stderr: 'ignore'
    })

    const client = new Client(
      { name: `skill-mcp-${info.skillName}-${info.serverName}`, version: '1.0.0' },
      { capabilities: {} }
    )

    try {
      await client.connect(transport)
    } catch (error) {
      try {
        await transport.close()
      } catch {
        // Ignore cleanup errors
      }

      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Failed to connect to MCP server "${info.serverName}".\n\n` +
        `Command: ${command} ${args.join(' ')}\n` +
        `Reason: ${errorMessage}\n\n` +
        `Hints:\n` +
        `  - Ensure the command is installed and available in PATH\n` +
        `  - Check if the MCP server package exists\n` +
        `  - Verify the args are correct for this server`
      )
    }

    clients.set(key, {
      client,
      transport,
      skillName: info.skillName,
      lastUsedAt: Date.now()
    })

    startCleanupTimer()

    return client
  }

  const getOrCreateClient = async (
    info: McpClientInfo,
    config: McpServerConfig
  ): Promise<Client> => {
    const key = getClientKey(info)

    const existing = clients.get(key)
    if (existing) {
      existing.lastUsedAt = Date.now()
      return existing.client
    }

    const pending = pendingConnections.get(key)
    if (pending) {
      return pending
    }

    const expandedConfig = expandEnvVarsInObject(config)
    const connectionPromise = createClient(info, expandedConfig)
    pendingConnections.set(key, connectionPromise)

    try {
      const client = await connectionPromise
      return client
    } finally {
      pendingConnections.delete(key)
    }
  }

  const disconnectSession = async (sessionID: string): Promise<void> => {
    for (const [key, managed] of clients.entries()) {
      if (key.startsWith(`${sessionID}:`)) {
        clients.delete(key)
        try {
          await managed.client.close()
        } catch {
          // Ignore cleanup errors
        }
        try {
          await managed.transport.close()
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  const disconnectAll = async (): Promise<void> => {
    stopCleanupTimer()

    const allClients = Array.from(clients.values())
    clients.clear()

    for (const managed of allClients) {
      try {
        await managed.client.close()
      } catch {
        // Ignore cleanup errors
      }
      try {
        await managed.transport.close()
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  const startCleanupTimer = (): void => {
    if (cleanupInterval) {
      return
    }

    cleanupInterval = setInterval(() => {
      cleanupIdleClients()
    }, 60000)

    cleanupInterval.unref()
  }

  const stopCleanupTimer = (): void => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval)
      cleanupInterval = null
    }
  }

  const cleanupIdleClients = async (): Promise<void> => {
    const now = Date.now()

    for (const [key, managed] of clients) {
      if (now - managed.lastUsedAt > IDLE_TIMEOUT) {
        clients.delete(key)
        try {
          await managed.client.close()
        } catch {
          // Ignore cleanup errors
        }
        try {
          await managed.transport.close()
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  const getOrCreateClientWithRetry = async (
    info: McpClientInfo,
    config: McpServerConfig
  ): Promise<Client> => {
    try {
      return await getOrCreateClient(info, config)
    } catch (error) {
      const key = getClientKey(info)
      const existing = clients.get(key)
      if (existing) {
        clients.delete(key)
        try {
          await existing.client.close()
        } catch {
          // Ignore
        }
        try {
          await existing.transport.close()
        } catch {
          // Ignore
        }
        return await getOrCreateClient(info, config)
      }
      throw error
    }
  }

  const listTools = async (info: McpClientInfo, context: McpContext): Promise<unknown[]> => {
    const client = await getOrCreateClientWithRetry(info, context.config)
    const result = await client.listTools()
    return result.tools
  }

  const listResources = async (info: McpClientInfo, context: McpContext): Promise<unknown[]> => {
    const client = await getOrCreateClientWithRetry(info, context.config)
    const result = await client.listResources()
    return result.resources
  }

  const listPrompts = async (info: McpClientInfo, context: McpContext): Promise<unknown[]> => {
    const client = await getOrCreateClientWithRetry(info, context.config)
    const result = await client.listPrompts()
    return result.prompts
  }

  const callTool = async (
    info: McpClientInfo,
    context: McpContext,
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown> => {
    const client = await getOrCreateClientWithRetry(info, context.config)
    const result = await client.callTool({ name, arguments: args })
    return result.content
  }

  const readResource = async (
    info: McpClientInfo,
    context: McpContext,
    uri: string
  ): Promise<unknown> => {
    const client = await getOrCreateClientWithRetry(info, context.config)
    const result = await client.readResource({ uri })
    return result.contents
  }

  const getPrompt = async (
    info: McpClientInfo,
    context: McpContext,
    name: string,
    args: Record<string, string>
  ): Promise<unknown> => {
    const client = await getOrCreateClientWithRetry(info, context.config)
    const result = await client.getPrompt({ name, arguments: args })
    return result.messages
  }

  const getConnectedServers = (): string[] => {
    return Array.from(clients.keys())
  }

  const isConnected = (info: McpClientInfo): boolean => {
    return clients.has(getClientKey(info))
  }

  return {
    getOrCreateClient,
    disconnectSession,
    disconnectAll,
    listTools,
    listResources,
    listPrompts,
    callTool,
    readResource,
    getPrompt,
    getConnectedServers,
    isConnected
  }
}
