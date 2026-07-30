import { describe, expect, it } from 'vitest'
import type { JsonPath } from './jsonTypes'
import { resolveTableModel, type TableModel, type TableModelResult } from './tableMapping'

function expectReady(result: TableModelResult): TableModel {
  expect(result.status).toBe('ready')
  if (result.status !== 'ready') throw new Error(`Expected a ready table model, received ${result.status}`)
  return result.model
}

function expectError(result: TableModelResult, code: string) {
  expect(result).toMatchObject({ status: 'error', code })
}

describe('resolveTableModel', () => {
  it('uses an empty navigation address to render a root primitive array', () => {
    const model = expectReady(resolveTableModel(['Ada', 42, true], ''))

    expect(model.kind).toBe('primitive')
    expect(model.columns).toEqual([{ id: 'value', label: 'value' }])
    expect(model.rowCount).toBe(3)
    expect(model.getCell(0, 'value')).toMatchObject({
      text: 'Ada',
      value: 'Ada',
      path: [0],
      type: 'string',
    })
    expect(model.getCell(1, 'value')).toMatchObject({ text: '42', path: [1], type: 'number' })
    expect(model.getCell(2, 'value')).toMatchObject({ text: 'true', path: [2], type: 'boolean' })
  })

  it('resolves an explicitly submitted nested navigation address', () => {
    const model = expectReady(resolveTableModel({ payload: { rows: [{ id: 1 }] } }, 'payload.rows'))

    expect(model.basePath).toEqual(['payload', 'rows'])
    expect(model.columns).toEqual([{ id: 'id', label: 'id' }])
    expect(model.getCell(0, 'id')).toMatchObject({
      text: '1',
      path: ['payload', 'rows', 0, 'id'],
    })
  })

  it('skips null rows while preserving original array indexes in cell paths', () => {
    const model = expectReady(resolveTableModel([null, 'first', null, 'second'], ''))

    expect(model.rowCount).toBe(2)
    expect(model.getRowPath(0)).toEqual([1])
    expect(model.getRowPath(1)).toEqual([3])
    expect(model.getCell(0, 'value').path).toEqual([1])
    expect(model.getCell(1, 'value').path).toEqual([3])
  })

  it('accepts mixed primitive types after null rows are removed', () => {
    const model = expectReady(resolveTableModel([1, null, 'two', false], ''))

    expect(model.kind).toBe('primitive')
    expect(model.rowCount).toBe(3)
    expect(model.getCell(2, 'value')).toMatchObject({ text: 'false', type: 'boolean' })
  })

  it('maps object rows using the union of keys without an index column', () => {
    const model = expectReady(
      resolveTableModel(
        [
          { id: 1, profile: { active: true } },
          { id: 2, name: 'Lin', tags: ['admin', 'editor'] },
        ],
        '',
      ),
    )

    expect(model.kind).toBe('object')
    expect(model.columns.map((column) => column.id)).toEqual(['id', 'profile', 'name', 'tags'])
    expect(model.getCell(0, 'profile')).toMatchObject({
      text: '{"active":true}',
      path: [0, 'profile'],
      type: 'object',
    })
    expect(model.getCell(1, 'tags')).toMatchObject({
      text: '["admin","editor"]',
      path: [1, 'tags'],
      type: 'array',
    })
  })

  it('leaves a missing object property blank and non-selectable while preserving explicit null', () => {
    const model = expectReady(resolveTableModel([{ id: 1 }, { id: 2, name: null }], ''))

    expect(model.getCell(0, 'name')).toEqual({
      text: '',
      value: undefined,
      path: undefined,
      type: 'undefined',
    })
    expect(model.getCell(1, 'name')).toEqual({
      text: 'null',
      value: null,
      path: [1, 'name'],
      type: 'null',
    })
  })

  it('renders ragged two-dimensional arrays using the maximum row width', () => {
    const model = expectReady(resolveTableModel([[1, 2], [3], [4, 5, 6]], ''))

    expect(model.kind).toBe('matrix')
    expect(model.columns).toEqual([
      { id: '0', label: '0' },
      { id: '1', label: '1' },
      { id: '2', label: '2' },
    ])
    expect(model.rowCount).toBe(3)
    expect(model.getCell(1, '1')).toEqual({
      text: '',
      value: undefined,
      path: undefined,
      type: 'undefined',
    })
    expect(model.getCell(2, '2')).toMatchObject({ text: '6', path: [2, 2] })
  })

  it('serializes structured matrix cells as compact JSON', () => {
    const model = expectReady(resolveTableModel([[{ id: 1 }, ['nested']]], ''))

    expect(model.getCell(0, '0')).toMatchObject({ text: '{"id":1}', type: 'object' })
    expect(model.getCell(0, '1')).toMatchObject({ text: '["nested"]', type: 'array' })
  })

  it.each([
    {
      value: [1, { id: 2 }],
      detectedKinds: ['primitive', 'object'],
    },
    {
      value: [[1], { id: 2 }],
      detectedKinds: ['matrix', 'object'],
    },
  ])('rejects mixed row shapes: $detectedKinds', ({ value, detectedKinds }) => {
    const result = resolveTableModel(value, '')

    expect(result).toMatchObject({
      status: 'error',
      code: 'mixed-item-types',
      detectedKinds,
    })
  })

  it.each([
    { root: { rows: [] }, address: '', code: 'target-not-array' },
    { root: { rows: [] }, address: 'missing.rows', code: 'path-not-found' },
    { root: { rows: [] }, address: 'rows[', code: 'invalid-path' },
  ])('returns $code for address "$address"', ({ root, address, code }) => {
    expectError(resolveTableModel(root, address), code)
  })

  it.each([
    { value: [], basePath: [] },
    { value: [null, null], basePath: [] },
    { value: { rows: [] }, basePath: ['rows'] },
  ])('returns an empty result when the selected array has no renderable rows', ({ value, basePath }) => {
    const address = formatTestPath(basePath)

    expect(resolveTableModel(value, address)).toMatchObject({
      status: 'empty',
      reason: 'no-rows',
      basePath,
    })
  })

  it.each([
    { value: [{}, {}], kind: 'object' },
    { value: [[], []], kind: 'matrix' },
  ])('returns an empty result when $kind rows have no columns', ({ value }) => {
    expect(resolveTableModel(value, '')).toMatchObject({
      status: 'empty',
      reason: 'no-columns',
      basePath: [],
    })
  })
})

function formatTestPath(path: JsonPath) {
  return path.join('.')
}
