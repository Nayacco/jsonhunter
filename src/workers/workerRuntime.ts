import { getAtPath } from '../domain/jsonPath'
import { summarizeJson } from '../domain/jsonSummary'
import type { JsonValue } from '../domain/jsonTypes'
import { executeDuckDbNode } from './duckDbExecution'
import { executeJsNode } from './jsExecution'
import type { WorkerRequest, WorkerResponse } from './workerProtocol'

export class JsonWorkerRuntime {
  private rawValue: JsonValue | undefined
  private currentValue: JsonValue | undefined

  async handle(request: WorkerRequest): Promise<WorkerResponse> {
    try {
      if (request.type === 'parseRaw') {
        this.rawValue = undefined
        this.currentValue = undefined
        this.rawValue = JSON.parse(request.rawJsonText) as JsonValue
        this.currentValue = this.rawValue
        return {
          type: 'parseRawResult',
          jobId: request.jobId,
          summary: summarizeJson(this.currentValue),
        }
      }

      if (request.type === 'getDetails') {
        const value = this.currentValue === undefined ? undefined : getAtPath(this.currentValue, request.path)
        return {
          type: 'detailsResult',
          jobId: request.jobId,
          path: request.path,
          value,
          summary: summarizeJson(value),
        }
      }

      if (request.type === 'executePipeline') {
        let output = this.rawValue
        if (output === undefined) throw new Error('Raw JSON is not loaded')
        for (const node of request.nodes) {
          if (node.type === 'raw') continue
          if (node.type === 'js') output = await executeJsNode(node.code, output)
          if (node.type === 'duckdb') output = await executeDuckDbNode(node.sql, output)
        }
        this.currentValue = output
        return {
          type: 'executePipelineResult',
          jobId: request.jobId,
          activeNodeId: request.nodes[request.nodes.length - 1]?.id ?? 'raw',
          summary: summarizeJson(output),
        }
      }

      if (request.type === 'getViewWindow') {
        const value = this.currentValue === undefined ? [] : getAtPath(this.currentValue, request.path)
        const rows = Array.isArray(value) ? value.slice(request.start, request.start + request.count) : []
        return {
          type: 'viewWindowResult',
          jobId: request.jobId,
          rows,
          total: Array.isArray(value) ? value.length : 0,
        }
      }

      return assertNever(request)
    } catch (error) {
      return {
        type: 'workerError',
        jobId: request.jobId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    }
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled worker request: ${JSON.stringify(value)}`)
}
