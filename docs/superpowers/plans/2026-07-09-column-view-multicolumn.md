# Column View Multicolumn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Finder-style JSON column view where clicking expandable rows appends child columns to the right while ancestor columns remain visible.

**Architecture:** Keep `selectedPath` as the source of truth, add a column-specific derived model in `viewerRows.ts`, and render that model in `ColumnsView` with Astryx components. Tree/table/source keep their existing scoped row-window behavior.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Vite, Astryx Design Core.

---

## File Structure

- Modify `src/features/viewer/viewerRows.ts`: add `ViewerColumn`, `ColumnWindowRequests`, and `deriveColumnViewFromJson`.
- Modify `src/features/viewer/viewerRows.test.ts`: add TDD coverage for multicolumn derivation and bounded windows.
- Modify `src/features/viewer/ColumnsView.tsx`: render multiple Astryx-based columns instead of one scoped row list.
- Modify `src/features/viewer/JsonViewer.tsx`: pass column model and column window callback through.
- Modify `src/features/viewer/JsonViewer.test.tsx`: add React regression coverage for visible ancestor columns.
- Modify `src/app/App.tsx`: derive column view from `displayedValue`, maintain per-column windows, and keep existing `selectedPath` persistence.
- Modify `src/styles/app.css`: add minimal token-based classes for horizontal column layout.

## Task 1: Column View Model

**Files:**
- Modify: `src/features/viewer/viewerRows.ts`
- Test: `src/features/viewer/viewerRows.test.ts`

- [ ] **Step 1: Write failing tests for derived columns**

Add these imports and tests in `src/features/viewer/viewerRows.test.ts`:

```ts
import { deriveColumnViewFromJson, deriveViewerRowsFromJson } from './viewerRows'

it('derives root column when no path is selected', () => {
  const columns = deriveColumnViewFromJson({ data: [{ id: 1 }], includes: { users: [] } }, [])

  expect(columns).toHaveLength(1)
  expect(columns[0]).toMatchObject({
    title: 'root',
    path: [],
    selectedChildPath: undefined,
  })
  expect(columns[0].rows.rows.map((row) => row.label)).toEqual(['data', 'includes'])
})

it('derives one column per expandable selected ancestor', () => {
  const rawValue = {
    data: [
      {
        id: '121',
        entities: {
          annotations: [{ normalized_text: 'Twitter' }],
        },
      },
    ],
  }

  const columns = deriveColumnViewFromJson(rawValue, ['data', 0, 'entities', 'annotations', 0])

  expect(columns.map((column) => column.title)).toEqual(['root', 'data', 'Index 0', 'entities', 'annotations'])
  expect(columns.map((column) => column.selectedChildPath)).toEqual([
    ['data'],
    ['data', 0],
    ['data', 0, 'entities'],
    ['data', 0, 'entities', 'annotations'],
    ['data', 0, 'entities', 'annotations', 0],
  ])
  expect(columns[2].rows.rows.map((row) => row.label)).toContain('entities')
  expect(columns[4].rows.rows[0]).toMatchObject({
    label: '0',
    path: ['data', 0, 'entities', 'annotations', 0],
  })
})

it('does not add an empty column for a primitive selected leaf', () => {
  const rawValue = { data: [{ id: '121', text: 'hello' }] }

  const columns = deriveColumnViewFromJson(rawValue, ['data', 0, 'text'])

  expect(columns.map((column) => column.title)).toEqual(['root', 'data', 'Index 0'])
  expect(columns[2].selectedChildPath).toEqual(['data', 0, 'text'])
})

it('keeps column windows bounded by path', () => {
  const guarded = new Array(5000)
  guarded[0] = { name: 'loaded-0' }
  guarded[8] = { name: 'loaded-8' }
  Object.defineProperty(guarded, 4999, {
    configurable: true,
    enumerable: true,
    get() {
      throw new Error('out-of-window entry should not be read')
    },
  })

  const columns = deriveColumnViewFromJson(guarded, [8], {
    root: { startIndex: 8, count: 1 },
  })

  expect(columns[0].rows.totalCount).toBe(5000)
  expect(columns[0].rows.startIndex).toBe(8)
  expect(columns[0].rows.rows).toHaveLength(1)
  expect(columns[0].rows.rows[0]).toMatchObject({
    label: '8',
    path: [8],
  })
})
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- src/features/viewer/viewerRows.test.ts
```

Expected: FAIL because `deriveColumnViewFromJson` is not exported.

- [ ] **Step 3: Implement minimal column derivation**

In `src/features/viewer/viewerRows.ts`, export these types and helpers:

```ts
export type ViewerColumn = {
  id: string
  title: string
  path: JsonPath
  rows: ViewerRowWindow
  selectedChildPath?: JsonPath
}

export type ColumnWindowRequests = Record<string, ViewerWindowRequest | undefined>
```

Add `deriveColumnViewFromJson(rawValue, selectedPath, windows = {})`, using the existing `createColumnsWindow`, `getAtPath`, `formatPath`, and `appendPath` helpers. Use column id `root` for path `[]`; otherwise use `formatPath(path)`. Use title `root` for `[]`, `Index N` for numeric final segments, and the final string key for object paths. Add a column only when the value at that column path is expandable.

- [ ] **Step 4: Run model tests and verify GREEN**

Run:

```bash
npm test -- src/features/viewer/viewerRows.test.ts
```

Expected: PASS.

## Task 2: Astryx Multicolumn UI

**Files:**
- Modify: `src/features/viewer/ColumnsView.tsx`
- Modify: `src/features/viewer/JsonViewer.tsx`
- Modify: `src/features/viewer/JsonViewer.test.tsx`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Write failing React regression tests**

In `src/features/viewer/JsonViewer.test.tsx`, add a test that renders `JsonViewer` in column mode with a pre-derived column model:

```tsx
it('renders ancestor and child columns together in columns mode', () => {
  renderWithProviders(
    <JsonViewer
      mode="columns"
      selectedPath={['data', 0, 'entities']}
      breadcrumb="root.data[0].entities"
      columnView={[
        {
          id: 'root',
          title: 'root',
          path: [],
          selectedChildPath: ['data'],
          rows: { startIndex: 0, totalCount: 1, rows: [{ label: 'data', value: '1 item', path: ['data'] }] },
        },
        {
          id: 'data',
          title: 'data',
          path: ['data'],
          selectedChildPath: ['data', 0],
          rows: { startIndex: 0, totalCount: 1, rows: [{ label: '0', value: '{entities}', path: ['data', 0] }] },
        },
        {
          id: 'data[0]',
          title: 'Index 0',
          path: ['data', 0],
          selectedChildPath: ['data', 0, 'entities'],
          rows: {
            startIndex: 0,
            totalCount: 2,
            rows: [
              { label: 'id', value: '"121"', path: ['data', 0, 'id'] },
              { label: 'entities', value: '1 field', path: ['data', 0, 'entities'] },
            ],
          },
        },
      ]}
      onModeChange={() => {}}
      onSelectPath={() => {}}
    />,
  )

  expect(screen.getByRole('region', { name: 'Columns view' })).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'root column' })).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'data column' })).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Index 0 column' })).toBeInTheDocument()
  expect(screen.getByText('Selected: data.0.entities')).toBeInTheDocument()
  expect(screen.getByText('entities')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
npm test -- src/features/viewer/JsonViewer.test.tsx
```

Expected: FAIL because `JsonViewer` does not accept `columnView` and `ColumnsView` still expects one `rows` window.

- [ ] **Step 3: Implement Astryx multicolumn rendering**

Update `ColumnsViewProps` to accept:

```ts
columns: ViewerColumn[]
onColumnWindowChange?(path: JsonPath, window: { startIndex: number; count: number }): void
```

Render a `Section` containing `VStack`, header `HStack`, selected text, and an `HStack` with class `json-columnBrowser`. For each `ViewerColumn`, render a `VStack as="section"` with `role="group"` and `aria-label={`${column.title} column`}`. Use `Heading`, `Text`, `EmptyState`, `VirtualRows`, and `Item`. Mark selected rows with `isSelected` if supported by `Item`; otherwise use `className="json-columnRowSelected"` and token CSS.

- [ ] **Step 4: Add minimal token CSS**

In `src/styles/app.css`, add only token-based layout classes:

```css
.json-columnBrowser {
  overflow-x: auto;
  align-items: stretch;
}

.json-columnPanel {
  min-width: var(--size-72);
  max-width: var(--size-80);
  border-right: var(--border-width-sm) solid var(--color-border);
}

.json-columnRows {
  min-height: var(--size-96);
}

.json-columnRowSelected {
  background: var(--color-surface-selected);
}
```

If a token name does not exist, replace it with an existing Astryx token from `npx astryx docs tokens`.

- [ ] **Step 5: Run React tests and verify GREEN**

Run:

```bash
npm test -- src/features/viewer/JsonViewer.test.tsx
```

Expected: PASS.

## Task 3: App Wiring and Verification

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/features/viewer/JsonViewer.tsx`
- Test: `src/features/viewer/JsonViewer.test.tsx`

- [ ] **Step 1: Wire column model into App**

In `App.tsx`, import `deriveColumnViewFromJson` and `type ColumnWindowRequests`. Add:

```ts
const [columnWindows, setColumnWindows] = useState<ColumnWindowRequests>({})
```

Clear it when `displayedSourceNodeId` changes. Derive:

```ts
const columnView = useMemo(
  () => (displayedValue === undefined ? undefined : deriveColumnViewFromJson(displayedValue, selectedPath, columnWindows)),
  [columnWindows, displayedValue, selectedPath],
)
```

Pass `columnView` to `JsonViewer`. Add `handleColumnWindowChange(path, window)` that keys by root or `formatPath(path)`.

- [ ] **Step 2: Preserve existing viewer windows**

Keep the existing `viewerWindows` state for tree/table/source. Do not use scoped `viewerRows.columns` in `JsonViewer` when `mode === 'columns'`.

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm test -- src/features/viewer/viewerRows.test.ts src/features/viewer/JsonViewer.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Inspect diff**

Run:

```bash
git diff -- src/features/viewer/viewerRows.ts src/features/viewer/ColumnsView.tsx src/features/viewer/JsonViewer.tsx src/features/viewer/JsonViewer.test.tsx src/app/App.tsx src/styles/app.css
```

Expected: changes are scoped to the multicolumn view, tests, and token CSS.
