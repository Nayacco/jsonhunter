import { describe, expect, it } from 'vitest'
import { buildTableModel } from './tableMapping'

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
})

