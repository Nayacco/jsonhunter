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

  it('invalid parse clears current value so details reflect failure state', async () => {
    const runtime = new JsonWorkerRuntime()

    const first = await runtime.handle({ type: 'parseRaw', jobId: 'job-1', rawJsonText: '{"data":[{"id":1}]}' })
    expect(first.type).toBe('parseRawResult')

    const second = await runtime.handle({ type: 'parseRaw', jobId: 'job-2', rawJsonText: '{invalid-json' })
    expect(second).toMatchObject({ type: 'workerError', jobId: 'job-2' })

    const details = await runtime.handle({ type: 'getDetails', jobId: 'job-3', path: ['data', 0, 'id'] })
    expect(details).toMatchObject({
      type: 'detailsResult',
      jobId: 'job-3',
      path: ['data', 0, 'id'],
      value: undefined,
    })
  })

  it('executes JS nodes through the selected endpoint', async () => {
    const runtime = new JsonWorkerRuntime()
    await runtime.handle({ type: 'parseRaw', jobId: 'parse', rawJsonText: '{"items":[{"amount":"4"}]}' })
    const response = await runtime.handle({
      type: 'executePipeline',
      jobId: 'run-js',
      nodes: [
        { id: 'raw', type: 'raw', label: 'Raw' },
        {
          id: 'js-1',
          type: 'js',
          label: 'Normalize',
          code: 'export default function transform(input) { return { items: input.items.map(item => ({ ...item, amount: Number(item.amount) })) } }',
        },
      ],
    })

    expect(response).toMatchObject({
      type: 'executePipelineResult',
      jobId: 'run-js',
      activeNodeId: 'js-1',
    })

    const details = await runtime.handle({ type: 'getDetails', jobId: 'details', path: ['items', 0, 'amount'] })
    expect(details).toMatchObject({ type: 'detailsResult', value: 4 })
  })

  it('restarts each pipeline run from immutable raw JSON', async () => {
    const runtime = new JsonWorkerRuntime()
    await runtime.handle({ type: 'parseRaw', jobId: 'parse', rawJsonText: '{"count":1}' })

    const incrementNode = {
      id: 'js-1',
      type: 'js' as const,
      label: 'Increment',
      code: 'export default function transform(input) { return { count: input.count + 1 } }',
    }

    const first = await runtime.handle({
      type: 'executePipeline',
      jobId: 'run-1',
      nodes: [{ id: 'raw', type: 'raw', label: 'Raw' }, incrementNode],
    })
    expect(first).toMatchObject({
      type: 'executePipelineResult',
      jobId: 'run-1',
      activeNodeId: 'js-1',
      summary: { type: 'object', childCount: 1 },
    })

    const second = await runtime.handle({
      type: 'executePipeline',
      jobId: 'run-2',
      nodes: [{ id: 'raw', type: 'raw', label: 'Raw' }, incrementNode],
    })
    expect(second).toMatchObject({
      type: 'executePipelineResult',
      jobId: 'run-2',
      activeNodeId: 'js-1',
      summary: { type: 'object', childCount: 1 },
    })

    const details = await runtime.handle({ type: 'getDetails', jobId: 'details', path: ['count'] })
    expect(details).toMatchObject({ type: 'detailsResult', value: 2 })
  })
})
