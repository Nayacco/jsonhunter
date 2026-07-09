import { JsonWorkerRuntime } from './workerRuntime'
import type { WorkerRequest, WorkerResponse } from './workerProtocol'

const runtime = new JsonWorkerRuntime()

export function createLatestOnlyMessageHandler(
  workerRuntime: Pick<JsonWorkerRuntime, 'handle'>,
  postMessage: (response: WorkerResponse) => void,
): (event: MessageEvent<WorkerRequest>) => Promise<void> {
  let latestMutationJobId = ''
  let latestReadOnlyJobId = ''

  const getLatestJobId = (request: WorkerRequest) =>
    isReadOnlyRequest(request) ? latestReadOnlyJobId : latestMutationJobId

  const setLatestJobId = (request: WorkerRequest) => {
    if (isReadOnlyRequest(request)) {
      latestReadOnlyJobId = request.jobId
      return
    }

    latestMutationJobId = request.jobId
  }

  return async (event: MessageEvent<WorkerRequest>) => {
    const request = event.data
    setLatestJobId(request)
    const isLatestRequest = () => request.jobId === getLatestJobId(request)

    try {
      const response = await workerRuntime.handle(request, { isCurrent: (jobId) => jobId === getLatestJobId(request) })
      if (!isLatestRequest()) return
      postMessage(response)
    } catch (error) {
      if (!isLatestRequest()) return
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

function isReadOnlyRequest(request: WorkerRequest): boolean {
  return request.type === 'getDetails' || request.type === 'getViewWindow'
}
