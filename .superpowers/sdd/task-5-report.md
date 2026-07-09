# Task 5 Report — Worker Protocol, JSON Parsing, and View Requests

## What I implemented
- Added `src/workers/workerProtocol.ts` with the required request/response union types:
  - `WorkerRequest` variants: `parseRaw`, `getDetails`, `getViewWindow`
  - `WorkerResponse` variants: `parseRawResult`, `detailsResult`, `viewWindowResult`, `workerError`
- Added `src/workers/workerRuntime.ts` with `JsonWorkerRuntime`:
  - Stores current parsed JSON in `currentValue`
  - `handle` supports `parseRaw`, `getDetails`, and `getViewWindow`
  - Returns `workerError` on thrown runtime exceptions
  - Uses `getAtPath` and `summarizeJson` from domain modules
- Added `src/workers/jsonWorker.ts`:
  - Registers a worker message handler, executes runtime requests, posts responses
- Added `src/workers/workerClient.ts`:
  - Constructs a typed module worker for `./jsonWorker.ts`
  - Implements `request()` with promise-based pending map
  - Implements `terminate()` and pending cleanup

## Tests added
- Created `src/workers/workerRuntime.test.ts` (TDD-first):
  - Verifies `parseRaw` returns `{ type: 'parseRawResult', summary.type: 'object', childCount: 1 }`
  - Verifies `getDetails` returns expected `value: 1` and echoes path

## Verification run
- `npm test -- src/workers/workerRuntime.test.ts`
  - Initially failed before implementation due to missing `src/workers/workerRuntime.ts`
  - Passed after implementation (`1 test file, 2 tests`)
- `npm run typecheck`
  - Passed

## Self-review
- Type contracts and runtime behavior match task brief exactly.
- Error handling in runtime is centralized and includes optional stack.
- `getDetails` and `getViewWindow` safely handle missing `currentValue` (undefined path returns undefined/empty window).
- No behavior beyond Task 5 requested scope was added.

## Concerns
- None blocking.

## Review Fix Notes (post-review)

- Fixed stale runtime state in `src/workers/workerRuntime.ts`: `parseRaw` now clears `currentValue` before parsing so failed parses cannot leave prior JSON in state.
- Added regression test `invalid parse clears current value so details reflect failure state` in `src/workers/workerRuntime.test.ts` to verify `getDetails` returns `value: undefined` after a parse failure.
- Updated `src/workers/workerClient.ts` pending request handling to store `{resolve, reject}`:
  - pending promises now reject on `worker` `error` and `messageerror` events
  - `terminate()` now rejects all pending promises with `Error('Worker was terminated')` instead of silently clearing them
- Added `src/workers/workerClient.test.ts` with focused tests for:
  - terminate-based pending rejection
  - worker `error` event rejection
  - worker `messageerror` rejection

## Extra checks
- `npm test -- src/workers/workerRuntime.test.ts src/workers/workerClient.test.ts` (pass)
