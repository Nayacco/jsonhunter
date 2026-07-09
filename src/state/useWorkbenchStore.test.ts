import { describe, expect, it, vi } from 'vitest'
import type { ProjectRecord, RawSource } from '../domain/projectTypes'
import { createWorkbenchStore } from './useWorkbenchStore'

describe('workbench store', () => {
  it('starts with no active project and columns viewer mode', () => {
    const store = createWorkbenchStore()
    expect(store.getState().activeProjectId).toBeUndefined()
    expect(store.getState().viewerMode).toBe('columns')
  })

  it('drops stale worker results by job id', () => {
    const store = createWorkbenchStore()
    store.getState().startJob('job-1')
    store.getState().startJob('job-2')
    store.getState().finishJob('job-1')
    expect(store.getState().activeJobId).toBe('job-2')
    store.getState().finishJob('job-2')
    expect(store.getState().activeJobId).toBeUndefined()
  })

  it('creates a persisted paste project through the repository', async () => {
    const saveProject = vi.fn(async () => {})
    const store = createWorkbenchStore({
      listProjects: async () => [],
      saveProject,
      deleteProject: async () => {},
      getProject: async () => undefined,
    })

    await store.getState().createProjectFromRaw('Pasted JSON', { type: 'paste', label: 'Pasted JSON', sizeBytes: 7 }, '{"ok":1}')

    expect(saveProject).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Pasted JSON',
        rawSource: { type: 'paste', label: 'Pasted JSON', sizeBytes: 7 },
        rawJsonText: '{"ok":1}',
        activeNodeId: 'raw',
      }),
    )
    expect(store.getState().activeProjectId).toBeDefined()
    expect(store.getState().projects).toHaveLength(1)
  })

  it('restores projects from the repository and selects the latest one', async () => {
    const first = makeProject('project-1', { type: 'paste', label: 'Paste 1', sizeBytes: 8 })
    const second = makeProject('project-2', { type: 'url', url: 'https://example.com/data.json' })
    const store = createWorkbenchStore({
      listProjects: async () => [second, first],
      saveProject: async () => {},
      deleteProject: async () => {},
      getProject: async () => undefined,
    })

    await store.getState().restoreProjects()

    expect(store.getState().projects).toEqual([second, first])
    expect(store.getState().activeProjectId).toBe('project-2')
    expect(store.getState().nodes).toEqual(second.pipeline)
  })
})

function makeProject(id: string, rawSource: RawSource): ProjectRecord {
  return {
    id,
    name: id,
    createdAt: 1,
    updatedAt: 2,
    rawSource,
    rawJsonText: rawSource.type === 'url' ? undefined : '{"ok":1}',
    pipeline: [{ id: 'raw', type: 'raw', label: 'Raw' }],
    activeNodeId: 'raw',
    viewerMode: 'columns',
    selectedPath: [],
  }
}
