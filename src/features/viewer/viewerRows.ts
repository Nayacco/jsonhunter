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

type ViewerWindowRequest = {
  startIndex: number
  count: number
}

type ChildEntry = {
  label: string
  path: JsonPath
  value: JsonValue
}

export type ViewerWindowRequests = Partial<Record<keyof ViewerRowsByMode, ViewerWindowRequest>>

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

export function deriveViewerRowsFromJson(
  rawValue: JsonValue,
  selectedPath: JsonPath = [],
  windows: ViewerWindowRequests = {},
): Required<ViewerRowsByMode> {
  const scopedValue = selectedPath.length === 0 ? rawValue : getAtPath(rawValue, selectedPath)
  const value = scopedValue === undefined ? rawValue : scopedValue

  return {
    columns: createColumnsWindow(value, selectedPath, windows.columns),
    tree: createTreeWindow(value, selectedPath, windows.tree),
    table: createTableWindow(value, selectedPath, windows.table),
    source: createSourceWindow(value, selectedPath, windows.source),
  }
}

function normalizeWindow(window?: ViewerWindowRequest) {
  return {
    startIndex: Math.max(window?.startIndex ?? 0, 0),
    count: Math.max(window?.count ?? DERIVED_WINDOW_SIZE, 0),
  }
}

function createColumnsWindow(value: JsonValue, basePath: JsonPath, window?: ViewerWindowRequest) {
  const { startIndex, count } = normalizeWindow(window)
  const totalCount = getChildEntryCount(value)
  if (totalCount === 0) {
    return createViewerRowWindow([
      {
        label: basePath.length === 0 ? 'value' : formatPath(basePath),
        path: basePath,
        value: summarizeJson(value).preview,
      },
    ])
  }

  const visibleEntries = getChildEntryWindow(value, basePath, startIndex, count)
  return createViewerRowWindow(
    visibleEntries.map((entry) => ({
      label: entry.label,
      path: entry.path,
      value: summarizeJson(entry.value).preview,
    })),
    totalCount,
    startIndex,
  )
}

function createTreeWindow(value: JsonValue, basePath: JsonPath, window?: ViewerWindowRequest) {
  const { startIndex, count } = normalizeWindow(window)
  const childCountTotal = getChildEntryCount(value)
  const rootLabel = basePath.length === 0 ? 'root' : formatPath(['root', ...basePath])
  const totalCount = childCountTotal + 1
  const rows: ViewerRow[] = []

  if (startIndex === 0 && count > 0) {
    rows.push({
      label: rootLabel,
      path: basePath,
      value: summarizeJson(value).label,
    })
  }

  const childStart = Math.max(startIndex - 1, 0)
  const childCount = startIndex === 0 ? Math.max(count - 1, 0) : count
  const visibleEntries = getChildEntryWindow(value, basePath, childStart, childCount)
  rows.push(
    ...visibleEntries.map((entry) => ({
      label: formatPath(['root', ...entry.path]),
      path: entry.path,
      value: summarizeJson(entry.value).preview,
    })),
  )

  return createViewerRowWindow(rows, totalCount, startIndex)
}

function createTableWindow(value: JsonValue, basePath: JsonPath, window?: ViewerWindowRequest) {
  const { startIndex, count } = normalizeWindow(window)
  const tableSource = getTableSource(value, basePath)
  if (tableSource) {
    const rows = tableSource.value.slice(startIndex, startIndex + count).map((entry, offset) => {
      const index = startIndex + offset
      return {
      label: getTableRowLabel(entry, index),
      path: appendPath(tableSource.path, index),
      value: summarizeJson(entry).preview,
      }
    })
    return createViewerRowWindow(rows, tableSource.value.length, startIndex)
  }

  return createColumnsWindow(value, basePath, window)
}

function createSourceWindow(value: JsonValue, basePath: JsonPath, window?: ViewerWindowRequest) {
  const { startIndex, count } = normalizeWindow(window)
  const source = getSourceLineSource(value, basePath)
  const rows = Array.from({ length: Math.max(Math.min(count, source.totalCount - startIndex), 0) }, (_, offset) =>
    source.getRow(startIndex + offset),
  )

  return createViewerRowWindow(rows, source.totalCount, startIndex)
}

type ViewerTableSource = {
  path: JsonPath
  value: JsonValue[]
}

function getChildEntryCount(value: JsonValue) {
  if (Array.isArray(value)) {
    return value.length
  }

  if (value && typeof value === 'object') {
    let count = 0
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) count += 1
    }
    return count
  }

  return 0
}

function getChildEntryWindow(
  value: JsonValue,
  basePath: JsonPath,
  startIndex: number,
  count: number,
): ChildEntry[] {
  if (count <= 0) return []

  if (Array.isArray(value)) {
    const endIndex = Math.min(value.length, startIndex + count)
    const rows: ChildEntry[] = []
    for (let index = startIndex; index < endIndex; index += 1) {
      rows.push({
        label: String(index),
        path: appendPath(basePath, index),
        value: value[index],
      })
    }
    return rows
  }

  if (value && typeof value === 'object') {
    const endIndex = startIndex + count
    const rows: ChildEntry[] = []
    let currentIndex = 0
    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue
      if (currentIndex >= endIndex) break
      if (currentIndex >= startIndex) {
        rows.push({
          label: key,
          path: appendPath(basePath, key),
          value: value[key],
        })
      }
      currentIndex += 1
    }
    return rows
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

type SourceLineSource = {
  totalCount: number
  getRow(index: number): ViewerRow
}

function getSourceLineSource(value: JsonValue, basePath: JsonPath): SourceLineSource {
  const tableSource = getTableSource(value, basePath)
  if (tableSource) {
    return {
      totalCount: tableSource.value.length + 2,
      getRow(index) {
        if (index === 0) return { label: '{', path: basePath }
        if (index === tableSource.value.length + 1) return { label: '}', path: basePath }
        const itemIndex = index - 1
        return {
          label: JSON.stringify(tableSource.value[itemIndex]),
          path: appendPath(tableSource.path, itemIndex),
        }
      },
    }
  }

  if (Array.isArray(value)) {
    return {
      totalCount: value.length,
      getRow(index) {
        return {
          label: JSON.stringify(value[index]),
          path: appendPath(basePath, index),
        }
      },
    }
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    return {
      totalCount: entries.length + 2,
      getRow(index) {
        if (index === 0) return { label: '{', path: basePath }
        if (index === entries.length + 1) return { label: '}', path: basePath }
        const [key, entry] = entries[index - 1]
        return {
          label: `${JSON.stringify(key)}: ${JSON.stringify(entry)}`,
          path: appendPath(basePath, key),
        }
      },
    }
  }

  return {
    totalCount: 1,
    getRow() {
      return {
        label: JSON.stringify(value),
        path: basePath,
      }
    },
  }
}
