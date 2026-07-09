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
  JSON.stringify(value)
}
