import { describe, expect, it } from 'vitest'
import { getRawSizeBytes, shouldPersistRawText } from './projectRepository'

describe('projectRepository raw persistence rules', () => {
  it('never persists URL raw text', () => {
    expect(shouldPersistRawText({ type: 'url', url: 'https://example.com/data.json' }, '{"ok":true}')).toBe(false)
  })

  it('persists file and paste raw text at or under 10 MiB', () => {
    expect(shouldPersistRawText({ type: 'file', fileName: 'small.json', sizeBytes: 2 }, '{}')).toBe(true)
    expect(shouldPersistRawText({ type: 'paste', label: 'Pasted JSON', sizeBytes: 2 }, '{}')).toBe(true)
  })

  it('does not persist file and paste raw text over 10 MiB', () => {
    const oversized = 'x'.repeat(10 * 1024 * 1024 + 1)
    expect(shouldPersistRawText({ type: 'file', fileName: 'large.json', sizeBytes: oversized.length }, oversized)).toBe(false)
  })

  it('uses UTF-8 bytes rather than string length', () => {
    expect(getRawSizeBytes('你')).toBe(3)
  })
})
