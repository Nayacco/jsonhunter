import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { ViewSwitcher } from './ViewSwitcher'

describe('ViewSwitcher', () => {
  it('uses a segmented single-select control for view mode switching', async () => {
    const user = userEvent.setup()
    const changes: string[] = []

    renderWithProviders(<ViewSwitcher mode="columns" onModeChange={(mode) => changes.push(mode)} />)

    expect(screen.getByRole('radiogroup', { name: 'View mode' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Columns' })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: 'Table' }))

    expect(changes).toContain('table')
  })
})
