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
})
