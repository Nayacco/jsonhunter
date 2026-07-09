import type { PipelineNode, PipelineNodeStatus, ProcessingNode } from '../domain/pipelineTypes'

export type PipelineState = {
  nodes: PipelineNode[]
  activeNodeId: string
  nodeStatuses: Record<string, PipelineNodeStatus>
}

export function createInitialPipeline(): PipelineState {
  return {
    nodes: [{ id: 'raw', type: 'raw', label: 'Raw' }],
    activeNodeId: 'raw',
    nodeStatuses: { raw: 'active' },
  }
}

export function appendNodeAfterActive(state: PipelineState, node: ProcessingNode): PipelineState {
  const activeIndex = state.nodes.findIndex((candidate) => candidate.id === state.activeNodeId)
  const insertAt = activeIndex + 1
  const nodes = [...state.nodes.slice(0, insertAt), node, ...state.nodes.slice(insertAt)]
  return selectActiveNode(
    {
      nodes,
      activeNodeId: node.id,
      nodeStatuses: { ...state.nodeStatuses, [node.id]: 'active' },
    },
    node.id,
  )
}

export function selectActiveNode(state: PipelineState, nodeId: string): PipelineState {
  if (!state.nodes.some((node) => node.id === nodeId)) throw new Error(`Unknown node: ${nodeId}`)
  const activeIndex = state.nodes.findIndex((node) => node.id === nodeId)
  const nodeStatuses: Record<string, PipelineNodeStatus> = {}
  state.nodes.forEach((node, index) => {
    if (node.id === nodeId) nodeStatuses[node.id] = 'active'
    else nodeStatuses[node.id] = index < activeIndex ? 'ready' : 'inactive'
  })
  return { ...state, activeNodeId: nodeId, nodeStatuses }
}

export function getExecutionNodes(state: PipelineState): PipelineNode[] {
  const activeIndex = state.nodes.findIndex((node) => node.id === state.activeNodeId)
  return state.nodes.slice(0, activeIndex + 1)
}

export function markDownstreamStale(state: PipelineState, changedNodeId: string): PipelineState {
  const changedIndex = state.nodes.findIndex((node) => node.id === changedNodeId)
  if (changedIndex === -1) throw new Error(`Unknown node: ${changedNodeId}`)
  const nodeStatuses = { ...state.nodeStatuses }
  state.nodes.slice(changedIndex + 1).forEach((node) => {
    nodeStatuses[node.id] = 'stale'
  })
  return { ...state, nodeStatuses }
}
