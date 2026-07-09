import { describe, expect, it } from 'vitest'
import { summarizeJson } from './jsonSummary'

describe('summarizeJson', () => {
  it('summarizes arrays and objects', () => {
    expect(summarizeJson([{ id: 1 }, { id: 2 }])).toEqual({
      type: 'array',
      label: 'Array(2)',
      childCount: 2,
      preview: '[2 items]',
    })

    expect(summarizeJson({ id: 1, name: 'Ada' })).toEqual({
      type: 'object',
      label: 'Object(2)',
      childCount: 2,
      preview: '{id, name}',
    })
  })
})
