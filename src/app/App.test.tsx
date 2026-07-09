import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen, within } from '@testing-library/react'
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
  it('renders details preview for the selected path', () => {
    renderWithProviders(<App />)
    const detailsPreview = screen.getByRole('region', { name: 'Details preview' })

    expect(screen.getByRole('heading', { level: 2, name: 'Details' })).toBeInTheDocument()
    expect(within(detailsPreview).getByText('root.data[0].id')).toBeInTheDocument()
    expect(within(detailsPreview).getByText('number')).toBeInTheDocument()
    expect(within(detailsPreview).getByText('42')).toBeInTheDocument()
    expect(within(detailsPreview).getByText('Normalize')).toBeInTheDocument()
  })

  it('updates details when a different viewer row is selected', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />)

    await user.click(screen.getByRole('button', { name: /name/i }))
    const detailsPreview = screen.getByRole('region', { name: 'Details preview' })

    expect(within(detailsPreview).getByText('root.data[0].name')).toBeInTheDocument()
    expect(within(detailsPreview).getByText('"Ada"')).toBeInTheDocument()
  })
})
