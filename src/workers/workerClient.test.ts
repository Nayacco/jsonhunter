import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { WorkerRequest } from './workerProtocol'
import { createWorkerClient } from './workerClient'

class FakeWorker {
  public postedMessages: unknown[] = []
  private listeners = new Map<string, Array<(event: { [key: string]: unknown }) => void>>()
  public terminate = () => {
    this.terminated = true
  }
  public terminated = false

  constructor(
    public url: string,
    public options: { type: string },
  ) {}

  addEventListener(type: string, handler: (event: { [key: string]: unknown }) => void): void {
    const list = this.listeners.get(type)
    if (list) list.push(handler)
    else this.listeners.set(type, [handler])
  }

  postMessage(message: unknown): void {
    this.postedMessages.push(message)
  }

  dispatch(type: string, event: { [key: string]: unknown }): void {
    const handlers = this.listeners.get(type)
    if (!handlers) return
    handlers.forEach((handler) => handler(event))
  }
}

let workers: FakeWorker[] = []
const OriginalWorker = globalThis.Worker

beforeEach(() => {
  workers = []

  const MockWorker: typeof FakeWorker = class extends FakeWorker {
    constructor(url: string, options?: { type: string }) {
      super(url, options ? options : { type: 'module' })
      workers.push(this)
    }
  }

  Object.defineProperty(globalThis, 'Worker', {
    value: MockWorker,
    configurable: true,
    writable: true,
  })
})

afterEach(() => {
  Object.defineProperty(globalThis, 'Worker', {
    value: OriginalWorker,
    configurable: true,
    writable: true,
  })
})

describe('WorkerClient', () => {
  it('rejects pending requests when terminate is called', async () => {
    const client = createWorkerClient()
    const request = { type: 'parseRaw', jobId: 'job-terminate', rawJsonText: '{"ok":1}' } as WorkerRequest

    const pending = client.request(request)
    client.terminate()

    await expect(pending).rejects.toThrow('terminated')
  })

  it('rejects pending requests on worker error', async () => {
    const client = createWorkerClient()
    const request = { type: 'parseRaw', jobId: 'job-error', rawJsonText: '{"ok":1}' } as WorkerRequest

    const pending = client.request(request)
    workers[0].dispatch('error', { error: new Error('worker crashed') })

    await expect(pending).rejects.toThrow('worker crashed')
  })

  it('rejects pending requests on messageerror', async () => {
    const client = createWorkerClient()
    const request = { type: 'parseRaw', jobId: 'job-messageerror', rawJsonText: '{"ok":1}' } as WorkerRequest

    const pending = client.request(request)
    workers[0].dispatch('messageerror', {})

    await expect(pending).rejects.toThrow('could not be decoded')
  })

  it('rejects superseded requests when a newer request starts', async () => {
    const client = createWorkerClient()
    const requestA = { type: 'parseRaw', jobId: 'job-a', rawJsonText: '{"ok":1}' } as WorkerRequest
    const requestB = { type: 'parseRaw', jobId: 'job-b', rawJsonText: '{"ok":2}' } as WorkerRequest

    const pendingA = client.request(requestA)
    const pendingB = client.request(requestB)

    await expect(pendingA).rejects.toThrow(/superseded/i)

    workers[0].dispatch('message', {
      data: {
        type: 'parseRawResult',
        jobId: 'job-b',
        summary: { type: 'object', label: 'Object(1)', childCount: 1, preview: '{ok}' },
      },
    })

    await expect(pendingB).resolves.toMatchObject({
      type: 'parseRawResult',
      jobId: 'job-b',
    })
  })

  it('keeps a pending parse request alive when a details request starts', async () => {
    const client = createWorkerClient()
    const parseRequest = { type: 'parseRaw', jobId: 'job-parse', rawJsonText: '{"ok":1}' } as WorkerRequest
    const detailsRequest = { type: 'getDetails', jobId: 'job-details', path: ['ok'] } as WorkerRequest

    const pendingParse = client.request(parseRequest)
    const pendingDetails = client.request(detailsRequest)

    workers[0].dispatch('message', {
      data: {
        type: 'detailsResult',
        jobId: 'job-details',
        path: ['ok'],
        value: 1,
        summary: { type: 'number', label: '1', childCount: 0, preview: '1' },
      },
    })
    workers[0].dispatch('message', {
      data: {
        type: 'parseRawResult',
        jobId: 'job-parse',
        summary: { type: 'object', label: 'Object(1)', childCount: 1, preview: '{ok}' },
        value: { ok: 1 },
      },
    })

    await expect(pendingDetails).resolves.toMatchObject({
      type: 'detailsResult',
      jobId: 'job-details',
    })
    await expect(pendingParse).resolves.toMatchObject({
      type: 'parseRawResult',
      jobId: 'job-parse',
    })
  })

  it('keeps a pending execute request alive when a view-window request starts', async () => {
    const client = createWorkerClient()
    const executeRequest = {
      type: 'executePipeline',
      jobId: 'job-execute',
      nodes: [{ id: 'raw', type: 'raw', label: 'Raw' }],
    } as WorkerRequest
    const viewRequest = {
      type: 'getViewWindow',
      jobId: 'job-view',
      mode: 'table',
      path: ['rows'],
      start: 0,
      count: 8,
    } as WorkerRequest

    const pendingExecute = client.request(executeRequest)
    const pendingView = client.request(viewRequest)

    workers[0].dispatch('message', {
      data: {
        type: 'viewWindowResult',
        jobId: 'job-view',
        rows: [{ id: 1 }],
        total: 1,
      },
    })
    workers[0].dispatch('message', {
      data: {
        type: 'executePipelineResult',
        jobId: 'job-execute',
        activeNodeId: 'raw',
        summary: { type: 'object', label: 'Object(1)', childCount: 1, preview: '{rows}' },
        output: { rows: [{ id: 1 }] },
      },
    })

    await expect(pendingView).resolves.toMatchObject({
      type: 'viewWindowResult',
      jobId: 'job-view',
    })
    await expect(pendingExecute).resolves.toMatchObject({
      type: 'executePipelineResult',
      jobId: 'job-execute',
    })
  })
})
