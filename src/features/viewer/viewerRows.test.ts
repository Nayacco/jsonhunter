import { describe, expect, it } from 'vitest'
import { deriveColumnViewFromJson, deriveViewerRowsFromJson } from './viewerRows'

describe('deriveViewerRowsFromJson', () => {
  function createWindowedArrayWithGuardedTail(length = 5000) {
    const value = new Array(length)
    for (let index = 0; index < 8; index += 1) {
      value[index] = { id: index, name: `row-${index}` }
    }
    Object.defineProperty(value, length - 1, {
      configurable: true,
      enumerable: true,
      get() {
        throw new Error('out-of-window entry should not be read')
      },
    })
    return value
  }

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

  it('does not read array entries outside the visible columns window', () => {
    const rawValue = createWindowedArrayWithGuardedTail()

    const rows = deriveViewerRowsFromJson(rawValue, [], {
      columns: { startIndex: 0, count: 8 },
    })

    expect(rows.columns.totalCount).toBe(5000)
    expect(rows.columns.rows).toHaveLength(8)
    expect(rows.columns.rows[0]).toMatchObject({
      label: '0',
      path: [0],
      value: '2 fields',
    })
  })

  it('summarizes object values in columns by field count', () => {
    const rows = deriveViewerRowsFromJson({
      profile: { id: 1, name: 'Ada', active: true },
      metadata: { source: 'paste' },
      empty: {},
    })

    expect(rows.columns.rows).toEqual([
      { label: 'profile', path: ['profile'], value: '3 fields' },
      { label: 'metadata', path: ['metadata'], value: '1 field' },
      { label: 'empty', path: ['empty'], value: '0 fields' },
    ])
  })

  it('does not read array entries outside the visible tree window', () => {
    const rawValue = createWindowedArrayWithGuardedTail()

    const rows = deriveViewerRowsFromJson(rawValue, [], {
      tree: { startIndex: 0, count: 8 },
    })

    expect(rows.tree.totalCount).toBe(5001)
    expect(rows.tree.rows).toHaveLength(8)
    expect(rows.tree.rows[0]).toMatchObject({
      label: 'root',
      path: [],
      value: 'Array(5000)',
    })
    expect(rows.tree.rows[1]).toMatchObject({
      label: 'root[0]',
      path: [0],
      value: '{id, name}',
    })
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

describe('deriveColumnViewFromJson', () => {
  it('derives root column when no path is selected', () => {
    const columns = deriveColumnViewFromJson({ data: [{ id: 1 }], includes: { users: [] } }, [])

    expect(columns).toHaveLength(1)
    expect(columns[0]).toMatchObject({
      title: 'root',
      path: [],
      selectedChildPath: undefined,
    })
    expect(columns[0].rows.rows.map((row) => row.label)).toEqual(['data', 'includes'])
  })

  it('derives one column per expandable selected ancestor', () => {
    const rawValue = {
      data: [
        {
          id: '121',
          entities: {
            annotations: [{ normalized_text: 'Twitter' }],
          },
        },
      ],
    }

    const columns = deriveColumnViewFromJson(rawValue, ['data', 0, 'entities', 'annotations', 0])

    expect(columns.map((column) => column.title)).toEqual([
      'root',
      'data',
      'Index 0',
      'entities',
      'annotations',
      'Index 0',
    ])
    expect(columns.map((column) => column.selectedChildPath)).toEqual([
      ['data'],
      ['data', 0],
      ['data', 0, 'entities'],
      ['data', 0, 'entities', 'annotations'],
      ['data', 0, 'entities', 'annotations', 0],
      undefined,
    ])
    expect(columns[2].rows.rows.map((row) => row.label)).toContain('entities')
    expect(columns[4].rows.rows[0]).toMatchObject({
      label: '0',
      path: ['data', 0, 'entities', 'annotations', 0],
    })
  })

  it('does not add an empty column for a primitive selected leaf', () => {
    const rawValue = { data: [{ id: '121', text: 'hello' }] }

    const columns = deriveColumnViewFromJson(rawValue, ['data', 0, 'text'])

    expect(columns.map((column) => column.title)).toEqual(['root', 'data', 'Index 0'])
    expect(columns[2].selectedChildPath).toEqual(['data', 0, 'text'])
  })

  it('keeps column windows bounded by path', () => {
    const guarded = new Array(5000)
    guarded[0] = { name: 'loaded-0' }
    guarded[8] = { name: 'loaded-8' }
    Object.defineProperty(guarded, 4999, {
      configurable: true,
      enumerable: true,
      get() {
        throw new Error('out-of-window entry should not be read')
      },
    })

    const columns = deriveColumnViewFromJson(guarded, [8], {
      root: { startIndex: 8, count: 1 },
    })

    expect(columns[0].rows.totalCount).toBe(5000)
    expect(columns[0].rows.startIndex).toBe(8)
    expect(columns[0].rows.rows).toHaveLength(1)
    expect(columns[0].rows.rows[0]).toMatchObject({
      label: '8',
      path: [8],
    })
  })
})
