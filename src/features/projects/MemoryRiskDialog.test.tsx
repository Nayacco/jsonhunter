import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { MemoryRiskDialog } from './MemoryRiskDialog'

describe('MemoryRiskDialog', () => {
  it('continues loading after explicit confirmation', async () => {
    const onConfirm = vi.fn()
    renderWithProviders(
      <MemoryRiskDialog
        isOpen
        warningLimitMiB={100}
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByRole('heading', { name: /large json may use significant memory/i })).toBeVisible()
    expect(screen.getByText(/100 mib/i)).toBeVisible()
    await userEvent.setup().click(screen.getByRole('button', { name: /continue loading/i }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('cancels the import through an explicit action', async () => {
    const onCancel = vi.fn()
    renderWithProviders(
      <MemoryRiskDialog
        isOpen
        warningLimitMiB={100}
        onCancel={onCancel}
        onConfirm={() => {}}
      />,
    )

    await userEvent.setup().click(screen.getByRole('button', { name: /cancel import/i }))

    expect(onCancel).toHaveBeenCalledOnce()
  })
})
