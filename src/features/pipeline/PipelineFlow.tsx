import { Button } from '@astryxdesign/core/Button'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Text } from '@astryxdesign/core/Text'
import { Toolbar } from '@astryxdesign/core/Toolbar'
import type { PipelineNode, PipelineNodeStatus, PipelineNodeType } from '../../domain/pipelineTypes'

type PipelineFlowProps = {
  nodes: PipelineNode[]
  activeNodeId: string
  nodeStatuses: Record<string, PipelineNodeStatus>
  onSelectNode(id: string): void
  onEditNode?(id: string): void
  onAddNode(type: Exclude<PipelineNodeType, 'raw'>): void
}

export function PipelineFlow({ nodes, activeNodeId, nodeStatuses, onSelectNode, onEditNode, onAddNode }: PipelineFlowProps) {
  return (
    <Toolbar
      label="Pipeline"
      size="sm"
      startContent={
        <HStack gap={2} wrap="wrap" align="center" as="section" aria-label="Pipeline nodes">
          <Text type="label">Pipeline</Text>
          {nodes.map((node) => {
            const status = nodeStatuses[node.id] ?? 'inactive'
            return (
              <HStack key={node.id} gap={1} align="center">
                <Button
                  label={`${node.label} ${node.type} ${status}`}
                  variant={node.id === activeNodeId ? 'primary' : 'secondary'}
                  icon={<StatusDot variant={statusVariant(status)} label={`${node.label} ${status}`} />}
                  onClick={() => onSelectNode(node.id)}
                >
                  {`${node.label} ${node.type} ${status}`}
                </Button>
                {node.type !== 'raw' && onEditNode ? (
                  <Button
                    label="Edit"
                    tooltip={`Edit ${node.label}`}
                    variant="ghost"
                    onClick={() => onEditNode(node.id)}
                  />
                ) : null}
              </HStack>
            )
          })}
        </HStack>
      }
      endContent={
        <VStack gap={1}>
          <Button label="Add JS" onClick={() => onAddNode('js')} />
          <Button label="Add DuckDB" onClick={() => onAddNode('duckdb')} />
        </VStack>
      }
    />
  )
}

function statusVariant(status: PipelineNodeStatus | undefined) {
  if (status === 'active') return 'success'
  if (status === 'error' || status === 'blocked') return 'error'
  if (status === 'stale') return 'warning'
  return 'neutral'
}
