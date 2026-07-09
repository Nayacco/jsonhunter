import type { JsonPath } from '../domain/jsonTypes'
import type { PipelineNode, PipelineNodeStatus } from '../domain/pipelineTypes'
import type { ProjectRecord } from '../domain/projectTypes'
import type { ViewerMode } from '../domain/viewTypes'

export type WorkbenchState = {
  projects: ProjectRecord[]
  activeProjectId?: string
  nodes: PipelineNode[]
  activeNodeId: string
  nodeStatuses: Record<string, PipelineNodeStatus>
  viewerMode: ViewerMode
  selectedPath: JsonPath
  activeJobId?: string
  error?: string
  startJob(jobId: string): void
  finishJob(jobId: string): void
  setViewerMode(mode: ViewerMode): void
  setSelectedPath(path: JsonPath): void
}
