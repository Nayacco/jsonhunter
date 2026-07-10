import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { formatPath, getAtPath } from '../domain/jsonPath'
import { summarizeJson, type JsonSummary } from '../domain/jsonSummary'
import type { JsonPath, JsonValue } from '../domain/jsonTypes'
import type { PipelineNode, PipelineNodeType, ProcessingNode } from '../domain/pipelineTypes'
import type { ProjectRecord, RawSource } from '../domain/projectTypes'
import { DetailsPreview } from '../features/details/DetailsPreview'
import { ErrorBanner } from '../features/pipeline/ErrorBanner'
import { NodeEditor } from '../features/pipeline/NodeEditor'
import { PipelineFlow } from '../features/pipeline/PipelineFlow'
import { ImportLandingPage } from '../features/projects/ImportLandingPage'
import { MemoryRiskDialog } from '../features/projects/MemoryRiskDialog'
import { ProjectLoadingPage } from '../features/projects/ProjectLoadingPage'
import { ProjectRestorePage } from '../features/projects/ProjectRestorePage'
import { JsonViewer } from '../features/viewer/JsonViewer'
import {
  deriveColumnViewFromJson,
  deriveViewerRowsFromJson,
  getColumnId,
  type ColumnWindowRequests,
  type ViewerWindowRequests,
} from '../features/viewer/viewerRows'
import {
  ProjectRepository,
  RAW_WARNING_LIMIT_BYTES,
  getRawSizeBytes,
} from '../persistence/projectRepository'
import {
  createInitialPipeline,
  getExecutionNodes,
  markDownstreamStale,
  selectActiveNode,
  type PipelineState,
} from '../pipeline/pipelineModel'
import { resetWorkbenchViewState, useWorkbenchStore } from '../state/useWorkbenchStore'
import type { WorkbenchJobKind } from '../state/storeTypes'
import { createWorkerClient, type WorkerClient } from '../workers/workerClient'
import type { WorkerRequest, WorkerResponse } from '../workers/workerProtocol'
import { AppShell } from './AppShell'

type DraftNodeState = {
  mode: 'create' | 'edit'
  baseNodeId: string
  node: ProcessingNode
}

type DraftOutput = {
  nodeId: string
  editorValue: string
  value: JsonValue
}

type DraftPreviewSnapshot = {
  value: JsonValue | undefined
  sourceNodeId: string
  details: DetailsState | undefined
}

type DetailsState = {
  path: string
  type: string
  valuePreview: string
}

type MemoryRiskRequest = {
  warningLimitMiB: number
  resolve(shouldContinue: boolean): void
}

function getNodeDraftValue(node: PipelineNode) {
  if (node.type === 'js') return node.code
  if (node.type === 'duckdb') return node.sql
  return ''
}

function applyEditorValue(node: ProcessingNode, editorValue: string): ProcessingNode {
  return node.type === 'js' ? { ...node, code: editorValue } : { ...node, sql: editorValue }
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

function createJobId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
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

function getPlaceholderDetails(activeNode: PipelineNode): DetailsState {
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
    valuePreview: `Preview for ${activeNode.label} will appear here once execution succeeds.`,
  }
}

function detailsFromSummary(path: JsonPath, summary: JsonSummary): DetailsState {
  return {
    path: formatPath(['root', ...path]),
    type: summary.type,
    valuePreview: summary.preview,
  }
}

function createDraftPipeline(current: PipelineState, draft: DraftNodeState): PipelineState {
  const nodes =
    draft.mode === 'edit'
      ? current.nodes.map((node) => (node.id === draft.node.id ? draft.node : node))
      : insertNodeAfter(current.nodes, draft.baseNodeId, draft.node)

  return selectActiveNode(
    {
      nodes,
      activeNodeId: draft.node.id,
      nodeStatuses: current.nodeStatuses,
    },
    draft.node.id,
  )
}

function insertNodeAfter(nodes: PipelineNode[], baseNodeId: string, node: ProcessingNode): PipelineNode[] {
  const baseIndex = nodes.findIndex((candidate) => candidate.id === baseNodeId)
  const insertAt = baseIndex === -1 ? nodes.length : baseIndex + 1
  return [...nodes.slice(0, insertAt), node, ...nodes.slice(insertAt)]
}

function isSupersededWorkerError(error: unknown): boolean {
  return error instanceof Error && /superseded/i.test(error.message)
}

export function App() {
  const repository = useMemo(() => new ProjectRepository(), [])
  const workerClient = useMemo(() => createWorkerClient(), [])
  const workerTerminationTimer = useRef<number | undefined>(undefined)
  const [rawValue, setRawValue] = useState<JsonValue | undefined>()
  const [displayedValue, setDisplayedValue] = useState<JsonValue | undefined>()
  const [displayedSourceNodeId, setDisplayedSourceNodeId] = useState('raw')
  const [draft, setDraft] = useState<DraftNodeState | undefined>()
  const [draftPreviewSnapshot, setDraftPreviewSnapshot] = useState<DraftPreviewSnapshot | undefined>()
  const [latestDraftOutput, setLatestDraftOutput] = useState<DraftOutput | undefined>()
  const [editorValue, setEditorValue] = useState('')
  const [details, setDetails] = useState<DetailsState | undefined>()
  const [viewerWindows, setViewerWindows] = useState<ViewerWindowRequests>({})
  const [columnWindows, setColumnWindows] = useState<ColumnWindowRequests>({})
  const [error, setError] = useState<string | undefined>()
  const [errorNodeId, setErrorNodeId] = useState<string | undefined>()
  const [isHydrating, setIsHydrating] = useState(true)
  const [isProjectLauncherOpen, setIsProjectLauncherOpen] = useState(false)
  const [memoryRiskRequest, setMemoryRiskRequest] = useState<MemoryRiskRequest | undefined>()

  const projects = useWorkbenchStore((state) => state.projects)
  const activeProjectId = useWorkbenchStore((state) => state.activeProjectId)
  const nodes = useWorkbenchStore((state) => state.nodes)
  const activeNodeId = useWorkbenchStore((state) => state.activeNodeId)
  const nodeStatuses = useWorkbenchStore((state) => state.nodeStatuses)
  const viewerMode = useWorkbenchStore((state) => state.viewerMode)
  const selectedPath = useWorkbenchStore((state) => state.selectedPath)
  const startJob = useWorkbenchStore((state) => state.startJob)
  const finishJob = useWorkbenchStore((state) => state.finishJob)
  const createProjectFromRaw = useWorkbenchStore((state) => state.createProjectFromRaw)
  const restoreProjects = useWorkbenchStore((state) => state.restoreProjects)
  const setViewerMode = useWorkbenchStore((state) => state.setViewerMode)
  const setSelectedPath = useWorkbenchStore((state) => state.setSelectedPath)

  const project = useMemo(
    () => projects.find((candidate) => candidate.id === activeProjectId),
    [activeProjectId, projects],
  )

  const savedActiveNode = useMemo(
    () => nodes.find((node) => node.id === activeNodeId) ?? nodes[0] ?? createInitialPipeline().nodes[0],
    [activeNodeId, nodes],
  )
  const activeNode = draft?.node ?? savedActiveNode

  const savedPipeline = useMemo<PipelineState>(
    () => ({
      nodes,
      activeNodeId,
      nodeStatuses,
    }),
    [activeNodeId, nodeStatuses, nodes],
  )
  const displayedPipeline = useMemo(
    () => (draft ? createDraftPipeline(savedPipeline, draft) : savedPipeline),
    [draft, savedPipeline],
  )
  const displayedNodeStatuses = useMemo(
    () => ({
      ...displayedPipeline.nodeStatuses,
      ...(errorNodeId ? { [errorNodeId]: 'error' as const } : {}),
    }),
    [displayedPipeline.nodeStatuses, errorNodeId],
  )

  useEffect(() => {
    if (workerTerminationTimer.current !== undefined) {
      window.clearTimeout(workerTerminationTimer.current)
      workerTerminationTimer.current = undefined
    }

    return () => {
      workerTerminationTimer.current = window.setTimeout(() => {
        workerClient.terminate()
        workerTerminationTimer.current = undefined
      }, 0)
    }
  }, [workerClient])

  useEffect(() => {
    void (async () => {
      try {
        await restoreProjects()
        const activeProject = getActiveProject()
        if (activeProject?.rawJsonText) {
          await hydrateExistingProject(activeProject, activeProject.rawJsonText)
        } else {
          setRawValue(undefined)
          setDisplayedValue(undefined)
        }
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : String(nextError))
      } finally {
        setIsHydrating(false)
      }
    })()
  }, [restoreProjects])

  useEffect(() => {
    if (draft) return
    setEditorValue(getNodeDraftValue(savedActiveNode))
  }, [draft, savedActiveNode])

  useEffect(() => {
    if (isHydrating || !project) return
    const persistedProject = toPersistedProject(project, nodes, activeNodeId, viewerMode, selectedPath)
    void repository.saveProject(persistedProject)
  }, [activeNodeId, isHydrating, nodes, project, repository, selectedPath, viewerMode])

  useEffect(() => {
    setViewerWindows({})
  }, [displayedSourceNodeId, selectedPath, viewerMode])

  useEffect(() => {
    setColumnWindows({})
  }, [displayedSourceNodeId])

  useEffect(() => {
    if (displayedValue === undefined) {
      setDetails(undefined)
      return
    }

    const fallbackValue = selectedPath.length === 0 ? displayedValue : getAtPath(displayedValue, selectedPath)
    setDetails(detailsFromSummary(selectedPath, summarizeJson(fallbackValue)))

    const jobId = createJobId('details')
    void (async () => {
      try {
        const response = await requestWorker(workerClient, startJob, finishJob, {
          type: 'getDetails',
          jobId,
          path: selectedPath,
        })
        if (!response || response.type !== 'detailsResult') return
        setDetails(detailsFromSummary(response.path, response.summary))
      } catch (nextError) {
        if (!isSupersededWorkerError(nextError)) {
          setError(nextError instanceof Error ? nextError.message : String(nextError))
        }
      }
    })()
  }, [displayedSourceNodeId, displayedValue, finishJob, selectedPath, startJob, workerClient])

  const language = activeNode.type === 'duckdb' ? 'sql' : 'javascript'
  const hasProject = project !== undefined
  const hasLoadedRaw = rawValue !== undefined && project !== undefined
  const viewerRows = useMemo(
    () =>
      displayedValue === undefined
        ? undefined
        : deriveViewerRowsFromJson(displayedValue, selectedPath, viewerWindows),
    [displayedValue, selectedPath, viewerWindows],
  )
  const columnView = useMemo(
    () =>
      displayedValue === undefined
        ? undefined
        : deriveColumnViewFromJson(displayedValue, selectedPath, columnWindows),
    [columnWindows, displayedValue, selectedPath],
  )
  const detailsPreview = details ?? getPlaceholderDetails(activeNode)

  function getActiveProject() {
    const state = useWorkbenchStore.getState()
    return state.projects.find((candidate) => candidate.id === state.activeProjectId)
  }

  function updateRuntimeProject(nextProject: ProjectRecord) {
    useWorkbenchStore.setState((state) => ({
      projects: state.projects.map((candidate) => (candidate.id === nextProject.id ? nextProject : candidate)),
    }))
  }

  async function parseRawWithWorker(rawJsonText: string): Promise<JsonValue> {
    const response = await requestWorker(workerClient, startJob, finishJob, {
      type: 'parseRaw',
      jobId: createJobId('parse'),
      rawJsonText,
    })
    if (!response) throw new Error('Raw JSON parse was superseded')
    if (response.type === 'workerError') throw new Error(response.message)
    if (response.type !== 'parseRawResult') throw new Error(`Unexpected worker response: ${response.type}`)
    return response.value
  }

  async function executeNodes(executionNodes: PipelineNode[], sourceNodeId: string): Promise<JsonValue> {
    const response = await requestWorker(workerClient, startJob, finishJob, {
      type: 'executePipeline',
      jobId: createJobId('execute'),
      nodes: executionNodes,
    })
    if (!response) throw new Error('Pipeline execution was superseded')
    if (response.type === 'workerError') throw new Error(response.message)
    if (response.type !== 'executePipelineResult') throw new Error(`Unexpected worker response: ${response.type}`)

    setDisplayedValue(response.output)
    setDisplayedSourceNodeId(sourceNodeId)
    setDetails(detailsFromSummary(selectedPath, response.summary))
    setError(undefined)
    setErrorNodeId(undefined)
    return response.output
  }

  async function executeSavedPipelineToNode(nodeId: string): Promise<void> {
    const pipeline = selectActiveNode(
      {
        nodes,
        activeNodeId,
        nodeStatuses,
      },
      nodeId,
    )
    useWorkbenchStore.setState(pipeline)
    const executionNodes = getExecutionNodes(pipeline)
    await executeNodes(executionNodes, nodeId)
  }

  function requestMemoryRiskConfirmation(rawJsonText: string): Promise<boolean> {
    if (getRawSizeBytes(rawJsonText) <= RAW_WARNING_LIMIT_BYTES) return Promise.resolve(true)

    return new Promise((resolve) => {
      setMemoryRiskRequest({
        warningLimitMiB: Math.round(RAW_WARNING_LIMIT_BYTES / 1024 / 1024),
        resolve,
      })
    })
  }

  function resolveMemoryRiskConfirmation(shouldContinue: boolean) {
    if (!memoryRiskRequest) return

    const { resolve } = memoryRiskRequest
    setMemoryRiskRequest(undefined)
    resolve(shouldContinue)
  }

  async function hydrateExistingProject(projectRecord: ProjectRecord, rawJsonText: string, rawSource = projectRecord.rawSource) {
    if (!(await requestMemoryRiskConfirmation(rawJsonText))) return

    const parsed = await parseRawWithWorker(rawJsonText)
    const nextProject = {
      ...projectRecord,
      rawSource,
      rawJsonText,
      updatedAt: Date.now(),
    }

    updateRuntimeProject(nextProject)
    setRawValue(parsed)
    setDisplayedValue(parsed)
    setDisplayedSourceNodeId('raw')
    setDraft(undefined)
    setDraftPreviewSnapshot(undefined)
    setLatestDraftOutput(undefined)
    setError(undefined)
    setErrorNodeId(undefined)

    try {
      const pipeline = selectActiveNode(
        {
          nodes: nextProject.pipeline,
          activeNodeId: nextProject.activeNodeId,
          nodeStatuses: {},
        },
        nextProject.activeNodeId,
      )
      const output = await executeNodes(getExecutionNodes(pipeline), nextProject.activeNodeId)
      setDisplayedValue(output)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
      setErrorNodeId(nextProject.activeNodeId)
    }

    void repository.saveProject(nextProject)
  }

  async function createProject(name: string, source: RawSource, rawJsonText: string) {
    if (!(await requestMemoryRiskConfirmation(rawJsonText))) return

    const parsed = await parseRawWithWorker(rawJsonText)
    await createProjectFromRaw(name, source, rawJsonText)
    setRawValue(parsed)
    setDisplayedValue(parsed)
    setDisplayedSourceNodeId('raw')
    setDraft(undefined)
    setDraftPreviewSnapshot(undefined)
    setLatestDraftOutput(undefined)
    resetWorkbenchViewState()
    setError(undefined)
    setErrorNodeId(undefined)
    setIsProjectLauncherOpen(false)
  }

  function createDraftNode(type: Exclude<PipelineNodeType, 'raw'>): ProcessingNode {
    const existingCount = displayedPipeline.nodes.filter((node): node is ProcessingNode => node.type === type).length
    let index = existingCount + 1
    let id = `${type}-${index}`
    while (displayedPipeline.nodes.some((node) => node.id === id)) {
      index += 1
      id = `${type}-${index}`
    }

    return type === 'js'
      ? {
          id,
          type,
          label: createNodeLabel(type, index),
          code: 'export default input => input',
        }
      : {
          id,
          type,
          label: createNodeLabel(type, index),
          sql: 'select * from input',
        }
  }

  async function handleSelectNode(id: string) {
    if (!hasLoadedRaw) return

    setDraft(undefined)
    setDraftPreviewSnapshot(undefined)
    setLatestDraftOutput(undefined)
    try {
      await executeSavedPipelineToNode(id)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
      setErrorNodeId(id)
    }
  }

  function handleEditNode(id: string) {
    const node = nodes.find((candidate): candidate is ProcessingNode => candidate.id === id && candidate.type !== 'raw')
    if (!node) return
    setDraft({ mode: 'edit', baseNodeId: id, node })
    setDraftPreviewSnapshot({
      value: displayedValue,
      sourceNodeId: displayedSourceNodeId,
      details,
    })
    setEditorValue(getNodeDraftValue(node))
    setLatestDraftOutput(undefined)
    setError(undefined)
    setErrorNodeId(undefined)
  }

  function handleAddNode(type: Exclude<PipelineNodeType, 'raw'>) {
    if (!hasLoadedRaw || draft) return

    const node = createDraftNode(type)
    setDraft({ mode: 'create', baseNodeId: activeNodeId, node })
    setDraftPreviewSnapshot({
      value: displayedValue,
      sourceNodeId: displayedSourceNodeId,
      details,
    })
    setEditorValue(getNodeDraftValue(node))
    setLatestDraftOutput(undefined)
    setError(undefined)
    setErrorNodeId(undefined)
  }

  async function handleRun() {
    if (!draft) return

    const nextDraft = { ...draft, node: applyEditorValue(draft.node, editorValue) }
    setDraft(nextDraft)
    const draftPipeline = createDraftPipeline(savedPipeline, nextDraft)

    try {
      const output = await executeNodes(getExecutionNodes(draftPipeline), nextDraft.node.id)
      setLatestDraftOutput({ nodeId: nextDraft.node.id, editorValue, value: output })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
      setErrorNodeId(nextDraft.node.id)
    }
  }

  async function handleSave() {
    if (!draft) return

    const nextDraft = { ...draft, node: applyEditorValue(draft.node, editorValue) }
    const draftPipeline = createDraftPipeline(savedPipeline, nextDraft)
    let output = latestDraftOutput?.nodeId === nextDraft.node.id && latestDraftOutput.editorValue === editorValue
      ? latestDraftOutput.value
      : undefined

    if (output === undefined) {
      try {
        output = await executeNodes(getExecutionNodes(draftPipeline), nextDraft.node.id)
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : String(nextError))
        setErrorNodeId(nextDraft.node.id)
        return
      }
    }

    const savedPipelineAfterSave = markDownstreamStale(draftPipeline, nextDraft.node.id)
    useWorkbenchStore.setState(savedPipelineAfterSave)
    setDisplayedValue(output)
    setDisplayedSourceNodeId(nextDraft.node.id)
    setDraft(undefined)
    setDraftPreviewSnapshot(undefined)
    setLatestDraftOutput(undefined)
    setError(undefined)
    setErrorNodeId(undefined)
  }

  function handleCancel() {
    if (draftPreviewSnapshot) {
      setDisplayedValue(draftPreviewSnapshot.value)
      setDisplayedSourceNodeId(draftPreviewSnapshot.sourceNodeId)
      setDetails(draftPreviewSnapshot.details)
    }
    setDraft(undefined)
    setDraftPreviewSnapshot(undefined)
    setLatestDraftOutput(undefined)
    setEditorValue(getNodeDraftValue(savedActiveNode))
    setError(undefined)
    setErrorNodeId(undefined)
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
      await createProject(
        createProjectNameFromSource({ type: 'file', fileName: file.name, sizeBytes: file.size }),
        createFileSource(file, rawJsonText),
        rawJsonText,
      )
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  function handleOpenProjectLauncher() {
    setDraft(undefined)
    setDraftPreviewSnapshot(undefined)
    setLatestDraftOutput(undefined)
    setError(undefined)
    setErrorNodeId(undefined)
    setIsProjectLauncherOpen(true)
  }

  function handleCloseProjectLauncher() {
    setError(undefined)
    setErrorNodeId(undefined)
    setIsProjectLauncherOpen(false)
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

  function handleViewerWindowChange(
    mode: keyof ViewerWindowRequests,
    window: { startIndex: number; count: number },
  ) {
    setViewerWindows((current) => {
      const existing = current[mode]
      if (existing?.startIndex === window.startIndex && existing.count === window.count) return current
      return { ...current, [mode]: window }
    })
  }

  function handleColumnWindowChange(path: JsonPath, window: { startIndex: number; count: number }) {
    const key = getColumnId(path)
    setColumnWindows((current) => {
      const existing = current[key]
      if (existing?.startIndex === window.startIndex && existing.count === window.count) return current
      return { ...current, [key]: window }
    })
  }

  const pipelinePane = (
    <PipelineFlow
      nodes={displayedPipeline.nodes}
      activeNodeId={displayedPipeline.activeNodeId}
      nodeStatuses={displayedNodeStatuses}
      onSelectNode={(id) => void handleSelectNode(id)}
      onEditNode={handleEditNode}
      onAddNode={handleAddNode}
      onOpenAnotherJson={handleOpenProjectLauncher}
    />
  )

  const viewerPane = (
    <>
      <ErrorBanner message={error} />
      {draft ? (
        <>
          <NodeEditor
            language={language}
            value={editorValue}
            onChange={(nextValue) => {
              setEditorValue(nextValue)
              setLatestDraftOutput(undefined)
            }}
            onRun={() => void handleRun()}
            onSave={() => void handleSave()}
            onCancel={handleCancel}
          />
          {displayedValue !== undefined && displayedSourceNodeId === draft.node.id && (
            <JsonViewer
              mode={viewerMode}
              selectedPath={selectedPath}
              rows={viewerRows}
              columnView={columnView}
              onModeChange={setViewerMode}
              onSelectPath={setSelectedPath}
              onWindowChange={handleViewerWindowChange}
              onColumnWindowChange={handleColumnWindowChange}
            />
          )}
        </>
      ) : (
        <JsonViewer
          mode={viewerMode}
          selectedPath={selectedPath}
          rows={viewerRows}
          columnView={columnView}
          onModeChange={setViewerMode}
          onSelectPath={setSelectedPath}
          onWindowChange={handleViewerWindowChange}
          onColumnWindowChange={handleColumnWindowChange}
        />
      )}
    </>
  )

  const loadedWorkbench = (
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

  let content: ReactNode

  if (isHydrating) {
    content = <ProjectLoadingPage />
  } else if (!hasProject || isProjectLauncherOpen) {
    content = (
      <ImportLandingPage
        error={error}
        onClearError={() => setError(undefined)}
        onPasteJson={handleCreateFromPaste}
        onLoadUrl={handleLoadUrl}
        onOpenFile={handleOpenFile}
        onCancel={hasProject ? handleCloseProjectLauncher : undefined}
      />
    )
  } else if (!hasLoadedRaw) {
    if (project.rawSource.type === 'url') {
      const { url } = project.rawSource
      content = (
        <ProjectRestorePage
          sourceLabel={url}
          error={error}
          onReloadUrl={() => handleReloadUrl(url)}
        />
      )
    } else if (project.rawSource.type === 'file') {
      content = (
        <ProjectRestorePage
          sourceLabel={project.rawSource.fileName}
          error={error}
          onReselectFile={handleRestoreFile}
        />
      )
    } else {
      content = (
        <ProjectRestorePage
          sourceLabel={project.rawSource.label}
          error={error}
          onPasteAgain={handleRestorePaste}
        />
      )
    }
  } else {
    content = loadedWorkbench
  }

  return (
    <>
      {content}
      <MemoryRiskDialog
        isOpen={memoryRiskRequest !== undefined}
        warningLimitMiB={memoryRiskRequest?.warningLimitMiB ?? Math.round(RAW_WARNING_LIMIT_BYTES / 1024 / 1024)}
        onCancel={() => resolveMemoryRiskConfirmation(false)}
        onConfirm={() => resolveMemoryRiskConfirmation(true)}
      />
    </>
  )
}

export async function requestWorker(
  workerClient: WorkerClient,
  startJob: (jobId: string, kind?: WorkbenchJobKind) => void,
  finishJob: (jobId: string, kind?: WorkbenchJobKind) => void,
  request: WorkerRequest,
): Promise<WorkerResponse | undefined> {
  const kind = getWorkerJobKind(request)
  startJob(request.jobId, kind)
  try {
    const response = await workerClient.request(request)
    if (getActiveJobIdForRequest(request) !== request.jobId) return undefined
    return response
  } catch (error) {
    if (isSupersededWorkerError(error)) return undefined
    throw error
  } finally {
    finishJob(request.jobId, kind)
  }
}

function getWorkerJobKind(request: WorkerRequest): WorkbenchJobKind {
  return isReadOnlyWorkerRequest(request) ? 'read-only' : 'mutation'
}

function getActiveJobIdForRequest(request: WorkerRequest): string | undefined {
  const state = useWorkbenchStore.getState()
  return isReadOnlyWorkerRequest(request) ? state.activeReadOnlyJobId : state.activeJobId
}

function isReadOnlyWorkerRequest(request: WorkerRequest): boolean {
  return request.type === 'getDetails' || request.type === 'getViewWindow'
}
