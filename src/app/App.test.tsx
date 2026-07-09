import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/render'
import { App } from './App'

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
  it('does not expose an editor save path for raw', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />)

    await user.click(screen.getByRole('button', { name: /raw/i }))

    expect(screen.queryByTestId('monaco-editor')).toBeNull()
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull()
  })

  it('marks downstream nodes stale after saving a middle node', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />)

    const editor = await screen.findByTestId('monaco-editor')
    await user.clear(editor)
    await user.type(editor, 'export default input => input + 1')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByRole('button', { name: /summarize/i })).toHaveClass('pipelineNode-stale')
  })

  it('shows a not-connected error when running a processing node', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />)

    await user.click(screen.getByRole('button', { name: /^run$/i }))

    expect(screen.getByText('Execution is not connected yet.')).toBeInTheDocument()
  })
})
