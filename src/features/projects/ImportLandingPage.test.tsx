import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { AppProviders } from '../../app/providers'
import { renderWithProviders } from '../../test/render'
import { ImportLandingPage } from './ImportLandingPage'

type LandingProps = ComponentProps<typeof ImportLandingPage>

function createProps(overrides: Partial<LandingProps> = {}): LandingProps {
  return {
    onClearError: vi.fn(),
    onPasteJson: vi.fn(async () => {}),
    onLoadUrl: vi.fn(async () => {}),
    onOpenFile: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('ImportLandingPage', () => {
  it('shows all three import methods at once', () => {
    renderWithProviders(<ImportLandingPage {...createProps()} />)

    expect(screen.getByRole('heading', { name: /open a file/i })).toBeVisible()
    expect(screen.getByRole('heading', { name: /load from url/i })).toBeVisible()
    expect(screen.getByRole('heading', { name: /paste json/i })).toBeVisible()
  })

  it('submits URL, paste, and file inputs unchanged', async () => {
    const user = userEvent.setup()
    const props = createProps()
    renderWithProviders(<ImportLandingPage {...props} />)

    await user.type(screen.getByLabelText(/json url/i), 'https://example.com/data.json')
    await user.click(screen.getByRole('button', { name: /load json/i }))

    fireEvent.change(screen.getByLabelText(/paste json/i), {
      target: { value: '{"ok":true}' },
    })
    await user.click(screen.getByRole('button', { name: /create project/i }))

    const file = new File(['{"file":true}'], 'data.json', { type: 'application/json' })
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInstanceOf(HTMLInputElement)
    await user.upload(fileInput as HTMLInputElement, file)

    expect(props.onLoadUrl).toHaveBeenCalledWith('https://example.com/data.json')
    expect(props.onPasteJson).toHaveBeenCalledWith('{"ok":true}')
    expect(props.onOpenFile).toHaveBeenCalledWith(file)
  })

  it('locks every entry point while one import is pending', async () => {
    let finish!: () => void
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    const user = userEvent.setup()
    renderWithProviders(<ImportLandingPage {...createProps({ onLoadUrl: vi.fn(() => pending) })} />)

    await user.type(screen.getByLabelText(/json url/i), 'https://example.com/data.json')
    await user.click(screen.getByRole('button', { name: /load json/i }))

    expect(screen.getByRole('button', { name: /load json/i })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByLabelText(/paste json/i)).toBeDisabled()
    expect(document.querySelector('input[type="file"]')).toBeDisabled()

    await act(async () => finish())
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /load json/i })).not.toHaveAttribute('aria-busy', 'true')
    })
  })

  it('keeps entered text and associates an import error with the attempted method', async () => {
    const user = userEvent.setup()
    const props = createProps()
    const view = renderWithProviders(<ImportLandingPage {...props} />)

    fireEvent.change(screen.getByLabelText(/paste json/i), {
      target: { value: '{broken}' },
    })
    expect(screen.getByLabelText(/paste json/i)).toHaveValue('{broken}')
    await user.click(screen.getByRole('button', { name: /create project/i }))
    expect(screen.getByLabelText(/paste json/i)).toHaveValue('{broken}')
    view.rerender(
      <AppProviders>
        <ImportLandingPage {...props} error="Unexpected token at position 1" />
      </AppProviders>,
    )

    expect(screen.getByLabelText(/paste json/i)).toHaveValue('{broken}')
    expect(screen.getByText(/unexpected token at position 1/i)).toBeVisible()
  })

  it('shows the return action only when a current project exists', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const view = renderWithProviders(<ImportLandingPage {...createProps({ onCancel })} />)

    await user.click(screen.getByRole('button', { name: /back to current project/i }))
    expect(onCancel).toHaveBeenCalledOnce()

    view.rerender(
      <AppProviders>
        <ImportLandingPage {...createProps()} />
      </AppProviders>,
    )
    expect(screen.queryByRole('button', { name: /back to current project/i })).toBeNull()
  })
})
