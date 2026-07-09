# Task 2 Report — Domain Types, Paths, Summaries, and Table Mapping

## Scope Completed
- Added domain types and utility modules under `src/domain`:
  - `jsonTypes.ts`
  - `jsonPath.ts`
  - `jsonSummary.ts`
  - `projectTypes.ts`
  - `pipelineTypes.ts`
  - `viewTypes.ts`
  - `tableMapping.ts`
- Added Task 2 test coverage under `src/domain`:
  - `jsonPath.test.ts`
  - `jsonSummary.test.ts`
  - `tableMapping.test.ts`
- Implementations follow the exact signatures and behavior from the Task 2 brief.

## Commands and Outcomes
- `npm test -- src/domain/jsonPath.test.ts src/domain/jsonSummary.test.ts src/domain/tableMapping.test.ts`
  - Initial run (before implementation): failed with expected module-not-found errors.
  - Final run: passed (3 files, 5 tests).
- `npm run typecheck` — passed.

## Commit
- `feat: add JSON domain primitives`
- Committed after all specified domain changes and tests in `src/domain`.

## Notes
- `npm install` was required in this environment before first test run because dev dependencies were not yet installed.
- No deviations from the specified interfaces in the brief were introduced.

## Review Fix Report (Task 2 follow-up)
- Fixed `src/domain/jsonPath.ts` to support lossless path formatting/parsing for arbitrary string keys:
  - Added safe/simple-segment formatting so common names remain readable (`a.b[0].c`).
  - Added bracket-quoted string segments (`[\"key.with.dot\"]`) with escaped content for keys containing `.`, `[`, `]`, empty keys, or other unsafe characters.
  - Updated parser to handle quoted/bracket string segments and numeric bracket segments, returning the exact original segment types.
- Fixed `src/domain/tableMapping.ts` to avoid collapsing missing object fields to `null`:
  - Kept `TableCell.value` nullable-aware as `JsonValue | undefined`.
  - Removed `?? null` fallback when mapping object-array rows so missing keys stay `undefined` and explicit `null` stays `null`.
- Fixed scalar fallback path rendering in `buildTableModel` by using `formatPath(basePath)` instead of `basePath.join('.')`.
- Added tests:
  - `src/domain/jsonPath.test.ts`: round-trip for arbitrary keys including dots/brackets/quotes/empty keys.
  - `src/domain/tableMapping.test.ts`: missing-vs-null cell behavior and numeric-segment path formatting for scalar rows.

## Re-Run Results (fix pass)
- `npm test -- src/domain/jsonPath.test.ts src/domain/jsonSummary.test.ts src/domain/tableMapping.test.ts`
  - `3 passed | 8 tests`
- `npm run typecheck`
  - `tsc -b` passed.
