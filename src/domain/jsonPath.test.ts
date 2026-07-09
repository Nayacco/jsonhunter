import { describe, expect, it } from 'vitest'
import { formatPath, getAtPath, parsePath } from './jsonPath'

describe('jsonPath', () => {
  it('formats and parses mixed object and array paths', () => {
    const path = ['root', 'data', 0, 'name']
    expect(formatPath(path)).toBe('root.data[0].name')
    expect(parsePath('root.data[0].name')).toEqual(path)
  })

  it('round-trips arbitrary object keys', () => {
    const path = ['root', 'data.key', 0, 'weird[name]', 'quoted"key', '']
    const formatted = formatPath(path)
    expect(formatted).toBe('root["data.key"][0]["weird[name]"]["quoted\\"key"][""]')
    expect(parsePath(formatted)).toEqual(path)
  })

  it('round-trips bracket-quoted keys with escaped backslash/newline/tab/unicode', () => {
    expect(parsePath(formatPath(['has\\backslash']))).toEqual(['has\\backslash'])
    expect(parsePath(formatPath(['line\nbreak']))).toEqual(['line\nbreak'])
    expect(parsePath(formatPath(['tab\tchar']))).toEqual(['tab\tchar'])
    expect(parsePath(formatPath(['\u0061unicode']))).toEqual(['aunicode'])
  })

  it('decodes JSON escapes from bracket-quoted keys', () => {
    expect(parsePath('["a\\\\b"]')).toEqual(['a\\b'])
    expect(parsePath('["line\\nbreak"]')).toEqual(['line\nbreak'])
    expect(parsePath('["tab\\tchar"]')).toEqual(['tab\tchar'])
    expect(parsePath('["\\u0061"]')).toEqual(['a'])
  })

  it('reads a value at a path', () => {
    const value = { data: [{ name: 'Ada' }] }
    expect(getAtPath(value, ['data', 0, 'name'])).toBe('Ada')
  })
})

