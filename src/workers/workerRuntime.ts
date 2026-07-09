import { getAtPath } from '../domain/jsonPath'
import { summarizeJson } from '../domain/jsonSummary'
import type { JsonValue } from '../domain/jsonTypes'
import type { WorkerRequest, WorkerResponse } from './workerProtocol'

export class JsonWorkerRuntime {
  private currentValue: JsonValue | undefined

  async handle(request: WorkerRequest): Promise<WorkerResponse> {
    try {
      if (request.type === 'parseRaw') {
        this.currentValue = undefined
        this.currentValue = JSON.parse(request.rawJsonText) as JsonValue
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
