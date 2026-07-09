import { create, type StoreApi, type UseBoundStore } from 'zustand'
import type { JsonPath } from '../domain/jsonTypes'
import type { ViewerMode } from '../domain/viewTypes'
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

export function resetWorkbenchViewState() {
  useWorkbenchStore.setState({ viewerMode: 'columns', selectedPath: [] })
}

export function restoreWorkbenchViewState(viewerMode: ViewerMode, selectedPath: JsonPath) {
  useWorkbenchStore.setState({ viewerMode, selectedPath })
}
