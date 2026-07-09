export type PipelineNodeType = 'raw' | 'js' | 'duckdb'
export type PipelineNodeStatus = 'ready' | 'active' | 'inactive' | 'stale' | 'blocked' | 'error'

export type RawNode = {
  id: 'raw'
  type: 'raw'
  label: 'Raw'
}

export type JsNode = {
  id: string
  type: 'js'
  label: string
  code: string
}

export type DuckDbNode = {
  id: string
  type: 'duckdb'
  label: string
  sql: string
}

export type ProcessingNode = JsNode | DuckDbNode
export type PipelineNode = RawNode | ProcessingNode
