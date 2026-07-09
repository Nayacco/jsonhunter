import { JsonWorkerRuntime } from './workerRuntime'
import type { WorkerRequest, WorkerResponse } from './workerProtocol'

const runtime = new JsonWorkerRuntime()

export function createLatestOnlyMessageHandler(
  workerRuntime: Pick<JsonWorkerRuntime, 'handle'>,
  postMessage: (response: WorkerResponse) => void,
): (event: MessageEvent<WorkerRequest>) => Promise<void> {
  let latestJobId = ''

  return async (event: MessageEvent<WorkerRequest>) => {
    const request = event.data
    latestJobId = request.jobId

    try {
      const response = await workerRuntime.handle(request)
      if (request.jobId !== latestJobId) return
      postMessage(response)
    } catch (error) {
      if (request.jobId !== latestJobId) return
      postMessage({
        type: 'workerError',
        jobId: request.jobId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
    }
  }
}

if (typeof self !== 'undefined') {
  self.addEventListener('message', createLatestOnlyMessageHandler(runtime, (response) => self.postMessage(response)))
}
