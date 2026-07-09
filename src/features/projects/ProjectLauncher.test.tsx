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
})
