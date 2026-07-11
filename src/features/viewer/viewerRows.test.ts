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

  it('keeps tree and source windows anchored to the full JSON when a path is selected', () => {
    const rawValue = {
      rows: [
        {
          nested: {
            values: [{ name: 'leaf-0' }],
          },
        },
      ],
      meta: {
        version: 1,
      },
    }

    const rows = deriveViewerRowsFromJson(rawValue, ['rows', 0, 'nested', 'values'], {
      source: { startIndex: 0, count: 32 },
    })

    expect(rows.columns.rows[0]).toMatchObject({
      label: '0',
      path: ['rows', 0, 'nested', 'values', 0],
    })
    expect(rows.tree.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'meta', path: ['meta'], depth: 1 }),
        expect.objectContaining({ label: 'name', path: ['rows', 0, 'nested', 'values', 0, 'name'], depth: 6 }),
      ]),
    )
    expect(rows.source.rows.map((row) => row.label).join('\n')).toContain('"meta": {')
    expect(rows.source.rows.map((row) => row.label).join('\n')).toContain('"version": 1')
  })

  it('derives tree rows as a fully expanded hierarchy of node names', () => {
    const rows = deriveViewerRowsFromJson({
      data: [
        {
          id: '121',
          entities: {
            urls: [{ expanded_url: 'https://example.com' }],
          },
        },
      ],
      meta: { source: 'fixture' },
    }, [], {
      tree: { startIndex: 0, count: 32 },
    })

    expect(rows.tree.rows).toEqual([
      { label: 'root', path: [], value: '2 fields', depth: 0, hasChildren: true },
      { label: 'data', path: ['data'], value: '[1 items]', depth: 1, hasChildren: true },
      { label: '0', path: ['data', 0], value: '2 fields', depth: 2, hasChildren: true },
      { label: 'id', path: ['data', 0, 'id'], value: '"121"', depth: 3, hasChildren: false },
      { label: 'entities', path: ['data', 0, 'entities'], value: '1 field', depth: 3, hasChildren: true },
      { label: 'urls', path: ['data', 0, 'entities', 'urls'], value: '[1 items]', depth: 4, hasChildren: true },
      { label: '0', path: ['data', 0, 'entities', 'urls', 0], value: '1 field', depth: 5, hasChildren: true },
      {
        label: 'expanded_url',
        path: ['data', 0, 'entities', 'urls', 0, 'expanded_url'],
        value: '"https://example.com"',
        depth: 6,
        hasChildren: false,
      },
      { label: 'meta', path: ['meta'], value: '1 field', depth: 1, hasChildren: true },
      { label: 'source', path: ['meta', 'source'], value: '"fixture"', depth: 2, hasChildren: false },
    ])
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

  it('renders source rows as fully expanded pretty JSON', () => {
    const rawValue = {
      rows: [
        {
          id: 1,
          name: 'row-1',
        },
      ],
    }

    const rows = deriveViewerRowsFromJson(rawValue, [], {
      source: { startIndex: 0, count: 16 },
    })

    expect(rows.source.rows.map((row) => row.label)).toEqual([
      '{',
      '  "rows": [',
      '    {',
      '      "id": 1,',
      '      "name": "row-1"',
      '    }',
      '  ]',
      '}',
    ])
  })

  it('derives token metadata for structured source rows', () => {
    const rawValue = {
      data: [{ active: false, score: 0.02, note: null }],
      meta: 'fixture',
    }

    const rows = deriveViewerRowsFromJson(rawValue, [], {
      source: { startIndex: 0, count: 16 },
    }).source.rows

    expect(rows[0]).toMatchObject({
      label: '{',
      path: [],
      depth: 0,
      hasChildren: true,
      source: {
        kind: 'object-open',
        tokens: [{ kind: 'punctuation', text: '{' }],
      },
    })
    expect(rows[1]).toMatchObject({
      label: '  "data": [',
      path: ['data'],
      depth: 1,
      hasChildren: true,
      source: {
        kind: 'array-open',
        tokens: [
          { kind: 'key', text: '"data"' },
          { kind: 'punctuation', text: ': ' },
          { kind: 'punctuation', text: '[' },
        ],
      },
    })
    expect(rows.find((row) => row.label.includes('"active": false'))).toMatchObject({
      path: ['data', 0, 'active'],
      depth: 3,
      hasChildren: false,
      source: {
        kind: 'property',
        tokens: [
          { kind: 'key', text: '"active"' },
          { kind: 'punctuation', text: ': ' },
          { kind: 'boolean', text: 'false' },
          { kind: 'punctuation', text: ',' },
        ],
      },
    })
    expect(rows.find((row) => row.label.includes('"score": 0.02'))?.source?.tokens).toContainEqual({
      kind: 'number',
      text: '0.02',
    })
    expect(rows.find((row) => row.label.includes('"note": null'))?.source?.tokens).toContainEqual({
      kind: 'null',
      text: 'null',
    })
    expect(rows.at(-1)).toMatchObject({
      label: '}',
      path: [],
      depth: 0,
      hasChildren: false,
      source: {
        kind: 'close',
        tokens: [{ kind: 'punctuation', text: '}' }],
      },
    })
  })

  it('derives collapsed summaries and item counts for source collections', () => {
    const rawValue = {
      data: [{ alias: '', baseCcy: 'USDC' }, { alias: 'second', baseCcy: 'USDT' }],
      meta: { source: 'fixture' },
    }

    const rows = deriveViewerRowsFromJson(rawValue, [], {
      source: { startIndex: 0, count: 32 },
    }).source.rows

    expect(rows.find((row) => row.path.join('.') === 'data')).toMatchObject({
      source: {
        summary: {
          countLabel: '2 items',
          tokens: [
            { kind: 'key', text: '"data"' },
            { kind: 'punctuation', text: ': ' },
            { kind: 'punctuation', text: '[' },
            { kind: 'punctuation', text: ' … ' },
            { kind: 'punctuation', text: ']' },
            { kind: 'punctuation', text: ',' },
          ],
        },
      },
    })
    expect(rows.find((row) => row.path.join('.') === 'data.0')).toMatchObject({
      source: {
        summary: {
          countLabel: '2 items',
          tokens: [
            { kind: 'punctuation', text: '{' },
            { kind: 'punctuation', text: ' … ' },
            { kind: 'punctuation', text: '}' },
            { kind: 'punctuation', text: ',' },
          ],
        },
      },
    })
    expect(rows.find((row) => row.path.join('.') === 'meta')).toMatchObject({
      source: {
        summary: {
          countLabel: '1 item',
        },
      },
    })
  })

  it('does not read array entries outside the visible columns window', () => {
    const rawValue = createWindowedArrayWithGuardedTail()

    const columns = deriveColumnViewFromJson(rawValue, [], {
      root: { startIndex: 0, count: 8 },
    }).at(0)?.rows

    expect(columns?.totalCount).toBe(5000)
    expect(columns?.rows).toHaveLength(8)
    expect(columns?.rows[0]).toMatchObject({
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

  it('fully expands tree rows for array entries in the requested window', () => {
    const rawValue = Array.from({ length: 3 }, (_, index) => ({
      id: index,
      name: `row-${index}`,
    }))

    const rows = deriveViewerRowsFromJson(rawValue, [], {
      tree: { startIndex: 0, count: 10 },
    })

    expect(rows.tree.totalCount).toBe(10)
    expect(rows.tree.rows).toHaveLength(10)
    expect(rows.tree.rows[0]).toMatchObject({
      label: 'root',
      path: [],
      value: '[3 items]',
      depth: 0,
    })
    expect(rows.tree.rows[1]).toMatchObject({
      label: '0',
      path: [0],
      value: '2 fields',
      depth: 1,
    })
    expect(rows.tree.rows[2]).toMatchObject({
      label: 'id',
      path: [0, 'id'],
      value: '0',
      depth: 2,
    })
    expect(rows.tree.rows[9]).toMatchObject({
      label: 'name',
      path: [2, 'name'],
      value: '"row-2"',
      depth: 2,
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
    expect(rows.tree.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'nested',
          path: ['rows', 0, 'nested'],
          value: 'null',
          depth: 3,
        }),
      ]),
    )
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
