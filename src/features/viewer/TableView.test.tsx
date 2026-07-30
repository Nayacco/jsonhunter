import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JsonPath } from '../../domain/jsonTypes'
import { renderWithProviders } from '../../test/render'
import { JsonViewer } from './JsonViewer'
import { TableView } from './TableView'

type MockVirtualItem = {
  index: number
  key: number
  start: number
  size?: number
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

describe('TableView', () => {
  beforeEach(() => {
    mockVirtualizerState.totalSize = 0
    mockVirtualizerState.virtualItems = []
  })

  it('renders a root array immediately without requiring a navigation address', () => {
    renderWithProviders(<TableView value={[{ id: 1, name: 'Ada' }]} onSelectPath={() => {}} />)

    expect(screen.getByRole('textbox', { name: 'Table navigation path' })).toHaveValue('')
    expect(screen.getByRole('columnheader', { name: 'id' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'name' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Ada' })).toBeInTheDocument()
  })

  it('only applies edited navigation input on Enter or Navigate', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <TableView
        value={{
          first: [{ name: 'Ada' }],
          second: [{ name: 'Lin' }],
        }}
        onSelectPath={() => {}}
      />,
    )

    const input = screen.getByRole('textbox', { name: 'Table navigation path' })
    expect(screen.getByText('Table data must be an array')).toBeInTheDocument()

    await user.type(input, 'first')
    expect(screen.queryByText('Ada')).not.toBeInTheDocument()

    await user.keyboard('{Enter}')
    expect(screen.getByRole('cell', { name: 'Ada' })).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, 'second')
    expect(screen.getByRole('cell', { name: 'Ada' })).toBeInTheDocument()
    expect(screen.queryByText('Lin')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Navigate table' }))
    expect(screen.getByRole('cell', { name: 'Lin' })).toBeInTheDocument()
    expect(screen.queryByText('Ada')).not.toBeInTheDocument()
  })

  it('shows a specific error and no stale table for mixed row shapes', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <TableView
        value={{ rows: [1, { id: 2 }] }}
        onSelectPath={() => {}}
      />,
    )

    const input = screen.getByRole('textbox', { name: 'Table navigation path' })
    await user.type(input, 'rows{Enter}')

    expect(screen.getByText('Table data has mixed item types')).toBeInTheDocument()
    expect(screen.getByText(/primitive, object/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an empty state when null filtering leaves no rows', () => {
    renderWithProviders(<TableView value={[null, null]} onSelectPath={() => {}} />)

    expect(screen.getByRole('heading', { name: 'No rows to display' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('updates the breadcrumb from a cell without changing the committed table path', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [selectedPath, setSelectedPath] = useState<JsonPath>(['breadcrumb'])

      return (
        <JsonViewer
          mode="table"
          value={{
            items: [{ name: 'Ada' }],
            other: [{ name: 'Lin' }],
          }}
          selectedPath={selectedPath}
          onModeChange={() => {}}
          onSelectPath={setSelectedPath}
        />
      )
    }

    renderWithProviders(<Harness />)

    const input = screen.getByRole('textbox', { name: 'Table navigation path' })
    await user.type(input, 'items{Enter}')
    fireEvent.click(screen.getByRole('cell', { name: 'Ada' }))

    expect(screen.getByRole('navigation', { name: 'JSON path' })).toHaveTextContent('root/items/0/name')
    expect(input).toHaveValue('items')
    expect(screen.getByRole('cell', { name: 'Ada' })).toBeInTheDocument()
    expect(screen.queryByText('Lin')).not.toBeInTheDocument()
  })

  it('renders only virtual rows from a large primitive array', () => {
    mockVirtualizerState.totalSize = 5000 * 32
    mockVirtualizerState.virtualItems = [
      { index: 100, key: 100, start: 100 * 32, size: 32 },
      { index: 101, key: 101, start: 101 * 32, size: 32 },
      { index: 102, key: 102, start: 102 * 32, size: 32 },
    ]

    renderWithProviders(
      <TableView
        value={Array.from({ length: 5000 }, (_, index) => `row-${index}`)}
        onSelectPath={() => {}}
      />,
    )

    expect(screen.getByRole('cell', { name: 'row-100' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'row-102' })).toBeInTheDocument()
    expect(screen.queryByText('row-0')).not.toBeInTheDocument()
    expect(screen.queryByText('row-4999')).not.toBeInTheDocument()
    expect(screen.getAllByRole('row').length).toBeLessThan(10)
  })
})
