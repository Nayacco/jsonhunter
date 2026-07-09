import { describe, expect, it } from 'vitest'
import { formatPath, getAtPath, parsePath } from './jsonPath'

describe('jsonPath', () => {
  it('formats and parses mixed object and array paths', () => {
    const path = ['root', 'data', 0, 'name']
    expect(formatPath(path)).toBe('root.data[0].name')
    expect(parsePath('root.data[0].name')).toEqual(path)
  })

  it('reads a value at a path', () => {
    const value = { data: [{ name: 'Ada' }] }
    expect(getAtPath(value, ['data', 0, 'name'])).toBe('Ada')
  })
})

