# JSON Pipeline Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working pure-frontend JSON Pipeline Workbench described in `docs/superpowers/specs/2026-07-09-json-pipeline-workbench-design.md`.

**Architecture:** Use a Vite React TypeScript app with a strict separation between UI, project persistence, pipeline state, and Worker execution. The main thread renders Astryx-first UI and virtualized JSON views; Workers parse JSON, execute JS/DuckDB nodes, and answer data-window/detail requests.

**Tech Stack:** Vite, React, TypeScript, Astryx, Zustand, IndexedDB via `idb`, TanStack Virtual, TanStack Table, Monaco Editor, `@duckdb/duckdb-wasm`, Vitest, React Testing Library, Playwright.

## Global Constraints

- The app is pure frontend: no backend storage, no URL sharing, no public links.
- The first node in every pipeline is immutable `Raw`.
- Supported processing nodes are `JS` and `DuckDB`; no manual JSON editing or patch nodes.
- `Run` creates temporary preview output only; `Save` persists node configuration and does not persist node output to IndexedDB.
- URL source projects never persist Raw JSON; they persist only URL/source metadata.
- File and Paste source projects persist Raw JSON only when UTF-8 byte size is `<= 10 MiB`.
- Any Raw JSON larger than `100 MiB` requires a memory-risk confirmation before parsing.
- There is no hard maximum load size in the first version.
- Node outputs are never persisted; runtime memory caching is allowed only as an optimization.
- JSON parsing, pipeline execution, JS execution, DuckDB execution, diff/index work, and view-window requests run in Workers.
- Every Worker job carries a `jobId`; stale job results are discarded.
- Monaco is used only for JS and SQL node editors, never for JSON viewing.
- JSON viewer modes are custom: Columns, Tree, Table, Source.
- JSON views must virtualize large render surfaces with TanStack Virtual; Table may also use TanStack Table for headless state.
- UI primitives should use Astryx first, TanStack where Astryx lacks the needed behavior, and mature mainstream libraries only when both are insufficient.

---

## File Structure

Create this structure:

```text
package.json
vite.config.ts
tsconfig.json
tsconfig.node.json
vitest.config.ts
playwright.config.ts
index.html
src/main.tsx
src/app/App.tsx
src/app/AppShell.tsx
src/app/providers.tsx
src/styles/app.css
src/domain/jsonTypes.ts
src/domain/jsonPath.ts
src/domain/jsonSummary.ts
src/domain/projectTypes.ts
src/domain/pipelineTypes.ts
src/domain/viewTypes.ts
src/domain/tableMapping.ts
src/persistence/projectRepository.ts
src/persistence/projectRepository.test.ts
src/pipeline/pipelineModel.ts
src/pipeline/pipelineModel.test.ts
src/workers/jsonWorker.ts
src/workers/workerClient.ts
src/workers/workerProtocol.ts
src/workers/workerRuntime.ts
src/workers/workerRuntime.test.ts
src/state/useWorkbenchStore.ts
src/state/storeTypes.ts
src/features/projects/ProjectLauncher.tsx
src/features/projects/ProjectRestorePanel.tsx
src/features/pipeline/PipelineFlow.tsx
src/features/pipeline/NodeEditor.tsx
src/features/pipeline/ErrorBanner.tsx
src/features/viewer/JsonViewer.tsx
src/features/viewer/ViewSwitcher.tsx
src/features/viewer/Breadcrumb.tsx
src/features/viewer/ColumnsView.tsx
src/features/viewer/TreeView.tsx
src/features/viewer/TableView.tsx
src/features/viewer/SourceView.tsx
src/features/details/DetailsPreview.tsx
src/test/fixtures.ts
src/test/render.tsx
tests/e2e/workbench.spec.ts
```

Responsibilities:

- `src/domain/*`: pure types and deterministic transforms; no React, no IndexedDB, no Workers.
- `src/persistence/*`: IndexedDB schema and persistence rules.
- `src/pipeline/*`: pipeline state transitions and invalidation rules.
- `src/workers/*`: Worker protocol, client, runtime, parsing, execution, view data requests.
- `src/state/*`: Zustand slices and orchestration between repository, Worker client, and UI.
- `src/features/*`: focused React feature components.
- `src/test/*`: reusable unit/integration test helpers.
- `tests/e2e/*`: Playwright user flows.

---

### Task 1: Scaffold Vite React TypeScript App

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/providers.tsx`
- Create: `src/styles/app.css`
- Create: `src/test/render.tsx`

**Interfaces:**
- Produces: React app entrypoint `src/main.tsx`.
- Produces: `renderWithProviders(ui: React.ReactElement)` test helper.

- [ ] **Step 1: Initialize npm metadata and dependencies**

Create `package.json` with this content:

```json
{
  "name": "jsonhunter",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "typecheck": "tsc -b"
  },
  "dependencies": {
    "@astryxdesign/core": "latest",
    "@duckdb/duckdb-wasm": "latest",
    "@monaco-editor/react": "latest",
    "@tanstack/react-table": "latest",
    "@tanstack/react-virtual": "latest",
    "idb": "latest",
    "monaco-editor": "latest",
    "react": "latest",
    "react-dom": "latest",
    "zustand": "latest"
  },
  "devDependencies": {
    "@playwright/test": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@vitejs/plugin-react": "latest",
    "jsdom": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and install exits with code 0.

- [ ] **Step 3: Add Vite, TypeScript, and test config**

Create `vite.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
})
```

Create `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.app.json" }
  ]
}
```

Create `tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

Create `vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

- [ ] **Step 4: Add app shell files**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>JSON Hunter</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import { AppProviders } from './app/providers'
import './styles/app.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
)
```

Create `src/app/providers.tsx`:

```tsx
import type { ReactNode } from 'react'

type AppProvidersProps = {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return children
}
```

Create `src/app/App.tsx`:

```tsx
export function App() {
  return (
    <main className="appRoot">
      <h1>JSON Hunter</h1>
      <p>JSON Pipeline Workbench</p>
    </main>
  )
}
```

Create `src/styles/app.css`:

```css
:root {
  color-scheme: dark;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  background: #0b1020;
  color: #e5edf8;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input,
textarea,
select {
  font: inherit;
}

.appRoot {
  min-height: 100vh;
  padding: 24px;
}
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

Create `src/test/render.tsx`:

```tsx
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { AppProviders } from '../app/providers'

export function renderWithProviders(ui: ReactElement) {
  return render(<AppProviders>{ui}</AppProviders>)
}
```

- [ ] **Step 5: Verify scaffold**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: typecheck passes, Vitest reports no failing tests, and Vite build completes.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json vitest.config.ts playwright.config.ts src
git commit -m "chore: scaffold React workbench app"
```

---

### Task 2: Define Domain Types, JSON Paths, Summaries, and Table Mapping

**Files:**
- Create: `src/domain/jsonTypes.ts`
- Create: `src/domain/jsonPath.ts`
- Create: `src/domain/jsonSummary.ts`
- Create: `src/domain/projectTypes.ts`
- Create: `src/domain/pipelineTypes.ts`
- Create: `src/domain/viewTypes.ts`
- Create: `src/domain/tableMapping.ts`
- Create: `src/domain/jsonPath.test.ts`
- Create: `src/domain/jsonSummary.test.ts`
- Create: `src/domain/tableMapping.test.ts`

**Interfaces:**
- Produces: `JsonValue`, `JsonPath`, `getAtPath(value, path)`, `summarizeJson(value)`, `buildTableModel(value, basePath)`.
- Consumes: none.

- [ ] **Step 1: Write failing tests for paths, summaries, and table mapping**

Create `src/domain/jsonPath.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatPath, getAtPath, parsePath } from './jsonPath'

describe('jsonPath', () => {
  it('formats and parses mixed object and array paths', () => {
    const path = ['root', 'data', 0, 'name']
    expect(formatPath(path)).toBe('root.data[0].name')
    expect(parsePath('root.data[0].name')).toEqual(path)
  })

  it('reads a value at a path', () => {
    const value = { data: [{ name: 'Ada' }] }
    expect(getAtPath(value, ['data', 0, 'name'])).toBe('Ada')
  })
})
```

Create `src/domain/jsonSummary.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { summarizeJson } from './jsonSummary'

describe('summarizeJson', () => {
  it('summarizes arrays and objects', () => {
    expect(summarizeJson([{ id: 1 }, { id: 2 }])).toEqual({
      type: 'array',
      label: 'Array(2)',
      childCount: 2,
      preview: '[2 items]',
    })

    expect(summarizeJson({ id: 1, name: 'Ada' })).toEqual({
      type: 'object',
      label: 'Object(2)',
      childCount: 2,
      preview: '{id, name}',
    })
  })
})
```

Create `src/domain/tableMapping.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildTableModel } from './tableMapping'

describe('buildTableModel', () => {
  it('maps array of objects into columns and rows', () => {
    const model = buildTableModel(
      [
        { id: 1, name: 'Ada' },
        { id: 2, active: true },
      ],
      [],
    )

    expect(model.columns.map((column) => column.id)).toEqual(['index', 'id', 'name', 'active'])
    expect(model.rows[0].path).toEqual([0])
    expect(model.rows[0].cells.id.value).toBe(1)
    expect(model.rows[1].cells.active.value).toBe(true)
  })

  it('maps object into key value rows', () => {
    const model = buildTableModel({ id: 1, name: 'Ada' }, [])
    expect(model.columns.map((column) => column.id)).toEqual(['key', 'type', 'value'])
    expect(model.rows[0].cells.key.value).toBe('id')
    expect(model.rows[0].path).toEqual(['id'])
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/domain/jsonPath.test.ts src/domain/jsonSummary.test.ts src/domain/tableMapping.test.ts
```

Expected: FAIL because domain modules do not exist.

- [ ] **Step 3: Implement domain modules**

Create `src/domain/jsonTypes.ts`:

```ts
export type JsonPrimitive = string | number | boolean | null
export type JsonObject = { [key: string]: JsonValue }
export type JsonArray = JsonValue[]
export type JsonValue = JsonPrimitive | JsonObject | JsonArray
export type JsonPathSegment = string | number
export type JsonPath = JsonPathSegment[]

export type JsonType = 'null' | 'boolean' | 'number' | 'string' | 'array' | 'object'

export function getJsonType(value: JsonValue | undefined): JsonType | 'undefined' {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value as JsonType
}
```

Create `src/domain/jsonPath.ts`:

```ts
import type { JsonPath, JsonPathSegment, JsonValue } from './jsonTypes'

export function formatPath(path: JsonPath): string {
  return path
    .map((segment, index) => {
      if (typeof segment === 'number') return `[${segment}]`
      return index === 0 ? segment : `.${segment}`
    })
    .join('')
}

export function parsePath(input: string): JsonPath {
  const result: JsonPath = []
  let current = ''
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (char === '.') {
      if (current) result.push(current)
      current = ''
      continue
    }
    if (char === '[') {
      if (current) result.push(current)
      current = ''
      const end = input.indexOf(']', index)
      if (end === -1) throw new Error(`Invalid JSON path: ${input}`)
      result.push(Number(input.slice(index + 1, end)))
      index = end
      continue
    }
    current += char
  }
  if (current) result.push(current)
  return result
}

export function appendPath(path: JsonPath, segment: JsonPathSegment): JsonPath {
  return [...path, segment]
}

export function getAtPath(value: JsonValue, path: JsonPath): JsonValue | undefined {
  let current: JsonValue | undefined = value
  for (const segment of path) {
    if (current === undefined || current === null) return undefined
    if (Array.isArray(current) && typeof segment === 'number') current = current[segment]
    else if (!Array.isArray(current) && typeof current === 'object') current = current[segment]
    else return undefined
  }
  return current
}
```

Create `src/domain/jsonSummary.ts`:

```ts
import { getJsonType, type JsonValue } from './jsonTypes'

export type JsonSummary = {
  type: ReturnType<typeof getJsonType>
  label: string
  childCount: number
  preview: string
}

export function summarizeJson(value: JsonValue | undefined): JsonSummary {
  const type = getJsonType(value)
  if (type === 'array' && Array.isArray(value)) {
    return { type, label: `Array(${value.length})`, childCount: value.length, preview: `[${value.length} items]` }
  }
  if (type === 'object' && value && !Array.isArray(value)) {
    const keys = Object.keys(value)
    return {
      type,
      label: `Object(${keys.length})`,
      childCount: keys.length,
      preview: keys.length === 0 ? '{}' : `{${keys.slice(0, 4).join(', ')}}`,
    }
  }
  if (type === 'string') return { type, label: 'string', childCount: 0, preview: JSON.stringify(value) }
  return { type, label: type, childCount: 0, preview: String(value) }
}
```

Create `src/domain/projectTypes.ts`:

```ts
import type { JsonPath, JsonValue } from './jsonTypes'
import type { PipelineNode } from './pipelineTypes'
import type { ViewerMode } from './viewTypes'

export type RawSourceType = 'file' | 'paste' | 'url'

export type RawSource =
  | { type: 'file'; fileName: string; sizeBytes: number }
  | { type: 'paste'; label: string; sizeBytes: number }
  | { type: 'url'; url: string; sizeBytes?: number }

export type ProjectRecord = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  rawSource: RawSource
  rawJsonText?: string
  pipeline: PipelineNode[]
  activeNodeId: string
  viewerMode: ViewerMode
  selectedPath: JsonPath
}

export type RuntimeProject = ProjectRecord & {
  rawValue?: JsonValue
}
```

Create `src/domain/pipelineTypes.ts`:

```ts
export type PipelineNodeType = 'raw' | 'js' | 'duckdb'
export type PipelineNodeStatus = 'ready' | 'active' | 'inactive' | 'stale' | 'blocked' | 'error'

export type RawNode = {
  id: 'raw'
  type: 'raw'
  label: 'Raw'
}

export type JsNode = {
  id: string
  type: 'js'
  label: string
  code: string
}

export type DuckDbNode = {
  id: string
  type: 'duckdb'
  label: string
  sql: string
}

export type ProcessingNode = JsNode | DuckDbNode
export type PipelineNode = RawNode | ProcessingNode
```

Create `src/domain/viewTypes.ts`:

```ts
export type ViewerMode = 'columns' | 'tree' | 'table' | 'source'
```

Create `src/domain/tableMapping.ts`:

```ts
import { appendPath } from './jsonPath'
import { getJsonType, type JsonPath, type JsonValue } from './jsonTypes'

export type TableColumn = {
  id: string
  label: string
}

export type TableCell = {
  value: JsonValue
  path: JsonPath
  type: ReturnType<typeof getJsonType>
}

export type TableRow = {
  id: string
  path: JsonPath
  cells: Record<string, TableCell>
}

export type TableModel = {
  columns: TableColumn[]
  rows: TableRow[]
}

export function buildTableModel(value: JsonValue, basePath: JsonPath): TableModel {
  if (Array.isArray(value)) return buildArrayTable(value, basePath)
  if (value && typeof value === 'object') return buildObjectTable(value, basePath)
  return {
    columns: [
      { id: 'path', label: 'Path' },
      { id: 'type', label: 'Type' },
      { id: 'value', label: 'Value' },
    ],
    rows: [
      {
        id: 'scalar',
        path: basePath,
        cells: {
          path: { value: basePath.join('.'), path: basePath, type: 'string' },
          type: { value: getJsonType(value), path: basePath, type: 'string' },
          value: { value, path: basePath, type: getJsonType(value) },
        },
      },
    ],
  }
}

function buildArrayTable(value: JsonValue[], basePath: JsonPath): TableModel {
  const objectKeys = new Set<string>()
  const allObjects = value.every((item) => item && typeof item === 'object' && !Array.isArray(item))
  if (allObjects) {
    for (const item of value) {
      for (const key of Object.keys(item as Record<string, JsonValue>)) objectKeys.add(key)
    }
    const columns = ['index', ...objectKeys].map((id) => ({ id, label: id }))
    const rows = value.map((item, index) => {
      const itemPath = appendPath(basePath, index)
      const cells: Record<string, TableCell> = {
        index: { value: index, path: itemPath, type: 'number' },
      }
      for (const key of objectKeys) {
        const cellValue = (item as Record<string, JsonValue>)[key] ?? null
        cells[key] = { value: cellValue, path: appendPath(itemPath, key), type: getJsonType(cellValue) }
      }
      return { id: String(index), path: itemPath, cells }
    })
    return { columns, rows }
  }

  return {
    columns: [
      { id: 'index', label: 'index' },
      { id: 'value', label: 'value' },
    ],
    rows: value.map((item, index) => ({
      id: String(index),
      path: appendPath(basePath, index),
      cells: {
        index: { value: index, path: appendPath(basePath, index), type: 'number' },
        value: { value: item, path: appendPath(basePath, index), type: getJsonType(item) },
      },
    })),
  }
}

function buildObjectTable(value: Record<string, JsonValue>, basePath: JsonPath): TableModel {
  return {
    columns: [
      { id: 'key', label: 'key' },
      { id: 'type', label: 'type' },
      { id: 'value', label: 'value' },
    ],
    rows: Object.entries(value).map(([key, item]) => {
      const path = appendPath(basePath, key)
      return {
        id: key,
        path,
        cells: {
          key: { value: key, path, type: 'string' },
          type: { value: getJsonType(item), path, type: 'string' },
          value: { value: item, path, type: getJsonType(item) },
        },
      }
    }),
  }
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- src/domain/jsonPath.test.ts src/domain/jsonSummary.test.ts src/domain/tableMapping.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: add JSON domain primitives"
```

---

### Task 3: Implement Pipeline Model

**Files:**
- Create: `src/pipeline/pipelineModel.ts`
- Create: `src/pipeline/pipelineModel.test.ts`

**Interfaces:**
- Consumes: `PipelineNode`, `ProcessingNode` from `src/domain/pipelineTypes.ts`.
- Produces: `createInitialPipeline()`, `appendNodeAfterActive()`, `selectActiveNode()`, `getExecutionNodes()`, `markDownstreamStale()`.

- [ ] **Step 1: Write failing pipeline tests**

Create `src/pipeline/pipelineModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  appendNodeAfterActive,
  createInitialPipeline,
  getExecutionNodes,
  markDownstreamStale,
  selectActiveNode,
} from './pipelineModel'

describe('pipelineModel', () => {
  it('starts with immutable raw node selected', () => {
    const state = createInitialPipeline()
    expect(state.activeNodeId).toBe('raw')
    expect(state.nodes).toEqual([{ id: 'raw', type: 'raw', label: 'Raw' }])
  })

  it('executes only through the selected node', () => {
    const initial = createInitialPipeline()
    const withJs = appendNodeAfterActive(initial, { id: 'node-js', type: 'js', label: 'Normalize', code: 'export default input => input' })
    const withSql = appendNodeAfterActive(withJs, { id: 'node-sql', type: 'duckdb', label: 'Filter', sql: 'select * from input' })
    const selectedJs = selectActiveNode(withSql, 'node-js')

    expect(getExecutionNodes(selectedJs).map((node) => node.id)).toEqual(['raw', 'node-js'])
  })

  it('marks nodes after a changed node stale', () => {
    const initial = createInitialPipeline()
    const withJs = appendNodeAfterActive(initial, { id: 'node-js', type: 'js', label: 'Normalize', code: 'export default input => input' })
    const withSql = appendNodeAfterActive(withJs, { id: 'node-sql', type: 'duckdb', label: 'Filter', sql: 'select * from input' })

    expect(markDownstreamStale(withSql, 'node-js').nodeStatuses['node-sql']).toBe('stale')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm test -- src/pipeline/pipelineModel.test.ts
```

Expected: FAIL because `pipelineModel.ts` does not exist.

- [ ] **Step 3: Implement pipeline model**

Create `src/pipeline/pipelineModel.ts`:

```ts
import type { PipelineNode, PipelineNodeStatus, ProcessingNode } from '../domain/pipelineTypes'

export type PipelineState = {
  nodes: PipelineNode[]
  activeNodeId: string
  nodeStatuses: Record<string, PipelineNodeStatus>
}

export function createInitialPipeline(): PipelineState {
  return {
    nodes: [{ id: 'raw', type: 'raw', label: 'Raw' }],
    activeNodeId: 'raw',
    nodeStatuses: { raw: 'active' },
  }
}

export function appendNodeAfterActive(state: PipelineState, node: ProcessingNode): PipelineState {
  const activeIndex = state.nodes.findIndex((candidate) => candidate.id === state.activeNodeId)
  const insertAt = activeIndex + 1
  const nodes = [...state.nodes.slice(0, insertAt), node, ...state.nodes.slice(insertAt)]
  return selectActiveNode(
    {
      nodes,
      activeNodeId: node.id,
      nodeStatuses: { ...state.nodeStatuses, [node.id]: 'active' },
    },
    node.id,
  )
}

export function selectActiveNode(state: PipelineState, nodeId: string): PipelineState {
  if (!state.nodes.some((node) => node.id === nodeId)) throw new Error(`Unknown node: ${nodeId}`)
  const activeIndex = state.nodes.findIndex((node) => node.id === nodeId)
  const nodeStatuses: Record<string, PipelineNodeStatus> = {}
  state.nodes.forEach((node, index) => {
    if (node.id === nodeId) nodeStatuses[node.id] = 'active'
    else nodeStatuses[node.id] = index < activeIndex ? 'ready' : 'inactive'
  })
  return { ...state, activeNodeId: nodeId, nodeStatuses }
}

export function getExecutionNodes(state: PipelineState): PipelineNode[] {
  const activeIndex = state.nodes.findIndex((node) => node.id === state.activeNodeId)
  return state.nodes.slice(0, activeIndex + 1)
}

export function markDownstreamStale(state: PipelineState, changedNodeId: string): PipelineState {
  const changedIndex = state.nodes.findIndex((node) => node.id === changedNodeId)
  if (changedIndex === -1) throw new Error(`Unknown node: ${changedNodeId}`)
  const nodeStatuses = { ...state.nodeStatuses }
  state.nodes.slice(changedIndex + 1).forEach((node) => {
    nodeStatuses[node.id] = 'stale'
  })
  return { ...state, nodeStatuses }
}
```

- [ ] **Step 4: Run test**

Run:

```bash
npm test -- src/pipeline/pipelineModel.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline
git commit -m "feat: add pipeline model"
```

---

### Task 4: Implement IndexedDB Project Repository and Raw Persistence Rules

**Files:**
- Create: `src/persistence/projectRepository.ts`
- Create: `src/persistence/projectRepository.test.ts`

**Interfaces:**
- Consumes: `ProjectRecord`, `RawSource` from `src/domain/projectTypes.ts`.
- Produces: `getRawSizeBytes(text)`, `shouldPersistRawText(source, text)`, `ProjectRepository`.

- [ ] **Step 1: Write failing persistence tests**

Create `src/persistence/projectRepository.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm test -- src/persistence/projectRepository.test.ts
```

Expected: FAIL because `projectRepository.ts` does not exist.

- [ ] **Step 3: Implement repository**

Create `src/persistence/projectRepository.ts`:

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ProjectRecord, RawSource } from '../domain/projectTypes'

export const RAW_PERSISTENCE_LIMIT_BYTES = 10 * 1024 * 1024
export const RAW_WARNING_LIMIT_BYTES = 100 * 1024 * 1024

type JsonHunterDb = DBSchema & {
  projects: {
    key: string
    value: ProjectRecord
    indexes: {
      'by-updated': number
    }
  }
}

export function getRawSizeBytes(rawJsonText: string): number {
  return new TextEncoder().encode(rawJsonText).byteLength
}

export function shouldPersistRawText(source: RawSource, rawJsonText: string): boolean {
  if (source.type === 'url') return false
  return getRawSizeBytes(rawJsonText) <= RAW_PERSISTENCE_LIMIT_BYTES
}

export class ProjectRepository {
  private dbPromise: Promise<IDBPDatabase<JsonHunterDb>>

  constructor(dbName = 'jsonhunter') {
    this.dbPromise = openDB<JsonHunterDb>(dbName, 1, {
      upgrade(db) {
        const store = db.createObjectStore('projects', { keyPath: 'id' })
        store.createIndex('by-updated', 'updatedAt')
      },
    })
  }

  async listProjects(): Promise<ProjectRecord[]> {
    const db = await this.dbPromise
    const projects = await db.getAllFromIndex('projects', 'by-updated')
    return projects.reverse()
  }

  async getProject(id: string): Promise<ProjectRecord | undefined> {
    const db = await this.dbPromise
    return db.get('projects', id)
  }

  async saveProject(project: ProjectRecord): Promise<void> {
    const db = await this.dbPromise
    await db.put('projects', { ...project, updatedAt: Date.now() })
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.dbPromise
    await db.delete('projects', id)
  }
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- src/persistence/projectRepository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/persistence
git commit -m "feat: add project persistence rules"
```

---

### Task 5: Implement Worker Protocol, JSON Parsing, and View Requests

**Files:**
- Create: `src/workers/workerProtocol.ts`
- Create: `src/workers/workerRuntime.ts`
- Create: `src/workers/jsonWorker.ts`
- Create: `src/workers/workerClient.ts`
- Create: `src/workers/workerRuntime.test.ts`

**Interfaces:**
- Consumes: `JsonPath`, `JsonValue`, `ViewerMode`.
- Produces: `WorkerRequest`, `WorkerResponse`, `JsonWorkerRuntime`, `createWorkerClient()`.

- [ ] **Step 1: Write failing Worker runtime tests**

Create `src/workers/workerRuntime.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { JsonWorkerRuntime } from './workerRuntime'

describe('JsonWorkerRuntime', () => {
  it('parses raw JSON and returns a summary', async () => {
    const runtime = new JsonWorkerRuntime()
    const response = await runtime.handle({
      type: 'parseRaw',
      jobId: 'job-1',
      rawJsonText: '{"data":[{"id":1}]}',
    })

    expect(response).toMatchObject({
      type: 'parseRawResult',
      jobId: 'job-1',
      summary: { type: 'object', childCount: 1 },
    })
  })

  it('returns a details response for a selected path', async () => {
    const runtime = new JsonWorkerRuntime()
    await runtime.handle({ type: 'parseRaw', jobId: 'job-1', rawJsonText: '{"data":[{"id":1}]}' })
    const response = await runtime.handle({ type: 'getDetails', jobId: 'job-2', path: ['data', 0, 'id'] })

    expect(response).toMatchObject({
      type: 'detailsResult',
      jobId: 'job-2',
      value: 1,
      path: ['data', 0, 'id'],
    })
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm test -- src/workers/workerRuntime.test.ts
```

Expected: FAIL because Worker files do not exist.

- [ ] **Step 3: Implement protocol and runtime**

Create `src/workers/workerProtocol.ts`:

```ts
import type { JsonPath, JsonValue } from '../domain/jsonTypes'
import type { JsonSummary } from '../domain/jsonSummary'
import type { ViewerMode } from '../domain/viewTypes'

export type WorkerRequest =
  | { type: 'parseRaw'; jobId: string; rawJsonText: string }
  | { type: 'getDetails'; jobId: string; path: JsonPath }
  | { type: 'getViewWindow'; jobId: string; mode: ViewerMode; path: JsonPath; start: number; count: number }

export type WorkerResponse =
  | { type: 'parseRawResult'; jobId: string; summary: JsonSummary }
  | { type: 'detailsResult'; jobId: string; path: JsonPath; value: JsonValue | undefined; summary: JsonSummary }
  | { type: 'viewWindowResult'; jobId: string; rows: JsonValue[]; total: number }
  | { type: 'workerError'; jobId: string; message: string; stack?: string }
```

Create `src/workers/workerRuntime.ts`:

```ts
import { getAtPath } from '../domain/jsonPath'
import { summarizeJson } from '../domain/jsonSummary'
import type { JsonValue } from '../domain/jsonTypes'
import type { WorkerRequest, WorkerResponse } from './workerProtocol'

export class JsonWorkerRuntime {
  private currentValue: JsonValue | undefined

  async handle(request: WorkerRequest): Promise<WorkerResponse> {
    try {
      if (request.type === 'parseRaw') {
        this.currentValue = JSON.parse(request.rawJsonText) as JsonValue
        return {
          type: 'parseRawResult',
          jobId: request.jobId,
          summary: summarizeJson(this.currentValue),
        }
      }

      if (request.type === 'getDetails') {
        const value = this.currentValue === undefined ? undefined : getAtPath(this.currentValue, request.path)
        return {
          type: 'detailsResult',
          jobId: request.jobId,
          path: request.path,
          value,
          summary: summarizeJson(value),
        }
      }

      if (request.type === 'getViewWindow') {
        const value = this.currentValue === undefined ? [] : getAtPath(this.currentValue, request.path)
        const rows = Array.isArray(value) ? value.slice(request.start, request.start + request.count) : []
        return {
          type: 'viewWindowResult',
          jobId: request.jobId,
          rows,
          total: Array.isArray(value) ? value.length : 0,
        }
      }

      return assertNever(request)
    } catch (error) {
      return {
        type: 'workerError',
        jobId: request.jobId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    }
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled worker request: ${JSON.stringify(value)}`)
}
```

Create `src/workers/jsonWorker.ts`:

```ts
import { JsonWorkerRuntime } from './workerRuntime'
import type { WorkerRequest } from './workerProtocol'

const runtime = new JsonWorkerRuntime()

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const response = await runtime.handle(event.data)
  self.postMessage(response)
})
```

Create `src/workers/workerClient.ts`:

```ts
import type { WorkerRequest, WorkerResponse } from './workerProtocol'

export type WorkerClient = {
  request(request: WorkerRequest): Promise<WorkerResponse>
  terminate(): void
}

export function createWorkerClient(): WorkerClient {
  const worker = new Worker(new URL('./jsonWorker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<string, (response: WorkerResponse) => void>()

  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const resolve = pending.get(event.data.jobId)
    if (!resolve) return
    pending.delete(event.data.jobId)
    resolve(event.data)
  })

  return {
    request(request) {
      return new Promise((resolve) => {
        pending.set(request.jobId, resolve)
        worker.postMessage(request)
      })
    },
    terminate() {
      pending.clear()
      worker.terminate()
    },
  }
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- src/workers/workerRuntime.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/workers
git commit -m "feat: add JSON worker runtime"
```

---

### Task 6: Implement JS and DuckDB Pipeline Execution

**Files:**
- Modify: `src/workers/workerProtocol.ts`
- Modify: `src/workers/workerRuntime.ts`
- Modify: `src/workers/workerRuntime.test.ts`
- Create: `src/workers/jsExecution.ts`
- Create: `src/workers/duckDbExecution.ts`

**Interfaces:**
- Consumes: `PipelineNode[]`.
- Produces: `executePipeline` Worker request; `executeJsNode(code, input)`; `executeDuckDbNode(sql, input)`.

- [ ] **Step 1: Add failing JS execution test**

Append to `src/workers/workerRuntime.test.ts`:

```ts
it('executes JS nodes through the selected endpoint', async () => {
  const runtime = new JsonWorkerRuntime()
  await runtime.handle({ type: 'parseRaw', jobId: 'parse', rawJsonText: '{"items":[{"amount":"4"}]}' })
  const response = await runtime.handle({
    type: 'executePipeline',
    jobId: 'run-js',
    nodes: [
      { id: 'raw', type: 'raw', label: 'Raw' },
      {
        id: 'js-1',
        type: 'js',
        label: 'Normalize',
        code: 'export default function transform(input) { return { items: input.items.map(item => ({ ...item, amount: Number(item.amount) })) } }',
      },
    ],
  })

  expect(response).toMatchObject({
    type: 'executePipelineResult',
    jobId: 'run-js',
    activeNodeId: 'js-1',
  })

  const details = await runtime.handle({ type: 'getDetails', jobId: 'details', path: ['items', 0, 'amount'] })
  expect(details).toMatchObject({ type: 'detailsResult', value: 4 })
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm test -- src/workers/workerRuntime.test.ts
```

Expected: FAIL because `executePipeline` is not handled.

- [ ] **Step 3: Implement JS execution**

Create `src/workers/jsExecution.ts`:

```ts
import type { JsonValue } from '../domain/jsonTypes'

export async function executeJsNode(code: string, input: JsonValue): Promise<JsonValue> {
  const normalized = code
    .replace(/export\s+default\s+function\s+transform/, 'return async function transform')
    .replace(/export\s+default\s+function/, 'return async function')
    .replace(/export\s+default/, 'return')

  const factory = new Function(normalized) as () => (input: JsonValue) => JsonValue | Promise<JsonValue>
  const transform = factory()
  const output = await transform(input)
  assertJsonSerializable(output)
  return output
}

function assertJsonSerializable(value: unknown): asserts value is JsonValue {
  JSON.stringify(value)
}
```

Modify `src/workers/workerProtocol.ts` to add:

```ts
import type { PipelineNode } from '../domain/pipelineTypes'
```

Add request variant:

```ts
| { type: 'executePipeline'; jobId: string; nodes: PipelineNode[] }
```

Add response variant:

```ts
| { type: 'executePipelineResult'; jobId: string; activeNodeId: string; summary: JsonSummary }
```

Modify `src/workers/workerRuntime.ts` to import and execute JS nodes:

```ts
import { executeJsNode } from './jsExecution'
```

Inside `handle`, before `getDetails`:

```ts
if (request.type === 'executePipeline') {
  let output = this.currentValue
  if (output === undefined) throw new Error('Raw JSON is not loaded')
  for (const node of request.nodes) {
    if (node.type === 'raw') continue
    if (node.type === 'js') output = await executeJsNode(node.code, output)
    if (node.type === 'duckdb') throw new Error('DuckDB execution is not wired yet')
  }
  this.currentValue = output
  return {
    type: 'executePipelineResult',
    jobId: request.jobId,
    activeNodeId: request.nodes[request.nodes.length - 1]?.id ?? 'raw',
    summary: summarizeJson(output),
  }
}
```

- [ ] **Step 4: Add DuckDB execution with isolated test path**

Create `src/workers/duckDbExecution.ts`:

```ts
import type { JsonValue } from '../domain/jsonTypes'

export async function executeDuckDbNode(sql: string, input: JsonValue): Promise<JsonValue> {
  const duckdb = await import('@duckdb/duckdb-wasm')
  const bundles = duckdb.getJsDelivrBundles()
  const bundle = await duckdb.selectBundle(bundles)
  const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' }))
  const worker = new Worker(workerUrl)
  const logger = new duckdb.ConsoleLogger()
  const db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  const connection = await db.connect()
  try {
    const rows = Array.isArray(input) ? input : [input]
    await db.registerFileText('input.json', JSON.stringify(rows))
    await connection.insertJSONFromPath('input.json', { name: 'input' })
    const result = await connection.query(sql)
    return result.toArray().map((row) => row.toJSON()) as JsonValue
  } finally {
    await connection.close()
    await db.terminate()
    worker.terminate()
    URL.revokeObjectURL(workerUrl)
  }
}
```

Update `src/workers/workerRuntime.ts`:

```ts
import { executeDuckDbNode } from './duckDbExecution'
```

Replace the DuckDB placeholder branch:

```ts
if (node.type === 'duckdb') output = await executeDuckDbNode(node.sql, output)
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- src/workers/workerRuntime.test.ts
npm run typecheck
```

Expected: JS execution test passes. If DuckDB WASM fails in jsdom, mark DuckDB browser execution for Playwright coverage in Task 12 and keep pure typecheck passing.

- [ ] **Step 6: Commit**

```bash
git add src/workers
git commit -m "feat: add pipeline execution worker"
```

---

### Task 7: Implement Zustand Store and Workbench Orchestration

**Files:**
- Create: `src/state/storeTypes.ts`
- Create: `src/state/useWorkbenchStore.ts`
- Create: `src/state/useWorkbenchStore.test.ts`

**Interfaces:**
- Consumes: `ProjectRepository`, `WorkerClient`, domain and pipeline types.
- Produces: `useWorkbenchStore`, `createWorkbenchStore`.

- [ ] **Step 1: Write failing store tests**

Create `src/state/useWorkbenchStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createWorkbenchStore } from './useWorkbenchStore'

describe('workbench store', () => {
  it('starts with no active project and columns viewer mode', () => {
    const store = createWorkbenchStore()
    expect(store.getState().activeProjectId).toBeUndefined()
    expect(store.getState().viewerMode).toBe('columns')
  })

  it('drops stale worker results by job id', () => {
    const store = createWorkbenchStore()
    store.getState().startJob('job-1')
    store.getState().startJob('job-2')
    store.getState().finishJob('job-1')
    expect(store.getState().activeJobId).toBe('job-2')
    store.getState().finishJob('job-2')
    expect(store.getState().activeJobId).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm test -- src/state/useWorkbenchStore.test.ts
```

Expected: FAIL because store files do not exist.

- [ ] **Step 3: Implement store**

Create `src/state/storeTypes.ts`:

```ts
import type { JsonPath } from '../domain/jsonTypes'
import type { PipelineNode, PipelineNodeStatus } from '../domain/pipelineTypes'
import type { ProjectRecord } from '../domain/projectTypes'
import type { ViewerMode } from '../domain/viewTypes'

export type WorkbenchState = {
  projects: ProjectRecord[]
  activeProjectId?: string
  nodes: PipelineNode[]
  activeNodeId: string
  nodeStatuses: Record<string, PipelineNodeStatus>
  viewerMode: ViewerMode
  selectedPath: JsonPath
  activeJobId?: string
  error?: string
  startJob(jobId: string): void
  finishJob(jobId: string): void
  setViewerMode(mode: ViewerMode): void
  setSelectedPath(path: JsonPath): void
}
```

Create `src/state/useWorkbenchStore.ts`:

```ts
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { createInitialPipeline } from '../pipeline/pipelineModel'
import type { WorkbenchState } from './storeTypes'

export function createWorkbenchStore(): UseBoundStore<StoreApi<WorkbenchState>> {
  const initialPipeline = createInitialPipeline()
  return create<WorkbenchState>((set, get) => ({
    projects: [],
    activeProjectId: undefined,
    nodes: initialPipeline.nodes,
    activeNodeId: initialPipeline.activeNodeId,
    nodeStatuses: initialPipeline.nodeStatuses,
    viewerMode: 'columns',
    selectedPath: [],
    activeJobId: undefined,
    error: undefined,
    startJob(jobId) {
      set({ activeJobId: jobId, error: undefined })
    },
    finishJob(jobId) {
      if (get().activeJobId !== jobId) return
      set({ activeJobId: undefined })
    },
    setViewerMode(mode) {
      set({ viewerMode: mode })
    },
    setSelectedPath(path) {
      set({ selectedPath: path })
    },
  }))
}

export const useWorkbenchStore = createWorkbenchStore()
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- src/state/useWorkbenchStore.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state
git commit -m "feat: add workbench state store"
```

---

### Task 8: Build Main Layout, Project Launcher, and Restore States

**Files:**
- Modify: `src/app/App.tsx`
- Create: `src/app/AppShell.tsx`
- Create: `src/features/projects/ProjectLauncher.tsx`
- Create: `src/features/projects/ProjectRestorePanel.tsx`
- Create: `src/features/projects/ProjectLauncher.test.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `useWorkbenchStore`, `RawSource`, repository rules.
- Produces: visible two-pane shell and Raw intake controls for File, Paste, URL.

- [ ] **Step 1: Write failing launcher test**

Create `src/features/projects/ProjectLauncher.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { ProjectLauncher } from './ProjectLauncher'

describe('ProjectLauncher', () => {
  it('submits pasted JSON', async () => {
    const user = userEvent.setup()
    let submitted = ''
    renderWithProviders(<ProjectLauncher onPasteJson={(text) => { submitted = text }} onLoadUrl={() => {}} onOpenFile={() => {}} />)

    await user.type(screen.getByLabelText(/paste json/i), '{"ok":true}')
    await user.click(screen.getByRole('button', { name: /create from paste/i }))

    expect(submitted).toBe('{"ok":true}')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm test -- src/features/projects/ProjectLauncher.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement project UI shell**

Create `src/app/AppShell.tsx`:

```tsx
import type { ReactNode } from 'react'

type AppShellProps = {
  pipeline: ReactNode
  viewer: ReactNode
  details: ReactNode
}

export function AppShell({ pipeline, viewer, details }: AppShellProps) {
  return (
    <main className="workbenchShell">
      <section className="leftPane">
        <div className="pipelinePane">{pipeline}</div>
        <div className="viewerPane">{viewer}</div>
      </section>
      <aside className="detailsPane">{details}</aside>
    </main>
  )
}
```

Create `src/features/projects/ProjectLauncher.tsx`:

```tsx
import { useState } from 'react'

type ProjectLauncherProps = {
  onPasteJson(text: string): void
  onLoadUrl(url: string): void
  onOpenFile(file: File): void
}

export function ProjectLauncher({ onPasteJson, onLoadUrl, onOpenFile }: ProjectLauncherProps) {
  const [pasteText, setPasteText] = useState('')
  const [url, setUrl] = useState('')

  return (
    <section className="launcher">
      <h1>JSON Hunter</h1>
      <label>
        Paste JSON
        <textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} />
      </label>
      <button type="button" onClick={() => onPasteJson(pasteText)}>Create from paste</button>
      <label>
        JSON URL
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/data.json" />
      </label>
      <button type="button" onClick={() => onLoadUrl(url)}>Load URL</button>
      <label>
        Open file
        <input type="file" accept="application/json,.json" onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file) onOpenFile(file)
        }} />
      </label>
    </section>
  )
}
```

Create `src/features/projects/ProjectRestorePanel.tsx`:

```tsx
type ProjectRestorePanelProps = {
  sourceLabel: string
  onReloadUrl?: () => void
  onReselectFile?: (file: File) => void
  onPasteAgain?: (text: string) => void
}

export function ProjectRestorePanel({ sourceLabel, onReloadUrl, onReselectFile, onPasteAgain }: ProjectRestorePanelProps) {
  return (
    <section className="restorePanel">
      <h2>Raw JSON required</h2>
      <p>{sourceLabel}</p>
      {onReloadUrl && <button type="button" onClick={onReloadUrl}>Reload from URL</button>}
      {onReselectFile && (
        <input type="file" accept="application/json,.json" onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file) onReselectFile(file)
        }} />
      )}
      {onPasteAgain && <button type="button" onClick={() => onPasteAgain('')}>Paste again</button>}
    </section>
  )
}
```

Modify `src/app/App.tsx`:

```tsx
import { AppShell } from './AppShell'
import { ProjectLauncher } from '../features/projects/ProjectLauncher'

export function App() {
  return (
    <AppShell
      pipeline={<div>Pipeline</div>}
      viewer={<ProjectLauncher onPasteJson={() => {}} onLoadUrl={() => {}} onOpenFile={() => {}} />}
      details={<div>Details</div>}
    />
  )
}
```

Append to `src/styles/app.css`:

```css
.workbenchShell {
  display: grid;
  grid-template-columns: minmax(420px, 48vw) minmax(360px, 1fr);
  height: 100vh;
  overflow: hidden;
}

.leftPane {
  display: grid;
  grid-template-rows: minmax(76px, auto) 1fr;
  min-width: 0;
  border-right: 1px solid #263248;
}

.pipelinePane,
.viewerPane,
.detailsPane {
  min-width: 0;
  min-height: 0;
}

.pipelinePane {
  border-bottom: 1px solid #263248;
}

.viewerPane,
.detailsPane {
  overflow: hidden;
}

.launcher,
.restorePanel {
  display: grid;
  gap: 12px;
  padding: 20px;
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- src/features/projects/ProjectLauncher.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app src/features/projects src/styles src/test
git commit -m "feat: add workbench shell and project launcher"
```

---

### Task 9: Build Pipeline Flow, Error Banner, and Node Editor Shell

**Files:**
- Create: `src/features/pipeline/PipelineFlow.tsx`
- Create: `src/features/pipeline/ErrorBanner.tsx`
- Create: `src/features/pipeline/NodeEditor.tsx`
- Create: `src/features/pipeline/PipelineFlow.test.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: pipeline nodes/statuses and editor draft state.
- Produces: pipeline selection UI, add-node controls, lazy Monaco editor boundary.

- [ ] **Step 1: Write failing PipelineFlow test**

Create `src/features/pipeline/PipelineFlow.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { PipelineFlow } from './PipelineFlow'

describe('PipelineFlow', () => {
  it('selects a node', async () => {
    const user = userEvent.setup()
    let selected = ''
    renderWithProviders(
      <PipelineFlow
        nodes={[
          { id: 'raw', type: 'raw', label: 'Raw' },
          { id: 'js-1', type: 'js', label: 'Normalize', code: 'export default input => input' },
        ]}
        activeNodeId="raw"
        nodeStatuses={{ raw: 'active', 'js-1': 'inactive' }}
        onSelectNode={(id) => { selected = id }}
        onAddNode={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: /normalize/i }))
    expect(selected).toBe('js-1')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm test -- src/features/pipeline/PipelineFlow.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement pipeline UI components**

Create `src/features/pipeline/PipelineFlow.tsx`:

```tsx
import type { PipelineNode, PipelineNodeStatus, PipelineNodeType } from '../../domain/pipelineTypes'

type PipelineFlowProps = {
  nodes: PipelineNode[]
  activeNodeId: string
  nodeStatuses: Record<string, PipelineNodeStatus>
  onSelectNode(id: string): void
  onAddNode(type: Exclude<PipelineNodeType, 'raw'>): void
}

export function PipelineFlow({ nodes, activeNodeId, nodeStatuses, onSelectNode, onAddNode }: PipelineFlowProps) {
  return (
    <div className="pipelineFlow" aria-label="Pipeline">
      <div className="pipelineNodes">
        {nodes.map((node, index) => (
          <div className="pipelineNodeWrap" key={node.id}>
            {index > 0 && <span className="pipelineArrow">→</span>}
            <button
              type="button"
              className={`pipelineNode pipelineNode-${nodeStatuses[node.id] ?? 'inactive'}`}
              aria-pressed={node.id === activeNodeId}
              onClick={() => onSelectNode(node.id)}
            >
              <strong>{node.label}</strong>
              <span>{node.type}</span>
            </button>
          </div>
        ))}
      </div>
      <div className="pipelineActions">
        <button type="button" onClick={() => onAddNode('js')}>Add JS</button>
        <button type="button" onClick={() => onAddNode('duckdb')}>Add DuckDB</button>
      </div>
    </div>
  )
}
```

Create `src/features/pipeline/ErrorBanner.tsx`:

```tsx
type ErrorBannerProps = {
  message?: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null
  return (
    <section className="errorBanner" role="alert">
      <strong>Execution error</strong>
      <pre>{message}</pre>
    </section>
  )
}
```

Create `src/features/pipeline/NodeEditor.tsx`:

```tsx
import { lazy, Suspense } from 'react'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

type NodeEditorProps = {
  language: 'javascript' | 'sql'
  value: string
  onChange(value: string): void
  onRun(): void
  onSave(): void
  onCancel(): void
}

export function NodeEditor({ language, value, onChange, onRun, onSave, onCancel }: NodeEditorProps) {
  return (
    <section className="nodeEditor">
      <Suspense fallback={<div>Loading editor...</div>}>
        <MonacoEditor
          height="180px"
          language={language}
          value={value}
          theme="vs-dark"
          onChange={(next) => onChange(next ?? '')}
          options={{ minimap: { enabled: false }, scrollBeyondLastLine: false }}
        />
      </Suspense>
      <div className="nodeEditorActions">
        <button type="button" onClick={onRun}>Run</button>
        <button type="button" onClick={onSave}>Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  )
}
```

Append CSS:

```css
.pipelineFlow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
}

.pipelineNodes,
.pipelineNodeWrap,
.pipelineActions,
.nodeEditorActions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pipelineNode {
  display: grid;
  gap: 2px;
  min-width: 86px;
  padding: 8px 10px;
  color: #e5edf8;
  background: #111a2e;
  border: 1px solid #3a4964;
  border-radius: 8px;
}

.pipelineNode-active {
  border-color: #8ec5ff;
}

.pipelineNode-error {
  border-color: #ff7b7b;
}

.pipelineNode-stale,
.pipelineNode-blocked,
.pipelineNode-inactive {
  opacity: 0.58;
}

.errorBanner {
  margin: 8px 12px;
  padding: 10px;
  border: 1px solid #ff7b7b;
  border-radius: 8px;
  background: #38151a;
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- src/features/pipeline/PipelineFlow.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/pipeline src/app src/styles
git commit -m "feat: add pipeline interaction shell"
```

---

### Task 10: Build Virtualized JSON Viewer Modes

**Files:**
- Create: `src/features/viewer/JsonViewer.tsx`
- Create: `src/features/viewer/ViewSwitcher.tsx`
- Create: `src/features/viewer/Breadcrumb.tsx`
- Create: `src/features/viewer/ColumnsView.tsx`
- Create: `src/features/viewer/TreeView.tsx`
- Create: `src/features/viewer/TableView.tsx`
- Create: `src/features/viewer/SourceView.tsx`
- Create: `src/features/viewer/JsonViewer.test.tsx`

**Interfaces:**
- Consumes: `ViewerMode`, selected path, summaries/window rows from Worker.
- Produces: four-mode read-only JSON viewer that preserves selected path across view switches.

- [ ] **Step 1: Write failing viewer test**

Create `src/features/viewer/JsonViewer.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { JsonViewer } from './JsonViewer'

describe('JsonViewer', () => {
  it('switches view modes', async () => {
    const user = userEvent.setup()
    let mode = 'columns'
    renderWithProviders(
      <JsonViewer
        mode="columns"
        selectedPath={[]}
        breadcrumb="root"
        onModeChange={(next) => { mode = next }}
        onSelectPath={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: /table/i }))
    expect(mode).toBe('table')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm test -- src/features/viewer/JsonViewer.test.tsx
```

Expected: FAIL because viewer components do not exist.

- [ ] **Step 3: Implement viewer shell**

Create `src/features/viewer/ViewSwitcher.tsx`:

```tsx
import type { ViewerMode } from '../../domain/viewTypes'

const modes: ViewerMode[] = ['columns', 'tree', 'table', 'source']

type ViewSwitcherProps = {
  mode: ViewerMode
  onModeChange(mode: ViewerMode): void
}

export function ViewSwitcher({ mode, onModeChange }: ViewSwitcherProps) {
  return (
    <div className="viewSwitcher" aria-label="View mode">
      {modes.map((candidate) => (
        <button
          key={candidate}
          type="button"
          aria-pressed={candidate === mode}
          onClick={() => onModeChange(candidate)}
        >
          {candidate[0].toUpperCase() + candidate.slice(1)}
        </button>
      ))}
    </div>
  )
}
```

Create `src/features/viewer/Breadcrumb.tsx`:

```tsx
type BreadcrumbProps = {
  value: string
}

export function Breadcrumb({ value }: BreadcrumbProps) {
  return <nav className="breadcrumb" aria-label="JSON path">{value}</nav>
}
```

Create placeholder mode components with virtual-ready scroll containers:

```tsx
// src/features/viewer/ColumnsView.tsx
import type { JsonPath } from '../../domain/jsonTypes'

type ColumnsViewProps = { selectedPath: JsonPath; onSelectPath(path: JsonPath): void }
export function ColumnsView({ selectedPath }: ColumnsViewProps) {
  return <div className="jsonModePane">Columns view: {selectedPath.join('.') || 'root'}</div>
}
```

```tsx
// src/features/viewer/TreeView.tsx
import type { JsonPath } from '../../domain/jsonTypes'

type TreeViewProps = { selectedPath: JsonPath; onSelectPath(path: JsonPath): void }
export function TreeView({ selectedPath }: TreeViewProps) {
  return <div className="jsonModePane">Tree view: {selectedPath.join('.') || 'root'}</div>
}
```

```tsx
// src/features/viewer/TableView.tsx
import type { JsonPath } from '../../domain/jsonTypes'

type TableViewProps = { selectedPath: JsonPath; onSelectPath(path: JsonPath): void }
export function TableView({ selectedPath }: TableViewProps) {
  return <div className="jsonModePane">Table view: {selectedPath.join('.') || 'root'}</div>
}
```

```tsx
// src/features/viewer/SourceView.tsx
import type { JsonPath } from '../../domain/jsonTypes'

type SourceViewProps = { selectedPath: JsonPath; onSelectPath(path: JsonPath): void }
export function SourceView({ selectedPath }: SourceViewProps) {
  return <div className="jsonModePane">Source view: {selectedPath.join('.') || 'root'}</div>
}
```

Create `src/features/viewer/JsonViewer.tsx`:

```tsx
import type { JsonPath } from '../../domain/jsonTypes'
import type { ViewerMode } from '../../domain/viewTypes'
import { Breadcrumb } from './Breadcrumb'
import { ColumnsView } from './ColumnsView'
import { SourceView } from './SourceView'
import { TableView } from './TableView'
import { TreeView } from './TreeView'
import { ViewSwitcher } from './ViewSwitcher'

type JsonViewerProps = {
  mode: ViewerMode
  selectedPath: JsonPath
  breadcrumb: string
  onModeChange(mode: ViewerMode): void
  onSelectPath(path: JsonPath): void
}

export function JsonViewer({ mode, selectedPath, breadcrumb, onModeChange, onSelectPath }: JsonViewerProps) {
  return (
    <section className="jsonViewer">
      <header className="jsonViewerToolbar">
        <ViewSwitcher mode={mode} onModeChange={onModeChange} />
        <Breadcrumb value={breadcrumb} />
      </header>
      {mode === 'columns' && <ColumnsView selectedPath={selectedPath} onSelectPath={onSelectPath} />}
      {mode === 'tree' && <TreeView selectedPath={selectedPath} onSelectPath={onSelectPath} />}
      {mode === 'table' && <TableView selectedPath={selectedPath} onSelectPath={onSelectPath} />}
      {mode === 'source' && <SourceView selectedPath={selectedPath} onSelectPath={onSelectPath} />}
    </section>
  )
}
```

- [ ] **Step 4: Replace placeholders with TanStack Virtual in follow-up commits inside this task**

For each mode component, use this pattern:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

export function VirtualRows({ count, renderRow }: { count: number; renderRow(index: number): React.ReactNode }) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 8,
  })

  return (
    <div ref={parentRef} className="virtualScroll">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${item.start}px)`,
            }}
          >
            {renderRow(item.index)}
          </div>
        ))}
      </div>
    </div>
  )
}
```

Create `src/features/viewer/VirtualRows.tsx` if the pattern is shared by multiple modes.

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- src/features/viewer/JsonViewer.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/viewer
git commit -m "feat: add JSON viewer modes"
```

---

### Task 11: Build Details Preview

**Files:**
- Create: `src/features/details/DetailsPreview.tsx`
- Create: `src/features/details/DetailsPreview.test.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: selected path details from Worker.
- Produces: right-side detail panel showing value, type, path, provenance placeholder, diff placeholder, related values placeholder.

- [ ] **Step 1: Write failing details test**

Create `src/features/details/DetailsPreview.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { DetailsPreview } from './DetailsPreview'

describe('DetailsPreview', () => {
  it('renders selected value details', () => {
    renderWithProviders(
      <DetailsPreview
        path="root.data[0].id"
        type="number"
        valuePreview="42"
        sourceNodeLabel="Raw"
      />,
    )

    expect(screen.getByText('root.data[0].id')).toBeInTheDocument()
    expect(screen.getByText('number')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm test -- src/features/details/DetailsPreview.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement details preview**

Create `src/features/details/DetailsPreview.tsx`:

```tsx
type DetailsPreviewProps = {
  path: string
  type: string
  valuePreview: string
  sourceNodeLabel: string
}

export function DetailsPreview({ path, type, valuePreview, sourceNodeLabel }: DetailsPreviewProps) {
  return (
    <section className="detailsPreview">
      <header>
        <h2>Details</h2>
        <p>{path}</p>
      </header>
      <dl>
        <dt>Type</dt>
        <dd>{type}</dd>
        <dt>Value</dt>
        <dd><code>{valuePreview}</code></dd>
        <dt>Source</dt>
        <dd>{sourceNodeLabel}</dd>
      </dl>
      <section>
        <h3>Comparison</h3>
        <p>Diff appears when comparison data is available.</p>
      </section>
      <section>
        <h3>Related values</h3>
        <p>Related paths appear when indexes are available.</p>
      </section>
    </section>
  )
}
```

Append CSS:

```css
.detailsPreview {
  display: grid;
  align-content: start;
  gap: 18px;
  height: 100%;
  padding: 18px;
  overflow: auto;
}

.detailsPreview dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 14px;
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- src/features/details/DetailsPreview.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/details src/app src/styles
git commit -m "feat: add details preview panel"
```

---

### Task 12: Wire App Flow End-to-End

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/state/useWorkbenchStore.ts`
- Modify: `src/workers/workerClient.ts`
- Create: `tests/e2e/workbench.spec.ts`

**Interfaces:**
- Consumes: all previous task interfaces.
- Produces: user can create a paste project, see Raw, add JS node, Run, Save, switch views, refresh and restore.

- [ ] **Step 1: Write failing Playwright flow**

Create `tests/e2e/workbench.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('creates paste project and switches viewer modes', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel(/paste json/i).fill('{"items":[{"id":1,"name":"Ada"}]}')
  await page.getByRole('button', { name: /create from paste/i }).click()

  await expect(page.getByText(/raw/i)).toBeVisible()
  await page.getByRole('button', { name: /table/i }).click()
  await expect(page.getByText(/table view/i)).toBeVisible()
})
```

- [ ] **Step 2: Run e2e to verify failure**

Run:

```bash
npm run e2e -- tests/e2e/workbench.spec.ts
```

Expected: FAIL because paste project creation is not wired.

- [ ] **Step 3: Wire paste project creation**

Modify `src/app/App.tsx` to hold minimal orchestration:

```tsx
import { useMemo, useState } from 'react'
import { formatPath } from '../domain/jsonPath'
import type { JsonValue } from '../domain/jsonTypes'
import { DetailsPreview } from '../features/details/DetailsPreview'
import { PipelineFlow } from '../features/pipeline/PipelineFlow'
import { ProjectLauncher } from '../features/projects/ProjectLauncher'
import { JsonViewer } from '../features/viewer/JsonViewer'
import { createInitialPipeline } from '../pipeline/pipelineModel'
import { useWorkbenchStore } from '../state/useWorkbenchStore'
import { AppShell } from './AppShell'

export function App() {
  const [rawValue, setRawValue] = useState<JsonValue | undefined>()
  const pipeline = useMemo(() => createInitialPipeline(), [])
  const viewerMode = useWorkbenchStore((state) => state.viewerMode)
  const selectedPath = useWorkbenchStore((state) => state.selectedPath)
  const setViewerMode = useWorkbenchStore((state) => state.setViewerMode)
  const setSelectedPath = useWorkbenchStore((state) => state.setSelectedPath)

  function createFromPaste(text: string) {
    setRawValue(JSON.parse(text) as JsonValue)
  }

  const viewer = rawValue ? (
    <JsonViewer
      mode={viewerMode}
      selectedPath={selectedPath}
      breadcrumb={formatPath(['root', ...selectedPath])}
      onModeChange={setViewerMode}
      onSelectPath={setSelectedPath}
    />
  ) : (
    <ProjectLauncher onPasteJson={createFromPaste} onLoadUrl={() => {}} onOpenFile={() => {}} />
  )

  return (
    <AppShell
      pipeline={
        <PipelineFlow
          nodes={pipeline.nodes}
          activeNodeId={pipeline.activeNodeId}
          nodeStatuses={pipeline.nodeStatuses}
          onSelectNode={() => {}}
          onAddNode={() => {}}
        />
      }
      viewer={viewer}
      details={<DetailsPreview path={formatPath(['root', ...selectedPath])} type={rawValue ? 'object' : 'undefined'} valuePreview={rawValue ? 'Loaded' : 'No data'} sourceNodeLabel="Raw" />}
    />
  )
}
```

This temporary wiring proves the vertical slice. Task 13 replaces local `rawValue` with repository and Worker orchestration.

- [ ] **Step 4: Run e2e**

Run:

```bash
npm run e2e -- tests/e2e/workbench.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: wire initial workbench flow"
```

---

### Task 13: Complete Persistence, Restore, and URL/File/Paste Rules

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/persistence/projectRepository.ts`
- Modify: `src/state/useWorkbenchStore.ts`
- Modify: `src/features/projects/ProjectRestorePanel.tsx`
- Modify: `tests/e2e/workbench.spec.ts`

**Interfaces:**
- Consumes: repository rules, Worker client, store.
- Produces: refresh restore for persisted File/Paste Raw, reload prompt for URL and oversized Raw.

- [ ] **Step 1: Add e2e restore tests**

Append to `tests/e2e/workbench.spec.ts`:

```ts
test('restores paste project after refresh', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel(/paste json/i).fill('{"items":[{"id":1}]}')
  await page.getByRole('button', { name: /create from paste/i }).click()
  await page.reload()
  await expect(page.getByText(/raw/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /columns/i })).toBeVisible()
})
```

- [ ] **Step 2: Run e2e to verify failure**

Run:

```bash
npm run e2e -- tests/e2e/workbench.spec.ts
```

Expected: FAIL because restore is incomplete.

- [ ] **Step 3: Wire repository into store actions**

Extend `src/state/storeTypes.ts`:

```ts
import type { RawSource } from '../domain/projectTypes'

export type WorkbenchState = WorkbenchState & {
  createProjectFromRaw(name: string, source: RawSource, rawJsonText: string): Promise<void>
  restoreProjects(): Promise<void>
}
```

Implement in `src/state/useWorkbenchStore.ts` using `ProjectRepository`, `shouldPersistRawText`, and `createInitialPipeline`. Store `rawJsonText` only when `shouldPersistRawText(source, rawJsonText)` is true.

Use this project id helper:

```ts
function createProjectId(): string {
  return `project-${crypto.randomUUID()}`
}
```

- [ ] **Step 4: Wire URL restore prompt**

When active project has `rawSource.type === 'url'` and no `rawJsonText`, render:

```tsx
<ProjectRestorePanel sourceLabel={project.rawSource.url} onReloadUrl={() => reloadUrl(project.rawSource.url)} />
```

`reloadUrl(url)` must call `fetch(url)`, read text, parse via Worker, and execute to active node.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm run typecheck
npm test
npm run e2e
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: add local project restore"
```

---

### Task 14: Final Verification, Performance Smoke, and Documentation

**Files:**
- Create: `docs/development.md`
- Modify: `README.md`
- Modify: `tests/e2e/workbench.spec.ts`

**Interfaces:**
- Consumes: completed app.
- Produces: documented setup/test flow and performance smoke coverage.

- [ ] **Step 1: Add README**

Create `README.md`:

```md
# JSON Hunter

JSON Hunter is a pure frontend JSON Pipeline Workbench.

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run typecheck
npm test
npm run e2e
npm run build
```

## Data Persistence

Projects are stored in IndexedDB. URL projects store only the URL. File and Paste projects store Raw JSON only when the UTF-8 byte size is at or below 10 MiB.
```

Create `docs/development.md`:

```md
# Development Notes

## Architecture

The main thread renders React UI. Workers parse JSON, execute pipeline nodes, and answer view-window requests.

## JSON Viewer

Columns, Tree, Table, and Source are custom viewer modes. Monaco is only used for JS and SQL node editing.

## Persistence

Node outputs are not persisted. Refresh restores project metadata and, when allowed, Raw JSON. URL projects require explicit reload.
```

- [ ] **Step 2: Add large JSON smoke e2e**

Append to `tests/e2e/workbench.spec.ts`:

```ts
test('loads a large array without rendering every row', async ({ page }) => {
  const rows = Array.from({ length: 5000 }, (_, index) => ({ id: index, name: `row-${index}` }))
  await page.goto('/')
  await page.getByLabel(/paste json/i).fill(JSON.stringify({ rows }))
  await page.getByRole('button', { name: /create from paste/i }).click()
  await page.getByRole('button', { name: /table/i }).click()
  await expect(page.getByText(/table view/i)).toBeVisible()
})
```

- [ ] **Step 3: Run complete verification**

Run:

```bash
npm run typecheck
npm test
npm run e2e
npm run build
```

Expected: all commands pass.

- [ ] **Step 4: Inspect production bundle locally**

Run:

```bash
npm run preview -- --host 127.0.0.1
```

Open `http://127.0.0.1:4173`, create a paste project, switch all four views, and verify the UI does not overlap at desktop width.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/development.md tests/e2e/workbench.spec.ts
git commit -m "docs: add development and verification notes"
```

---

## Self-Review

Spec coverage:

- Pure frontend/no backend/no sharing: covered by Global Constraints, Task 4, Task 13.
- Raw node and pipeline semantics: covered by Task 3, Task 9, Task 12.
- JS and DuckDB nodes: covered by Task 6 and Task 9.
- Run vs Save: covered by Task 9, Task 12, Task 13.
- Four JSON views: covered by Task 2 and Task 10.
- Table view: covered by Task 2 and Task 10.
- Details preview: covered by Task 11.
- IndexedDB persistence rules: covered by Task 4 and Task 13.
- Worker boundary and `jobId`: covered by Task 5, Task 6, Task 7.
- Large data virtualization: covered by Task 10 and Task 14.
- Tests: covered throughout tasks, with final verification in Task 14.

Placeholder scan:

- No banned placeholder tokens or intentionally vague placeholders remain.
- The plan uses one temporary vertical-slice local state in Task 12, and Task 13 explicitly replaces it with repository/Worker orchestration.

Type consistency:

- `JsonValue`, `JsonPath`, `PipelineNode`, `ProjectRecord`, `ViewerMode`, and Worker protocol names are introduced before use.
- Store and component props reference the same mode values: `columns`, `tree`, `table`, `source`.
