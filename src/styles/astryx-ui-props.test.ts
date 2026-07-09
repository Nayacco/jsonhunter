import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const roots = ['src/app', 'src/features']

function collectTsxFiles(path: string): string[] {
  return readdirSync(path).flatMap((entry) => {
    const fullPath = join(path, entry)
    if (statSync(fullPath).isDirectory()) return collectTsxFiles(fullPath)
    return fullPath.endsWith('.tsx') && !fullPath.includes('.test.') ? [fullPath] : []
  })
}

const appSource = roots
  .flatMap(collectTsxFiles)
  .map((filePath) => readFileSync(filePath, 'utf8'))
  .join('\n')

describe('Astryx UI props', () => {
  it('lets layout containers use their Astryx defaults', () => {
    expect(appSource).not.toMatch(/<Section\b[^>]*(variant=|padding=|height=)/)
    expect(appSource).not.toMatch(/<AstryxAppShell\b[^>]*(contentPadding=|variant=|height=)/)
    expect(appSource).not.toMatch(/<Toolbar\b[^>]*variant="transparent"/)
    expect(appSource).not.toMatch(/<TabList\b[^>]*size=/)
  })

  it('does not hard-code detail metadata presentation', () => {
    expect(appSource).not.toMatch(/label=\{\{[^}]*width:/)
    expect(appSource).not.toMatch(/<Token\b[^>]*(size=|color=)/)
  })
})
