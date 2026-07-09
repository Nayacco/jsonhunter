import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { JsonViewer } from './JsonViewer'

describe('JsonViewer', () => {
  it('switches view modes', async () => {
    const user = userEvent.setup()
    let mode = 'columns'
    renderWithProviders(
      <JsonViewer
        mode="columns"
        selectedPath={[]}
        breadcrumb="root"
        onModeChange={(next) => {
          mode = next
        }}
        onSelectPath={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: /table/i }))
    expect(mode).toBe('table')
  })
})
