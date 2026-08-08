import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockedHome = vi.hoisted(() => ({ path: '' }))

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os')

  return {
    ...actual,
    homedir: () => mockedHome.path
  }
})

import { OpenCodeEmbeddedSkillMcp } from '../index.js'
import {
  discoverOpencodeGlobalSkills,
  discoverOpencodeProjectSkills,
  discoverSkills,
  loadMcpJsonFromDir
} from '../skill-loader.js'

function skillMarkdown(name: string, serverName: string): string {
  return `---
name: ${name}
description: Test skill
mcp:
  ${serverName}:
    command: ["node", "server.js"]
---

# ${name}
`
}

async function writeSkill(root: string, name: string, serverName = `${name}-mcp`): Promise<void> {
  const skillDir = join(root, name)
  await mkdir(skillDir, { recursive: true })
  await writeFile(join(skillDir, 'SKILL.md'), skillMarkdown(name, serverName))
}

describe('skill discovery', () => {
  let temporaryRoot: string
  let projectRoot: string
  let originalForceValue: string | undefined

  beforeEach(async () => {
    temporaryRoot = await mkdtemp(join(tmpdir(), 'opencode-lazy-loader-'))
    mockedHome.path = join(temporaryRoot, 'home')
    projectRoot = join(temporaryRoot, 'project')
    await mkdir(projectRoot, { recursive: true })
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot)
    originalForceValue = process.env.OPENCODE_LAZY_LOADER_FORCE
  })

  afterEach(async () => {
    if (originalForceValue === undefined) {
      delete process.env.OPENCODE_LAZY_LOADER_FORCE
    } else {
      process.env.OPENCODE_LAZY_LOADER_FORCE = originalForceValue
    }

    vi.restoreAllMocks()
    await rm(temporaryRoot, { recursive: true, force: true })
  })

  it('discovers embedded MCPs from the plural global OpenCode skills directory', async () => {
    const skillsRoot = join(mockedHome.path, '.config', 'opencode', 'skills')
    await writeSkill(skillsRoot, 'read-pdf', 'pdf-reader')

    const skills = await discoverOpencodeGlobalSkills()

    expect(skills).toHaveLength(1)
    expect(skills[0]).toMatchObject({
      name: 'read-pdf',
      scope: 'opencode',
      mcpConfig: {
        'pdf-reader': {
          command: ['node', 'server.js']
        }
      }
    })
  })

  it('discovers skills from the plural project OpenCode skills directory', async () => {
    const skillsRoot = join(projectRoot, '.opencode', 'skills')
    await writeSkill(skillsRoot, 'hello-world')

    const skills = await discoverOpencodeProjectSkills()

    expect(skills.map((skill) => skill.name)).toEqual(['hello-world'])
  })

  it('uses project skills in preference to global skills with the same name', async () => {
    await writeSkill(join(mockedHome.path, '.agents', 'skills'), 'shared', 'global-mcp')
    await writeSkill(join(projectRoot, '.claude', 'skills'), 'shared', 'project-mcp')

    const skills = await discoverSkills()

    expect(skills).toHaveLength(1)
    expect(skills[0]).toMatchObject({
      name: 'shared',
      scope: 'claude-project',
      mcpConfig: {
        'project-mcp': {
          command: ['node', 'server.js']
        }
      }
    })
  })

  it('discovers remote MCP servers from skill frontmatter', async () => {
    const skillDir = join(mockedHome.path, '.config', 'opencode', 'skills', 'remote-skill')
    await mkdir(skillDir, { recursive: true })
    await writeFile(
      join(skillDir, 'SKILL.md'),
      `---
name: remote-skill
description: Test skill
mcp:
  remote-server:
    type: remote
    url: https://mcp.example.com/mcp
    headers:
      Authorization: Bearer \${API_TOKEN}
---

# remote-skill
`
    )

    const skills = await discoverOpencodeGlobalSkills()

    expect(skills).toHaveLength(1)
    expect(skills[0].mcpConfig).toMatchObject({
      'remote-server': {
        type: 'remote',
        url: 'https://mcp.example.com/mcp',
        headers: { Authorization: 'Bearer ${API_TOKEN}' }
      }
    })
  })

  it('loads direct-format mcp.json entries with remote configs', async () => {
    const skillDir = join(temporaryRoot, 'remote-json-skill')
    await mkdir(skillDir, { recursive: true })
    await writeFile(
      join(skillDir, 'mcp.json'),
      JSON.stringify({
        'remote-server': { type: 'remote', url: 'https://mcp.example.com/mcp' }
      })
    )

    const config = await loadMcpJsonFromDir(skillDir)

    expect(config).toEqual({
      'remote-server': { type: 'remote', url: 'https://mcp.example.com/mcp' }
    })
  })

  it('still ignores direct-format mcp.json entries with neither command nor remote type', async () => {
    const skillDir = join(temporaryRoot, 'invalid-json-skill')
    await mkdir(skillDir, { recursive: true })
    await writeFile(
      join(skillDir, 'mcp.json'),
      JSON.stringify({ 'some-key': { unrelated: true } })
    )

    const config = await loadMcpJsonFromDir(skillDir)

    expect(config).toBeUndefined()
  })

  it('registers skill_mcp without replacing OpenCode native skill tool', async () => {
    process.env.OPENCODE_LAZY_LOADER_FORCE = '1'

    const hooks = await OpenCodeEmbeddedSkillMcp({ client: {} } as never)

    expect(hooks.tool).toHaveProperty('skill_mcp')
    expect(hooks.tool).not.toHaveProperty('skill')
  })
})
