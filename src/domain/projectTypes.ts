import type { JsonPath, JsonValue } from './jsonTypes'
import type { PipelineNode } from './pipelineTypes'
import type { ViewerMode } from './viewTypes'

export type RawSourceType = 'file' | 'paste' | 'url'

export type RawSource =
  | { type: 'file'; fileName: string; sizeBytes: number }
  | { type: 'paste'; label: string; sizeBytes: number }
  | { type: 'url'; url: string; sizeBytes?: number }

export type ProjectRecord = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  rawSource: RawSource
  rawJsonText?: string
  pipeline: PipelineNode[]
  activeNodeId: string
  viewerMode: ViewerMode
  selectedPath: JsonPath
}

export type RuntimeProject = ProjectRecord & {
  rawValue?: JsonValue
}
