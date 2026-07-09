import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { createInitialPipeline } from '../pipeline/pipelineModel'
import type { WorkbenchState } from './storeTypes'

export function createWorkbenchStore(): UseBoundStore<StoreApi<WorkbenchState>> {
  const initialPipeline = createInitialPipeline()
  return create<WorkbenchState>((set, get) => ({
    projects: [],
    activeProjectId: undefined,
    nodes: initialPipeline.nodes,
    activeNodeId: initialPipeline.activeNodeId,
    nodeStatuses: initialPipeline.nodeStatuses,
    viewerMode: 'columns',
    selectedPath: [],
    activeJobId: undefined,
    error: undefined,
    startJob(jobId) {
      set({ activeJobId: jobId, error: undefined })
    },
    finishJob(jobId) {
      if (get().activeJobId !== jobId) return
      set({ activeJobId: undefined })
    },
    setViewerMode(mode) {
      set({ viewerMode: mode })
    },
    setSelectedPath(path) {
      set({ selectedPath: path })
    },
  }))
}

export const useWorkbenchStore = createWorkbenchStore()
