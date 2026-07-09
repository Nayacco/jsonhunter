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
import { ProjectRestorePanel } from '../features/projects/ProjectRestorePanel'
import { JsonViewer } from '../features/viewer/JsonViewer'
import { ProjectRepository, getRawSizeBytes } from '../persistence/projectRepository'
import {
  appendNodeAfterActive,
  createInitialPipeline,
  getExecutionNodes,
  markDownstreamStale,
  selectActiveNode,
} from '../pipeline/pipelineModel'
import { resetWorkbenchViewState, useWorkbenchStore } from '../state/useWorkbenchStore'
import { JsonWorkerRuntime } from '../workers/workerRuntime'
import { AppShell } from './AppShell'

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

function createProjectNameFromSource(source: RawSource): string {
  if (source.type === 'file') return source.fileName
  if (source.type === 'url') return source.url
  return createProjectName()
}

function createPasteSource(rawJsonText: string): RawSource {
  return {
    type: 'paste',
    label: createProjectName(),
    sizeBytes: getRawSizeBytes(rawJsonText),
  }
}

function createFileSource(file: File, rawJsonText: string): RawSource {
  return {
    type: 'file',
    fileName: file.name,
    sizeBytes: file.size || getRawSizeBytes(rawJsonText),
  }
}

function createUrlSource(url: string, rawJsonText: string): RawSource {
  return {
    type: 'url',
    url,
    sizeBytes: getRawSizeBytes(rawJsonText),
  }
}

function toPersistedProject(
  project: ProjectRecord,
  nodes: ProjectRecord['pipeline'],
  activeNodeId: string,
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
    pipeline: nodes,
    activeNodeId,
    viewerMode,
    selectedPath,
  }
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
  const workerRuntime = useMemo(() => new JsonWorkerRuntime(), [])
  const [rawValue, setRawValue] = useState<JsonValue | undefined>()
  const [editorValue, setEditorValue] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [isHydrating, setIsHydrating] = useState(true)

  const projects = useWorkbenchStore((state) => state.projects)
  const activeProjectId = useWorkbenchStore((state) => state.activeProjectId)
  const nodes = useWorkbenchStore((state) => state.nodes)
  const activeNodeId = useWorkbenchStore((state) => state.activeNodeId)
  const nodeStatuses = useWorkbenchStore((state) => state.nodeStatuses)
  const viewerMode = useWorkbenchStore((state) => state.viewerMode)
  const selectedPath = useWorkbenchStore((state) => state.selectedPath)
  const createProjectFromRaw = useWorkbenchStore((state) => state.createProjectFromRaw)
  const restoreProjects = useWorkbenchStore((state) => state.restoreProjects)
  const setViewerMode = useWorkbenchStore((state) => state.setViewerMode)
  const setSelectedPath = useWorkbenchStore((state) => state.setSelectedPath)

  const project = useMemo(
    () => projects.find((candidate) => candidate.id === activeProjectId),
    [activeProjectId, projects],
  )

  const activeNode = useMemo(
    () => nodes.find((node) => node.id === activeNodeId) ?? nodes[0] ?? createInitialPipeline().nodes[0],
    [activeNodeId, nodes],
  )

  useEffect(() => {
    void (async () => {
      try {
        await restoreProjects()
        const activeProject = getActiveProject()
        if (activeProject?.rawJsonText) {
          await hydrateExistingProject(activeProject, activeProject.rawJsonText)
        } else {
          setRawValue(undefined)
        }
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : String(nextError))
      } finally {
        setIsHydrating(false)
      }
    })()
  }, [restoreProjects])

  useEffect(() => {
    setEditorValue(getNodeDraftValue(activeNode))
  }, [activeNode])

  useEffect(() => {
    if (isHydrating || !project) return
    const persistedProject = toPersistedProject(project, nodes, activeNodeId, viewerMode, selectedPath)
    void repository.saveProject(persistedProject)
  }, [activeNodeId, isHydrating, nodes, project, repository, selectedPath, viewerMode])

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
  const hasProject = project !== undefined
  const hasLoadedRaw = rawValue !== undefined && project !== undefined

  function getActiveProject() {
    const state = useWorkbenchStore.getState()
    return state.projects.find((candidate) => candidate.id === state.activeProjectId)
  }

  function updatePipeline(updater: (current: ReturnType<typeof createInitialPipeline>) => ReturnType<typeof createInitialPipeline>) {
    useWorkbenchStore.setState((state) => updater({
      nodes: state.nodes,
      activeNodeId: state.activeNodeId,
      nodeStatuses: state.nodeStatuses,
    }))
  }

  function updateRuntimeProject(nextProject: ProjectRecord) {
    useWorkbenchStore.setState((state) => ({
      projects: state.projects.map((candidate) => (candidate.id === nextProject.id ? nextProject : candidate)),
    }))
  }

  async function parseRawWithWorker(rawJsonText: string) {
    const response = await workerRuntime.handle({
      type: 'parseRaw',
      jobId: crypto.randomUUID(),
      rawJsonText,
    })
    if (response.type === 'workerError') throw new Error(response.message)
    return JSON.parse(rawJsonText) as JsonValue
  }

  async function executeProjectNodes(projectRecord: ProjectRecord) {
    const pipeline = selectActiveNode(
      {
        nodes: projectRecord.pipeline,
        activeNodeId: projectRecord.activeNodeId,
        nodeStatuses: {},
      },
      projectRecord.activeNodeId,
    )
    const executionNodes = getExecutionNodes(pipeline)
    if (executionNodes.length <= 1) return
    const response = await workerRuntime.handle({
      type: 'executePipeline',
      jobId: crypto.randomUUID(),
      nodes: executionNodes,
    })
    if (response.type === 'workerError') throw new Error(response.message)
  }

  async function hydrateExistingProject(projectRecord: ProjectRecord, rawJsonText: string, rawSource = projectRecord.rawSource) {
    const parsed = await parseRawWithWorker(rawJsonText)
    const nextProject = {
      ...projectRecord,
      rawSource,
      rawJsonText,
      updatedAt: Date.now(),
      pipeline: useWorkbenchStore.getState().nodes,
      activeNodeId: useWorkbenchStore.getState().activeNodeId,
      viewerMode: useWorkbenchStore.getState().viewerMode,
      selectedPath: useWorkbenchStore.getState().selectedPath,
    }

    await executeProjectNodes(nextProject)
    updateRuntimeProject(nextProject)
    setRawValue(parsed)
    setError(undefined)
    void repository.saveProject(nextProject)
  }

  async function createProject(name: string, source: RawSource, rawJsonText: string) {
    const parsed = await parseRawWithWorker(rawJsonText)
    await createProjectFromRaw(name, source, rawJsonText)
    setRawValue(parsed)
    resetWorkbenchViewState()
    setError(undefined)
  }

  function handleSelectNode(id: string) {
    updatePipeline((current) => selectActiveNode(current, id))
    setError(undefined)
  }

  function handleAddNode(type: Exclude<PipelineNodeType, 'raw'>) {
    if (!hasLoadedRaw) return

    updatePipeline((current) => {
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

    updatePipeline((current) =>
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

  async function handleCreateFromPaste(text: string) {
    try {
      await createProject(createProjectName(), createPasteSource(text), text)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  async function handleLoadUrl(url: string) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Unable to load URL: ${response.status}`)
      const rawJsonText = await response.text()
      await createProject(createProjectNameFromSource({ type: 'url', url }), createUrlSource(url, rawJsonText), rawJsonText)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  async function handleOpenFile(file: File) {
    try {
      const rawJsonText = await file.text()
      await createProject(createProjectNameFromSource({ type: 'file', fileName: file.name, sizeBytes: file.size }), createFileSource(file, rawJsonText), rawJsonText)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  async function handleReloadUrl(url: string) {
    const activeProject = getActiveProject()
    if (!activeProject) return

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Unable to load URL: ${response.status}`)
      const rawJsonText = await response.text()
      await hydrateExistingProject(activeProject, rawJsonText, createUrlSource(url, rawJsonText))
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  async function handleRestorePaste(text: string) {
    const activeProject = getActiveProject()
    if (!activeProject) return

    try {
      await hydrateExistingProject(activeProject, text, createPasteSource(text))
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  async function handleRestoreFile(file: File) {
    const activeProject = getActiveProject()
    if (!activeProject) return

    try {
      const rawJsonText = await file.text()
      await hydrateExistingProject(activeProject, rawJsonText, createFileSource(file, rawJsonText))
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  const pipelinePane = hasProject ? (
    <PipelineFlow
      nodes={nodes}
      activeNodeId={activeNodeId}
      nodeStatuses={nodeStatuses}
      onSelectNode={handleSelectNode}
      onAddNode={handleAddNode}
    />
  ) : (
    <ProjectLauncher onPasteJson={handleCreateFromPaste} onLoadUrl={handleLoadUrl} onOpenFile={handleOpenFile} />
  )

  const restorePane =
    !project || hasLoadedRaw
      ? undefined
      : project.rawSource.type === 'url'
        ? (() => {
            const { url } = project.rawSource
            return <ProjectRestorePanel sourceLabel={url} onReloadUrl={() => handleReloadUrl(url)} />
          })()
        : project.rawSource.type === 'file'
          ? (() => {
              const { fileName } = project.rawSource
              return <ProjectRestorePanel sourceLabel={fileName} onReselectFile={handleRestoreFile} />
            })()
          : <ProjectRestorePanel sourceLabel={project.rawSource.label} onPasteAgain={handleRestorePaste} />

  const viewerPane = hasProject ? (
    <div className="editorPane">
      <ErrorBanner message={error} />
      {hasLoadedRaw && activeNode.type === 'raw' ? (
        <JsonViewer
          mode={viewerMode}
          selectedPath={selectedPath}
          breadcrumb={formatPath(['root', ...selectedPath])}
          onModeChange={setViewerMode}
          onSelectPath={setSelectedPath}
        />
      ) : hasLoadedRaw ? (
        <NodeEditor
          language={language}
          value={editorValue}
          onChange={setEditorValue}
          onRun={handleRun}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : (
        restorePane
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
