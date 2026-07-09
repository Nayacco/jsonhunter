import { describe, expect, it } from 'vitest'
import { deriveViewerRowsFromJson } from './viewerRows'

describe('deriveViewerRowsFromJson', () => {
  it('builds a bounded table window from raw array data nested under rows', () => {
    const rawValue = {
      rows: Array.from({ length: 5000 }, (_, index) => ({
        id: index,
        name: `row-${index}`,
        active: index % 2 === 0,
      })),
    }

    const rows = deriveViewerRowsFromJson(rawValue)

    expect(rows.table.totalCount).toBe(5000)
    expect(rows.table.rows).toHaveLength(8)
    expect(rows.table.rows[0]).toMatchObject({
      label: 'row-0',
      path: ['rows', 0],
    })
    expect(rows.table.rows[7]).toMatchObject({
      label: 'row-7',
      path: ['rows', 7],
    })
  })

  it('scopes the derived windows to the selected path', () => {
    const rawValue = {
      rows: [
        {
          nested: {
            values: [{ name: 'leaf-0' }, { name: 'leaf-1' }],
          },
        },
      ],
    }

    const rows = deriveViewerRowsFromJson(rawValue, ['rows', 0, 'nested', 'values'])

    expect(rows.table.totalCount).toBe(2)
    expect(rows.table.rows[0]).toMatchObject({
      label: 'leaf-0',
      path: ['rows', 0, 'nested', 'values', 0],
    })
    expect(rows.columns.rows[0]).toMatchObject({
      label: '0',
      path: ['rows', 0, 'nested', 'values', 0],
    })
  })

  it('derives a lower table window by visible index instead of permanent placeholders', () => {
    const rawValue = {
      rows: Array.from({ length: 5000 }, (_, index) => ({
        id: index,
        name: `row-${index}`,
      })),
    }

    const rows = deriveViewerRowsFromJson(rawValue, [], {
      table: { startIndex: 4992, count: 8 },
    })

    expect(rows.table.totalCount).toBe(5000)
    expect(rows.table.startIndex).toBe(4992)
    expect(rows.table.rows).toHaveLength(8)
    expect(rows.table.rows[0]).toMatchObject({
      label: 'row-4992',
      path: ['rows', 4992],
    })
    expect(rows.table.rows[7]).toMatchObject({
      label: 'row-4999',
      path: ['rows', 4999],
    })
  })

  it('keeps source windows bounded without stringifying every item', () => {
    const rawValue = {
      rows: Array.from({ length: 5000 }, (_, index) => ({
        id: index,
        name: `row-${index}`,
      })),
    }

    const rows = deriveViewerRowsFromJson(rawValue, [], {
      source: { startIndex: 4998, count: 4 },
    })

    expect(rows.source.totalCount).toBe(5002)
    expect(rows.source.startIndex).toBe(4998)
    expect(rows.source.rows.map((row) => row.label).join('\n')).toContain('row-4997')
    expect(rows.source.rows.map((row) => row.label).join('\n')).not.toContain('row-0')
  })

  it('keeps a selected null leaf scoped instead of falling back to the root value', () => {
    const rawValue = {
      rows: [
        {
          nested: null,
          fallback: {
            name: 'should not be used',
          },
        },
      ],
    }

    const rows = deriveViewerRowsFromJson(rawValue, ['rows', 0, 'nested'])

    expect(rows.columns.rows[0]).toMatchObject({
      label: 'rows[0].nested',
      path: ['rows', 0, 'nested'],
      value: 'null',
    })
    expect(rows.tree.rows[0]).toMatchObject({
      label: 'root.rows[0].nested',
      path: ['rows', 0, 'nested'],
      value: 'null',
    })
  })
})
