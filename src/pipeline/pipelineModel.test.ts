import { describe, expect, it } from 'vitest'
import {
  appendNodeAfterActive,
  createInitialPipeline,
  getExecutionNodes,
  markDownstreamStale,
  selectActiveNode,
} from './pipelineModel'

describe('pipelineModel', () => {
  it('starts with immutable raw node selected', () => {
    const state = createInitialPipeline()
    expect(state.activeNodeId).toBe('raw')
    expect(state.nodes).toEqual([{ id: 'raw', type: 'raw', label: 'Raw' }])
  })

  it('executes only through the selected node', () => {
    const initial = createInitialPipeline()
    const withJs = appendNodeAfterActive(initial, { id: 'node-js', type: 'js', label: 'Normalize', code: 'export default input => input' })
    const withSql = appendNodeAfterActive(withJs, { id: 'node-sql', type: 'duckdb', label: 'Filter', sql: 'select * from input' })
    const selectedJs = selectActiveNode(withSql, 'node-js')

    expect(getExecutionNodes(selectedJs).map((node) => node.id)).toEqual(['raw', 'node-js'])
  })

  it('marks nodes after a changed node stale', () => {
    const initial = createInitialPipeline()
    const withJs = appendNodeAfterActive(initial, { id: 'node-js', type: 'js', label: 'Normalize', code: 'export default input => input' })
    const withSql = appendNodeAfterActive(withJs, { id: 'node-sql', type: 'duckdb', label: 'Filter', sql: 'select * from input' })

    expect(markDownstreamStale(withSql, 'node-js').nodeStatuses['node-sql']).toBe('stale')
  })
})
