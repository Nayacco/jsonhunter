import { getAtPath } from '../domain/jsonPath'
import { summarizeJson } from '../domain/jsonSummary'
import type { JsonValue } from '../domain/jsonTypes'
import { executeDuckDbNode } from './duckDbExecution'
import { executeJsNode } from './jsExecution'
import type { WorkerRequest, WorkerResponse } from './workerProtocol'

type HandleOptions = {
  isCurrent?: (jobId: string) => boolean
}

export class JsonWorkerRuntime {
  private rawValue: JsonValue | undefined
  private currentValue: JsonValue | undefined

  async handle(request: WorkerRequest, options: HandleOptions = {}): Promise<WorkerResponse> {
    try {
      if (request.type === 'parseRaw') {
        let parsed: JsonValue
        try {
          parsed = JSON.parse(request.rawJsonText) as JsonValue
        } catch (error) {
          if (!isStale(request.jobId, options)) {
            this.rawValue = undefined
            this.currentValue = undefined
          }
          throw error
        }
        if (isStale(request.jobId, options)) {
          return {
            type: 'parseRawResult',
            jobId: request.jobId,
            summary: summarizeJson(parsed),
            value: parsed,
          }
        }
        this.rawValue = cloneJsonValue(parsed)
        this.currentValue = cloneJsonValue(parsed)
        return {
          type: 'parseRawResult',
          jobId: request.jobId,
          summary: summarizeJson(this.currentValue),
          value: cloneJsonValue(this.currentValue),
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
        let output = this.rawValue === undefined ? undefined : cloneJsonValue(this.rawValue)
        if (output === undefined) throw new Error('Raw JSON is not loaded')
        for (const node of request.nodes) {
          if (node.type === 'raw') continue
          if (node.type === 'js') output = await executeJsNode(node.code, output)
          if (node.type === 'duckdb') output = await executeDuckDbNode(node.sql, output)
        }
        if (!isStale(request.jobId, options)) {
          this.currentValue = cloneJsonValue(output)
        }
        return {
          type: 'executePipelineResult',
          jobId: request.jobId,
          activeNodeId: request.nodes[request.nodes.length - 1]?.id ?? 'raw',
          summary: summarizeJson(output),
          output: cloneJsonValue(output),
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

function isStale(jobId: string, options: HandleOptions): boolean {
  return options.isCurrent !== undefined && !options.isCurrent(jobId)
}

function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
