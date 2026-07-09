import { useEffect, useMemo, useState } from 'react'
import { formatPath, getAtPath } from '../domain/jsonPath'
import { summarizeJson } from '../domain/jsonSummary'
import type { JsonValue } from '../domain/jsonTypes'
import type { PipelineNode, PipelineNodeType, ProcessingNode } from '../domain/pipelineTypes'
import type { ProjectRecord, RawSource } from '../domain/projectTypes'
import { DetailsPreview } from '../features/details/DetailsPreview'
import { ErrorBanner } from '../features/pipeline/ErrorBanner'
import { NodeEditor } from '../features/pipeline/NodeEditor'
import { PipelineFlow } from '../features/pipeline/PipelineFlow'
import { ProjectLauncher } from '../features/projects/ProjectLauncher'
import { JsonViewer } from '../features/viewer/JsonViewer'
import { ProjectRepository, getRawSizeBytes, sanitizeProjectForPersistence } from '../persistence/projectRepository'
import {
  appendNodeAfterActive,
  createInitialPipeline,
  markDownstreamStale,
  selectActiveNode,
  type PipelineState,
} from '../pipeline/pipelineModel'
import { resetWorkbenchViewState, restoreWorkbenchViewState, useWorkbenchStore } from '../state/useWorkbenchStore'
import { AppShell } from './AppShell'

type PersistedProjectContext = {
  id: string
  name: string
  createdAt: number
  rawSource: RawSource
  rawJsonText?: string
}

const ACTIVE_PROJECT_STORAGE_KEY = 'jsonhunter.active-project'

function getNodeDraftValue(node: PipelineNode) {
  if (node.type === 'js') return node.code
  if (node.type === 'duckdb') return node.sql
  return ''
}

function createNodeLabel(type: Exclude<PipelineNodeType, 'raw'>, index: number) {
  return type === 'js' ? `JS ${index}` : `DuckDB ${index}`
}

function createProjectName() {
  return 'Pasted JSON'
}

function createPasteSource(rawJsonText: string): RawSource {
  return {
    type: 'paste',
    label: createProjectName(),
    sizeBytes: getRawSizeBytes(rawJsonText),
  }
}

function toPersistedProject(
  project: PersistedProjectContext,
  pipeline: PipelineState,
  viewerMode: ReturnType<typeof useWorkbenchStore.getState>['viewerMode'],
  selectedPath: ReturnType<typeof useWorkbenchStore.getState>['selectedPath'],
): ProjectRecord {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: Date.now(),
    rawSource: project.rawSource,
    rawJsonText: project.rawJsonText,
    pipeline: pipeline.nodes,
    activeNodeId: pipeline.activeNodeId,
    viewerMode,
    selectedPath,
  }
}

function buildPipelineState(project: ProjectRecord): PipelineState {
  return selectActiveNode(
    {
      nodes: project.pipeline,
      activeNodeId: project.activeNodeId,
      nodeStatuses: {},
    },
    project.activeNodeId,
  )
}

function readStoredProject(): ProjectRecord | undefined {
  const raw = globalThis.localStorage?.getItem(ACTIVE_PROJECT_STORAGE_KEY)
  if (!raw) return undefined

  try {
    return JSON.parse(raw) as ProjectRecord
  } catch {
    globalThis.localStorage?.removeItem(ACTIVE_PROJECT_STORAGE_KEY)
    return undefined
  }
}

function writeStoredProject(project: ProjectRecord) {
  globalThis.localStorage?.setItem(
    ACTIVE_PROJECT_STORAGE_KEY,
    JSON.stringify(sanitizeProjectForPersistence(project)),
  )
}

function getPlaceholderDetails(activeNode: PipelineNode) {
  if (activeNode.type === 'raw') {
    return {
      path: 'root',
      type: 'undefined',
      valuePreview: 'Create or restore a project to inspect raw JSON.',
    }
  }

  return {
    path: 'root',
    type: activeNode.type === 'duckdb' ? 'table' : 'object',
    valuePreview: `Preview for ${activeNode.label} will appear here once execution data is connected.`,
  }
}

export function App() {
  const repository = useMemo(() => new ProjectRepository(), [])
  const [pipeline, setPipeline] = useState<PipelineState>(() => createInitialPipeline())
  const [project, setProject] = useState<PersistedProjectContext | undefined>()
  const [rawValue, setRawValue] = useState<JsonValue | undefined>()
  const [editorValue, setEditorValue] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [isHydrating, setIsHydrating] = useState(true)

  const viewerMode = useWorkbenchStore((state) => state.viewerMode)
  const selectedPath = useWorkbenchStore((state) => state.selectedPath)
  const setViewerMode = useWorkbenchStore((state) => state.setViewerMode)
  const setSelectedPath = useWorkbenchStore((state) => state.setSelectedPath)

  const activeNode = useMemo(
    () => pipeline.nodes.find((node) => node.id === pipeline.activeNodeId) ?? pipeline.nodes[0],
    [pipeline.activeNodeId, pipeline.nodes],
  )

  useEffect(() => {
    void (async () => {
      try {
        const latestProject = readStoredProject() ?? (await repository.listProjects())[0]
        if (!latestProject?.rawJsonText) return

        const parsed = JSON.parse(latestProject.rawJsonText) as JsonValue
        setProject({
          id: latestProject.id,
          name: latestProject.name,
          createdAt: latestProject.createdAt,
          rawSource: latestProject.rawSource,
          rawJsonText: latestProject.rawJsonText,
        })
        setRawValue(parsed)
        setPipeline(buildPipelineState(latestProject))
        restoreWorkbenchViewState(latestProject.viewerMode, latestProject.selectedPath)
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : String(nextError))
      } finally {
        setIsHydrating(false)
      }
    })()
  }, [repository])

  useEffect(() => {
    setEditorValue(getNodeDraftValue(activeNode))
  }, [activeNode])

  useEffect(() => {
    if (isHydrating || !project || rawValue === undefined) return
    const persistedProject = toPersistedProject(project, pipeline, viewerMode, selectedPath)
    writeStoredProject(persistedProject)
    void repository.saveProject(persistedProject)
  }, [isHydrating, pipeline, project, rawValue, repository, selectedPath, viewerMode])

  const detailsPreview = useMemo(() => {
    if (rawValue === undefined) return getPlaceholderDetails(activeNode)

    if (activeNode.type === 'raw') {
      const selectedValue = selectedPath.length === 0 ? rawValue : getAtPath(rawValue, selectedPath)
      const summary = summarizeJson(selectedValue)
      return {
        path: formatPath(['root', ...selectedPath]),
        type: summary.type,
        valuePreview: summary.preview,
      }
    }

    return getPlaceholderDetails(activeNode)
  }, [activeNode, rawValue, selectedPath])

  const language = activeNode.type === 'duckdb' ? 'sql' : 'javascript'
  const hasProject = rawValue !== undefined && project !== undefined

  function handleSelectNode(id: string) {
    setPipeline((current) => selectActiveNode(current, id))
    setError(undefined)
  }

  function handleAddNode(type: Exclude<PipelineNodeType, 'raw'>) {
    if (!hasProject) return

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

  function handleCreateFromPaste(text: string) {
    try {
      const parsed = JSON.parse(text) as JsonValue
      const now = Date.now()
      const rawSource = createPasteSource(text)
      const nextProject = {
        id: crypto.randomUUID(),
        name: createProjectName(),
        createdAt: now,
        rawSource,
        rawJsonText: text,
      }

      setProject(nextProject)
      setRawValue(parsed)
      setPipeline(createInitialPipeline())
      resetWorkbenchViewState()
      setError(undefined)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  const pipelinePane = hasProject ? (
    <PipelineFlow
      nodes={pipeline.nodes}
      activeNodeId={pipeline.activeNodeId}
      nodeStatuses={pipeline.nodeStatuses}
      onSelectNode={handleSelectNode}
      onAddNode={handleAddNode}
    />
  ) : (
    <ProjectLauncher onPasteJson={handleCreateFromPaste} onLoadUrl={() => {}} onOpenFile={() => {}} />
  )

  const viewerPane = hasProject ? (
    <div className="editorPane">
      <ErrorBanner message={error} />
      {activeNode.type === 'raw' ? (
        <JsonViewer
          mode={viewerMode}
          selectedPath={selectedPath}
          breadcrumb={formatPath(['root', ...selectedPath])}
          onModeChange={setViewerMode}
          onSelectPath={setSelectedPath}
        />
      ) : (
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
  ) : (
    <div className="editorPane">
      <ErrorBanner message={error} />
    </div>
  )

  return (
    <AppShell
      pipeline={pipelinePane}
      viewer={viewerPane}
      details={
        <DetailsPreview
          path={detailsPreview.path}
          type={detailsPreview.type}
          valuePreview={detailsPreview.valuePreview}
          sourceNodeLabel={activeNode.label}
        />
      }
    />
  )
}
