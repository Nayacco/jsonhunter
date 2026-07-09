import { describe, expect, it } from 'vitest'
import { executeJsNode } from './jsExecution'

describe('executeJsNode', () => {
  it('rejects sparse arrays with only holes', async () => {
    await expect(
      executeJsNode('export default function transform() { return Array(2) }', { ok: true }),
    ).rejects.toThrow(/valid JSON/i)
  })

  it('rejects sparse arrays with missing leading entries', async () => {
    await expect(
      executeJsNode('export default function transform() { return [, 1] }', { ok: true }),
    ).rejects.toThrow(/valid JSON/i)
  })

  it('rejects undefined return values', async () => {
    await expect(
      executeJsNode('export default function transform() { return undefined }', { ok: true }),
    ).rejects.toThrow(/valid JSON/i)
  })

  it('rejects function return values', async () => {
    await expect(
      executeJsNode('export default function transform() { return function nope() {} }', { ok: true }),
    ).rejects.toThrow(/valid JSON/i)
  })

  it('rejects nested non-JSON values', async () => {
    await expect(
      executeJsNode('export default function transform() { return { bad: [Symbol("x")] } }', { ok: true }),
    ).rejects.toThrow(/valid JSON/i)
  })
})
