import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/render'
import { App } from './App'

const listProjects = vi.fn(async () => [])
const saveProject = vi.fn(async () => {})

vi.mock('../persistence/projectRepository', () => ({
  ProjectRepository: class {
    listProjects = listProjects
    saveProject = saveProject
  },
  getRawSizeBytes: (rawJsonText: string) => new TextEncoder().encode(rawJsonText).byteLength,
  sanitizeProjectForPersistence: (project: any) => {
    const rawJsonText = project.rawJsonText as string | undefined
    const size = new TextEncoder().encode(rawJsonText ?? '').byteLength
    return size <= 10 * 1024 * 1024 ? project : { ...project, rawJsonText: undefined }
  },
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
  async function createPasteProject(user: ReturnType<typeof userEvent.setup>) {
    window.localStorage.clear()
    renderWithProviders(<App />)

    fireEvent.change(screen.getByLabelText(/paste json/i), {
      target: { value: '{"items":[{"id":1,"name":"Ada"}]}' },
    })
    await user.click(screen.getByRole('button', { name: /create from paste/i }))
  }

  async function createPasteProjectFromText(user: ReturnType<typeof userEvent.setup>, text: string) {
    window.localStorage.clear()
    renderWithProviders(<App />)

    fireEvent.change(screen.getByLabelText(/paste json/i), {
      target: { value: text },
    })
    await user.click(screen.getByRole('button', { name: /create from paste/i }))
  }

  it('does not expose an editor save path for raw', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)

    await user.click(screen.getByRole('button', { name: /raw/i }))

    expect(screen.queryByTestId('monaco-editor')).toBeNull()
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
  })

  it('marks downstream nodes stale after saving a middle node', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)

    await user.click(screen.getByRole('button', { name: /add js/i }))
    await user.click(screen.getByRole('button', { name: /add duckdb/i }))
    await user.click(screen.getByRole('button', { name: /js 1/i }))

    const editor = await screen.findByTestId('monaco-editor')
    await user.clear(editor)
    await user.type(editor, 'export default input => input + 1')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByRole('button', { name: /duckdb 1/i })).toHaveClass('pipelineNode-stale')
  })

  it('shows a not-connected error when running a processing node', async () => {
    const user = userEvent.setup()
    await createPasteProject(user)

    await user.click(screen.getByRole('button', { name: /add js/i }))

    await user.click(screen.getByRole('button', { name: /^run$/i }))

    expect(screen.getByText('Execution is not connected yet.')).toBeInTheDocument()
  })

  it('does not mirror oversized raw text into refresh storage', async () => {
    const user = userEvent.setup()
    const oversizedRawJson = JSON.stringify({
      payload: 'x'.repeat(10 * 1024 * 1024 + 32),
    })

    await createPasteProjectFromText(user, oversizedRawJson)

    await waitFor(() => {
      const storedProject = window.localStorage.getItem('jsonhunter.active-project')
      expect(storedProject).not.toBeNull()
      expect(JSON.parse(storedProject ?? '{}').rawJsonText).toBeUndefined()
    })
  })
})
