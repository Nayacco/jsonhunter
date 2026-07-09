import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectRepository, getRawSizeBytes, shouldPersistRawText, RAW_PERSISTENCE_LIMIT_BYTES } from './projectRepository'
import type { ProjectRecord } from '../domain/projectTypes'

const TEST_DB_NAME = `jsonhunter-project-repository-test-${Date.now()}-${Math.random().toString(36).slice(2)}`

let savedProjects = new Map<string, ProjectRecord>()
const putSpy = vi.fn()
const getSpy = vi.fn()

vi.mock('idb', async () => {
  const actual = await vi.importActual('idb')
  return {
    ...(actual as object),
    openDB: vi.fn(async () => ({
      put: putSpy,
      get: getSpy,
    })),
  }
})

function makeProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: `project-${Math.random().toString(36).slice(2)}`,
    name: 'Test Project',
    createdAt: 0,
    updatedAt: 0,
    rawSource: { type: 'file', fileName: 'test.json', sizeBytes: 2 },
    rawJsonText: '{"value": "sample"}',
    pipeline: [{ id: 'raw', type: 'raw', label: 'Raw' }],
    activeNodeId: 'raw',
    viewerMode: 'source',
    selectedPath: [],
    ...overrides,
  }
}

beforeEach(() => {
  savedProjects = new Map<string, ProjectRecord>()
  putSpy.mockImplementation(async (_store: string, project: ProjectRecord) => {
    savedProjects.set(project.id, project)
  })
  getSpy.mockImplementation(async (_store: string, id: string) => savedProjects.get(id))
})

afterEach(() => {
  putSpy.mockReset()
  getSpy.mockReset()
})

describe('projectRepository raw persistence rules', () => {
  it('never persists URL raw text', () => {
    expect(shouldPersistRawText({ type: 'url', url: 'https://example.com/data.json' }, '{"ok":true}')).toBe(false)
  })

  it('persists file and paste raw text at or under 10 MiB', () => {
    expect(shouldPersistRawText({ type: 'file', fileName: 'small.json', sizeBytes: 2 }, '{}')).toBe(true)
    expect(shouldPersistRawText({ type: 'paste', label: 'Pasted JSON', sizeBytes: 2 }, '{}')).toBe(true)
  })

  it('does not persist file and paste raw text over 10 MiB', () => {
    const oversized = 'x'.repeat(10 * 1024 * 1024 + 1)
    expect(shouldPersistRawText({ type: 'file', fileName: 'large.json', sizeBytes: oversized.length }, oversized)).toBe(false)
  })

  it('uses UTF-8 bytes rather than string length', () => {
    expect(getRawSizeBytes('你')).toBe(3)
  })
})

describe('ProjectRepository.saveProject', () => {
  it('does not persist rawJsonText for URL projects', async () => {
    const repo = new ProjectRepository(TEST_DB_NAME)
    const project = makeProject({
      rawSource: { type: 'url', url: 'https://example.com/data.json' },
      rawJsonText: '{"value":"from-url"}',
    })

    await repo.saveProject(project)
    const stored = await repo.getProject(project.id)

    expect(stored).toBeDefined()
    expect(stored && 'rawJsonText' in stored).toBe(false)
  })

  it('persists allowed rawJsonText for file and paste projects', async () => {
    const repo = new ProjectRepository(TEST_DB_NAME)
    const fileProject = makeProject({
      id: 'file-small',
      rawSource: { type: 'file', fileName: 'small.json', sizeBytes: 2 },
      rawJsonText: '{"value":"small file"}',
    })
    const pasteProject = makeProject({
      id: 'paste-small',
      rawSource: { type: 'paste', label: 'Pasted JSON', sizeBytes: 2 },
      rawJsonText: '{"value":"small paste"}',
    })

    await repo.saveProject(fileProject)
    await repo.saveProject(pasteProject)

    const storedFile = await repo.getProject(fileProject.id)
    const storedPaste = await repo.getProject(pasteProject.id)

    expect(storedFile).toMatchObject({ rawJsonText: fileProject.rawJsonText })
    expect(storedPaste).toMatchObject({ rawJsonText: pasteProject.rawJsonText })
  })

  it('does not persist rawJsonText for oversize file projects', async () => {
    const repo = new ProjectRepository(TEST_DB_NAME)
    const oversizedText = 'x'.repeat(RAW_PERSISTENCE_LIMIT_BYTES + 1)
    const project = makeProject({
      rawSource: { type: 'file', fileName: 'large.json', sizeBytes: oversizedText.length },
      rawJsonText: oversizedText,
    })

    await repo.saveProject(project)
    const stored = await repo.getProject(project.id)

    expect(stored).toBeDefined()
    expect(stored && 'rawJsonText' in stored).toBe(false)
  })
})
