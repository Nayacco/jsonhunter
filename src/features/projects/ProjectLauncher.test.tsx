import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { ProjectLauncher } from './ProjectLauncher'

describe('ProjectLauncher', () => {
  it('submits pasted JSON', async () => {
    const user = userEvent.setup()
    let submitted = ''
    renderWithProviders(
      <ProjectLauncher
        onPasteJson={(text) => {
          submitted = text
        }}
        onLoadUrl={() => {}}
        onOpenFile={() => {}}
      />,
    )

    fireEvent.change(screen.getByLabelText(/paste json/i), {
      target: { value: '{"ok":true}' },
    })
    await user.click(screen.getByRole('button', { name: /create from paste/i }))

    expect(submitted).toBe('{"ok":true}')
  })

  it('submits a JSON URL', async () => {
    const user = userEvent.setup()
    let submitted = ''
    renderWithProviders(
      <ProjectLauncher
        onPasteJson={() => {}}
        onLoadUrl={(url) => {
          submitted = url
        }}
        onOpenFile={() => {}}
      />,
    )

    await user.type(screen.getByLabelText(/json url/i), 'https://example.com/data.json')
    await user.click(screen.getByRole('button', { name: /load url/i }))

    expect(submitted).toBe('https://example.com/data.json')
  })

  it('submits a selected JSON file', async () => {
    const user = userEvent.setup()
    const file = new File(['{"ok":true}'], 'data.json', { type: 'application/json' })
    let submitted: File | undefined
    renderWithProviders(
      <ProjectLauncher
        onPasteJson={() => {}}
        onLoadUrl={() => {}}
        onOpenFile={(nextFile) => {
          submitted = nextFile
        }}
      />,
    )

    const input = document.querySelector('input[type="file"]')
    expect(input).toBeInstanceOf(HTMLInputElement)
    await user.upload(input as HTMLInputElement, file)

    expect(submitted).toBe(file)
  })
})
