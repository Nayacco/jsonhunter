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

  it('limits column row values so keys remain visible', () => {
    expect(css).toMatch(/\.json-columnValue\s*\{[^}]*max-width:\s*calc\(var\(--spacing-12\) \* 3\)/s)
    expect(css).toMatch(/\.json-columnValue\s*\{[^}]*text-overflow:\s*ellipsis/s)
  })

  it('uses an emphasized token for tree guide lines', () => {
    expect(css).toMatch(/\.json-treeGuides\s*\{[^}]*--json-tree-guide-color:\s*var\(--color-border-emphasized\)/s)
    expect(css).toMatch(/\.json-treeGuides\[data-has-guides='true'\]::after\s*\{[^}]*var\(--json-tree-guide-color\)/s)
  })

  it('draws tree branch connectors toward the row content', () => {
    expect(css).toMatch(/\.json-treeGuides\[data-has-guides='true'\]::after\s*\{[^}]*inset-inline-start:\s*100%/s)
  })

  it('leaves row gaps in tree vertical guide rails', () => {
    expect(css).toMatch(/\.json-treeGuides\s*\{[^}]*--json-tree-guide-gap:\s*var\(--spacing-2\)/s)
    expect(css).toMatch(/\.json-treeGuides::before\s*\{[^}]*inset-block:\s*var\(--json-tree-guide-gap\)/s)
  })

  it('aligns tree guide indentation with disclosure button centers', () => {
    expect(css).toMatch(
      /\.json-treeGuides\s*\{[^}]*--json-tree-indent:\s*calc\(var\(--size-element-sm\) \/ 2 \+ var\(--spacing-1\)\)/s,
    )
  })
})
