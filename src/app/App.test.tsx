import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectRecord } from '../domain/projectTypes'
import { resetWorkbenchStore, useWorkbenchStore } from '../state/useWorkbenchStore'
import type { WorkerResponse } from '../workers/workerProtocol'
import { renderWithProviders } from '../test/render'
import { App, requestWorker } from './App'

const { listProjects, saveProject, workerRequest, createWorkerClient, rawSizeBytesOverride } = vi.hoisted(() => ({
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

  it('shows the full landing page without empty workbench regions', async () => {
    renderWithProviders(<App />)

    expect(await screen.findByRole('heading', { name: /make complex json feel navigable/i })).toBeVisible()
    expect(screen.queryByRole('banner', { name: /pipeline/i })).toBeNull()
    expect(screen.queryByRole('region', { name: /json viewer/i })).toBeNull()
    expect(screen.queryByRole('complementary', { name: /details/i })).toBeNull()
  })

  it('returns from the new-project landing page to the unchanged workbench', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)

    await user.click(screen.getByRole('button', { name: /open another json/i }))
    expect(await screen.findByRole('heading', { name: /make complex json feel navigable/i })).toBeVisible()
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

    await user.click(screen.getByRole('button', { name: /open another json/i }))
    fireEvent.change(screen.getByLabelText(/paste json/i), {
      target: { value: '{broken' },
    })
    await user.click(screen.getByRole('button', { name: /create (?:from paste|project)/i }))
    expect(await screen.findByText(/replacement json is invalid/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: /back to current project/i }))

    expect(await screen.findByRole('button', { name: /raw/i })).toBeVisible()
    expect(screen.queryByText(/replacement json is invalid/i)).toBeNull()
  })

  it('shows source restoration without workbench regions', async () => {
    listProjects.mockImplementation(async () => [makeUrlProject()])

    renderWithProviders(<App />)

    expect(await screen.findByRole('heading', { name: /raw json required/i })).toBeVisible()
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
    expect(screen.queryByRole('heading', { name: /make complex json feel navigable/i })).toBeNull()
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
    expect(await screen.findByRole('button', { name: /Ada/ })).toBeVisible()

    await user.click(screen.getByRole('button', { name: /open another json/i }))
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

    expect(await screen.findByRole('button', { name: /Lin/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Ada/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /create project/i })).toBeNull()
  })

  it('marks downstream nodes stale after saving a middle node', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)

    await user.click(screen.getByRole('button', { name: /add js/i }))
    await user.click(screen.getByRole('button', { name: /^run$/i }))
    await screen.findByText('{items}')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
    })

    await user.click(screen.getByRole('button', { name: /add duckdb/i }))
    await user.click(screen.getByRole('button', { name: /^run$/i }))
    await screen.findByText('{items}')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
    })

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0])

    const editor = await screen.findByTestId('monaco-editor')
    await user.clear(editor)
    await user.type(editor, 'export default input => input + 1')
    await user.click(screen.getByRole('button', { name: /^run$/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByRole('button', { name: /duckdb 1/i })).toHaveTextContent(/stale/i)
  })

  it('runs processing nodes through the worker and keeps the last successful preview visible', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)

    await user.click(screen.getByRole('button', { name: /add js/i }))
    await user.click(screen.getByRole('button', { name: /^run$/i }))

    await user.click(screen.getByRole('radio', { name: /^table$/i }))
    expect(await screen.findByRole('button', { name: /Grace/ })).toBeVisible()

    workerRequest.mockImplementationOnce(async (request: any) => ({
      type: 'workerError',
      jobId: request.jobId,
      message: 'Transform failed',
    }))
    await user.click(screen.getByRole('button', { name: /^run$/i }))

    expect(await screen.findByText('Transform failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Grace/ })).toBeVisible()
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

    await user.click(screen.getByRole('button', { name: /add js/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /js 1/i })).toBeVisible()
    })
    expect(
      saveProject.mock.calls.every(([savedProject]) =>
        (savedProject as ProjectRecord).pipeline.every((node) => node.type === 'raw'),
      ),
    ).toBe(true)
  })

  it('cancels an unsaved draft processing node without persisting it', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)

    await user.click(screen.getByRole('button', { name: /add js/i }))
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

    await user.click(screen.getByRole('button', { name: /add js/i }))
    await user.click(screen.getByRole('button', { name: /^run$/i }))

    await user.click(screen.getByRole('radio', { name: /^table$/i }))
    expect(await screen.findByRole('button', { name: /Grace/ })).toBeVisible()
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
    expect(await screen.findByRole('button', { name: /Ada/ })).toBeVisible()

    await user.click(screen.getByRole('button', { name: /add js/i }))
    await user.click(screen.getByRole('button', { name: /^run$/i }))
    expect(await screen.findByRole('button', { name: /Grace/ })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(await screen.findByRole('button', { name: /Ada/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: /js 1/i })).toBeNull()
    expect(
      saveProject.mock.calls.every(([savedProject]) =>
        (savedProject as ProjectRecord).pipeline.every((node) => node.type === 'raw'),
      ),
    ).toBe(true)

    await user.click(screen.getByRole('button', { name: /add js/i }))
    await user.click(screen.getByRole('button', { name: /^run$/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await screen.findByRole('button', { name: /js 1/i })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
    })
    expect(await screen.findByRole('button', { name: /Grace/ })).toBeVisible()

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
    const editor = await screen.findByTestId('monaco-editor')
    fireEvent.change(editor, {
      target: { value: 'export default input => ({ items: [{ id: 1, name: "Hopper" }] })' },
    })
    await user.click(screen.getByRole('button', { name: /^run$/i }))
    expect(await screen.findByRole('button', { name: /Hopper/ })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(await screen.findByRole('button', { name: /Grace/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Hopper/ })).toBeNull()
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

    await user.click(screen.getByRole('button', { name: /add js/i }))
    await user.click(screen.getByRole('button', { name: /^run$/i }))
    await user.click(screen.getByRole('radio', { name: /^table$/i }))
    await screen.findByRole('button', { name: /Grace/ })
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

  it('asks for confirmation before parsing memory-risk pasted JSON', async () => {
    const user = userEvent.setup()
    rawSizeBytesOverride.value = 100 * 1024 * 1024 + 1
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    await createPasteProjectFromText(user, '{"items":[]}')

    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/100 MiB/i))
    expect(workerRequest).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'parseRaw' }))
    expect(screen.queryByRole('button', { name: /raw/i })).toBeNull()
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

    expect(await screen.findByRole('heading', { name: /raw json required/i })).toBeInTheDocument()
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
    expect(screen.queryByRole('heading', { name: /raw json required/i })).toBeNull()
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
