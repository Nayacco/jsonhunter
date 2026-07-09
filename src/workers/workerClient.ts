import type { WorkerRequest, WorkerResponse } from './workerProtocol'

export type WorkerClient = {
  request(request: WorkerRequest): Promise<WorkerResponse>
  terminate(): void
}

type PendingRequest = {
  resolve(response: WorkerResponse): void
  reject(error: Error): void
}

export function createWorkerClient(): WorkerClient {
  const worker = new Worker(new URL('./jsonWorker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<string, PendingRequest>()

  const rejectAllPending = (error: Error): void => {
    const pendingEntries = Array.from(pending.values())
    pending.clear()
    pendingEntries.forEach((entry) => entry.reject(error))
  }

  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const entry = pending.get(event.data.jobId)
    if (!entry) return
    pending.delete(event.data.jobId)
    entry.resolve(event.data)
  })

  worker.addEventListener('error', (event: ErrorEvent) => {
    rejectAllPending(event.error instanceof Error ? event.error : new Error(event.message))
  })

  worker.addEventListener('messageerror', () => {
    rejectAllPending(new Error('Worker message could not be decoded'))
  })

  const rejectSupersededPending = (nextJobId: string): void => {
    const superseded = Array.from(pending.entries()).filter(([jobId]) => jobId !== nextJobId)
    superseded.forEach(([jobId, entry]) => {
      pending.delete(jobId)
      entry.reject(new Error(`Worker request ${jobId} was superseded by ${nextJobId}`))
    })
  }

  return {
    request(request) {
      return new Promise((resolve, reject) => {
        rejectSupersededPending(request.jobId)
        pending.set(request.jobId, { resolve, reject })
        worker.postMessage(request)
      })
    },
    terminate() {
      rejectAllPending(new Error('Worker was terminated'))
      worker.terminate()
    },
  }
}
