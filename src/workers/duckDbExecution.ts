import type { JsonValue } from '../domain/jsonTypes'

export async function executeDuckDbNode(sql: string, input: JsonValue): Promise<JsonValue> {
  const duckdb = await import('@duckdb/duckdb-wasm')
  const bundles = duckdb.getJsDelivrBundles()
  const bundle = await duckdb.selectBundle(bundles)
  const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' }))
  const worker = new Worker(workerUrl)
  const logger = new duckdb.ConsoleLogger()
  const db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  const connection = await db.connect()
  try {
    const rows = Array.isArray(input) ? input : [input]
    await db.registerFileText('input.json', JSON.stringify(rows))
    await connection.insertJSONFromPath('input.json', { name: 'input' })
    const result = await connection.query(sql)
    return result.toArray().map((row) => row.toJSON()) as JsonValue
  } finally {
    await connection.close()
    await db.terminate()
    worker.terminate()
    URL.revokeObjectURL(workerUrl)
  }
}
