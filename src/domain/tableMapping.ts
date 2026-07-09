import { appendPath, formatPath } from './jsonPath'
import { getJsonType, type JsonPath, type JsonValue } from './jsonTypes'

export type TableColumn = {
  id: string
  label: string
}

export type TableCell = {
  value: JsonValue | undefined
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
          path: { value: formatPath(basePath), path: basePath, type: 'string' },
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
        const cellValue = (item as Record<string, JsonValue | undefined>)[key]
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
