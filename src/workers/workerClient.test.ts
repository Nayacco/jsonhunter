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
})
