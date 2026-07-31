import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectRecord } from '../domain/projectTypes'
import { resetWorkbenchStore, useWorkbenchStore } from '../state/useWorkbenchStore'
import type { WorkerResponse } from '../workers/workerProtocol'
import { renderWithProviders } from '../test/render'
import { App, requestWorker } from './App'

const {
  listProjects,
  saveProject,
  workerRequest,
  createWorkerClient,
  rawSizeBytesOverride,
  deriveViewerRowsFromJsonCalls,
  deriveViewerRowsForModeCalls,
} = vi.hoisted(() => ({
  listProjects: vi.fn<() => Promise<ProjectRecord[]>>(async () => []),
  saveProject: vi.fn<(project: ProjectRecord) => Promise<void>>(async () => {}),
  workerRequest: vi.fn<(request: any) => Promise<any>>(async () => ({
    type: 'parseRawResult',
    jobId: 'job',
    summary: { type: 'object', label: 'Object(1)', childCount: 1, preview: '{ok}' },
    value: { ok: true },
  })),
  createWorkerClient: vi.fn(() => ({
    request: workerRequest,
    terminate: vi.fn(),
  })),
  rawSizeBytesOverride: { value: undefined as number | undefined },
  deriveViewerRowsFromJsonCalls: vi.fn(),
  deriveViewerRowsForModeCalls: vi.fn(),
}))

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return { promise, resolve }
}

vi.mock('../persistence/projectRepository', () => ({
  ProjectRepository: class {
    listProjects = listProjects
    saveProject = saveProject
  },
  RAW_WARNING_LIMIT_BYTES: 100 * 1024 * 1024,
  getRawSizeBytes: (rawJsonText: string) =>
    rawSizeBytesOverride.value ?? new TextEncoder().encode(rawJsonText).byteLength,
  shouldPersistRawText: (source: { type: string }, rawJsonText: string) =>
    source.type !== 'url' && new TextEncoder().encode(rawJsonText).byteLength <= 10 * 1024 * 1024,
  sanitizeProjectForPersistence: (project: any) => {
    const rawJsonText = project.rawJsonText as string | undefined
    const size = new TextEncoder().encode(rawJsonText ?? '').byteLength
    return size <= 10 * 1024 * 1024 ? project : { ...project, rawJsonText: undefined }
  },
}))

vi.mock('../workers/workerRuntime', () => ({
  JsonWorkerRuntime: class {
    handle = workerRequest
  },
}))

vi.mock('../workers/workerClient', () => ({
  createWorkerClient,
}))

vi.mock('../features/viewer/viewerRows', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/viewer/viewerRows')>()
  const deriveViewerRowsForMode = (
    actual as typeof actual & {
      deriveViewerRowsForMode?: (...args: any[]) => unknown
    }
  ).deriveViewerRowsForMode

  return {
    ...actual,
    deriveViewerRowsFromJson: (...args: Parameters<typeof actual.deriveViewerRowsFromJson>) => {
      deriveViewerRowsFromJsonCalls(...args)
      return actual.deriveViewerRowsFromJson(...args)
    },
    deriveViewerRowsForMode: (...args: any[]) => {
      deriveViewerRowsForModeCalls(...args)
      if (!deriveViewerRowsForMode) throw new Error('deriveViewerRowsForMode is not implemented')
      return deriveViewerRowsForMode(...args)
    },
  }
})

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, options }: any) => (
    <textarea
      aria-label="Monaco editor"
      data-testid="monaco-editor"
      readOnly={Boolean(options?.readOnly)}
      value={value}
      onChange={(event) => onChange?.(event.currentTarget.value)}
    />
  ),
}))

describe('App', () => {
  beforeEach(() => {
    listProjects.mockReset()
    listProjects.mockImplementation(async () => [])
    saveProject.mockReset()
    workerRequest.mockClear()
    workerRequest.mockImplementation(async (request: any) => {
      if (request.type === 'parseRaw') {
        return {
          type: 'parseRawResult',
          jobId: request.jobId,
          summary: { type: 'object', label: 'Object(1)', childCount: 1, preview: '{items}' },
          value: JSON.parse(request.rawJsonText),
        }
      }
      if (request.type === 'executePipeline') {
        return {
          type: 'executePipelineResult',
          jobId: request.jobId,
          activeNodeId: request.nodes.at(-1)?.id ?? 'raw',
          summary: { type: 'object', label: 'Object(1)', childCount: 1, preview: '{items}' },
          output: { items: [{ id: 1, name: 'Grace' }] },
        }
      }
      if (request.type === 'getDetails') {
        return {
          type: 'detailsResult',
          jobId: request.jobId,
          path: request.path,
          value: request.path.length === 0 ? { items: [{ id: 1, name: 'Grace' }] } : 'Grace',
          summary: { type: request.path.length === 0 ? 'object' : 'string', label: 'value', childCount: 0, preview: request.path.length === 0 ? '{items}' : '"Grace"' },
        }
      }
      return { type: 'viewWindowResult', jobId: request.jobId, rows: [], total: 0 }
    })
    createWorkerClient.mockClear()
    deriveViewerRowsFromJsonCalls.mockClear()
    deriveViewerRowsForModeCalls.mockClear()
    rawSizeBytesOverride.value = undefined
    vi.restoreAllMocks()
    window.localStorage.clear()
    resetWorkbenchStore()
  })

  afterEach(() => {
    window.localStorage.clear()
    resetWorkbenchStore()
  })

  async function createPasteProject(user: ReturnType<typeof userEvent.setup>) {
    renderWithProviders(<App />)

    fireEvent.change(await screen.findByLabelText(/paste json/i), {
      target: { value: '{"items":[{"id":1,"name":"Ada"}]}' },
    })
    await user.click(screen.getByRole('button', { name: /create project/i }))
    await screen.findByRole('button', { name: /raw/i })
  }

  async function createPasteProjectFromText(user: ReturnType<typeof userEvent.setup>, text: string) {
    renderWithProviders(<App />)

    fireEvent.change(await screen.findByLabelText(/paste json/i), {
      target: { value: text },
    })
    await user.click(screen.getByRole('button', { name: /create project/i }))
  }

  async function navigateTableToItems(user: ReturnType<typeof userEvent.setup>) {
    const input = await screen.findByRole('textbox', { name: 'Table navigation path' })
    await user.clear(input)
    await user.type(input, 'items{Enter}')
  }

  async function addStep(
    user: ReturnType<typeof userEvent.setup>,
    type: 'js' | 'duckdb',
  ) {
    await user.click(screen.getByRole('button', { name: /add step/i }))
    await user.click(
      screen.getByRole('menuitem', {
        name: type === 'js' ? /add js/i : /add duckdb/i,
      }),
    )
  }

  async function editStep(user: ReturnType<typeof userEvent.setup>, label: string) {
    await user.click(
      screen.getByRole('button', { name: new RegExp(`more actions for ${label}`, 'i') }),
    )
    await user.click(screen.getByRole('menuitem', { name: /edit step/i }))
  }

  it('shows the full landing page without empty workbench regions', async () => {
    renderWithProviders(<App />)

    expect(await screen.findByRole('heading', { name: /make complex data feel navigable/i })).toBeVisible()
    expect(screen.queryByRole('banner', { name: /pipeline/i })).toBeNull()
    expect(screen.queryByRole('region', { name: /json viewer/i })).toBeNull()
    expect(screen.queryByRole('complementary', { name: /details/i })).toBeNull()
  })

  it('imports a CSV file through the canonical JSON worker flow', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />)

    const csvText = 'id,name,code\r\n1,Ada,001\r\n2,"Grace, Hopper",002'
    const file = new File([csvText], 'people.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', { value: async () => csvText })
    await screen.findByRole('heading', { name: /open a file/i })
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInstanceOf(HTMLInputElement)
    await user.upload(fileInput as HTMLInputElement, file)

    await waitFor(() => {
      expect(workerRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'parseRaw',
          rawJsonText: JSON.stringify([
            { id: '1', name: 'Ada', code: '001' },
            { id: '2', name: 'Grace, Hopper', code: '002' },
          ]),
        }),
      )
    })
    expect(await screen.findByRole('button', { name: /raw/i })).toBeVisible()
    expect(useWorkbenchStore.getState().projects[0]?.rawSource).toMatchObject({
      type: 'file',
      fileName: 'people.csv',
      format: 'csv',
    })
  })

  it('returns from the new-project landing page to the unchanged workbench', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)

    await user.click(screen.getByRole('button', { name: /import data/i }))
    expect(await screen.findByRole('heading', { name: /make complex data feel navigable/i })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /back to current project/i }))

    expect(await screen.findByRole('button', { name: /raw/i })).toBeVisible()
  })

  it('keeps the current project clean when a replacement import fails', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)
    workerRequest.mockImplementation(async (request: any) => {
      if (request.type === 'parseRaw') {
        return {
          type: 'workerError',
          jobId: request.jobId,
          message: 'Replacement JSON is invalid',
        }
      }
      return { type: 'viewWindowResult', jobId: request.jobId, rows: [], total: 0 }
    })

    await user.click(screen.getByRole('button', { name: /import data/i }))
    fireEvent.change(screen.getByLabelText(/paste json/i), {
      target: { value: '{broken' },
    })
    await user.click(screen.getByRole('button', { name: /create (?:from paste|project)/i }))
    expect(await screen.findByText(/replacement json is invalid/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: /back to current project/i }))

    expect(await screen.findByRole('button', { name: /raw/i })).toBeVisible()
    expect(screen.queryByText(/replacement json is invalid/i)).toBeNull()
  })

  it('does not derive source rows again when selecting an item', async () => {
    const user = userEvent.setup()
    const largeJson = JSON.stringify({
      items: Array.from({ length: 5000 }, (_, index) => ({
        id: index,
        name: `row-${index}`,
      })),
    })

    await createPasteProjectFromText(user, largeJson)
    await user.click(await screen.findByRole('radio', { name: /^source$/i }))
    const sourceItem = await screen.findByRole('button', { name: '"id": 0,' })
    const deriveCountBeforeSelection =
      deriveViewerRowsFromJsonCalls.mock.calls.length + deriveViewerRowsForModeCalls.mock.calls.length

    expect(deriveCountBeforeSelection).toBeGreaterThan(0)
    await user.click(sourceItem)
    await screen.findByText('root.items[0].id')

    expect(
      deriveViewerRowsFromJsonCalls.mock.calls.length + deriveViewerRowsForModeCalls.mock.calls.length,
    ).toBe(deriveCountBeforeSelection)
  })

  it('shows source restoration without workbench regions', async () => {
    listProjects.mockImplementation(async () => [makeUrlProject()])

    renderWithProviders(<App />)

    expect(await screen.findByRole('heading', { name: /source data required/i })).toBeVisible()
    expect(screen.queryByRole('banner', { name: /pipeline/i })).toBeNull()
    expect(screen.queryByRole('region', { name: /json viewer/i })).toBeNull()
    expect(screen.queryByRole('complementary', { name: /details/i })).toBeNull()
  })

  it('shows a full-page hydration state without flashing the launcher', async () => {
    const deferred = createDeferred<WorkerResponse>()
    workerRequest.mockImplementationOnce(() => deferred.promise)
    listProjects.mockImplementation(async () => [makePasteProject()])

    renderWithProviders(<App />)

    expect(await screen.findByText(/restoring project/i)).toBeVisible()
    expect(screen.queryByRole('heading', { name: /make complex data feel navigable/i })).toBeNull()
    expect(screen.queryByRole('banner', { name: /pipeline/i })).toBeNull()
  })

  it('does not expose an editor save path for raw', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)

    await user.click(screen.getByRole('button', { name: /raw/i }))

    expect(screen.queryByTestId('monaco-editor')).toBeNull()
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
  })

  it('lets a loaded project return to the launcher and create a different JSON project', async () => {
    const user = userEvent.setup()
    workerRequest.mockImplementation(async (request: any) => {
      if (request.type === 'parseRaw') {
        return {
          type: 'parseRawResult',
          jobId: request.jobId,
          summary: { type: 'object', label: 'Object(1)', childCount: 1, preview: '{items}' },
          value: JSON.parse(request.rawJsonText),
        }
      }
      if (request.type === 'getDetails') {
        return {
          type: 'detailsResult',
          jobId: request.jobId,
          path: request.path,
          value: request.path.length === 0 ? { items: [{ id: 2, name: 'Lin' }] } : 'Lin',
          summary: {
            type: request.path.length === 0 ? 'object' : 'string',
            label: 'value',
            childCount: 0,
            preview: request.path.length === 0 ? '{items}' : '"Lin"',
          },
        }
      }
      return { type: 'viewWindowResult', jobId: request.jobId, rows: [], total: 0 }
    })
    await createPasteProject(user)
    await user.click(screen.getByRole('radio', { name: /^table$/i }))
    await navigateTableToItems(user)
    expect(await screen.findByRole('cell', { name: 'Ada' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: /import data/i }))
    fireEvent.change(screen.getByLabelText(/paste json/i), {
      target: { value: '{"items":[{"id":2,"name":"Lin"}]}' },
    })
    await user.click(screen.getByRole('button', { name: /create project/i }))

    await waitFor(() => {
      expect(workerRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'parseRaw',
          rawJsonText: '{"items":[{"id":2,"name":"Lin"}]}',
        }),
      )
    })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /create project/i })).toBeNull()
    })
    await user.click(screen.getByRole('radio', { name: /^table$/i }))
    await navigateTableToItems(user)

    expect(await screen.findByRole('cell', { name: 'Lin' })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'Ada' })).toBeNull()
    expect(screen.queryByRole('button', { name: /create project/i })).toBeNull()
  })

  it('reruns downstream nodes after saving a middle node', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)

    await addStep(user, 'js')
    await user.click(screen.getByRole('button', { name: /^run$/i }))
    await screen.findByText('{items}')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
    })

    await addStep(user, 'duckdb')
    await user.click(screen.getByRole('button', { name: /^run$/i }))
    await screen.findByText('{items}')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
    })

    await editStep(user, 'JS 1')

    const editor = await screen.findByTestId('monaco-editor')
    await user.clear(editor)
    await user.type(editor, 'export default input => input + 1')
    const executionCountBeforeSave = workerRequest.mock.calls.filter(
      ([request]) => request.type === 'executePipeline',
    ).length
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
    })
    const executionRequestsAfterSave = workerRequest.mock.calls
      .map(([request]) => request)
      .filter((request) => request.type === 'executePipeline')
    expect(executionRequestsAfterSave).toHaveLength(executionCountBeforeSave + 1)
    expect(executionRequestsAfterSave.at(-1)).toEqual(
      expect.objectContaining({
        type: 'executePipeline',
        nodes: [
          expect.objectContaining({ id: 'raw' }),
          expect.objectContaining({ id: 'js-1' }),
          expect.objectContaining({ id: 'duckdb-1' }),
        ],
      }),
    )
    expect(screen.getByRole('button', { name: /duckdb 1.*active/i })).toBeVisible()
  })

  it('keeps an edited node and exposes the last successful output when downstream rerun fails', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)

    for (const type of ['js', 'duckdb', 'js'] as const) {
      await addStep(user, type)
      await user.click(screen.getByRole('button', { name: /^save$/i }))
      await waitFor(() => expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull())
    }

    await editStep(user, 'JS 1')
    fireEvent.change(await screen.findByTestId('monaco-editor'), {
      target: { value: 'export default input => ({ ...input, edited: true })' },
    })

    const defaultWorkerImplementation = workerRequest.getMockImplementation()
    workerRequest.mockImplementation(async (request: any) => {
      if (
        request.type === 'executePipeline' &&
        request.nodes.some(
          (node: { type: string; code?: string }) =>
            node.type === 'js' && node.code?.includes('edited: true'),
        )
      ) {
        return {
          type: 'workerError',
          jobId: request.jobId,
          message: 'DuckDB downstream failed',
          failedNodeId: 'duckdb-1',
          lastSuccessfulNodeId: 'js-1',
          lastSuccessfulOutput: { items: [{ id: 1, name: 'Recovered' }] },
          lastSuccessfulSummary: {
            type: 'object',
            label: 'Object(1)',
            childCount: 1,
            preview: '{items}',
          },
        }
      }
      if (!defaultWorkerImplementation) throw new Error('Expected default worker implementation')
      return defaultWorkerImplementation(request)
    })

    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText(/duckdb downstream failed/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
    expect(screen.getByRole('button', { name: /js 1.*active/i })).toBeVisible()
    expect(
      within(screen.getByRole('button', { name: /duckdb 1.*error/i })).getByText('DuckDB', {
        exact: true,
      }),
    ).toBeVisible()
    expect(
      within(screen.getByRole('button', { name: /js 2.*blocked/i })).getByText('JS', {
        exact: true,
      }),
    ).toBeVisible()
    await user.click(screen.getByRole('radio', { name: /^table$/i }))
    await navigateTableToItems(user)
    expect(await screen.findByRole('cell', { name: 'Recovered' })).toBeVisible()
  })

  it('runs processing nodes through the worker and keeps the last successful preview visible', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)

    await addStep(user, 'js')
    await user.click(screen.getByRole('button', { name: /^run$/i }))

    await user.click(screen.getByRole('radio', { name: /^table$/i }))
    await navigateTableToItems(user)
    expect(await screen.findByRole('cell', { name: 'Grace' })).toBeVisible()

    workerRequest.mockImplementationOnce(async (request: any) => ({
      type: 'workerError',
      jobId: request.jobId,
      message: 'Transform failed',
    }))
    await user.click(screen.getByRole('button', { name: /^run$/i }))

    expect(await screen.findByText('Transform failed')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Grace' })).toBeVisible()
  })

  it('constructs a worker client for app parse and execution requests', async () => {
    const user = userEvent.setup()

    await createPasteProject(user)

    expect(createWorkerClient).toHaveBeenCalledTimes(1)
    expect(workerRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'parseRaw',
        rawJsonText: '{"items":[{"id":1,"name":"Ada"}]}',
      }),
    )
  })

  it('does not treat execute results as stale when a details request starts later', async () => {
    const executeDeferred = createDeferred<WorkerResponse>()
    const workerClient = {
      request: vi.fn((request: any) => {
        if (request.type === 'executePipeline') return executeDeferred.promise
        return Promise.resolve({
          type: 'detailsResult' as const,
          jobId: request.jobId,
          path: request.path,
          value: [{ id: 1, name: 'Ada' }],
          summary: {
            type: 'array' as const,
            label: 'Array(1)',
            childCount: 1,
            preview: '[1]',
          },
        })
      }),
      terminate: vi.fn(),
    }
    const { startJob, finishJob } = useWorkbenchStore.getState()

    const executePromise = requestWorker(workerClient, startJob, finishJob, {
      type: 'executePipeline',
      jobId: 'job-execute',
      nodes: [{ id: 'raw', type: 'raw', label: 'Raw' }],
    })
    const detailsPromise = requestWorker(workerClient, startJob, finishJob, {
      type: 'getDetails',
      jobId: 'job-details',
      path: ['items'],
    })

    await expect(detailsPromise).resolves.toMatchObject({
      type: 'detailsResult',
      jobId: 'job-details',
    })

    executeDeferred.resolve({
      type: 'executePipelineResult',
      jobId: 'job-execute',
      activeNodeId: 'raw',
      summary: { type: 'object', label: 'Object(1)', childCount: 1, preview: '{items}' },
      output: { items: [{ id: 1, name: 'Grace' }] },
    })

    await expect(executePromise).resolves.toMatchObject({
      type: 'executePipelineResult',
      jobId: 'job-execute',
    })
  })

  it('keeps added processing nodes as drafts until save', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)

    await addStep(user, 'js')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /js 1/i })).toBeVisible()
    })
    expect(
      saveProject.mock.calls.every(([savedProject]) =>
        (savedProject as ProjectRecord).pipeline.every((node) => node.type === 'raw'),
      ),
    ).toBe(true)
  })

  it('keeps the current viewer mounted while a new step is being edited', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)
    await user.click(screen.getByRole('radio', { name: /^table$/i }))
    await navigateTableToItems(user)
    expect(await screen.findByRole('cell', { name: 'Ada' })).toBeVisible()

    await addStep(user, 'js')

    expect(await screen.findByTestId('monaco-editor')).toBeVisible()
    expect(screen.getByRole('radio', { name: /^table$/i })).toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Table navigation path' })).toHaveValue('items')
    expect(screen.getByRole('cell', { name: 'Ada' })).toBeVisible()
  })

  it('appends new steps at the pipeline end even when an earlier node is selected', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)
    await addStep(user, 'js')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
    })

    await user.click(screen.getByRole('button', { name: /raw.*active|raw.*ready/i }))
    await addStep(user, 'js')
    await user.click(screen.getByRole('button', { name: /^run$/i }))

    const executionRequests = workerRequest.mock.calls
      .map(([request]) => request)
      .filter((request) => request.type === 'executePipeline')
    expect(executionRequests.at(-1)?.nodes.map((node: { id: string }) => node.id)).toEqual([
      'raw',
      'js-1',
      'js-2',
    ])
  })

  it('confirms and lists every downstream node before a cascading delete', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)
    await addStep(user, 'js')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull())
    await addStep(user, 'duckdb')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull())

    await user.click(screen.getByRole('button', { name: /more actions for js 1/i }))
    await user.click(screen.getByRole('menuitem', { name: /delete step/i }))

    expect(await screen.findByRole('heading', { name: /delete js 1 and downstream steps/i })).toBeVisible()
    expect(screen.getByText(/js 1, duckdb 1/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: /delete 2 steps/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /js 1/i })).toBeNull()
      expect(screen.queryByRole('button', { name: /duckdb 1/i })).toBeNull()
    })
    expect(screen.getByRole('button', { name: /raw.*active/i })).toBeVisible()
  })

  it('deletes the final processing node without opening a confirmation dialog', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)
    await addStep(user, 'js')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull())

    await user.click(screen.getByRole('button', { name: /more actions for js 1/i }))
    await user.click(screen.getByRole('menuitem', { name: /delete step/i }))

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(screen.queryByRole('button', { name: /js 1/i })).toBeNull())
    expect(screen.getByRole('button', { name: /raw.*active/i })).toBeVisible()
  })

  it('cancels an unsaved draft processing node without persisting it', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)

    await addStep(user, 'js')
    expect(await screen.findByRole('button', { name: /js 1/i })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(screen.queryByRole('button', { name: /js 1/i })).toBeNull()
    expect(
      saveProject.mock.calls.every(([savedProject]) =>
        (savedProject as ProjectRecord).pipeline.every((node) => node.type === 'raw'),
      ),
    ).toBe(true)
  })

  it('runs a draft node as a temporary preview without saving its config', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)

    await addStep(user, 'js')
    await user.click(screen.getByRole('button', { name: /^run$/i }))

    await user.click(screen.getByRole('radio', { name: /^table$/i }))
    await navigateTableToItems(user)
    expect(await screen.findByRole('cell', { name: 'Grace' })).toBeVisible()
    expect(screen.getByText('{items}')).toBeInTheDocument()
    expect(
      saveProject.mock.calls.every(([savedProject]) =>
        (savedProject as ProjectRecord).pipeline.every((node) => node.type === 'raw'),
      ),
    ).toBe(true)
  })

  it('rolls back add and edit draft previews to the last saved endpoint on cancel', async () => {
    const user = userEvent.setup()
    workerRequest.mockImplementation(async (request: any) => {
      if (request.type === 'parseRaw') {
        return {
          type: 'parseRawResult',
          jobId: request.jobId,
          summary: { type: 'object', label: 'Object(1)', childCount: 1, preview: '{items}' },
          value: JSON.parse(request.rawJsonText),
        }
      }
      if (request.type === 'executePipeline') {
        const activeNode = request.nodes.at(-1)
        const activeName =
          activeNode?.type === 'js' && activeNode.code.includes('Hopper')
            ? 'Hopper'
            : 'Grace'
        return {
          type: 'executePipelineResult',
          jobId: request.jobId,
          activeNodeId: activeNode?.id ?? 'raw',
          summary: { type: 'object', label: 'Object(1)', childCount: 1, preview: '{items}' },
          output: { items: [{ id: 1, name: activeName }] },
        }
      }
      if (request.type === 'getDetails') {
        return {
          type: 'detailsResult',
          jobId: request.jobId,
          path: request.path,
          value: request.path.length === 0 ? { items: [{ id: 1, name: 'Grace' }] } : 'Grace',
          summary: {
            type: request.path.length === 0 ? 'object' : 'string',
            label: 'value',
            childCount: 0,
            preview: request.path.length === 0 ? '{items}' : '"Grace"',
          },
        }
      }
      return { type: 'viewWindowResult', jobId: request.jobId, rows: [], total: 0 }
    })

    await createPasteProject(user)

    await user.click(screen.getByRole('radio', { name: /^table$/i }))
    await navigateTableToItems(user)
    expect(await screen.findByRole('cell', { name: 'Ada' })).toBeVisible()

    await addStep(user, 'js')
    await user.click(screen.getByRole('button', { name: /^run$/i }))
    await navigateTableToItems(user)
    expect(await screen.findByRole('cell', { name: 'Grace' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    await navigateTableToItems(user)
    expect(await screen.findByRole('cell', { name: 'Ada' })).toBeVisible()
    expect(screen.queryByRole('button', { name: /js 1/i })).toBeNull()
    expect(
      saveProject.mock.calls.every(([savedProject]) =>
        (savedProject as ProjectRecord).pipeline.every((node) => node.type === 'raw'),
      ),
    ).toBe(true)

    await addStep(user, 'js')
    await user.click(screen.getByRole('button', { name: /^run$/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await screen.findByRole('button', { name: /^js 1, js,/i })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
    })
    await navigateTableToItems(user)
    expect(await screen.findByRole('cell', { name: 'Grace' })).toBeVisible()

    await editStep(user, 'JS 1')
    const editor = await screen.findByTestId('monaco-editor')
    fireEvent.change(editor, {
      target: { value: 'export default input => ({ items: [{ id: 1, name: "Hopper" }] })' },
    })
    await user.click(screen.getByRole('button', { name: /^run$/i }))
    await navigateTableToItems(user)
    expect(await screen.findByRole('cell', { name: 'Hopper' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    await navigateTableToItems(user)
    expect(await screen.findByRole('cell', { name: 'Grace' })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'Hopper' })).toBeNull()
    expect(
      saveProject.mock.calls
        .map(([savedProject]) => savedProject as ProjectRecord)
        .every((savedProject) =>
          savedProject.pipeline
            .filter((node) => node.type === 'js')
            .every((node) => !node.code.includes('Hopper')),
        ),
    ).toBe(true)
  })

  it('saves a successful draft node and persists only pipeline metadata', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)

    await addStep(user, 'js')
    await user.click(screen.getByRole('button', { name: /^run$/i }))
    await user.click(screen.getByRole('radio', { name: /^table$/i }))
    await navigateTableToItems(user)
    await screen.findByRole('cell', { name: 'Grace' })
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(saveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          pipeline: expect.arrayContaining([
            expect.objectContaining({ id: 'js-1', type: 'js' }),
          ]),
          activeNodeId: 'js-1',
        }),
      )
    })
    const savedProcessingProject = saveProject.mock.calls
      .map(([savedProject]) => savedProject as ProjectRecord & { nodeOutputs?: unknown })
      .find((savedProject) => savedProject.activeNodeId === 'js-1')
    expect(savedProcessingProject?.nodeOutputs).toBeUndefined()
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
  })

  it('keeps pasted JSON available when a memory-risk import is canceled', async () => {
    const user = userEvent.setup()
    rawSizeBytesOverride.value = 100 * 1024 * 1024 + 1

    await createPasteProjectFromText(user, '{"items":[]}')

    expect(
      await screen.findByRole('heading', { name: /large json may use significant memory/i }),
    ).toBeVisible()
    expect(workerRequest).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'parseRaw' }))
    await user.click(screen.getByRole('button', { name: /cancel import/i }))

    expect(await screen.findByLabelText(/paste json/i)).toHaveValue('{"items":[]}')
    expect(screen.queryByRole('button', { name: /raw/i })).toBeNull()
  })

  it('parses memory-risk JSON only after explicit confirmation', async () => {
    const user = userEvent.setup()
    rawSizeBytesOverride.value = 100 * 1024 * 1024 + 1

    await createPasteProjectFromText(user, '{"items":[]}')

    expect(
      await screen.findByRole('heading', { name: /large json may use significant memory/i }),
    ).toBeVisible()
    expect(workerRequest).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'parseRaw' }))
    await user.click(screen.getByRole('button', { name: /continue loading/i }))

    expect(await screen.findByRole('button', { name: /raw/i })).toBeVisible()
    expect(workerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'parseRaw', rawJsonText: '{"items":[]}' }),
    )
  })

  it('does not mirror oversized raw text into refresh storage', async () => {
    const user = userEvent.setup()
    const oversizedRawJson = JSON.stringify({
      payload: 'x'.repeat(10 * 1024 * 1024 + 32),
    })

    await createPasteProjectFromText(user, oversizedRawJson)

    await waitFor(() => {
      expect(saveProject).toHaveBeenCalled()
      const savedProject = (saveProject as any).mock.calls[0]?.[0] as { rawJsonText?: string } | undefined
      expect(savedProject?.rawJsonText).toBeUndefined()
    })
  })

  it('shows a reload prompt for a restored URL project without raw text', async () => {
    listProjects.mockImplementation(async () => [makeUrlProject()])

    renderWithProviders(<App />)

    expect(await screen.findByRole('heading', { name: /source data required/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload from url/i })).toBeInTheDocument()
  })

  it('reloads a restored URL project through the worker client', async () => {
    listProjects.mockImplementation(async () => [makeUrlProject()])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    renderWithProviders(<App />)

    await userEvent.setup().click(await screen.findByRole('button', { name: /reload from url/i }))

    await waitFor(() => {
      expect(workerRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'parseRaw',
          rawJsonText: '{"ok":true}',
        }),
      )
    })
    expect(await screen.findByRole('button', { name: /raw/i })).toBeVisible()
  })

  it('does not show the restore prompt while a persisted raw project is hydrating', async () => {
    let resolveWorkerRequest: ((value: { type: 'parseRawResult'; jobId: string; summary: any; value: any }) => void) | undefined
    workerRequest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveWorkerRequest = resolve
        }),
    )
    listProjects.mockImplementation(async () => [makePasteProject()])

    renderWithProviders(<App />)

    await waitFor(() => {
      expect(workerRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'parseRaw',
          rawJsonText: '{"ok":true}',
        }),
      )
    })
    expect(screen.queryByRole('heading', { name: /source data required/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /paste again/i })).toBeNull()

    await act(async () => {
      resolveWorkerRequest?.({
        type: 'parseRawResult',
        jobId: 'job',
        summary: { type: 'object', label: 'Object(1)', childCount: 1, preview: '{ok}' },
        value: { ok: true },
      })
    })

    expect(await screen.findByRole('button', { name: /raw/i })).toBeVisible()
  })
})

function makeUrlProject(): ProjectRecord {
  return {
    id: 'project-url',
    name: 'Remote JSON',
    createdAt: 1,
    updatedAt: 2,
    rawSource: { type: 'url', url: 'https://example.com/data.json' },
    pipeline: [{ id: 'raw', type: 'raw', label: 'Raw' }],
    activeNodeId: 'raw',
    viewerMode: 'columns',
    selectedPath: [],
  }
}

function makePasteProject(): ProjectRecord {
  return {
    id: 'project-paste',
    name: 'Pasted JSON',
    createdAt: 1,
    updatedAt: 2,
    rawSource: { type: 'paste', label: 'Pasted JSON', sizeBytes: 11 },
    rawJsonText: '{"ok":true}',
    pipeline: [{ id: 'raw', type: 'raw', label: 'Raw' }],
    activeNodeId: 'raw',
    viewerMode: 'columns',
    selectedPath: [],
  }
}
