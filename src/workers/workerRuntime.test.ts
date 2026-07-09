import { describe, expect, it } from 'vitest'
import { JsonWorkerRuntime } from './workerRuntime'

describe('JsonWorkerRuntime', () => {
  it('parses raw JSON and returns a summary', async () => {
    const runtime = new JsonWorkerRuntime()
    const response = await runtime.handle({
      type: 'parseRaw',
      jobId: 'job-1',
      rawJsonText: '{"data":[{"id":1}]}',
    })

    expect(response).toMatchObject({
      type: 'parseRawResult',
      jobId: 'job-1',
      summary: { type: 'object', childCount: 1 },
    })
  })

  it('returns a details response for a selected path', async () => {
    const runtime = new JsonWorkerRuntime()
    await runtime.handle({ type: 'parseRaw', jobId: 'job-1', rawJsonText: '{"data":[{"id":1}]}' })
    const response = await runtime.handle({ type: 'getDetails', jobId: 'job-2', path: ['data', 0, 'id'] })

    expect(response).toMatchObject({
      type: 'detailsResult',
      jobId: 'job-2',
      value: 1,
      path: ['data', 0, 'id'],
    })
  })
})
