# Source JSON Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a structured, readonly source JSON viewer with syntax-colored tokens, indentation guides, collapsible branches, and path selection.

**Architecture:** Keep source mode on the existing `ViewerRowWindow` and `VirtualRows` path instead of adding Monaco. `viewerRows.ts` will emit source-specific metadata alongside the existing `label`, and `SourceView.tsx` will render that metadata with local collapse state. CSS stays in `src/styles/app.css` using Astryx tokens.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Astryx components, `@tanstack/react-virtual`.

## Global Constraints

- Use a custom readonly JSON viewer for the default `source` mode instead of Monaco.
- The source view remains a JSON browser, not an editor.
- The source view shows the full displayed JSON, not only the currently selected path.
- Clicking a source row updates `selectedPath` and the breadcrumb/details panel.
- Object and array opening rows have disclosure controls.
- Collapsing a branch hides descendant rows while keeping sibling rows visible.
- Indentation guide rails show nesting depth.
- Keys, strings, numbers, booleans, null, punctuation, and commas are visually distinguishable.
- Use Astryx components for structure and controls, especially `Section`, `HStack`, `VStack`, `Heading`, `Text`, `Icon`, `IconButton`, `Button`, and `EmptyState`.
- Do not add raw layout `<div>` wrappers in app feature code.
- Dense source lines stay edge-to-edge in the scroll area.
- Use Astryx tokens for custom CSS: `var(--color-*)`, `var(--spacing-*)`, `var(--radius-*)`, and size tokens.
- Do not use raw hex colors, raw pixel values, Tailwind utilities, or a new custom design system.

---

## File Structure

- Modify `src/features/viewer/viewerRows.ts`
  - Extend `ViewerRow` with optional source-specific metadata.
  - Keep `label` as the accessible plain-text JSON line.
  - Emit `depth`, `hasChildren`, and token metadata for source rows.

- Modify `src/features/viewer/viewerRows.test.ts`
  - Add tests for source row metadata and preserve the existing pretty JSON label test.

- Modify `src/features/viewer/SourceView.tsx`
  - Replace plain `Item` source rows with compact tokenized rows.
  - Add local collapse state keyed by JSON path.
  - Reuse `VirtualRows` and the existing reset action.

- Modify `src/features/viewer/JsonViewer.test.tsx`
  - Add React tests for source disclosures, collapse behavior, click selection, and guide metadata.

- Modify `src/styles/app.css`
  - Add `.json-source*` classes for source rows, tokens, disclosure spacer, and guide rails.
  - Keep existing `.virtualScroll` behavior.

---

### Task 1: Source Row Metadata

**Files:**
- Modify: `src/features/viewer/viewerRows.ts`
- Test: `src/features/viewer/viewerRows.test.ts`

**Interfaces:**
- Consumes: `JsonPath`, `JsonValue`, `appendPath`, `deriveViewerRowsFromJson`.
- Produces:
  - `export type SourceTokenKind = 'punctuation' | 'key' | 'string' | 'number' | 'boolean' | 'null'`
  - `export type SourceRowKind = 'object-open' | 'array-open' | 'property' | 'primitive' | 'close'`
  - `export type SourceToken = { kind: SourceTokenKind; text: string }`
  - `ViewerRow['source']?: { kind: SourceRowKind; tokens: SourceToken[] }`

- [ ] **Step 1: Write failing unit tests for source metadata**

Add this test after the existing `renders source rows as fully expanded pretty JSON` test in `src/features/viewer/viewerRows.test.ts`:

```ts
  it('derives token metadata for structured source rows', () => {
    const rawValue = {
      data: [{ active: false, score: 0.02, note: null }],
      meta: 'fixture',
    }

    const rows = deriveViewerRowsFromJson(rawValue, [], {
      source: { startIndex: 0, count: 16 },
    }).source.rows

    expect(rows[0]).toMatchObject({
      label: '{',
      path: [],
      depth: 0,
      hasChildren: true,
      source: {
        kind: 'object-open',
        tokens: [{ kind: 'punctuation', text: '{' }],
      },
    })
    expect(rows[1]).toMatchObject({
      label: '  "data": [',
      path: ['data'],
      depth: 1,
      hasChildren: true,
      source: {
        kind: 'array-open',
        tokens: [
          { kind: 'key', text: '"data"' },
          { kind: 'punctuation', text: ': ' },
          { kind: 'punctuation', text: '[' },
        ],
      },
    })
    expect(rows.find((row) => row.label.includes('"active": false'))).toMatchObject({
      path: ['data', 0, 'active'],
      depth: 3,
      hasChildren: false,
      source: {
        kind: 'property',
        tokens: [
          { kind: 'key', text: '"active"' },
          { kind: 'punctuation', text: ': ' },
          { kind: 'boolean', text: 'false' },
          { kind: 'punctuation', text: ',' },
        ],
      },
    })
    expect(rows.find((row) => row.label.includes('"score": 0.02'))?.source?.tokens).toContainEqual({
      kind: 'number',
      text: '0.02',
    })
    expect(rows.find((row) => row.label.includes('"note": null'))?.source?.tokens).toContainEqual({
      kind: 'null',
      text: 'null',
    })
    expect(rows.at(-1)).toMatchObject({
      label: '}',
      path: [],
      depth: 0,
      hasChildren: false,
      source: {
        kind: 'close',
        tokens: [{ kind: 'punctuation', text: '}' }],
      },
    })
  })
```

- [ ] **Step 2: Run the metadata test and verify it fails**

Run:

```bash
npm test -- src/features/viewer/viewerRows.test.ts -t "derives token metadata for structured source rows"
```

Expected: FAIL because source rows do not yet include `depth`, `hasChildren`, or `source.tokens`.

- [ ] **Step 3: Extend the source row types**

In `src/features/viewer/viewerRows.ts`, replace the current `ViewerRow` type block with:

```ts
export type SourceTokenKind = 'punctuation' | 'key' | 'string' | 'number' | 'boolean' | 'null'

export type SourceRowKind = 'object-open' | 'array-open' | 'property' | 'primitive' | 'close'

export type SourceToken = {
  kind: SourceTokenKind
  text: string
}

export type SourceRowMetadata = {
  kind: SourceRowKind
  tokens: SourceToken[]
}

export type ViewerRow = {
  label: string
  path: JsonPath
  value?: string
  depth?: number
  hasChildren?: boolean
  source?: SourceRowMetadata
}
```

- [ ] **Step 4: Add token helpers**

Add these helpers above `appendSourceValueRows` in `src/features/viewer/viewerRows.ts`:

```ts
function createPunctuationToken(text: string): SourceToken {
  return { kind: 'punctuation', text }
}

function createPrimitiveSourceToken(value: JsonValue): SourceToken {
  if (typeof value === 'string') return { kind: 'string', text: JSON.stringify(value) }
  if (typeof value === 'number') return { kind: 'number', text: JSON.stringify(value) }
  if (typeof value === 'boolean') return { kind: 'boolean', text: JSON.stringify(value) }
  return { kind: 'null', text: 'null' }
}

function createTrailingCommaTokens(hasTrailingComma: boolean): SourceToken[] {
  return hasTrailingComma ? [createPunctuationToken(',')] : []
}

function createSourceLabel(depth: number, tokens: SourceToken[]) {
  return `${'  '.repeat(depth)}${tokens.map((token) => token.text).join('')}`
}
```

- [ ] **Step 5: Replace source row emission with tokenized metadata**

Replace `appendSourceValueRows` and add the complete `appendSourcePropertyRows` and `appendSourceArrayRows` implementations:

```ts
function appendSourceValueRows(
  context: SourceRowContext,
  value: JsonValue,
  path: JsonPath,
  depth: number,
  hasTrailingComma: boolean,
) {
  if (Array.isArray(value)) {
    appendSourceArrayRows(context, value, path, depth, hasTrailingComma, [createPunctuationToken('[')])
    return
  }

  if (value && typeof value === 'object') {
    const tokens = [createPunctuationToken('{')]
    const entries = Object.entries(value)
    context.emit({
      label: createSourceLabel(depth, tokens),
      path,
      depth,
      hasChildren: entries.length > 0,
      source: { kind: 'object-open', tokens },
    })
    entries.forEach(([key, entry], index) => {
      appendSourcePropertyRows(context, key, entry, appendPath(path, key), depth + 1, index < entries.length - 1)
    })
    const closeTokens = [createPunctuationToken('}'), ...createTrailingCommaTokens(hasTrailingComma)]
    context.emit({
      label: createSourceLabel(depth, closeTokens),
      path,
      depth,
      hasChildren: false,
      source: { kind: 'close', tokens: closeTokens },
    })
    return
  }

  const tokens = [createPrimitiveSourceToken(value), ...createTrailingCommaTokens(hasTrailingComma)]
  context.emit({
    label: createSourceLabel(depth, tokens),
    path,
    depth,
    hasChildren: false,
    source: { kind: 'primitive', tokens },
  })
}

function appendSourcePropertyRows(
  context: SourceRowContext,
  key: string,
  value: JsonValue,
  path: JsonPath,
  depth: number,
  hasTrailingComma: boolean,
) {
  const keyTokens: SourceToken[] = [
    { kind: 'key', text: JSON.stringify(key) },
    createPunctuationToken(': '),
  ]

  if (Array.isArray(value)) {
    appendSourceArrayRows(context, value, path, depth, hasTrailingComma, [
      ...keyTokens,
      createPunctuationToken('['),
    ])
    return
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    const tokens = [...keyTokens, createPunctuationToken('{')]
    context.emit({
      label: createSourceLabel(depth, tokens),
      path,
      depth,
      hasChildren: entries.length > 0,
      source: { kind: 'object-open', tokens },
    })
    entries.forEach(([entryKey, entryValue], index) => {
      appendSourcePropertyRows(
        context,
        entryKey,
        entryValue,
        appendPath(path, entryKey),
        depth + 1,
        index < entries.length - 1,
      )
    })
    const closeTokens = [createPunctuationToken('}'), ...createTrailingCommaTokens(hasTrailingComma)]
    context.emit({
      label: createSourceLabel(depth, closeTokens),
      path,
      depth,
      hasChildren: false,
      source: { kind: 'close', tokens: closeTokens },
    })
    return
  }

  const tokens = [...keyTokens, createPrimitiveSourceToken(value), ...createTrailingCommaTokens(hasTrailingComma)]
  context.emit({
    label: createSourceLabel(depth, tokens),
    path,
    depth,
    hasChildren: false,
    source: { kind: 'property', tokens },
  })
}

function appendSourceArrayRows(
  context: SourceRowContext,
  value: JsonValue[],
  path: JsonPath,
  depth: number,
  hasTrailingComma: boolean,
  openTokens: SourceToken[],
) {
  context.emit({
    label: createSourceLabel(depth, openTokens),
    path,
    depth,
    hasChildren: value.length > 0,
    source: { kind: 'array-open', tokens: openTokens },
  })
  value.forEach((entry, index) => {
    appendSourceValueRows(context, entry, appendPath(path, index), depth + 1, index < value.length - 1)
  })
  const closeTokens = [createPunctuationToken(']'), ...createTrailingCommaTokens(hasTrailingComma)]
  context.emit({
    label: createSourceLabel(depth, closeTokens),
    path,
    depth,
    hasChildren: false,
    source: { kind: 'close', tokens: closeTokens },
  })
}
```

Before applying this code, remove the existing older `appendSourcePropertyRows` and `appendSourceArrayRows` definitions below `appendSourceValueRows` so the file has one implementation of each function.

- [ ] **Step 6: Run source row tests**

Run:

```bash
npm test -- src/features/viewer/viewerRows.test.ts
```

Expected: PASS. The existing `renders source rows as fully expanded pretty JSON` test must still pass with the same `label` strings.

- [ ] **Step 7: Commit source metadata**

```bash
git add src/features/viewer/viewerRows.ts src/features/viewer/viewerRows.test.ts
git commit -m "feat(source): derive tokenized JSON rows"
```

---

### Task 2: Tokenized SourceView Rendering And Collapse

**Files:**
- Modify: `src/features/viewer/SourceView.tsx`
- Test: `src/features/viewer/JsonViewer.test.tsx`

**Interfaces:**
- Consumes: `ViewerRow.source`, `ViewerRow.depth`, `ViewerRow.hasChildren`, `ViewerRow.path`, `VirtualRows`.
- Produces: `.json-sourceRow`, `.json-sourceGuides`, `.json-sourceToken-*`, `.json-sourceDisclosureSpacer` class usage for Task 3.

- [ ] **Step 1: Run Astryx discovery before UI changes**

Run:

```bash
npx astryx build "readonly JSON source viewer"
```

Expected: command exits successfully and confirms which Astryx primitives fit the layout. Keep using the existing local components if the output does not add a better option.

- [ ] **Step 2: Write failing React tests for collapse and token rendering**

Add these tests after `keeps source view anchored to the full JSON after selecting a row` in `src/features/viewer/JsonViewer.test.tsx`:

```tsx
  it('renders source rows with disclosure controls and token classes', () => {
    const rawValue = {
      data: [{ active: false }],
      meta: 'fixture',
    }

    renderWithProviders(
      <JsonViewer
        mode="source"
        selectedPath={[]}
        rows={deriveViewerRowsFromJson(rawValue, [], { source: { startIndex: 0, count: 24 } })}
        onModeChange={() => {}}
        onSelectPath={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Collapse data' })).toBeInTheDocument()
    expect(screen.getByText('"data"')).toHaveClass('json-sourceToken-key')
    expect(screen.getByText('false')).toHaveClass('json-sourceToken-boolean')

    const activeRow = screen.getByText('"active"').closest('.json-sourceRow')
    const activeGuides = activeRow?.querySelector('.json-sourceGuides')
    expect(activeGuides).toHaveAttribute('data-depth', '3')
  })

  it('collapses source descendants while preserving sibling rows', async () => {
    const user = userEvent.setup()
    const rawValue = {
      data: [{ active: false }],
      meta: 'fixture',
    }

    renderWithProviders(
      <JsonViewer
        mode="source"
        selectedPath={[]}
        rows={deriveViewerRowsFromJson(rawValue, [], { source: { startIndex: 0, count: 24 } })}
        onModeChange={() => {}}
        onSelectPath={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Collapse data' }))

    expect(screen.queryByText('"active"')).not.toBeInTheDocument()
    expect(screen.queryByText(']')).not.toBeInTheDocument()
    expect(screen.getByText('"meta"')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expand data' }))
    expect(screen.getByText('"active"')).toBeInTheDocument()
  })
```

- [ ] **Step 3: Run the React tests and verify they fail**

Run:

```bash
npm test -- src/features/viewer/JsonViewer.test.tsx -t "source"
```

Expected: FAIL because `SourceView` still renders a plain `Item` and has no source disclosure controls or token spans.

- [ ] **Step 4: Replace `SourceView.tsx` with tokenized rendering**

Replace the full contents of `src/features/viewer/SourceView.tsx` with:

```tsx
import { useMemo, useState, type CSSProperties } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Section } from '@astryxdesign/core/Section'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import type { JsonPath } from '../../domain/jsonTypes'
import { VirtualRows } from './VirtualRows'
import { getViewerRow, type SourceToken, type ViewerRow, type ViewerRowWindow } from './viewerRows'

type SourceViewProps = {
  rows: ViewerRowWindow
  onSelectPath(path: JsonPath): void
  onWindowChange?(window: { startIndex: number; count: number }): void
}

function getSourceGuideStyle(depth = 0) {
  const normalizedDepth = Math.max(0, depth)
  const guideWidth =
    normalizedDepth === 0
      ? '0'
      : `calc(${'var(--json-source-indent) + '.repeat(normalizedDepth - 1)}var(--json-source-indent))`

  return {
    '--json-source-depth': normalizedDepth,
    '--json-source-guide-width': guideWidth,
  } as CSSProperties
}

function pathKey(path: JsonPath) {
  return JSON.stringify(path)
}

function hasCollapsedAncestor(path: JsonPath, collapsedPaths: Set<string>) {
  for (let length = 1; length < path.length; length += 1) {
    if (collapsedPaths.has(pathKey(path.slice(0, length)))) return true
  }
  return path.length > 0 && collapsedPaths.has(pathKey([]))
}

function isSourceRowHidden(row: ViewerRow, collapsedPaths: Set<string>) {
  if (row.source?.kind === 'close' && collapsedPaths.has(pathKey(row.path))) return true
  return hasCollapsedAncestor(row.path, collapsedPaths)
}

function renderToken(token: SourceToken, index: number) {
  return (
    <span key={`${token.kind}-${index}-${token.text}`} className={`json-sourceToken-${token.kind}`}>
      {token.text}
    </span>
  )
}

function SourceLine({ row }: { row: ViewerRow }) {
  if (!row.source) {
    return <Text type="code">{row.label}</Text>
  }

  return <Text type="code">{row.source.tokens.map(renderToken)}</Text>
}

export function SourceView({ rows, onSelectPath, onWindowChange }: SourceViewProps) {
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set())
  const canFilterRows = rows.startIndex === 0 && rows.rows.length === rows.totalCount
  const visibleRows = useMemo(
    () => (canFilterRows ? rows.rows.filter((row) => !isSourceRowHidden(row, collapsedPaths)) : rows.rows),
    [canFilterRows, collapsedPaths, rows.rows],
  )
  const visibleCount = canFilterRows ? visibleRows.length : rows.totalCount

  function toggleRow(path: JsonPath) {
    const key = pathKey(path)
    setCollapsedPaths((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <Section>
      <VStack gap={2} as="section" aria-label="Source view">
        <HStack gap={2} align="center" justify="between">
          <Heading level={2}>Source</Heading>
          <Button label="Reset path" size="sm" variant="ghost" onClick={() => onSelectPath([])} />
        </HStack>
        {rows.totalCount === 0 ? (
          <EmptyState title="No rows" description="This view has no rows for the selected JSON path." isCompact />
        ) : (
          <VirtualRows
            count={visibleCount}
            estimateSize={32}
            onWindowChange={(startIndex, count) => onWindowChange?.({ startIndex, count })}
            renderRow={(index) => {
              const row = canFilterRows ? visibleRows[index] : getViewerRow(rows, index)

              if (!row) {
                return <Text type="supporting">Loading row {index + 1}</Text>
              }

              const isCollapsed = collapsedPaths.has(pathKey(row.path))
              const depth = row.depth ?? 0
              const canCollapse = row.hasChildren && (row.source?.kind === 'object-open' || row.source?.kind === 'array-open')
              const collapseLabel = `${isCollapsed ? 'Expand' : 'Collapse'} ${String(row.path.at(-1) ?? 'root')}`

              return (
                <HStack
                  gap={1}
                  align="center"
                  className="json-sourceRow"
                  onClick={() => onSelectPath(row.path)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    onSelectPath(row.path)
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <HStack
                    className="json-sourceGuides"
                    aria-hidden="true"
                    data-depth={depth}
                    data-has-guides={depth > 0 ? 'true' : 'false'}
                    style={getSourceGuideStyle(depth)}
                  />
                  {canCollapse ? (
                    <IconButton
                      label={collapseLabel}
                      tooltip={collapseLabel}
                      icon={<Icon icon={isCollapsed ? 'chevronRight' : 'chevronDown'} size="xsm" />}
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleRow(row.path)
                      }}
                    />
                  ) : (
                    <HStack className="json-sourceDisclosureSpacer" aria-hidden="true" />
                  )}
                  <SourceLine row={row} />
                </HStack>
              )
            }}
          />
        )}
      </VStack>
    </Section>
  )
}
```

- [ ] **Step 5: Run source React tests**

Run:

```bash
npm test -- src/features/viewer/JsonViewer.test.tsx -t "source"
```

Expected: PASS for all source-related tests.

- [ ] **Step 6: Commit source rendering**

```bash
git add src/features/viewer/SourceView.tsx src/features/viewer/JsonViewer.test.tsx
git commit -m "feat(source): render collapsible JSON source"
```

---

### Task 3: Source Viewer Styling And Final Verification

**Files:**
- Modify: `src/styles/app.css`
- Test: `src/styles/app-css.test.ts`

**Interfaces:**
- Consumes: class names emitted by `SourceView`: `.json-sourceRow`, `.json-sourceGuides`, `.json-sourceDisclosureSpacer`, `.json-sourceToken-*`.
- Produces: token-based visual styling for compact source rows.

- [ ] **Step 1: Write failing CSS regression test**

Open `src/styles/app-css.test.ts` and add this test case inside the existing `describe('app.css', () => { ... })` block:

```ts
it('defines source viewer styles with design tokens', () => {
  expect(css).toContain('.json-sourceRow')
  expect(css).toContain('.json-sourceGuides')
  expect(css).toContain('.json-sourceToken-key')
  expect(css).toContain('var(--json-source-guide-width)')
  expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/)
})
```

- [ ] **Step 2: Run the CSS test and verify it fails**

Run:

```bash
npm test -- src/styles/app-css.test.ts
```

Expected: FAIL because `.json-sourceRow` and source token classes are not in `app.css`.

- [ ] **Step 3: Add source styles using Astryx tokens**

Append this CSS after the existing `.json-treeDisclosureSpacer` block in `src/styles/app.css`:

```css
.json-sourceRow {
  min-height: var(--size-element-md);
  padding-inline-end: var(--spacing-2);
  color: var(--color-text-primary);
}

.json-sourceGuides {
  --json-source-indent: calc(var(--size-element-sm) / 2 + var(--spacing-1));
  --json-source-guide-color: var(--color-border-emphasized);
  --json-source-guide-gap: var(--spacing-2);

  align-self: stretch;
  flex: 0 0 var(--json-source-guide-width);
  min-width: 0;
  min-height: var(--size-element-md);
  position: relative;
}

.json-sourceGuides::before {
  content: '';
  position: absolute;
  inset-block: var(--json-source-guide-gap);
  inset-inline: 0;
  background-image: linear-gradient(
    to right,
    transparent 0,
    transparent calc(100% - var(--border-width)),
    var(--json-source-guide-color) calc(100% - var(--border-width)),
    var(--json-source-guide-color) 100%
  );
  background-repeat: repeat-x;
  background-size: var(--json-source-indent) 100%;
}

.json-sourceGuides[data-depth='0'] {
  display: none;
}

.json-sourceDisclosureSpacer {
  flex: 0 0 var(--size-element-sm);
  width: var(--size-element-sm);
}

.json-sourceToken-key {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
}

.json-sourceToken-string {
  color: var(--color-text-orange);
}

.json-sourceToken-number {
  color: var(--color-text-cyan);
}

.json-sourceToken-boolean,
.json-sourceToken-null {
  color: var(--color-text-blue);
  font-weight: var(--font-weight-semibold);
}

.json-sourceToken-punctuation {
  color: var(--color-text-secondary);
}
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npm test -- src/styles/app-css.test.ts src/features/viewer/viewerRows.test.ts src/features/viewer/JsonViewer.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm run typecheck
npm test
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit styling and verification fixes**

```bash
git add src/styles/app.css src/styles/app-css.test.ts
git commit -m "style(source): polish JSON source viewer"
```

---

## Execution Notes

- Keep Monaco unchanged in `src/features/pipeline/NodeEditor.tsx`.
- Keep `SourceView` readonly. Do not add editing actions, contentEditable, or Monaco in source mode.
- Preserve existing source `label` strings so accessible button names and current tests keep working.
- Follow the existing `TreeView` pattern with `HStack role="button"` and keyboard handling for row activation.
- Use the color tokens listed in Task 3; do not substitute raw colors.
