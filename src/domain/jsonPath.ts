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
