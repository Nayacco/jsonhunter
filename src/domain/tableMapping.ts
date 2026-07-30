import { appendPath, getAtPath, parsePath } from './jsonPath'
import { getJsonType, type JsonPath, type JsonValue } from './jsonTypes'

export type TableKind = 'primitive' | 'object' | 'matrix'

export type TableColumn = {
  id: string
  label: string
}

export type TableCell = {
  text: string
  value: JsonValue | undefined
  path: JsonPath | undefined
  type: ReturnType<typeof getJsonType>
}

export type TableModel = {
  kind: TableKind
  basePath: JsonPath
  columns: TableColumn[]
  rowCount: number
  getRowId(rowIndex: number): string
  getRowPath(rowIndex: number): JsonPath
  getCell(rowIndex: number, columnId: string): TableCell
}

export type TableModelErrorCode =
  | 'invalid-path'
  | 'path-not-found'
  | 'target-not-array'
  | 'mixed-item-types'

export type TableModelResult =
  | { status: 'ready'; model: TableModel }
  | { status: 'empty'; reason: 'no-rows' | 'no-columns'; basePath: JsonPath }
  | {
      status: 'error'
      code: TableModelErrorCode
      title: string
      message: string
      detectedKinds?: TableKind[]
    }

type TableRowEntry = {
  sourceIndex: number
  value: Exclude<JsonValue, null>
}

export function resolveTableModel(rootValue: JsonValue, address: string): TableModelResult {
  const normalizedAddress = address.trim()
  let basePath: JsonPath

  try {
    basePath = normalizedAddress === '' ? [] : parsePath(normalizedAddress)
  } catch {
    return {
      status: 'error',
      code: 'invalid-path',
      title: 'Invalid table path',
      message: `“${address}” is not a valid JSON navigation path.`,
    }
  }

  const target = basePath.length === 0 ? rootValue : getAtPath(rootValue, basePath)
  if (target === undefined) {
    return {
      status: 'error',
      code: 'path-not-found',
      title: 'Table path not found',
      message: `No data exists at “${normalizedAddress}”.`,
    }
  }

  if (!Array.isArray(target)) {
    return {
      status: 'error',
      code: 'target-not-array',
      title: 'Table data must be an array',
      message: normalizedAddress
        ? `The value at “${normalizedAddress}” is ${getJsonType(target)}, not an array.`
        : `The root value is ${getJsonType(target)}, not an array.`,
    }
  }

  return buildArrayTableModel(target, basePath)
}

function buildArrayTableModel(value: JsonValue[], basePath: JsonPath): TableModelResult {
  const rows: TableRowEntry[] = []

  value.forEach((item, sourceIndex) => {
    if (item !== null) rows.push({ sourceIndex, value: item })
  })

  if (rows.length === 0) {
    return { status: 'empty', reason: 'no-rows', basePath }
  }

  const detectedKinds = Array.from(new Set(rows.map((row) => getTableKind(row.value))))
  if (detectedKinds.length > 1) {
    return {
      status: 'error',
      code: 'mixed-item-types',
      title: 'Table data has mixed item types',
      message: `Found ${detectedKinds.join(', ')} rows. Use an array containing only one row shape.`,
      detectedKinds,
    }
  }

  const kind = detectedKinds[0]
  const columns = getColumns(kind, rows)
  if (columns.length === 0) {
    return { status: 'empty', reason: 'no-columns', basePath }
  }

  return {
    status: 'ready',
    model: createTableModel(kind, basePath, columns, rows),
  }
}

function getTableKind(value: Exclude<JsonValue, null>): TableKind {
  if (Array.isArray(value)) return 'matrix'
  if (typeof value === 'object') return 'object'
  return 'primitive'
}

function getColumns(kind: TableKind, rows: TableRowEntry[]): TableColumn[] {
  if (kind === 'primitive') return [{ id: 'value', label: 'value' }]

  if (kind === 'object') {
    const keys = new Set<string>()
    for (const row of rows) {
      for (const key of Object.keys(row.value as Record<string, JsonValue>)) keys.add(key)
    }
    return Array.from(keys, (key) => ({ id: key, label: key }))
  }

  const columnCount = rows.reduce(
    (maximum, row) => Math.max(maximum, (row.value as JsonValue[]).length),
    0,
  )
  return Array.from({ length: columnCount }, (_, index) => ({
    id: String(index),
    label: String(index),
  }))
}

function createTableModel(
  kind: TableKind,
  basePath: JsonPath,
  columns: TableColumn[],
  rows: TableRowEntry[],
): TableModel {
  function getRow(rowIndex: number) {
    const row = rows[rowIndex]
    if (!row) throw new RangeError(`Table row ${rowIndex} is outside the model.`)
    return row
  }

  function getRowPath(rowIndex: number) {
    return appendPath(basePath, getRow(rowIndex).sourceIndex)
  }

  return {
    kind,
    basePath,
    columns,
    rowCount: rows.length,
    getRowId(rowIndex) {
      return String(getRow(rowIndex).sourceIndex)
    },
    getRowPath,
    getCell(rowIndex, columnId) {
      const row = getRow(rowIndex)
      const rowPath = getRowPath(rowIndex)

      if (kind === 'primitive') {
        return createCell(row.value, rowPath)
      }

      if (kind === 'object') {
        const record = row.value as Record<string, JsonValue>
        if (!Object.prototype.hasOwnProperty.call(record, columnId)) return createMissingCell()
        return createCell(record[columnId], appendPath(rowPath, columnId))
      }

      const columnIndex = Number(columnId)
      const matrixRow = row.value as JsonValue[]
      if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= matrixRow.length) {
        return createMissingCell()
      }
      return createCell(matrixRow[columnIndex], appendPath(rowPath, columnIndex))
    },
  }
}

function createCell(value: JsonValue, path: JsonPath): TableCell {
  return {
    text: formatCellText(value),
    value,
    path,
    type: getJsonType(value),
  }
}

function createMissingCell(): TableCell {
  return {
    text: '',
    value: undefined,
    path: undefined,
    type: 'undefined',
  }
}

function formatCellText(value: JsonValue) {
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
