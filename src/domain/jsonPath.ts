import type { JsonPath, JsonPathSegment, JsonValue } from './jsonTypes'

export function formatPath(path: JsonPath): string {
  return path
    .map((segment, index) => formatPathSegment(segment, index === 0))
    .join('')
}

export function parsePath(input: string): JsonPath {
  const result: JsonPath = []
  let currentSegment = ''

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (char === '.') {
      if (currentSegment) result.push(currentSegment)
      currentSegment = ''
      continue
    }

    if (char === '[') {
      if (currentSegment) {
        result.push(currentSegment)
        currentSegment = ''
      }

      const bracketValue = parseBracketSegment(input, index)
      result.push(bracketValue.value)
      index = bracketValue.nextIndex
      continue
    }

    currentSegment += char
  }

  if (currentSegment) result.push(currentSegment)
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

function formatPathSegment(segment: JsonPathSegment, isFirst: boolean): string {
  if (typeof segment === 'number') {
    return `[${segment}]`
  }

  if (isSafeSegment(segment)) {
    return isFirst ? segment : `.${segment}`
  }

  return `[${JSON.stringify(segment)}]`
}

function isSafeSegment(segment: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)
}

function parseBracketSegment(input: string, index: number): { nextIndex: number; value: JsonPathSegment } {
  if (index + 1 >= input.length) {
    throw new Error(`Invalid JSON path: ${input}`)
  }

  const openingBracketIndex = index
  const nextChar = input[index + 1]

  if (nextChar === '"' || nextChar === "'") {
    let segment = ''
    let currentIndex = index + 2
    const quote = nextChar

    while (currentIndex < input.length) {
      const char = input[currentIndex]
      if (char === '\\') {
        const escaped = input[currentIndex + 1]
        if (escaped === undefined) throw new Error(`Invalid JSON path: ${input}`)
        segment += escaped
        currentIndex += 2
        continue
      }
      if (char === quote) {
        if (input[currentIndex + 1] !== ']') throw new Error(`Invalid JSON path: ${input}`)
        return { nextIndex: currentIndex + 1, value: segment }
      }
      segment += char
      currentIndex += 1
    }

    throw new Error(`Invalid JSON path: ${input}`)
  }

  const closingBracketIndex = input.indexOf(']', index)
  if (closingBracketIndex === -1) throw new Error(`Invalid JSON path: ${input}`)

  const rawSegment = input.slice(openingBracketIndex + 1, closingBracketIndex)
  const numericSegment = Number(rawSegment)
  if (!Number.isInteger(numericSegment) || String(numericSegment) !== rawSegment) {
    throw new Error(`Invalid JSON path: ${input}`)
  }

  return { nextIndex: closingBracketIndex, value: numericSegment }
}
