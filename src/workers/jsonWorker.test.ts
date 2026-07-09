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

  it('keeps a pending mutation result when a newer read-only request arrives', async () => {
    const responses: WorkerResponse[] = []
    const execute = createDeferred<WorkerResponse>()
    const details = createDeferred<WorkerResponse>()

    const handler = createLatestOnlyMessageHandler(
      {
        handle(request: WorkerRequest) {
          if (request.type === 'executePipeline') return execute.promise
          return details.promise
        },
      },
      (response) => {
        responses.push(response)
      },
    )

    void handler(
      createMessageEvent({
        type: 'executePipeline',
        jobId: 'job-execute',
        nodes: [{ id: 'raw', type: 'raw', label: 'Raw' }],
      }),
    )
    void handler(createMessageEvent({ type: 'getDetails', jobId: 'job-details', path: ['items'] }))

    details.resolve({
      type: 'detailsResult',
      jobId: 'job-details',
      path: ['items'],
      value: [{ id: 1 }],
      summary: {
        type: 'array',
        label: 'Array(1)',
        childCount: 1,
        preview: '[1]',
      },
    })
    await Promise.resolve()

    execute.resolve({
      type: 'executePipelineResult',
      jobId: 'job-execute',
      activeNodeId: 'raw',
      summary: createObjectSummary(),
      output: { count: 1 },
    })
    await Promise.resolve()

    expect(responses).toEqual([
      {
        type: 'detailsResult',
        jobId: 'job-details',
        path: ['items'],
        value: [{ id: 1 }],
        summary: {
          type: 'array',
          label: 'Array(1)',
          childCount: 1,
          preview: '[1]',
        },
      },
      {
        type: 'executePipelineResult',
        jobId: 'job-execute',
        activeNodeId: 'raw',
        summary: createObjectSummary(),
        output: { count: 1 },
      },
    ])
  })
})
