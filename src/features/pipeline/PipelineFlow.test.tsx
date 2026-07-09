import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
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

  it('renders visible node status text', () => {
    renderWithProviders(
      <PipelineFlow
        nodes={[
          { id: 'raw', type: 'raw', label: 'Raw' },
          { id: 'js-1', type: 'js', label: 'Normalize', code: 'export default input => input' },
        ]}
        activeNodeId="raw"
        nodeStatuses={{ raw: 'active', 'js-1': 'stale' }}
        onSelectNode={() => {}}
        onAddNode={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: /raw/i })).toHaveTextContent(/active/i)
    expect(screen.getByRole('button', { name: /normalize/i })).toHaveTextContent(/stale/i)
  })
})
