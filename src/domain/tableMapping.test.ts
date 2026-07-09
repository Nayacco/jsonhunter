import { describe, expect, it } from 'vitest'
import { buildTableModel } from './tableMapping'
import { formatPath } from './jsonPath'

describe('buildTableModel', () => {
  it('maps array of objects into columns and rows', () => {
    const model = buildTableModel(
      [
        { id: 1, name: 'Ada' },
        { id: 2, active: true },
      ],
      [],
    )

    expect(model.columns.map((column) => column.id)).toEqual(['index', 'id', 'name', 'active'])
    expect(model.rows[0].path).toEqual([0])
    expect(model.rows[0].cells.id.value).toBe(1)
    expect(model.rows[1].cells.active.value).toBe(true)
  })

  it('maps object into key value rows', () => {
    const model = buildTableModel({ id: 1, name: 'Ada' }, [])
    expect(model.columns.map((column) => column.id)).toEqual(['key', 'type', 'value'])
    expect(model.rows[0].cells.key.value).toBe('id')
    expect(model.rows[0].path).toEqual(['id'])
  })

  it('preserves missing object properties as undefined', () => {
    const model = buildTableModel([{ id: 1 }, { id: 2, name: null }], [])

    expect(model.columns.map((column) => column.id)).toEqual(['index', 'id', 'name'])
    expect(model.rows[0].cells.name.value).toBeUndefined()
    expect(model.rows[0].cells.name.type).toBe('undefined')
    expect(model.rows[1].cells.name.value).toBeNull()
    expect(model.rows[1].cells.name.type).toBe('null')
  })

  it('formats scalar path cells with numeric segments', () => {
    const model = buildTableModel('value', ['data', 0, 'name'])
    expect(model.rows[0].cells.path.value).toBe(formatPath(['data', 0, 'name']))
  })
})

