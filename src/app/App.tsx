import { useEffect, useMemo, useState } from 'react'
import { AppShell } from './AppShell'
import { ErrorBanner } from '../features/pipeline/ErrorBanner'
import { NodeEditor } from '../features/pipeline/NodeEditor'
import { PipelineFlow } from '../features/pipeline/PipelineFlow'
import { ProjectLauncher } from '../features/projects/ProjectLauncher'
import type { PipelineNode, PipelineNodeType, ProcessingNode } from '../domain/pipelineTypes'
import {
  appendNodeAfterActive,
  createInitialPipeline,
  markDownstreamStale,
  selectActiveNode,
  type PipelineState,
} from '../pipeline/pipelineModel'

function createDemoPipeline(): PipelineState {
  let state = createInitialPipeline()
  state = appendNodeAfterActive(state, {
    id: 'js-1',
    type: 'js',
    label: 'Normalize',
    code: 'export default input => input',
  })
  state = appendNodeAfterActive(state, {
    id: 'duckdb-1',
    type: 'duckdb',
    label: 'Summarize',
    sql: 'select * from input',
  })

  return selectActiveNode(state, 'js-1')
}

function getNodeDraftValue(node: PipelineNode) {
  if (node.type === 'js') return node.code
  if (node.type === 'duckdb') return node.sql
  return ''
}

function createNodeLabel(type: Exclude<PipelineNodeType, 'raw'>, index: number) {
  return type === 'js' ? `JS ${index}` : `DuckDB ${index}`
}

export function App() {
  const [pipeline, setPipeline] = useState<PipelineState>(() => createDemoPipeline())
  const [editorValue, setEditorValue] = useState('')
  const [error, setError] = useState<string | undefined>()

  const activeNode = useMemo(
    () => pipeline.nodes.find((node) => node.id === pipeline.activeNodeId) ?? pipeline.nodes[0],
    [pipeline.activeNodeId, pipeline.nodes],
  )

  useEffect(() => {
    setEditorValue(getNodeDraftValue(activeNode))
  }, [activeNode])

  const language = activeNode.type === 'duckdb' ? 'sql' : 'javascript'

  function handleSelectNode(id: string) {
    setPipeline((current) => selectActiveNode(current, id))
    setError(undefined)
  }

  function handleAddNode(type: Exclude<PipelineNodeType, 'raw'>) {
    setPipeline((current) => {
      const count = current.nodes.filter((node): node is ProcessingNode => node.type === type).length + 1
      const node: ProcessingNode =
        type === 'js'
          ? {
              id: `${type}-${count}`,
              type,
              label: createNodeLabel(type, count),
              code: 'export default input => input',
            }
          : {
              id: `${type}-${count}`,
              type,
              label: createNodeLabel(type, count),
              sql: 'select * from input',
            }

      return appendNodeAfterActive(current, node)
    })
    setError(undefined)
  }

  function handleSave() {
    if (activeNode.type === 'raw') return

    setPipeline((current) =>
      markDownstreamStale(
        {
          ...current,
          nodes: current.nodes.map((node) => {
            if (node.id !== current.activeNodeId) return node
            return node.type === 'js'
              ? {
                  ...node,
                  code: editorValue,
                }
              : {
                  ...node,
                  sql: editorValue,
                }
          }),
        },
        current.activeNodeId,
      ),
    )
    setError(undefined)
  }

  function handleCancel() {
    setEditorValue(getNodeDraftValue(activeNode))
    setError(undefined)
  }

  function handleRun() {
    setError('Execution is not connected yet.')
  }

  return (
    <AppShell
      pipeline={
        <PipelineFlow
          nodes={pipeline.nodes}
          activeNodeId={pipeline.activeNodeId}
          nodeStatuses={pipeline.nodeStatuses}
          onSelectNode={handleSelectNode}
          onAddNode={handleAddNode}
        />
      }
      viewer={
        <div className="editorPane">
          <ErrorBanner message={error} />
          {activeNode.type === 'raw' ? null : (
            <NodeEditor
              language={language}
              value={editorValue}
              onChange={setEditorValue}
              onRun={handleRun}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          )}
        </div>
      }
      details={<ProjectLauncher onPasteJson={() => {}} onLoadUrl={() => {}} onOpenFile={() => {}} />}
    />
  )
}
