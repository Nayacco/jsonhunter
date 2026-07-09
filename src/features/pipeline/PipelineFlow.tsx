import type { PipelineNode, PipelineNodeStatus, PipelineNodeType } from '../../domain/pipelineTypes'

type PipelineFlowProps = {
  nodes: PipelineNode[]
  activeNodeId: string
  nodeStatuses: Record<string, PipelineNodeStatus>
  onSelectNode(id: string): void
  onAddNode(type: Exclude<PipelineNodeType, 'raw'>): void
}

export function PipelineFlow({ nodes, activeNodeId, nodeStatuses, onSelectNode, onAddNode }: PipelineFlowProps) {
  return (
    <div className="pipelineFlow" aria-label="Pipeline">
      <div className="pipelineNodes">
        {nodes.map((node, index) => (
          <div className="pipelineNodeWrap" key={node.id}>
            {index > 0 && <span className="pipelineArrow">→</span>}
            <button
              type="button"
              className={`pipelineNode pipelineNode-${nodeStatuses[node.id] ?? 'inactive'}`}
              aria-pressed={node.id === activeNodeId}
              onClick={() => onSelectNode(node.id)}
            >
              <strong>{node.label}</strong>
              <span>{node.type}</span>
            </button>
          </div>
        ))}
      </div>
      <div className="pipelineActions">
        <button type="button" onClick={() => onAddNode('js')}>
          Add JS
        </button>
        <button type="button" onClick={() => onAddNode('duckdb')}>
          Add DuckDB
        </button>
      </div>
    </div>
  )
}
