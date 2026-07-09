import type { JsonPath } from '../../domain/jsonTypes'

export type ViewerRow = {
  label: string
  path: JsonPath
  value?: string
}

export type ViewerRowWindow = {
  startIndex: number
  totalCount: number
  rows: ViewerRow[]
}

export type ViewerRowsByMode = {
  columns?: ViewerRowWindow
  tree?: ViewerRowWindow
  table?: ViewerRowWindow
  source?: ViewerRowWindow
}

function createViewerRowWindow(rows: ViewerRow[]): ViewerRowWindow {
  return {
    startIndex: 0,
    totalCount: rows.length,
    rows,
  }
}

const defaultViewerRows: Required<ViewerRowsByMode> = {
  columns: createViewerRowWindow([
    { label: 'Primary', value: '1', path: ['primary'] },
    { label: 'Nested', value: '2', path: ['nested'] },
    { label: 'Array', value: '3', path: ['array'] },
    { label: 'Metadata', value: '4', path: ['metadata'] },
    { label: 'Preview', value: '5', path: ['preview'] },
    { label: 'Details', value: '6', path: ['details'] },
  ]),
  tree: createViewerRowWindow([
    { label: 'root', value: 'level 0', path: [] },
    { label: 'node.a', value: 'level 1', path: ['node', 'a'] },
    { label: 'node.b', value: 'level 1', path: ['node', 'b'] },
    { label: 'node.c', value: 'level 1', path: ['node', 'c'] },
    { label: 'node.d', value: 'level 1', path: ['node', 'd'] },
    { label: 'node.e', value: 'level 1', path: ['node', 'e'] },
    { label: 'node.f', value: 'level 1', path: ['node', 'f'] },
    { label: 'node.g', value: 'level 1', path: ['node', 'g'] },
  ]),
  table: createViewerRowWindow([
    { label: 'row-1', value: 'value 1', path: ['table', 0] },
    { label: 'row-2', value: 'value 2', path: ['table', 1] },
    { label: 'row-3', value: 'value 3', path: ['table', 2] },
    { label: 'row-4', value: 'value 4', path: ['table', 3] },
    { label: 'row-5', value: 'value 5', path: ['table', 4] },
    { label: 'row-6', value: 'value 6', path: ['table', 5] },
    { label: 'row-7', value: 'value 7', path: ['table', 6] },
    { label: 'row-8', value: 'value 8', path: ['table', 7] },
  ]),
  source: createViewerRowWindow([
    { label: '{', path: [] },
    { label: '  "name": "jsonhunter"', path: ['name'] },
    { label: '  "mode": "source"', path: ['mode'] },
    { label: '  "status": "ready"', path: ['status'] },
    { label: '}', path: [] },
  ]),
}

export function getViewerRows(rows?: ViewerRowsByMode): Required<ViewerRowsByMode> {
  return {
    columns: rows?.columns ?? defaultViewerRows.columns,
    tree: rows?.tree ?? defaultViewerRows.tree,
    table: rows?.table ?? defaultViewerRows.table,
    source: rows?.source ?? defaultViewerRows.source,
  }
}

export function getViewerRow(window: ViewerRowWindow, index: number) {
  const offset = index - window.startIndex
  return offset >= 0 && offset < window.rows.length ? window.rows[offset] : undefined
}
