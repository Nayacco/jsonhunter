import type { WorkerRequest, WorkerResponse } from './workerProtocol'

export type WorkerClient = {
  request(request: WorkerRequest): Promise<WorkerResponse>
  terminate(): void
}

export function createWorkerClient(): WorkerClient {
  const worker = new Worker(new URL('./jsonWorker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<string, (response: WorkerResponse) => void>()

  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const resolve = pending.get(event.data.jobId)
    if (!resolve) return
    pending.delete(event.data.jobId)
    resolve(event.data)
  })

  return {
    request(request) {
      return new Promise((resolve) => {
        pending.set(request.jobId, resolve)
        worker.postMessage(request)
      })
    },
    terminate() {
      pending.clear()
      worker.terminate()
    },
  }
}
