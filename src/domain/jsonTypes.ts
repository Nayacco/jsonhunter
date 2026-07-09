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
