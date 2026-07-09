import { create, type StoreApi, type UseBoundStore } from 'zustand'
import type { JsonPath } from '../domain/jsonTypes'
import type { ProjectRecord, RawSource } from '../domain/projectTypes'
import type { ViewerMode } from '../domain/viewTypes'
import { ProjectRepository, shouldPersistRawText } from '../persistence/projectRepository'
import { createInitialPipeline, selectActiveNode } from '../pipeline/pipelineModel'
import type { WorkbenchState } from './storeTypes'

type ProjectRepositoryLike = Pick<ProjectRepository, 'listProjects' | 'saveProject' | 'getProject' | 'deleteProject'>

function createProjectId(): string {
  return `project-${crypto.randomUUID()}`
}

function getHydratedPipeline(project: ProjectRecord) {
  return selectActiveNode(
    {
      nodes: project.pipeline,
      activeNodeId: project.activeNodeId,
      nodeStatuses: {},
    },
    project.activeNodeId,
  )
}

export function createWorkbenchStore(
  repository?: ProjectRepositoryLike,
): UseBoundStore<StoreApi<WorkbenchState>> {
  const initialPipeline = createInitialPipeline()
  let cachedRepository = repository

  function getRepository() {
    if (!cachedRepository) cachedRepository = new ProjectRepository()
    return cachedRepository
  }

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
    async createProjectFromRaw(name: string, source: RawSource, rawJsonText: string) {
      const now = Date.now()
      const pipeline = createInitialPipeline()
      const persistedRawJsonText = shouldPersistRawText(source, rawJsonText) ? rawJsonText : undefined
      const project: ProjectRecord = {
        id: createProjectId(),
        name,
        createdAt: now,
        updatedAt: now,
        rawSource: source,
        rawJsonText,
        pipeline: pipeline.nodes,
        activeNodeId: pipeline.activeNodeId,
        viewerMode: 'columns',
        selectedPath: [],
      }

      set((state) => ({
        projects: [
          project,
          ...state.projects.filter((existingProject) => existingProject.id !== project.id),
        ],
        activeProjectId: project.id,
        nodes: pipeline.nodes,
        activeNodeId: pipeline.activeNodeId,
        nodeStatuses: pipeline.nodeStatuses,
        viewerMode: 'columns',
        selectedPath: [],
        error: undefined,
      }))

      await getRepository().saveProject({
        ...project,
        rawJsonText: persistedRawJsonText,
      })
    },
    async restoreProjects() {
      const activeProjectIdBeforeRestore = get().activeProjectId
      const projects = await getRepository().listProjects()
      const activeProjectIdAfterRestore = get().activeProjectId
      if (
        activeProjectIdAfterRestore !== activeProjectIdBeforeRestore &&
        activeProjectIdAfterRestore !== undefined
      ) {
        return
      }
      const activeProject = projects[0]
      if (!activeProject) {
        set({
          projects: [],
          activeProjectId: undefined,
          nodes: initialPipeline.nodes,
          activeNodeId: initialPipeline.activeNodeId,
          nodeStatuses: initialPipeline.nodeStatuses,
          viewerMode: 'columns',
          selectedPath: [],
          error: undefined,
        })
        return
      }

      const pipeline = getHydratedPipeline(activeProject)
      set({
        projects,
        activeProjectId: activeProject.id,
        nodes: pipeline.nodes,
        activeNodeId: pipeline.activeNodeId,
        nodeStatuses: pipeline.nodeStatuses,
        viewerMode: activeProject.viewerMode,
        selectedPath: activeProject.selectedPath,
        error: undefined,
      })
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

export function resetWorkbenchStore() {
  const initialPipeline = createInitialPipeline()
  useWorkbenchStore.setState({
    projects: [],
    activeProjectId: undefined,
    nodes: initialPipeline.nodes,
    activeNodeId: initialPipeline.activeNodeId,
    nodeStatuses: initialPipeline.nodeStatuses,
    viewerMode: 'columns',
    selectedPath: [],
    activeJobId: undefined,
    error: undefined,
  })
}

export function resetWorkbenchViewState() {
  useWorkbenchStore.setState({ viewerMode: 'columns', selectedPath: [] })
}

export function restoreWorkbenchViewState(viewerMode: ViewerMode, selectedPath: JsonPath) {
  useWorkbenchStore.setState({ viewerMode, selectedPath })
}
