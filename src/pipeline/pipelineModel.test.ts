import { describe, expect, it } from 'vitest'
import {
  appendNode,
  createInitialPipeline,
  getExecutionNodes,
  markExecutionFailure,
  removeNodeAndDownstream,
  replaceNode,
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
    const withJs = appendNode(initial, {
      id: 'node-js',
      type: 'js',
      label: 'Normalize',
      code: 'export default input => input',
    })
    const selectedRaw = selectActiveNode(withJs, 'raw')
    const withSql = appendNode(selectedRaw, {
      id: 'node-sql',
      type: 'duckdb',
      label: 'Filter',
      sql: 'select * from input',
    })
    const selectedJs = selectActiveNode(withSql, 'node-js')

    expect(withSql.nodes.map((node) => node.id)).toEqual(['raw', 'node-js', 'node-sql'])
    expect(getExecutionNodes(selectedJs).map((node) => node.id)).toEqual(['raw', 'node-js'])
  })

  it('replaces a processing node without moving it', () => {
    const initial = createInitialPipeline()
    const withJs = appendNode(initial, {
      id: 'node-js',
      type: 'js',
      label: 'Normalize',
      code: 'export default input => input',
    })
    const withSql = appendNode(withJs, {
      id: 'node-sql',
      type: 'duckdb',
      label: 'Filter',
      sql: 'select * from input',
    })
    const replaced = replaceNode(withSql, {
      id: 'node-js',
      type: 'js',
      label: 'Normalize',
      code: 'export default input => ({...input, edited: true})',
    })

    expect(replaced.nodes.map((node) => node.id)).toEqual(['raw', 'node-js', 'node-sql'])
    expect(replaced.nodes[1]).toMatchObject({
      id: 'node-js',
      code: 'export default input => ({...input, edited: true})',
    })
  })

  it('removes a node and every downstream node', () => {
    const initial = createInitialPipeline()
    const withJs = appendNode(initial, {
      id: 'node-js',
      type: 'js',
      label: 'Normalize',
      code: 'export default input => input',
    })
    const withSql = appendNode(withJs, {
      id: 'node-sql',
      type: 'duckdb',
      label: 'Filter',
      sql: 'select * from input',
    })

    const result = removeNodeAndDownstream(withSql, 'node-js')

    expect(result.removedNodes.map((node) => node.id)).toEqual(['node-js', 'node-sql'])
    expect(result.state.nodes.map((node) => node.id)).toEqual(['raw'])
    expect(result.state.activeNodeId).toBe('raw')
    expect(result.state.nodeStatuses).toEqual({ raw: 'active' })
  })

  it('marks a failed node as error and later nodes as blocked', () => {
    const initial = createInitialPipeline()
    const withJs = appendNode(initial, {
      id: 'node-js',
      type: 'js',
      label: 'Normalize',
      code: 'export default input => input',
    })
    const withSql = appendNode(withJs, {
      id: 'node-sql',
      type: 'duckdb',
      label: 'Filter',
      sql: 'select * from input',
    })
    const withFinalJs = appendNode(withSql, {
      id: 'node-final',
      type: 'js',
      label: 'Project',
      code: 'export default input => input',
    })

    const failed = markExecutionFailure(withFinalJs, 'node-sql', 'node-js')

    expect(failed.activeNodeId).toBe('node-js')
    expect(failed.nodeStatuses).toEqual({
      raw: 'ready',
      'node-js': 'active',
      'node-sql': 'error',
      'node-final': 'blocked',
    })
  })
})
