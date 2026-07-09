import type { JsonPath } from '../domain/jsonTypes'
import type { PipelineNode, PipelineNodeStatus } from '../domain/pipelineTypes'
import type { ProjectRecord, RawSource } from '../domain/projectTypes'
import type { ViewerMode } from '../domain/viewTypes'

export type WorkbenchJobKind = 'mutation' | 'read-only'

export type WorkbenchState = {
  projects: ProjectRecord[]
  activeProjectId?: string
  nodes: PipelineNode[]
  activeNodeId: string
  nodeStatuses: Record<string, PipelineNodeStatus>
  viewerMode: ViewerMode
  selectedPath: JsonPath
  activeJobId?: string
  activeReadOnlyJobId?: string
  error?: string
  startJob(jobId: string, kind?: WorkbenchJobKind): void
  finishJob(jobId: string, kind?: WorkbenchJobKind): void
  createProjectFromRaw(name: string, source: RawSource, rawJsonText: string): Promise<void>
  restoreProjects(): Promise<void>
  setViewerMode(mode: ViewerMode): void
  setSelectedPath(path: JsonPath): void
}
