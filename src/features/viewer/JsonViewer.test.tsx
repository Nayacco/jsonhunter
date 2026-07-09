import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { JsonViewer } from './JsonViewer'

type MockVirtualItem = {
  index: number
  key: number
  start: number
}

const mockVirtualizerState = vi.hoisted(() => ({
  totalSize: 0,
  virtualItems: [] as MockVirtualItem[],
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => ({
    getTotalSize: () => mockVirtualizerState.totalSize || count * estimateSize(),
    getVirtualItems: () => mockVirtualizerState.virtualItems,
  }),
}))

describe('JsonViewer', () => {
  beforeEach(() => {
    mockVirtualizerState.totalSize = 0
    mockVirtualizerState.virtualItems = []
  })

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

  it('renders only the active pane and maps worker window rows by total count', () => {
    mockVirtualizerState.virtualItems = [
      { index: 9, key: 9, start: 288 },
      { index: 10, key: 10, start: 320 },
      { index: 11, key: 11, start: 352 },
      { index: 12, key: 12, start: 384 },
    ]

    renderWithProviders(
      <JsonViewer
        mode="tree"
        selectedPath={['items', 10]}
        breadcrumb="root.items[10]"
        rows={{
          columns: { startIndex: 0, totalCount: 1, rows: [{ label: 'Column placeholder', value: '1', path: ['columns', 0] }] },
          tree: {
            startIndex: 10,
            totalCount: 1000,
            rows: [
              { label: 'Tree placeholder', value: 'depth 10', path: ['items', 10] },
              { label: 'Tree sibling', value: 'depth 11', path: ['items', 11] },
            ],
          },
          table: { startIndex: 0, totalCount: 1, rows: [{ label: 'Table placeholder', value: 'value', path: ['table', 0] }] },
          source: { startIndex: 0, totalCount: 1, rows: [{ label: '"source": true', path: ['source', 0] }] },
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
    expect(screen.getByText('Tree sibling')).toBeInTheDocument()
    expect(screen.getByText(/Loading row 10/)).toBeInTheDocument()
    expect(screen.getByText('root.items[10]')).toBeInTheDocument()
    expect(screen.getByText('Selected: items.10')).toBeInTheDocument()
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
            columns: { startIndex: 2, totalCount: 10, rows: [{ label: 'Column row', value: 'A', path: ['items', 2] }] },
            tree: { startIndex: 2, totalCount: 10, rows: [{ label: 'Tree row', value: 'B', path: ['items', 2] }] },
            table: { startIndex: 2, totalCount: 10, rows: [{ label: 'Table row', value: 'C', path: ['items', 2] }] },
            source: { startIndex: 2, totalCount: 10, rows: [{ label: '"Table row"', path: ['items', 2] }] },
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

  it('does not render every row when virtual items are unavailable for a large count', () => {
    renderWithProviders(
      <JsonViewer
        mode="table"
        selectedPath={[]}
        breadcrumb="root"
        rows={{
          table: {
            startIndex: 0,
            totalCount: 5000,
            rows: Array.from({ length: 3 }, (_, index) => ({
              label: `Loaded row ${index}`,
              value: `value ${index}`,
              path: ['table', index],
            })),
          },
        }}
        onModeChange={() => {}}
        onSelectPath={() => {}}
      />,
    )

    expect(screen.getByText('Loaded row 0')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /tabs/i })).toBeInTheDocument()
    expect(screen.getByText('Loaded row 1')).toBeInTheDocument()
    expect(screen.getByText('Loaded row 2')).toBeInTheDocument()
    expect(screen.getByText(/Loading row 4/)).toBeInTheDocument()
    expect(screen.queryByText(/Loading row 4999/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /row/i }).length).toBeLessThan(100)
  })
})
