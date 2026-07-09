import { describe, expect, it } from 'vitest'
import { executeJsNode } from './jsExecution'

describe('executeJsNode', () => {
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
