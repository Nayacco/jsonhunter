import { describe, expect, it } from 'vitest'
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
})
