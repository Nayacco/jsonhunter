import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../app/providers'
import { renderWithProviders } from '../../test/render'
import { ProjectLoadingPage } from './ProjectLoadingPage'
import { ProjectRestorePage } from './ProjectRestorePage'

describe('ProjectRestorePage', () => {
  it('reloads a stored URL', async () => {
    const onReloadUrl = vi.fn(async () => {})
    renderWithProviders(
      <ProjectRestorePage sourceLabel="https://example.com/data.json" onReloadUrl={onReloadUrl} />,
    )

    await userEvent.setup().click(screen.getByRole('button', { name: /reload from url/i }))

    expect(onReloadUrl).toHaveBeenCalledOnce()
  })

  it('reselects a stored file', async () => {
    const onReselectFile = vi.fn(async () => {})
    renderWithProviders(<ProjectRestorePage sourceLabel="data.json" onReselectFile={onReselectFile} />)
    const file = new File(['{"ok":true}'], 'data.json', { type: 'application/json' })
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInstanceOf(HTMLInputElement)

    await userEvent.setup().upload(fileInput as HTMLInputElement, file)

    expect(onReselectFile).toHaveBeenCalledWith(file)
  })

  it('preserves pasted replacement JSON while reporting an error', async () => {
    const onPasteAgain = vi.fn(async () => {})
    const view = renderWithProviders(
      <ProjectRestorePage sourceLabel="Pasted JSON" onPasteAgain={onPasteAgain} />,
    )

    fireEvent.change(screen.getByLabelText(/paste json again/i), {
      target: { value: '{broken}' },
    })
    await userEvent.setup().click(screen.getByRole('button', { name: /paste again/i }))
    view.rerender(
      <AppProviders>
        <ProjectRestorePage
          sourceLabel="Pasted JSON"
          error="Unexpected token"
          onPasteAgain={onPasteAgain}
        />
      </AppProviders>,
    )

    expect(screen.getByLabelText(/paste json again/i)).toHaveValue('{broken}')
    expect(screen.getByText(/unexpected token/i)).toBeVisible()
  })
})

describe('ProjectLoadingPage', () => {
  it('announces persisted project hydration', () => {
    renderWithProviders(<ProjectLoadingPage />)

    expect(screen.getByText(/restoring project/i)).toBeVisible()
  })
})
