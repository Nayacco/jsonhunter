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
