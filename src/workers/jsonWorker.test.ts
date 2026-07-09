import { describe, expect, it } from 'vitest'
import type { WorkerRequest, WorkerResponse } from './workerProtocol'
import { createLatestOnlyMessageHandler } from './jsonWorker'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return { promise, resolve }
}

function createMessageEvent(data: WorkerRequest): MessageEvent<WorkerRequest> {
  return { data } as MessageEvent<WorkerRequest>
}

function createObjectSummary() {
  return {
    type: 'object' as const,
    label: 'Object(1)',
    childCount: 1,
    preview: '{count}',
  }
}

function createParseResult(jobId: string): WorkerResponse {
  return {
    type: 'parseRawResult',
    jobId,
    summary: createObjectSummary(),
    value: { count: 1 },
  }
}

describe('jsonWorker latest-only handling', () => {
  it('drops stale async results when a newer request arrives', async () => {
    const responses: WorkerResponse[] = []
    const first = createDeferred<WorkerResponse>()
    const second = createDeferred<WorkerResponse>()

    const handler = createLatestOnlyMessageHandler(
      {
        handle(request: WorkerRequest) {
          if (request.jobId === 'job-1') return first.promise
          return second.promise
        },
      },
      (response) => {
        responses.push(response)
      },
    )

    void handler(createMessageEvent({ type: 'parseRaw', jobId: 'job-1', rawJsonText: '{"count":1}' }))
    void handler(createMessageEvent({ type: 'parseRaw', jobId: 'job-2', rawJsonText: '{"count":2}' }))

    second.resolve(createParseResult('job-2'))
    await Promise.resolve()

    first.resolve(createParseResult('job-1'))
    await Promise.resolve()

    expect(responses).toEqual([createParseResult('job-2')])
  })

  it('drops stale async errors when a newer request arrives', async () => {
    const responses: WorkerResponse[] = []
    const first = createDeferred<WorkerResponse>()
    const second = createDeferred<WorkerResponse>()

    const handler = createLatestOnlyMessageHandler(
      {
        handle(request: WorkerRequest) {
          if (request.jobId === 'job-1') return first.promise
          return second.promise
        },
      },
      (response) => {
        responses.push(response)
      },
    )

    void handler(createMessageEvent({ type: 'parseRaw', jobId: 'job-1', rawJsonText: '{"count":1}' }))
    void handler(createMessageEvent({ type: 'parseRaw', jobId: 'job-2', rawJsonText: '{"count":2}' }))

    second.resolve(createParseResult('job-2'))
    await Promise.resolve()

    first.resolve({ type: 'workerError', jobId: 'job-1', message: 'stale failure' })
    await Promise.resolve()

    expect(responses).toEqual([createParseResult('job-2')])
  })
})
