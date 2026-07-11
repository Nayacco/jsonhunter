import { appendPath, formatPath, getAtPath } from '../../domain/jsonPath'
import { summarizeJson } from '../../domain/jsonSummary'
import type { JsonPath, JsonValue } from '../../domain/jsonTypes'

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

export type ViewerRowWindow = {
  startIndex: number
  totalCount: number
  rows: ViewerRow[]
}

export type ViewerColumn = {
  id: string
  title: string
  path: JsonPath
  rows: ViewerRowWindow
  selectedChildPath?: JsonPath
}

export type ViewerRowsByMode = {
  columns?: ViewerRowWindow
  tree?: ViewerRowWindow
  table?: ViewerRowWindow
  source?: ViewerRowWindow
}

const DERIVED_WINDOW_SIZE = 8

export type ViewerWindowRequest = {
  startIndex: number
  count: number
}

type ChildEntry = {
  label: string
  path: JsonPath
  value: JsonValue
}

export type ViewerWindowRequests = Partial<Record<keyof ViewerRowsByMode, ViewerWindowRequest>>
export type ColumnWindowRequests = Record<string, ViewerWindowRequest | undefined>

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
    tree: createTreeWindow(rawValue, []),
    table: createTableWindow(value, selectedPath, windows.table),
    source: createSourceWindow(rawValue, [], windows.source),
  }
}

export function deriveColumnViewFromJson(
  rawValue: JsonValue,
  selectedPath: JsonPath = [],
  windows: ColumnWindowRequests = {},
): ViewerColumn[] {
  const columns: ViewerColumn[] = []
  let columnPath: JsonPath = []

  while (true) {
    const value = columnPath.length === 0 ? rawValue : getAtPath(rawValue, columnPath)
    if (!isColumnExpandable(value)) break

    const id = getColumnId(columnPath)
    const selectedChildPath =
      selectedPath.length > columnPath.length
        ? appendPath(columnPath, selectedPath[columnPath.length])
        : undefined

    columns.push({
      id,
      title: getColumnTitle(columnPath),
      path: columnPath,
      rows: createColumnsWindow(value, columnPath, windows[id]),
      selectedChildPath,
    })

    if (!selectedChildPath) break
    columnPath = selectedChildPath
  }

  return columns
}

export function getColumnId(path: JsonPath) {
  return path.length === 0 ? 'root' : formatPath(path)
}

function normalizeWindow(window?: ViewerWindowRequest) {
  return {
    startIndex: Math.max(window?.startIndex ?? 0, 0),
    count: Math.max(window?.count ?? DERIVED_WINDOW_SIZE, 0),
  }
}

function getColumnTitle(path: JsonPath) {
  if (path.length === 0) return 'root'
  const segment = path[path.length - 1]
  return typeof segment === 'number' ? `Index ${segment}` : segment
}

function isColumnExpandable(value: JsonValue | undefined) {
  return Array.isArray(value) || (value !== null && typeof value === 'object')
}

function createColumnsWindow(value: JsonValue, basePath: JsonPath, window?: ViewerWindowRequest) {
  const { startIndex, count } = normalizeWindow(window)
  const totalCount = getChildEntryCount(value)
  if (totalCount === 0) {
    return createViewerRowWindow([
      {
        label: basePath.length === 0 ? 'value' : formatPath(basePath),
        path: basePath,
        value: summarizeColumnValue(value),
      },
    ])
  }

  const visibleEntries = getChildEntryWindow(value, basePath, startIndex, count)
  return createViewerRowWindow(
    visibleEntries.map((entry) => ({
      label: entry.label,
      path: entry.path,
      value: summarizeColumnValue(entry.value),
    })),
    totalCount,
    startIndex,
  )
}

function summarizeColumnValue(value: JsonValue) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const fieldCount = getChildEntryCount(value)
    return `${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'}`
  }

  return summarizeJson(value).preview
}

function createTreeWindow(value: JsonValue, basePath: JsonPath) {
  const rows: ViewerRow[] = []

  function emit(currentValue: JsonValue, path: JsonPath) {
    const isRoot = path.length === basePath.length
    rows.push({
      label: isRoot ? 'root' : String(path[path.length - 1]),
      path,
      value: summarizeColumnValue(currentValue),
      depth: path.length - basePath.length,
      hasChildren: getChildEntryCount(currentValue) > 0,
    })
  }

  function visit(currentValue: JsonValue, path: JsonPath) {
    emit(currentValue, path)

    if (Array.isArray(currentValue)) {
      for (let index = 0; index < currentValue.length; index += 1) {
        visit(currentValue[index], appendPath(path, index))
      }
      return
    }

    if (currentValue && typeof currentValue === 'object') {
      for (const key in currentValue) {
        if (Object.prototype.hasOwnProperty.call(currentValue, key)) {
          visit(currentValue[key], appendPath(path, key))
        }
      }
    }
  }

  visit(value, basePath)

  return createViewerRowWindow(rows)
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
  const source = getSourceLineSource(value, basePath, startIndex, count)

  return createViewerRowWindow(source.rows, source.totalCount, startIndex)
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
  rows: ViewerRow[]
}

function getSourceLineSource(
  value: JsonValue,
  basePath: JsonPath,
  startIndex: number,
  count: number,
): SourceLineSource {
  const rows: ViewerRow[] = []
  const endIndex = startIndex + count
  let currentIndex = 0

  function emit(row: ViewerRow) {
    if (currentIndex >= startIndex && currentIndex < endIndex) rows.push(row)
    currentIndex += 1
  }

  appendSourceValueRows({ emit }, value, basePath, 0, false)

  return {
    totalCount: currentIndex,
    rows,
  }
}

type SourceRowContext = {
  emit(row: ViewerRow): void
}

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
