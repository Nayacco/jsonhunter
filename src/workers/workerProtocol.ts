import type { PipelineNode } from '../domain/pipelineTypes'
import type { JsonPath, JsonValue } from '../domain/jsonTypes'
import type { JsonSummary } from '../domain/jsonSummary'
import type { ViewerMode } from '../domain/viewTypes'

export type WorkerRequest =
  | { type: 'parseRaw'; jobId: string; rawJsonText: string }
  | { type: 'executePipeline'; jobId: string; nodes: PipelineNode[] }
  | { type: 'getDetails'; jobId: string; path: JsonPath }
  | { type: 'getViewWindow'; jobId: string; mode: ViewerMode; path: JsonPath; start: number; count: number }

export type WorkerResponse =
  | { type: 'parseRawResult'; jobId: string; summary: JsonSummary }
  | { type: 'executePipelineResult'; jobId: string; activeNodeId: string; summary: JsonSummary }
  | { type: 'detailsResult'; jobId: string; path: JsonPath; value: JsonValue | undefined; summary: JsonSummary }
  | { type: 'viewWindowResult'; jobId: string; rows: JsonValue[]; total: number }
  | { type: 'workerError'; jobId: string; message: string; stack?: string }
