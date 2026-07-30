import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { PipelineFlow } from './PipelineFlow'

describe('PipelineFlow', () => {
  it('selects a node', async () => {
    const user = userEvent.setup()
    let selected = ''
    renderWithProviders(
      <PipelineFlow
        nodes={[
          { id: 'raw', type: 'raw', label: 'Raw' },
          { id: 'js-1', type: 'js', label: 'Normalize', code: 'export default input => input' },
        ]}
        activeNodeId="raw"
        nodeStatuses={{ raw: 'active', 'js-1': 'inactive' }}
        onSelectNode={(id) => {
          selected = id
        }}
        onAddNode={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: /normalize/i }))
    expect(selected).toBe('js-1')
  })

  it('exposes one append action after the final node', async () => {
    const user = userEvent.setup()
    const onAddNode = vi.fn()

    renderWithProviders(
      <PipelineFlow
        nodes={[
          { id: 'raw', type: 'raw', label: 'Raw' },
          { id: 'js-1', type: 'js', label: 'Normalize', code: 'export default input => input' },
        ]}
        activeNodeId="js-1"
        nodeStatuses={{ raw: 'ready', 'js-1': 'active' }}
        onSelectNode={() => {}}
        onAddNode={onAddNode}
      />,
    )

    expect(screen.getAllByTestId('pipeline-connector')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: /add step/i }))
    await user.click(screen.getByRole('menuitem', { name: /add js/i }))

    expect(onAddNode).toHaveBeenCalledWith('js')
    expect(screen.getByRole('button', { name: /add step/i })).toBeInTheDocument()
  })

  it('keeps edit and delete inside the node control', async () => {
    const user = userEvent.setup()
    const onEditNode = vi.fn()
    const onDeleteNode = vi.fn()

    renderWithProviders(
      <PipelineFlow
        nodes={[
          { id: 'raw', type: 'raw', label: 'Raw' },
          { id: 'js-1', type: 'js', label: 'Normalize', code: 'export default input => input' },
        ]}
        activeNodeId="js-1"
        nodeStatuses={{ raw: 'ready', 'js-1': 'active' }}
        onSelectNode={() => {}}
        onEditNode={onEditNode}
        onDeleteNode={onDeleteNode}
        onAddNode={() => {}}
      />,
    )

    const nodeButton = screen.getByRole('button', { name: /normalize.*js.*active/i })
    const menuButton = screen.getByRole('button', { name: /more actions for normalize/i })

    expect(within(nodeButton).getByText('JS', { exact: true })).toBeVisible()
    expect(nodeButton.parentElement).toBe(menuButton.parentElement)

    await user.click(menuButton)
    await user.click(screen.getByRole('menuitem', { name: /edit step/i }))
    expect(onEditNode).toHaveBeenCalledWith('js-1')

    await new Promise((resolve) => window.setTimeout(resolve, 60))
    await user.click(screen.getByRole('button', { name: /more actions for normalize/i }))
    await user.click(screen.getByRole('menuitem', { name: /delete step/i }))
    expect(onDeleteNode).toHaveBeenCalledWith('js-1')
    expect(screen.queryByRole('button', { name: /more actions for raw/i })).toBeNull()
  })

  it('shows only the node type while status stays accessible', () => {
    renderWithProviders(
      <PipelineFlow
        nodes={[
          { id: 'raw', type: 'raw', label: 'Raw' },
          { id: 'js-1', type: 'js', label: 'Normalize', code: 'export default input => input' },
          { id: 'js-2', type: 'js', label: 'Project', code: 'export default input => input' },
        ]}
        activeNodeId="raw"
        nodeStatuses={{ raw: 'active', 'js-1': 'error', 'js-2': 'blocked' }}
        onSelectNode={() => {}}
        onAddNode={() => {}}
      />,
    )

    expect(
      within(screen.getByRole('button', { name: /raw.*active/i })).getByText('JSON', {
        exact: true,
      }),
    ).toBeVisible()
    expect(
      within(screen.getByRole('button', { name: /normalize.*error/i })).getByText('JS', {
        exact: true,
      }),
    ).toBeVisible()
    expect(
      within(screen.getByRole('button', { name: /project.*blocked/i })).getByText('JS', {
        exact: true,
      }),
    ).toBeVisible()
    expect(screen.queryByText(/^(active|error|blocked)$/i)).toBeNull()
  })
})
