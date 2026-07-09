import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/styles/app.css'), 'utf8')

describe('app.css', () => {
  it('does not define a custom root token theme', () => {
    expect(css).not.toMatch(/:root\s*\{[^}]*--color-/s)
    expect(css).not.toMatch(/:root\s*\{[^}]*--spacing-/s)
    expect(css).not.toMatch(/:root\s*\{[^}]*--radius-/s)
  })

  it('keeps bridge styles token-based', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(css).not.toMatch(/rgba?\(/)
  })
})
