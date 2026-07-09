import type { JsonValue } from '../domain/jsonTypes'

export async function executeJsNode(code: string, input: JsonValue): Promise<JsonValue> {
  const normalized = code
    .replace(/export\s+default\s+function\s+transform/, 'return async function transform')
    .replace(/export\s+default\s+function/, 'return async function')
    .replace(/export\s+default/, 'return')

  const factory = new Function(normalized) as () => (input: JsonValue) => JsonValue | Promise<JsonValue>
  const transform = factory()
  const output = await transform(input)
  assertJsonSerializable(output)
  return output
}

function assertJsonSerializable(value: unknown): asserts value is JsonValue {
  assertJsonValue(value, 'result')
}

function assertJsonValue(value: unknown, path: string): asserts value is JsonValue {
  if (value === null) return

  if (typeof value === 'string' || typeof value === 'boolean') return

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`JS pipeline output must be valid JSON: ${path} contains a non-finite number`)
    }
    return
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new Error(`JS pipeline output must be valid JSON: ${path}[${index}] is missing`)
      }
      const entry = value[index]
      assertJsonValue(entry, `${path}[${index}]`)
    }
    return
  }

  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`JS pipeline output must be valid JSON: ${path} is not a plain object`)
    }

    Object.entries(value).forEach(([key, entry]) => {
      assertJsonValue(entry, `${path}.${key}`)
    })
    return
  }

  throw new Error(`JS pipeline output must be valid JSON: ${path} contains ${typeof value}`)
}
