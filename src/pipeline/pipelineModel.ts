import type {
  PipelineNode,
  PipelineNodeStatus,
  ProcessingNode,
} from '../domain/pipelineTypes'

export type PipelineState = {
  nodes: PipelineNode[]
  activeNodeId: string
  nodeStatuses: Record<string, PipelineNodeStatus>
}

export type RemoveNodeResult = {
  state: PipelineState
  removedNodes: ProcessingNode[]
}

export function createInitialPipeline(): PipelineState {
  return {
    nodes: [{ id: 'raw', type: 'raw', label: 'Raw' }],
    activeNodeId: 'raw',
    nodeStatuses: { raw: 'active' },
  }
}

export function appendNode(state: PipelineState, node: ProcessingNode): PipelineState {
  const nodes = [...state.nodes, node]
  return selectActiveNode(
    {
      nodes,
      activeNodeId: node.id,
      nodeStatuses: { ...state.nodeStatuses, [node.id]: 'active' },
    },
    node.id,
  )
}

export function replaceNode(state: PipelineState, node: ProcessingNode): PipelineState {
  const nodeIndex = state.nodes.findIndex((candidate) => candidate.id === node.id)
  if (nodeIndex === -1) throw new Error(`Unknown node: ${node.id}`)
  if (state.nodes[nodeIndex]?.type === 'raw') throw new Error('Raw node cannot be replaced')

  return {
    ...state,
    nodes: state.nodes.map((candidate) => (candidate.id === node.id ? node : candidate)),
  }
}

export function removeNodeAndDownstream(
  state: PipelineState,
  nodeId: string,
): RemoveNodeResult {
  const nodeIndex = state.nodes.findIndex((node) => node.id === nodeId)
  if (nodeIndex === -1) throw new Error(`Unknown node: ${nodeId}`)
  if (state.nodes[nodeIndex]?.type === 'raw') throw new Error('Raw node cannot be deleted')

  const nodes = state.nodes.slice(0, nodeIndex)
  const removedNodes = state.nodes.slice(nodeIndex) as ProcessingNode[]
  const activeNodeId = nodes.at(-1)?.id ?? 'raw'

  return {
    state: selectActiveNode(
      {
        nodes,
        activeNodeId,
        nodeStatuses: {},
      },
      activeNodeId,
    ),
    removedNodes,
  }
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

export function markExecutionFailure(
  state: PipelineState,
  failedNodeId: string,
  lastSuccessfulNodeId: string,
): PipelineState {
  const failedIndex = state.nodes.findIndex((node) => node.id === failedNodeId)
  const lastSuccessfulIndex = state.nodes.findIndex((node) => node.id === lastSuccessfulNodeId)
  if (failedIndex === -1) throw new Error(`Unknown failed node: ${failedNodeId}`)
  if (lastSuccessfulIndex === -1) {
    throw new Error(`Unknown last successful node: ${lastSuccessfulNodeId}`)
  }
  if (lastSuccessfulIndex >= failedIndex) {
    throw new Error('Last successful node must precede the failed node')
  }

  const nodeStatuses: Record<string, PipelineNodeStatus> = {}
  state.nodes.forEach((node, index) => {
    if (node.id === lastSuccessfulNodeId) nodeStatuses[node.id] = 'active'
    else if (node.id === failedNodeId) nodeStatuses[node.id] = 'error'
    else if (index > failedIndex) nodeStatuses[node.id] = 'blocked'
    else nodeStatuses[node.id] = 'ready'
  })

  return {
    ...state,
    activeNodeId: lastSuccessfulNodeId,
    nodeStatuses,
  }
}
