import { describe, it, expect } from 'vitest'
import { normalizeCommand, normalizeEnv } from '../utils/env-vars.js'
import type { McpServerConfig } from '../types.js'

describe('normalizeCommand', () => {
  describe('OpenCode format (command as array)', () => {
    it('parses command array with executable and args', () => {
      const config: McpServerConfig = {
        command: ['npx', '-y', '@playwright/mcp@latest']
      }

      const result = normalizeCommand(config)

      expect(result.command).toBe('npx')
      expect(result.args).toEqual(['-y', '@playwright/mcp@latest'])
    })

    it('handles command array with only executable', () => {
      const config: McpServerConfig = {
        command: ['node']
      }

      const result = normalizeCommand(config)

      expect(result.command).toBe('node')
      expect(result.args).toEqual([])
    })

    it('converts non-string array elements to strings', () => {
      const config: McpServerConfig = {
        command: ['node', '--port', 3000 as unknown as string]
      }

      const result = normalizeCommand(config)

      expect(result.command).toBe('node')
      expect(result.args).toEqual(['--port', '3000'])
    })
  })

  describe('oh-my-opencode format (command string + args array)', () => {
    it('parses command string with args array', () => {
      const config: McpServerConfig = {
        command: 'npx',
        args: ['-y', '@anthropic-ai/mcp-playwright']
      }

      const result = normalizeCommand(config)

      expect(result.command).toBe('npx')
      expect(result.args).toEqual(['-y', '@anthropic-ai/mcp-playwright'])
    })

    it('handles command string without args', () => {
      const config: McpServerConfig = {
        command: 'node'
      }

      const result = normalizeCommand(config)

      expect(result.command).toBe('node')
      expect(result.args).toEqual([])
    })

    it('handles command string with empty args array', () => {
      const config: McpServerConfig = {
        command: 'python',
        args: []
      }

      const result = normalizeCommand(config)

      expect(result.command).toBe('python')
      expect(result.args).toEqual([])
    })

    it('converts non-string args to strings', () => {
      const config: McpServerConfig = {
        command: 'node',
        args: ['--port', 8080 as unknown as string]
      }

      const result = normalizeCommand(config)

      expect(result.command).toBe('node')
      expect(result.args).toEqual(['--port', '8080'])
    })
  })

  describe('edge cases', () => {
    it('throws error when command is undefined', () => {
      const config: McpServerConfig = {}

      expect(() => normalizeCommand(config)).toThrow(
        'Invalid MCP command configuration: command must be a string or array'
      )
    })

    it('throws error when command is empty array', () => {
      const config: McpServerConfig = {
        command: []
      }

      expect(() => normalizeCommand(config)).toThrow(
        'Invalid MCP command configuration: command array must not be empty'
      )
    })

    it('ignores args field when command is array (OpenCode format takes precedence)', () => {
      const config: McpServerConfig = {
        command: ['npx', '-y', '@some/package'],
        args: ['should', 'be', 'ignored']
      }

      const result = normalizeCommand(config)

      expect(result.command).toBe('npx')
      expect(result.args).toEqual(['-y', '@some/package'])
    })
  })
})

describe('normalizeEnv', () => {
  describe('object format (oh-my-opencode style)', () => {
    it('passes through object format unchanged', () => {
      const config: McpServerConfig = {
        command: 'node',
        env: { API_KEY: 'secret', DEBUG: 'true' }
      }

      const result = normalizeEnv(config)

      expect(result.env).toEqual({ API_KEY: 'secret', DEBUG: 'true' })
    })

    it('handles empty object', () => {
      const config: McpServerConfig = {
        command: 'node',
        env: {}
      }

      const result = normalizeEnv(config)

      expect(result.env).toEqual({})
    })
  })

  describe('array format (OpenCode style)', () => {
    it('converts array of KEY=value strings to object', () => {
      const config: McpServerConfig = {
        command: 'node',
        env: ['API_KEY=secret', 'DEBUG=true']
      }

      const result = normalizeEnv(config)

      expect(result.env).toEqual({ API_KEY: 'secret', DEBUG: 'true' })
    })

    it('handles values containing equals sign', () => {
      const config: McpServerConfig = {
        command: 'node',
        env: ['CONNECTION_STRING=host=localhost;port=5432']
      }

      const result = normalizeEnv(config)

      expect(result.env).toEqual({ CONNECTION_STRING: 'host=localhost;port=5432' })
    })

    it('handles empty array', () => {
      const config: McpServerConfig = {
        command: 'node',
        env: []
      }

      const result = normalizeEnv(config)

      expect(result.env).toEqual({})
    })

    it('skips malformed entries without equals sign', () => {
      const config: McpServerConfig = {
        command: 'node',
        env: ['VALID=value', 'INVALID_NO_EQUALS', 'ALSO_VALID=123']
      }

      const result = normalizeEnv(config)

      expect(result.env).toEqual({ VALID: 'value', ALSO_VALID: '123' })
    })

    it('handles empty value after equals sign', () => {
      const config: McpServerConfig = {
        command: 'node',
        env: ['EMPTY_VALUE=']
      }

      const result = normalizeEnv(config)

      expect(result.env).toEqual({ EMPTY_VALUE: '' })
    })
  })

  describe('edge cases', () => {
    it('returns empty object when env is undefined', () => {
      const config: McpServerConfig = {
        command: 'node'
      }

      const result = normalizeEnv(config)

      expect(result.env).toEqual({})
    })
  })

  describe('backward compatibility', () => {
    it('supports deprecated environment field', () => {
      const config: McpServerConfig = {
        command: 'node',
        environment: { LEGACY_KEY: 'legacy_value' }
      }

      const result = normalizeEnv(config)

      expect(result.env).toEqual({ LEGACY_KEY: 'legacy_value' })
    })

    it('prefers env over deprecated environment when both present', () => {
      const config: McpServerConfig = {
        command: 'node',
        env: { NEW_KEY: 'new_value' },
        environment: { OLD_KEY: 'old_value' }
      }

      const result = normalizeEnv(config)

      expect(result.env).toEqual({ NEW_KEY: 'new_value' })
    })
  })
})
