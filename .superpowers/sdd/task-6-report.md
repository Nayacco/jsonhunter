# Task 6 Report — JS and DuckDB Pipeline Execution

## What I implemented
- Updated `src/workers/workerProtocol.ts`:
  - Added `executePipeline` to `WorkerRequest` with `nodes: PipelineNode[]`
  - Added `executePipelineResult` to `WorkerResponse` with `activeNodeId` and `summary`
- Updated `src/workers/workerRuntime.ts`:
  - Added `executePipeline` handling
  - Starts from the current parsed JSON value and throws `Raw JSON is not loaded` if absent
  - Skips the `raw` node, executes `js` nodes via `executeJsNode`, executes `duckdb` nodes via `executeDuckDbNode`
  - Persists the pipeline output back into `currentValue`
  - Returns `executePipelineResult` with the last node id and `summarizeJson(output)`
- Added `src/workers/jsExecution.ts`:
  - Implements `executeJsNode(code, input)`
  - Normalizes `export default` module text into a callable async function via `new Function`
  - Awaits the transform result and validates JSON serialization through `JSON.stringify`
- Added `src/workers/duckDbExecution.ts`:
  - Implements `executeDuckDbNode(sql, input)`
  - Loads `@duckdb/duckdb-wasm`, selects a bundle, instantiates an async worker-backed DB, registers JSON input, runs SQL, and returns JSON rows

## TDD evidence
- Added the required failing test to `src/workers/workerRuntime.test.ts`:
  - `executes JS nodes through the selected endpoint`
- Verified RED first with:
  - `npm test -- src/workers/workerRuntime.test.ts`
  - Failure matched expectation: `executePipeline` returned `workerError` because the request type was unhandled
- Implemented the minimum production code to satisfy that behavior
- Verified GREEN with:
  - `npm test -- src/workers/workerRuntime.test.ts`
  - Passed: `1` file, `4` tests

## Verification run
- `npm test -- src/workers/workerRuntime.test.ts`
  - Passed
- `npm run typecheck`
  - Passed

## Self-review
- Scope stayed within `src/workers/*` plus this report file.
- The JS execution path follows the brief exactly and updates worker state so downstream `getDetails` reads transformed values.
- DuckDB execution is implemented as a real browser-worker path, not a mock.
- No DuckDB runtime test was added in jsdom because the task explicitly allows browser execution coverage to be deferred if WASM worker execution is not available there.

## Concerns
- DuckDB WASM browser execution is implemented and typechecks, but it is not proven in `jsdom` by this task. Per the brief, browser execution coverage should be handled later in Playwright if needed.

## Commit
- Intended commit message: `feat: add pipeline execution worker`

## Review fix notes
- Fixed the runtime state model in `src/workers/workerRuntime.ts` by separating immutable `rawValue` from the active `currentValue`. `parseRaw` now clears both slots on entry, parses once, and assigns the parsed JSON to both raw and active state. `executePipeline` now always starts from `rawValue` and only updates `currentValue` with the newest pipeline output, so repeated runs no longer compound prior transforms.
- Added a regression test in `src/workers/workerRuntime.test.ts` that parses `{"count":1}`, runs the same incrementing JS pipeline twice, and verifies the displayed `count` stays `2` on the second run instead of drifting to `3`.
- Fixed stale async worker responses in `src/workers/jsonWorker.ts` with a latest-job gate. The worker now tracks the newest `jobId` and posts a result or error only when the completing request still matches that newest job. Older async completions are silently dropped.
- Added focused coverage in `src/workers/jsonWorker.test.ts` for both stale-result and stale-error suppression using the extracted `createLatestOnlyMessageHandler` helper.
- Strengthened JS output validation in `src/workers/jsExecution.ts` to reject non-JSON values explicitly instead of trusting `JSON.stringify`. The validator now rejects `undefined`, functions, symbols, non-finite numbers, and non-plain-object instances, including when they appear nested inside arrays or objects.
- Added focused validation tests in `src/workers/jsExecution.test.ts` covering `undefined`, function returns, and nested symbol values.

## Verification after review fixes
- `npm test -- src/workers/workerRuntime.test.ts`
- `npm test -- src/workers/workerClient.test.ts`
- `npm test -- src/workers/jsonWorker.test.ts`
- `npm test -- src/workers/jsExecution.test.ts`
- `npm run typecheck`

## Second re-review fix notes
- Threaded an optional `isCurrent(jobId)` guard into `JsonWorkerRuntime.handle()` and used it to prevent stale `parseRaw` and `executePipeline` requests from committing `rawValue` or `currentValue` after a newer job supersedes them.
- Kept the stale-job design small: `executePipeline` still computes into a local `output`, but only the current job is allowed to publish that output into runtime state; stale parse failures also avoid clearing active state.
- Updated `src/workers/jsonWorker.ts` to pass the latest-job guard down into the runtime, so stale work is discarded both before state commit and again before `postMessage`.
- Added focused runtime regressions in `src/workers/workerRuntime.test.ts` covering stale parse suppression and an older delayed `executePipeline` that finishes after a newer pipeline job but cannot overwrite the active `currentValue`.
- Hardened JS output validation in `src/workers/jsExecution.ts` so sparse arrays are rejected by checking every index with `Object.prototype.hasOwnProperty.call(value, index)` before validating nested entries.
- Added focused sparse-array coverage in `src/workers/jsExecution.test.ts` for both `Array(2)` and `[ , 1 ]`.

## Second re-review verification
- `npm test -- src/workers/workerRuntime.test.ts`
- `npm test -- src/workers/jsonWorker.test.ts`
- `npm test -- src/workers/jsExecution.test.ts`
- `npm run typecheck`

## Third re-review fix notes
- Fixed raw immutability in `src/workers/workerRuntime.ts` by deep-cloning parsed JSON into separate `rawValue` and `currentValue` slots during `parseRaw`, so the raw and active state no longer alias the same object graph.
- Hardened the pipeline entry boundary in `src/workers/workerRuntime.ts` so every `executePipeline` run starts from a deep clone of `rawValue`, which keeps user JS from mutating the stored raw snapshot in place; committed pipeline output is also cloned before becoming the new active value.
- Updated the runtime regression in `src/workers/workerRuntime.test.ts` to use an in-place mutating transform (`input.count += 1; return input`) and verified that running the same pipeline twice still leaves details at `2` instead of drifting to `3`.
- Fixed `src/workers/workerClient.ts` so a new `request()` rejects any older pending promises immediately with a superseded error, matching the worker's latest-only execution model instead of leaving stale callers hanging forever.
- Added focused client coverage in `src/workers/workerClient.test.ts` that starts request A, then request B, verifies A rejects with a superseded error, and confirms B still resolves from the worker response.

## Third re-review verification
- `npm test -- src/workers/workerRuntime.test.ts`
- `npm test -- src/workers/workerClient.test.ts`
- `npm test -- src/workers/jsonWorker.test.ts`
- `npm test -- src/workers/jsExecution.test.ts`
- `npm run typecheck`
