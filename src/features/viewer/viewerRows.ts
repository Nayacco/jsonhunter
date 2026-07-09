import { appendPath, formatPath, getAtPath } from '../../domain/jsonPath'
import { summarizeJson } from '../../domain/jsonSummary'
import type { JsonPath, JsonValue } from '../../domain/jsonTypes'

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

const DERIVED_WINDOW_SIZE = 8

function createViewerRowWindow(rows: ViewerRow[], totalCount = rows.length, startIndex = 0): ViewerRowWindow {
  return {
    startIndex,
    totalCount,
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

export function deriveViewerRowsFromJson(rawValue: JsonValue, selectedPath: JsonPath = []): Required<ViewerRowsByMode> {
  const scopedValue = selectedPath.length === 0 ? rawValue : getAtPath(rawValue, selectedPath)
  const value = scopedValue ?? rawValue

  return {
    columns: createColumnsWindow(value, selectedPath),
    tree: createTreeWindow(value, selectedPath),
    table: createTableWindow(value, selectedPath),
    source: createSourceWindow(value, selectedPath),
  }
}

function createColumnsWindow(value: JsonValue, basePath: JsonPath) {
  const entries = getChildEntries(value, basePath)
  if (entries.length === 0) {
    return createViewerRowWindow([
      {
        label: basePath.length === 0 ? 'value' : formatPath(basePath),
        path: basePath,
        value: summarizeJson(value).preview,
      },
    ])
  }

  return createViewerRowWindow(
    entries.slice(0, DERIVED_WINDOW_SIZE).map((entry) => ({
      label: entry.label,
      path: entry.path,
      value: summarizeJson(entry.value).preview,
    })),
    entries.length,
  )
}

function createTreeWindow(value: JsonValue, basePath: JsonPath) {
  const entries = getChildEntries(value, basePath)
  const rootLabel = basePath.length === 0 ? 'root' : formatPath(['root', ...basePath])
  const rows: ViewerRow[] = [
    {
      label: rootLabel,
      path: basePath,
      value: summarizeJson(value).label,
    },
    ...entries.slice(0, Math.max(DERIVED_WINDOW_SIZE - 1, 0)).map((entry) => ({
      label: formatPath(['root', ...entry.path]),
      path: entry.path,
      value: summarizeJson(entry.value).preview,
    })),
  ]

  return createViewerRowWindow(rows, Math.max(entries.length + 1, rows.length))
}

function createTableWindow(value: JsonValue, basePath: JsonPath) {
  const tableSource = getTableSource(value, basePath)
  if (tableSource) {
    const rows = tableSource.value.slice(0, DERIVED_WINDOW_SIZE).map((entry, index) => ({
      label: getTableRowLabel(entry, index),
      path: appendPath(tableSource.path, index),
      value: summarizeJson(entry).preview,
    }))
    return createViewerRowWindow(rows, tableSource.value.length)
  }

  return createColumnsWindow(value, basePath)
}

function createSourceWindow(value: JsonValue, basePath: JsonPath) {
  const lines = JSON.stringify(value, null, 2)?.split('\n') ?? [String(value)]
  return createViewerRowWindow(
    lines.slice(0, DERIVED_WINDOW_SIZE).map((line) => ({
      label: line,
      path: basePath,
    })),
    lines.length,
  )
}

type ViewerTableSource = {
  path: JsonPath
  value: JsonValue[]
}

function getChildEntries(value: JsonValue, basePath: JsonPath) {
  if (Array.isArray(value)) {
    return value.map((entry, index) => ({
      label: String(index),
      path: appendPath(basePath, index),
      value: entry,
    }))
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, entry]) => ({
      label: key,
      path: appendPath(basePath, key),
      value: entry,
    }))
  }

  return []
}

function getTableSource(value: JsonValue, basePath: JsonPath): ViewerTableSource | undefined {
  if (Array.isArray(value)) {
    return { path: basePath, value }
  }

  if (!value || typeof value !== 'object') return undefined

  const preferredKeys = ['rows', 'items', 'data']
  for (const key of preferredKeys) {
    const candidate = value[key]
    if (Array.isArray(candidate)) {
      return { path: appendPath(basePath, key), value: candidate }
    }
  }

  const fallbackEntry = Object.entries(value).find((entry): entry is [string, JsonValue[]] => Array.isArray(entry[1]))
  if (!fallbackEntry) return undefined

  return {
    path: appendPath(basePath, fallbackEntry[0]),
    value: fallbackEntry[1],
  }
}

function getTableRowLabel(value: JsonValue, index: number) {
  if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.name === 'string') {
    return value.name
  }

  return `row-${index}`
}
