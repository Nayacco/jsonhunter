import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/styles/app.css'), 'utf8')
const themeCss = readFileSync(resolve(process.cwd(), 'src/theme/jsonHunterTheme.css'), 'utf8')

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

  it('keeps landing page atmosphere on Astryx tokens', () => {
    expect(css).toMatch(/\.importLanding-hero\s*\{[^}]*var\(--color-background-surface\)/s)
    expect(css).not.toMatch(/\.importLanding-[^{]+\{[^}]*(?:#[0-9a-fA-F]{3,8}|rgba?\(|\d+px)/s)
  })

  it('defines shared JSON semantic colors with Astryx tokens', () => {
    expect(css).toMatch(/\.json-viewKey\s*\{[^}]*color:\s*var\(--color-text-gray\)/s)
    expect(css).toMatch(/\.json-viewValue\s*\{[^}]*color:\s*var\(--color-data-orange-4\)/s)
    expect(css).toMatch(/\.json-viewValue\s*\{[^}]*font-weight:\s*var\(--font-weight-semibold\)/s)
    expect(css).toMatch(/\.json-viewMeta\s*\{[^}]*color:\s*var\(--color-text-secondary\)/s)
    expect(themeCss).toMatch(/--color-data-orange-4:\s*light-dark\(/)
  })

  it('distinguishes the table header and lets the table fill the available viewer height', () => {
    expect(css).toMatch(
      /\.json-tableScroll th\s*\{[^}]*background:\s*var\(--color-background-body\)/s,
    )
    expect(css).toMatch(
      /\.json-tableScroll th\.json-tableRowNumberCell\s*\{[^}]*background:\s*color-mix\(\s*in srgb,\s*var\(--color-background-body\) 88%,\s*var\(--color-text-primary\)\s*\)/s,
    )
    expect(css).toMatch(/\.json-tableScroll\s*\{[^}]*flex:\s*1 1 0/s)
    expect(css).toMatch(/\.json-tableScroll\s*\{[^}]*min-height:\s*0/s)
    expect(css).not.toMatch(/\.json-tableScroll\s*\{[^}]*52vh/s)
    expect(css).not.toMatch(/\.json-tableScroll\s*\{[^}]*32rem/s)
  })

  it('gives the table row-number column its own token-based background', () => {
    expect(css).toMatch(
      /\.json-tableScroll \.json-tableRowNumberCell\s*\{[^}]*background:\s*var\(--color-background-gray\)/s,
    )
  })

  it('limits column row values so keys remain visible', () => {
    expect(css).toMatch(/\.json-columnValue\s*\{[^}]*max-width:\s*calc\(var\(--spacing-12\) \* 3\)/s)
    expect(css).toMatch(/\.json-columnValue\s*\{[^}]*text-overflow:\s*ellipsis/s)
  })

  it('uses an emphasized token for tree guide lines', () => {
    expect(css).toMatch(/\.json-treeGuides\s*\{[^}]*--json-tree-guide-color:\s*var\(--color-border-emphasized\)/s)
    expect(css).toMatch(/\.json-treeGuides\[data-has-guides='true'\]::after\s*\{[^}]*var\(--json-tree-guide-color\)/s)
  })

  it('matches the Item selected treatment in tree and source rows', () => {
    expect(css).toMatch(
      /\.json-treeRow\[data-selected='true'\]\s*\{[^}]*background-color:\s*var\(--color-accent-muted\)/s,
    )
    expect(css).toMatch(
      /\.json-sourceRow\[data-selected='true'\]\s*\{[^}]*background-color:\s*var\(--color-accent-muted\)/s,
    )
    expect(css).toMatch(/\.json-treeRow\s*\{[^}]*border-radius:\s*var\(--radius-element\)/s)
    expect(css).toMatch(/\.json-sourceRow\s*\{[^}]*border-radius:\s*var\(--radius-element\)/s)
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

  it('keeps source layout token-based and typography semantic', () => {
    expect(css).toContain('.json-sourceRow')
    expect(css).toContain('.json-sourceGuides')
    expect(css).toContain('var(--json-source-guide-width)')
    expect(css).not.toMatch(
      /\.json-sourceToken-[^{]+\{[^}]*(?:font-family|font-size|font-weight|line-height)/s,
    )
    expect(css).not.toMatch(
      /\.json-sourceSummary\s*\{[^}]*(?:font-family|font-size|font-weight|line-height)/s,
    )
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })
})
