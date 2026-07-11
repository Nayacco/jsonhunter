import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { JsonViewer } from './JsonViewer'
import { deriveColumnViewFromJson, deriveViewerRowsFromJson } from './viewerRows'

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
        onModeChange={(next) => {
          mode = next
        }}
        onSelectPath={() => {}}
      />,
    )

    await user.click(screen.getByRole('radio', { name: /table/i }))
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
    expect(screen.getByRole('navigation', { name: 'JSON path' })).toHaveTextContent('root/items/10')
    expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument()
  })

  it('preserves breadcrumb path across mode switches', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [mode, setMode] = useState<'columns' | 'tree' | 'table' | 'source'>('columns')
      const [selectedPath, setSelectedPath] = useState<(string | number)[]>(['items', 2])

      return (
        <JsonViewer
          mode={mode}
          selectedPath={selectedPath}
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

    expect(screen.getByRole('navigation', { name: 'JSON path' })).toHaveTextContent('root/items/2')
    expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /table/i }))
    expect(screen.getByRole('region', { name: 'Table view' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'JSON path' })).toHaveTextContent('root/items/2')
    expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /source/i }))
    expect(screen.getByRole('region', { name: 'Source view' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'JSON path' })).toHaveTextContent('root/items/2')
    expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument()
  })

  it('lets breadcrumb ancestors reset the selected path from the toolbar', async () => {
    const user = userEvent.setup()
    const selectedPaths: (string | number)[][] = []

    renderWithProviders(
      <JsonViewer
        mode="columns"
        selectedPath={['items', 2, 'name']}
        onModeChange={() => {}}
        onSelectPath={(path) => selectedPaths.push(path)}
      />,
    )

    await user.click(screen.getByRole('link', { name: 'items' }))
    expect(selectedPaths).toEqual([['items']])
  })

  it('renders ancestor and child columns together in columns mode', () => {
    renderWithProviders(
      <JsonViewer
        mode="columns"
        selectedPath={['data', 0, 'entities']}
        columnView={[
          {
            id: 'root',
            title: 'root',
            path: [],
            selectedChildPath: ['data'],
            rows: { startIndex: 0, totalCount: 1, rows: [{ label: 'data', value: '1 item', path: ['data'] }] },
          },
          {
            id: 'data',
            title: 'data',
            path: ['data'],
            selectedChildPath: ['data', 0],
            rows: { startIndex: 0, totalCount: 1, rows: [{ label: '0', value: '{entities}', path: ['data', 0] }] },
          },
          {
            id: 'data[0]',
            title: 'Index 0',
            path: ['data', 0],
            selectedChildPath: ['data', 0, 'entities'],
            rows: {
              startIndex: 0,
              totalCount: 2,
              rows: [
                { label: 'id', value: '"121"', path: ['data', 0, 'id'] },
                { label: 'entities', value: '1 field', path: ['data', 0, 'entities'] },
              ],
            },
          },
        ]}
        onModeChange={() => {}}
        onSelectPath={() => {}}
      />,
    )

    expect(screen.getByRole('region', { name: 'Columns view' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'root column' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'data column' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Index 0 column' })).toBeInTheDocument()
    expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument()
    expect(screen.getAllByText('entities').length).toBeGreaterThan(0)
  })

  it('keeps ancestor columns visible while clicking deeper column rows', async () => {
    const user = userEvent.setup()
    const rawValue = { data: [{ id: '121', entities: { annotations: [] } }] }

    function Harness() {
      const [selectedPath, setSelectedPath] = useState<(string | number)[]>([])

      return (
        <JsonViewer
          mode="columns"
          selectedPath={selectedPath}
          columnView={deriveColumnViewFromJson(rawValue, selectedPath)}
          onModeChange={() => {}}
          onSelectPath={setSelectedPath}
        />
      )
    }

    renderWithProviders(<Harness />)

    await user.click(screen.getByRole('button', { name: /data/i }))
    expect(screen.getByRole('group', { name: 'root column' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'data column' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /0/i }))
    expect(screen.getByRole('group', { name: 'root column' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'data column' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Index 0 column' })).toBeInTheDocument()
  })

  it('keeps tree view anchored to the full JSON after selecting a row', async () => {
    const user = userEvent.setup()
    const rawValue = {
      data: [{ id: '121', entities: { annotations: [] } }],
      meta: { source: 'fixture' },
    }

    function Harness() {
      const [selectedPath, setSelectedPath] = useState<(string | number)[]>([])

      return (
        <JsonViewer
          mode="tree"
          selectedPath={selectedPath}
          rows={deriveViewerRowsFromJson(rawValue, selectedPath, { tree: { startIndex: 0, count: 24 } })}
          onModeChange={() => {}}
          onSelectPath={setSelectedPath}
        />
      )
    }

    renderWithProviders(<Harness />)

    const rootDataRow = screen.getByText('data').closest('.json-treeRow')
    expect(rootDataRow).toBeInTheDocument()
    await user.click(rootDataRow!)

    expect(screen.getByRole('navigation', { name: 'JSON path' })).toHaveTextContent('root/data')
    expect(screen.getByRole('button', { name: /^meta 1 field/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^entities 1 field/i })).toBeInTheDocument()
  })

  it('budgets virtual row height for single-line tree table rows', () => {
    renderWithProviders(
      <JsonViewer
        mode="tree"
        selectedPath={[]}
        rows={{
          tree: {
            startIndex: 0,
            totalCount: 2,
            rows: [
              { label: 'root', value: 'Array(1)', path: [] },
              { label: 'root[0]', value: '{id, text}', path: [0] },
            ],
          },
        }}
        onModeChange={() => {}}
        onSelectPath={() => {}}
      />,
    )

    const scrollContent = screen.getByRole('region', { name: 'Tree view' }).querySelector('.virtualScroll > div')

    expect(scrollContent).toHaveStyle({ height: '64px' })
  })

  it('renders tree rows as key and value columns with collapsible branches', async () => {
    const user = userEvent.setup()
    const rawValue = {
      data: [{ id: '121', entities: { urls: [] } }],
      meta: { source: 'fixture' },
    }

    renderWithProviders(
      <JsonViewer
        mode="tree"
        selectedPath={[]}
        rows={deriveViewerRowsFromJson(rawValue, [], { tree: { startIndex: 0, count: 32 } })}
        onModeChange={() => {}}
        onSelectPath={() => {}}
      />,
    )

    const dataRow = screen.getByText('data').closest('.json-treeRow')
    expect(dataRow).toHaveTextContent('[1 items]')
    expect(screen.getByRole('button', { name: 'Collapse data' })).toBeInTheDocument()
    expect(screen.getByText('entities')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Collapse data' }))
    expect(screen.queryByText('entities')).not.toBeInTheDocument()
    expect(screen.getByText('meta')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expand data' }))
    expect(screen.getByText('entities')).toBeInTheDocument()
  })

  it('renders tree branch guide rails for nested rows', () => {
    const rawValue = {
      data: [{ id: '121' }],
    }

    renderWithProviders(
      <JsonViewer
        mode="tree"
        selectedPath={[]}
        rows={deriveViewerRowsFromJson(rawValue, [], { tree: { startIndex: 0, count: 12 } })}
        onModeChange={() => {}}
        onSelectPath={() => {}}
      />,
    )

    const idRow = screen.getByText('id').closest('.json-treeRow')
    const idGuides = idRow?.querySelector('.json-treeGuides')

    expect(idGuides).toHaveAttribute('data-depth', '3')
    expect(idGuides).toHaveStyle({ '--json-tree-depth': '3' })
    expect(idGuides).toHaveStyle({
      '--json-tree-guide-width': 'calc(var(--json-tree-indent) + var(--json-tree-indent) + var(--json-tree-indent))',
    })
  })

  it('keeps source view anchored to the full JSON after selecting a row', async () => {
    const user = userEvent.setup()
    const rawValue = {
      data: [{ id: '121' }],
      meta: { source: 'fixture' },
    }

    function Harness() {
      const [selectedPath, setSelectedPath] = useState<(string | number)[]>([])

      return (
        <JsonViewer
          mode="source"
          selectedPath={selectedPath}
          rows={deriveViewerRowsFromJson(rawValue, selectedPath, { source: { startIndex: 0, count: 24 } })}
          onModeChange={() => {}}
          onSelectPath={setSelectedPath}
        />
      )
    }

    renderWithProviders(<Harness />)

    await user.click(screen.getByRole('button', { name: /"data": \[/i }))

    expect(screen.getByRole('navigation', { name: 'JSON path' })).toHaveTextContent('root/data')
    expect(screen.getByRole('button', { name: /"meta": \{/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /"source": "fixture"/i })).toBeInTheDocument()
  })

  it('renders source rows with disclosure controls and token classes', () => {
    const rawValue = {
      data: [{ active: false }],
      meta: 'fixture',
    }

    renderWithProviders(
      <JsonViewer
        mode="source"
        selectedPath={[]}
        rows={deriveViewerRowsFromJson(rawValue, [], { source: { startIndex: 0, count: 24 } })}
        onModeChange={() => {}}
        onSelectPath={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Collapse data' })).toBeInTheDocument()
    expect(screen.getByText('"data"')).toHaveClass('json-sourceToken-key')
    expect(screen.getByText('false')).toHaveClass('json-sourceToken-boolean')

    const activeRow = screen.getByText('"active"').closest('.json-sourceRow')
    const activeGuides = activeRow?.querySelector('.json-sourceGuides')
    expect(activeGuides).toHaveAttribute('data-depth', '3')
  })

  it('collapses source descendants while preserving sibling rows', async () => {
    const user = userEvent.setup()
    const rawValue = {
      data: [{ active: false }],
      meta: 'fixture',
    }

    renderWithProviders(
      <JsonViewer
        mode="source"
        selectedPath={[]}
        rows={deriveViewerRowsFromJson(rawValue, [], { source: { startIndex: 0, count: 24 } })}
        onModeChange={() => {}}
        onSelectPath={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Collapse data' }))

    expect(screen.queryByText('"active"')).not.toBeInTheDocument()
    expect(screen.getByText('// 1 item')).toBeInTheDocument()
    expect(screen.getByText('"meta"')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expand data' }))
    expect(screen.getByText('"active"')).toBeInTheDocument()
  })

  it('collapses source descendants in a partial source window', async () => {
    const user = userEvent.setup()
    const rawValue = {
      data: [{ active: false }],
      meta: 'fixture',
    }
    const sourceRows = deriveViewerRowsFromJson(rawValue, [], { source: { startIndex: 0, count: 6 } }).source

    renderWithProviders(
      <JsonViewer
        mode="source"
        selectedPath={[]}
        rows={{
          source: {
            ...sourceRows,
            totalCount: sourceRows.totalCount + 20,
          },
        }}
        onModeChange={() => {}}
        onSelectPath={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Collapse data' }))

    expect(screen.queryByText('"active"')).not.toBeInTheDocument()
    expect(screen.getByText('// 1 item')).toBeInTheDocument()
  })

  it('does not shrink the requested source window while a branch is collapsed', async () => {
    const user = userEvent.setup()
    const windowChanges: { startIndex: number; count: number }[] = []
    const rawValue = {
      data: [{ active: false }],
      meta: 'fixture',
    }

    renderWithProviders(
      <JsonViewer
        mode="source"
        selectedPath={[]}
        rows={deriveViewerRowsFromJson(rawValue, [], { source: { startIndex: 0, count: 24 } })}
        onModeChange={() => {}}
        onSelectPath={() => {}}
        onWindowChange={(mode, window) => {
          if (mode === 'source') windowChanges.push(window)
        }}
      />,
    )

    windowChanges.length = 0
    await user.click(screen.getByRole('button', { name: 'Collapse data' }))

    expect(windowChanges).toEqual([])
  })

  it('renders collapsed source summaries with item counts', async () => {
    const user = userEvent.setup()
    const rawValue = {
      data: [{ alias: '', baseCcy: 'USDC' }, { alias: 'second', baseCcy: 'USDT' }],
    }

    renderWithProviders(
      <JsonViewer
        mode="source"
        selectedPath={[]}
        rows={deriveViewerRowsFromJson(rawValue, [], { source: { startIndex: 0, count: 32 } })}
        onModeChange={() => {}}
        onSelectPath={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Collapse data' }))

    expect(screen.getByText('// 2 items')).toHaveClass('json-sourceSummary')
    expect(screen.getByRole('button', { name: /"data": \[/i })).toHaveTextContent(/"data": \[ … \]\/\/ 2 items/)
    expect(screen.queryByText('"alias"')).not.toBeInTheDocument()
  })

  it('restores loaded source descendants after collapsing and expanding with window updates', async () => {
    const user = userEvent.setup()
    const rawValue = {
      data: [
        {
          alias: '',
          auctionEndTime: '',
          baseCcy: 'USDC',
          category: '1',
          contTdSwTime: '',
          ctMult: '',
          ctType: '',
          ctVal: '',
        },
      ],
      meta: 'fixture',
    }
    const fullSourceTotal = deriveViewerRowsFromJson(rawValue, [], { source: { startIndex: 0, count: 64 } }).source
      .totalCount

    function Harness() {
      const [sourceWindow, setSourceWindow] = useState({ startIndex: 0, count: 24 })

      return (
        <>
          <JsonViewer
            mode="source"
            selectedPath={[]}
            rows={deriveViewerRowsFromJson(rawValue, [], { source: sourceWindow })}
            onModeChange={() => {}}
            onSelectPath={() => {}}
            onWindowChange={(mode, window) => {
              if (mode !== 'source') return
              setSourceWindow((current) =>
                current.startIndex === window.startIndex && current.count === window.count ? current : window,
              )
            }}
          />
          <span data-testid="source-window-count">{sourceWindow.count}</span>
        </>
      )
    }

    renderWithProviders(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Collapse data' }))
    await waitFor(() => expect(screen.queryByText('"ctVal"')).not.toBeInTheDocument())
    expect(Number(screen.getByTestId('source-window-count').textContent)).toBe(fullSourceTotal)

    await user.click(screen.getByRole('button', { name: 'Expand data' }))

    expect(screen.getByText('"alias"')).toBeInTheDocument()
    expect(screen.getByText('"baseCcy"')).toBeInTheDocument()
    expect(screen.getByText('"ctVal"')).toBeInTheDocument()
  })

  it('does not render every row when virtual items are unavailable for a large count', () => {
    renderWithProviders(
      <JsonViewer
        mode="table"
        selectedPath={[]}
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
    expect(screen.getByRole('radiogroup', { name: 'View mode' })).toBeInTheDocument()
    expect(screen.getByText('Loaded row 1')).toBeInTheDocument()
    expect(screen.getByText('Loaded row 2')).toBeInTheDocument()
    expect(screen.getByText(/Loading row 4/)).toBeInTheDocument()
    expect(screen.queryByText(/Loading row 4999/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /row/i }).length).toBeLessThan(100)
  })
})
