import { Button } from '@astryxdesign/core/Button'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import { MoreMenu } from '@astryxdesign/core/MoreMenu'
import { HStack } from '@astryxdesign/core/Stack'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Text } from '@astryxdesign/core/Text'
import { Toolbar } from '@astryxdesign/core/Toolbar'
import type {
  PipelineNode,
  PipelineNodeStatus,
  PipelineNodeType,
} from '../../domain/pipelineTypes'

type PipelineFlowProps = {
  nodes: PipelineNode[]
  activeNodeId: string
  nodeStatuses: Record<string, PipelineNodeStatus>
  draftNodeId?: string
  isAddDisabled?: boolean
  onSelectNode(id: string): void
  onEditNode?(id: string): void
  onDeleteNode?(id: string): void
  onAddNode(type: Exclude<PipelineNodeType, 'raw'>): void
}

export function PipelineFlow({
  nodes,
  activeNodeId,
  nodeStatuses,
  draftNodeId,
  isAddDisabled = false,
  onSelectNode,
  onEditNode,
  onDeleteNode,
  onAddNode,
}: PipelineFlowProps) {
  return (
    <Toolbar
      label="Pipeline"
      size="sm"
      className="pipelineFlow-toolbar"
      startContent={
        <HStack gap={2} align="center" className="pipelineFlow-scroll">
          <Text type="label" className="pipelineFlow-label">
            Pipeline
          </Text>
          <HStack
            gap={0}
            align="center"
            as="section"
            aria-label="Pipeline nodes"
            className="pipelineFlow-track"
          >
            {nodes.map((node, index) => {
              const status = nodeStatuses[node.id] ?? 'inactive'
              const isDraft = node.id === draftNodeId
              const hasMenu =
                node.type !== 'raw' && !isDraft && Boolean(onEditNode || onDeleteNode)

              return (
                <HStack key={node.id} gap={0} align="center" className="pipelineFlow-segment">
                  {index > 0 ? <PipelineConnector /> : null}
                  <HStack
                    gap={0}
                    align="center"
                    className="pipelineFlow-node"
                    data-active={node.id === activeNodeId}
                    data-draft={isDraft}
                    data-has-menu={hasMenu}
                  >
                    <Button
                      label={`${node.label}, ${nodeTypeLabel(node.type)}, ${status}`}
                      variant="ghost"
                      icon={
                        <StatusDot
                          variant={statusVariant(status)}
                          label={`${node.label} ${status}`}
                          tooltip={`${node.label}: ${status}`}
                        />
                      }
                      className="pipelineFlow-nodeButton"
                      onClick={() => onSelectNode(node.id)}
                    >
                      <Text type="label" color="inherit">
                        {nodeTypeLabel(node.type)}
                      </Text>
                    </Button>
                    {hasMenu ? (
                      <MoreMenu
                        label={`More actions for ${node.label}`}
                        size="sm"
                        items={[
                          ...(onEditNode
                            ? [
                                {
                                  label: 'Edit step',
                                  onClick: () => onEditNode(node.id),
                                },
                              ]
                            : []),
                          ...(onDeleteNode
                            ? [
                                ...(onEditNode ? [{ type: 'divider' as const }] : []),
                                {
                                  label: 'Delete step',
                                  onClick: () => onDeleteNode(node.id),
                                },
                              ]
                            : []),
                        ]}
                      />
                    ) : null}
                  </HStack>
                </HStack>
              )
            })}
            <PipelineConnector />
            <DropdownMenu
              button={{
                label: 'Add step',
                variant: 'secondary',
                isDisabled: isAddDisabled,
              }}
              menuWidth="calc(var(--spacing-12) * 3)"
              items={[
                { label: 'Add JS', onClick: () => onAddNode('js') },
                { label: 'Add DuckDB', onClick: () => onAddNode('duckdb') },
              ]}
            />
          </HStack>
        </HStack>
      }
    />
  )
}

function PipelineConnector() {
  return (
    <HStack
      aria-hidden="true"
      data-testid="pipeline-connector"
      className="pipelineFlow-connector"
    />
  )
}

function nodeTypeLabel(type: PipelineNodeType) {
  if (type === 'js') return 'JS'
  if (type === 'duckdb') return 'DuckDB'
  return 'JSON'
}

function statusVariant(status: PipelineNodeStatus | undefined) {
  if (status === 'active') return 'accent'
  if (status === 'ready') return 'success'
  if (status === 'error' || status === 'blocked') return 'error'
  if (status === 'stale') return 'warning'
  return 'neutral'
}
