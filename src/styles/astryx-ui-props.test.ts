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

const sourceFiles = roots.flatMap(collectTsxFiles)
const projectPageFiles = new Set([
  join('src', 'features', 'projects', 'ProjectPageShell.tsx'),
  join('src', 'features', 'projects', 'ImportLandingPage.tsx'),
  join('src', 'features', 'projects', 'ProjectRestorePage.tsx'),
  join('src', 'features', 'projects', 'ProjectLoadingPage.tsx'),
])
const appSource = sourceFiles.map((filePath) => readFileSync(filePath, 'utf8')).join('\n')
const defaultLayoutSource = sourceFiles
  .filter((filePath) => !projectPageFiles.has(filePath))
  .map((filePath) => readFileSync(filePath, 'utf8'))
  .join('\n')
const projectPageSource = sourceFiles
  .filter((filePath) => projectPageFiles.has(filePath))
  .map((filePath) => readFileSync(filePath, 'utf8'))
  .join('\n')

describe('Astryx UI props', () => {
  it('lets layout containers use their Astryx defaults', () => {
    expect(defaultLayoutSource).not.toMatch(/<Section\b[^>]*(variant=|padding=|height=)/)
    expect(defaultLayoutSource).not.toMatch(/<AstryxAppShell\b[^>]*(contentPadding=|variant=|height=)/)
    expect(defaultLayoutSource).not.toMatch(/<Toolbar\b[^>]*variant="transparent"/)
    expect(defaultLayoutSource).not.toMatch(/<TabList\b[^>]*size=/)
  })

  it('uses Astryx primitives for the full-page project launcher', () => {
    expect(projectPageSource).not.toMatch(/<div\b/)
    expect(projectPageSource).toContain('height={height}')
    expect(projectPageSource).toContain("columns={{ minWidth: 280, max: 3, repeat: 'fit' }}")
  })

  it('does not hard-code detail metadata presentation', () => {
    expect(appSource).not.toMatch(/label=\{\{[^}]*width:/)
    expect(appSource).not.toMatch(/<Token\b[^>]*(size=|color=)/)
  })
})
