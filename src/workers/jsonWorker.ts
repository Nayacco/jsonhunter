import { JsonWorkerRuntime } from './workerRuntime'
import type { WorkerRequest } from './workerProtocol'

const runtime = new JsonWorkerRuntime()

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const response = await runtime.handle(event.data)
  self.postMessage(response)
})
