import { useMemo, useState } from 'react'
import { AppShell } from './AppShell'
import { DetailsPreview } from '../features/details/DetailsPreview'
import { PipelineFlow } from '../features/pipeline/PipelineFlow'
import { JsonViewer } from '../features/viewer/JsonViewer'
import type { JsonPath } from '../domain/jsonTypes'
import type { PipelineNodeType, ProcessingNode } from '../domain/pipelineTypes'
import type { ViewerRowsByMode } from '../features/viewer/viewerRows'
import {
  appendNodeAfterActive,
  createInitialPipeline,
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
function createNodeLabel(type: Exclude<PipelineNodeType, 'raw'>, index: number) {
  return type === 'js' ? `JS ${index}` : `DuckDB ${index}`
}

const demoViewerRows: ViewerRowsByMode = {
  columns: {
    startIndex: 0,
    totalCount: 4,
    rows: [
      { label: 'ID', value: '42', path: ['data', 0, 'id'] },
      { label: 'Name', value: '"Ada"', path: ['data', 0, 'name'] },
      { label: 'Role', value: '"analyst"', path: ['data', 0, 'role'] },
      { label: 'Status', value: '"ready"', path: ['meta', 'status'] },
    ],
  },
  tree: {
    startIndex: 0,
    totalCount: 5,
    rows: [
      { label: 'root', value: 'object', path: [] },
      { label: 'data', value: 'array(2)', path: ['data'] },
      { label: 'data[0]', value: 'object', path: ['data', 0] },
      { label: 'data[0].id', value: '42', path: ['data', 0, 'id'] },
      { label: 'data[0].name', value: '"Ada"', path: ['data', 0, 'name'] },
    ],
  },
  table: {
    startIndex: 0,
    totalCount: 3,
    rows: [
      { label: 'Row 1', value: 'Ada', path: ['data', 0, 'name'] },
      { label: 'Row 2', value: 'Lin', path: ['data', 1, 'name'] },
      { label: 'Status', value: 'ready', path: ['meta', 'status'] },
    ],
  },
  source: {
    startIndex: 0,
    totalCount: 6,
    rows: [
      { label: '{', path: [] },
      { label: '  "data": [', path: ['data'] },
      { label: '    { "id": 42, "name": "Ada" },', path: ['data', 0] },
      { label: '    { "id": 43, "name": "Lin" }', path: ['data', 1] },
      { label: '  ],', path: ['meta'] },
      { label: '  "status": "ready"', path: ['meta', 'status'] },
    ],
  },
}

type DetailRecord = {
  type: string
  valuePreview: string
}

const detailPreviewByPath = new Map<string, DetailRecord>([
  [JSON.stringify([]), { type: 'object', valuePreview: '{ data: [...], meta: {...} }' }],
  [JSON.stringify(['data']), { type: 'array', valuePreview: '[{ id: 42, name: "Ada" }, { id: 43, name: "Lin" }]' }],
  [JSON.stringify(['data', 0]), { type: 'object', valuePreview: '{ id: 42, name: "Ada", role: "analyst" }' }],
  [JSON.stringify(['data', 0, 'id']), { type: 'number', valuePreview: '42' }],
  [JSON.stringify(['data', 0, 'name']), { type: 'string', valuePreview: '"Ada"' }],
  [JSON.stringify(['data', 0, 'role']), { type: 'string', valuePreview: '"analyst"' }],
  [JSON.stringify(['data', 1, 'name']), { type: 'string', valuePreview: '"Lin"' }],
  [JSON.stringify(['meta']), { type: 'object', valuePreview: '{ status: "ready" }' }],
  [JSON.stringify(['meta', 'status']), { type: 'string', valuePreview: '"ready"' }],
])

function formatPath(path: JsonPath) {
  if (path.length === 0) return 'root'

  return path.reduce<string>((label, segment) => {
    if (typeof segment === 'number') return `${label}[${segment}]`
    return `${label}.${segment}`
  }, 'root')
}

function getDetailPreview(path: JsonPath): DetailRecord {
  return detailPreviewByPath.get(JSON.stringify(path)) ?? { type: 'unknown', valuePreview: 'Unavailable' }
}

export function App() {
  const [pipeline, setPipeline] = useState<PipelineState>(() => createDemoPipeline())
  const [viewerMode, setViewerMode] = useState<'columns' | 'tree' | 'table' | 'source'>('columns')
  const [selectedPath, setSelectedPath] = useState<JsonPath>(['data', 0, 'id'])

  const activeNode = useMemo(
    () => pipeline.nodes.find((node) => node.id === pipeline.activeNodeId) ?? pipeline.nodes[0],
    [pipeline.activeNodeId, pipeline.nodes],
  )
  const selectedDetails = useMemo(() => getDetailPreview(selectedPath), [selectedPath])
  const breadcrumb = useMemo(() => formatPath(selectedPath), [selectedPath])

  function handleSelectNode(id: string) {
    setPipeline((current) => selectActiveNode(current, id))
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
        <JsonViewer
          mode={viewerMode}
          selectedPath={selectedPath}
          breadcrumb={breadcrumb}
          rows={demoViewerRows}
          onModeChange={setViewerMode}
          onSelectPath={setSelectedPath}
        />
      }
      details={
        <DetailsPreview
          path={breadcrumb}
          type={selectedDetails.type}
          valuePreview={selectedDetails.valuePreview}
          sourceNodeLabel={activeNode.label}
        />
      }
    />
  )
}
