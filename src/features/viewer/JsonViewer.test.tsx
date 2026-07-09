import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
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

  it('renders only the active pane and uses supplied placeholder rows', () => {
    renderWithProviders(
      <JsonViewer
        mode="tree"
        selectedPath={['items', 2]}
        breadcrumb="root.items[2]"
        rows={{
          columns: [{ label: 'Column placeholder', value: '1', path: ['columns', 0] }],
          tree: [{ label: 'Tree placeholder', value: 'depth 2', path: ['items', 2] }],
          table: [{ label: 'Table placeholder', value: 'value', path: ['table', 0] }],
          source: [{ label: '"source": true', path: ['source', 0] }],
        }}
        onModeChange={() => {}}
        onSelectPath={() => {}}
      />,
    )

    expect(screen.getByRole('region', { name: 'Tree view' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Columns view' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Table view' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Source view' })).not.toBeInTheDocument()
    expect(screen.getByText('Tree placeholder')).toBeInTheDocument()
    expect(screen.queryByText('Column placeholder')).not.toBeInTheDocument()
    expect(screen.getByText('root.items[2]')).toBeInTheDocument()
    expect(screen.getByText('Selected: items.2')).toBeInTheDocument()
  })

  it('preserves breadcrumb and selected path across mode switches', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [mode, setMode] = useState<'columns' | 'tree' | 'table' | 'source'>('columns')
      const [selectedPath, setSelectedPath] = useState<(string | number)[]>(['items', 2])
      const breadcrumb = `root.${selectedPath.join('.')}`

      return (
        <JsonViewer
          mode={mode}
          selectedPath={selectedPath}
          breadcrumb={breadcrumb}
          rows={{
            columns: [{ label: 'Column row', value: 'A', path: ['items', 2] }],
            tree: [{ label: 'Tree row', value: 'B', path: ['items', 2] }],
            table: [{ label: 'Table row', value: 'C', path: ['items', 2] }],
            source: [{ label: '"Table row"', path: ['items', 2] }],
          }}
          onModeChange={setMode}
          onSelectPath={setSelectedPath}
        />
      )
    }

    renderWithProviders(<Harness />)

    expect(screen.getByText('root.items.2')).toBeInTheDocument()
    expect(screen.getByText('Selected: items.2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /table/i }))
    expect(screen.getByRole('region', { name: 'Table view' })).toBeInTheDocument()
    expect(screen.getByText('root.items.2')).toBeInTheDocument()
    expect(screen.getByText('Selected: items.2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /source/i }))
    expect(screen.getByRole('region', { name: 'Source view' })).toBeInTheDocument()
    expect(screen.getByText('root.items.2')).toBeInTheDocument()
    expect(screen.getByText('Selected: items.2')).toBeInTheDocument()
  })
})
