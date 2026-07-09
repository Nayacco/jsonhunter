# JSON Pipeline Workbench Design

## Purpose

Build a pure frontend JSON debugging workbench for browsing JSON, transforming it through a reproducible pipeline, and inspecting the result at any pipeline point.

The product is not a shared online viewer. It has no backend and no public sharing. It persists local projects in the user's browser so refreshes and later visits restore the workbench state.

## Scope

The first version supports:

- Local multi-project workspace stored in IndexedDB.
- One immutable `Raw` node per project.
- Pipeline processing nodes of type `JS` and `DuckDB`.
- Future extension points for additional node types.
- Left/right main layout with pipeline and JSON browsing on the left, details preview on the right.
- Three JSON result views: columns, tree, and readonly source.
- Node execution to the currently selected pipeline node only.
- Safe temporary preview via `Run`; saved pipeline updates only via `Save`.
- Non-destructive error handling that preserves the last successful output.
- Vite, React, TypeScript, Astryx, Zustand, and Worker-based execution.
- Virtualized JSON browsing for large data.

The first version does not support:

- Backend storage.
- URL sharing or public links.
- Manual JSON editing or patch nodes.
- Collaborative editing.

## Main Layout

The page is split into two main panes.

The left pane is the work area. It uses a vertical layout:

- Top: Pipeline Flow.
- Bottom: JSON result viewer.

The right pane is a full-height details preview for the currently selected JSON node.

The Pipeline Flow is compact by default. It shows a left-to-right chain:

```text
Raw -> JS -> DuckDB -> ...
```

When the user adds or edits a processing node, the compact flow expands into a code or SQL editor. After saving, it collapses back to the flow.

## Pipeline Model

Each project has one pipeline. The first node is always `Raw`.

`Raw` stores the original JSON. It is immutable, cannot be deleted, and cannot be edited. Selecting `Raw` restores the view to the original JSON while keeping downstream nodes in the pipeline.

Processing nodes run from left to right. Selecting a node means "execute from `Raw` through this node and show that output." Nodes to the right of the selected node remain visible but are inactive and do not affect the displayed JSON.

Adding a node appends it after the current active pipeline position unless the product later introduces explicit insertion controls.

Editing an existing node opens the editor for that node. Saving a changed middle node invalidates downstream runtime results because their inputs may no longer match.

## Run And Save Semantics

`Run` creates a temporary preview only. It updates the JSON result viewer with a draft output but does not commit the node into the saved pipeline.

`Save` stores the node configuration, promotes the latest successful draft output to the active in-memory result, collapses the editor back to the flow view, and selects the saved node as the active pipeline endpoint. It does not persist node output to IndexedDB.

If the user runs a draft and then leaves without saving, the pipeline remains unchanged.

## Node Types

### Raw

`Raw` is the immutable input node. Its output is the original parsed JSON.

### JS

The JS node uses a function-style API. The default template is:

```js
export default function transform(input) {
  return input
}
```

`input` is the previous node output. The returned value must be JSON-serializable.

### DuckDB

The DuckDB node receives the previous node output as an automatically registered `input` table or view.

For array output, the system exposes the array as rows so users can write:

```sql
select * from input
```

For object output, the system exposes it as a single-row structure or JSON value. The implementation should choose the most ergonomic mapping while keeping the user-facing concept stable: write SQL against `input`, produce JSON output.

The implementation uses `@duckdb/duckdb-wasm` in a Worker. Query results are converted to JSON arrays. Even one-row or one-column results remain arrays so output shape rules stay predictable.

## JSON Result Viewer

The left-bottom result area shows the output for the active pipeline endpoint or the current temporary preview.

It supports three switchable views:

- Columns view.
- Tree view.
- Readonly source view.

The view switcher sits to the left of the breadcrumb, for example:

```text
[Columns] [Tree] [Source] root / data / items / 0
```

All views share:

- Current output data.
- Selected JSON path.
- Search state where practical.
- Copy and path actions.

Switching views should preserve the selected JSON node whenever possible.

## Details Preview

The right pane follows the selected JSON node from the result viewer.

It prioritizes debugging context while still supporting exploration.

For every selection, it should show:

- Current value preview.
- JSON type.
- Full path.
- Source pipeline node.
- Difference from `Raw` or the previous node when available.
- Related values or same-value occurrences.
- Copy value and copy path actions.
- Navigation actions such as locating the value in source view.

For objects and arrays, the pane shows structure summaries such as field count, array length, and child previews. For scalar values, it focuses on the value itself, type, provenance, and related occurrences.

## Error Handling

Errors must not destroy the browsing context.

If `Run` or re-execution fails:

- Keep the last successful JSON output visible in the result viewer.
- Show an error banner near the pipeline or at the top of the result viewer.
- Mark the failing node red in the flow.
- Prevent downstream nodes from running.
- Mark downstream nodes as inactive, blocked, or stale.

Expanding the error banner shows:

- Node name and type.
- Error message.
- JS stack trace or SQL error location when available.
- Input summary.

## Local Persistence

The app stores project state in IndexedDB, not localStorage, because raw JSON can be large.

The app never persists node output caches. Node outputs may be cached in memory during a runtime session as an optimization, but they are not part of the persisted data model.

Raw JSON persistence depends on source type:

- URL source: never persist Raw JSON. Persist only the URL and source metadata. When the project is reopened, show the project and pipeline but require the user to click `Reload from URL` before execution.
- File source: persist Raw JSON only when its UTF-8 byte size is less than or equal to `10 MiB`.
- Paste source: persist Raw JSON only when its UTF-8 byte size is less than or equal to `10 MiB`.

Raw JSON size is calculated from the original JSON text with UTF-8 byte length, using the same rule for file, paste, and URL-loaded text:

```ts
const rawSizeBytes = new TextEncoder().encode(rawJsonText).byteLength
```

When File or Paste Raw JSON is larger than `10 MiB`, store only source metadata and require the user to provide the Raw JSON again after refresh. When any Raw JSON is larger than `100 MiB`, warn the user that loading may consume significant memory and require confirmation before parsing. There is no hard maximum load size in the first version.

The local project store persists:

- Project id and name.
- Raw source type and source metadata.
- Raw JSON only when allowed by the source and size rules above.
- Pipeline nodes.
- Node type and code or SQL.
- Active selected pipeline node.
- Result view mode.
- Selected JSON path.
- Relevant UI state.

Refreshing the page or reopening the app restores the last active project and its workbench state. If Raw JSON is available locally, the app parses it and re-executes the pipeline to the last selected node. If Raw JSON is not available, the app restores the project shell and pipeline but disables execution until the user reloads the URL, reselects the file, or pastes the JSON again.

For URL projects, clicking `Reload from URL` fetches and parses the latest URL content, then automatically executes the pipeline to the last selected node. CORS restrictions apply because the app has no backend proxy.

## Technical Architecture

The app uses:

- Vite with React and TypeScript.
- `@astryxdesign/core` as the preferred UI component system.
- Zustand for frontend state management.
- IndexedDB through a light wrapper such as `idb`.
- TanStack Virtual for virtualized list, column, tree, and source rendering.
- Monaco Editor only for JS and DuckDB SQL node editors.
- `@duckdb/duckdb-wasm` for DuckDB execution.
- Vitest, React Testing Library, and Playwright for tests.

Astryx is the first choice for UI primitives. If a required UI or behavior is not available in Astryx, prefer TanStack libraries where they fit the domain, such as TanStack Virtual. If neither Astryx nor TanStack covers a need, evaluate mature mainstream libraries before building from scratch.

Zustand should be organized into focused slices:

- `projectSlice`: project list, active project, Raw source metadata, restore state.
- `pipelineSlice`: nodes, active node, stale, blocked, and error states.
- `editorSlice`: active editor node, draft JS or SQL, Run preview state.
- `viewerSlice`: view mode, selected path, breadcrumb, search state.
- `workerSlice`: current job, loading state, cancellation, and worker errors.

IndexedDB access should live in a repository or service layer rather than being deeply embedded in Zustand actions.

## Worker Boundary

Expensive work runs outside the main thread.

Workers handle:

- JSON parsing with native `JSON.parse`.
- Pipeline execution.
- JS node execution.
- DuckDB SQL execution.
- Diff calculation.
- Related value and path indexing.
- Data window requests for virtualized views.

The main thread handles:

- Astryx UI rendering.
- Pipeline Flow interaction.
- Monaco node editors.
- JSON viewer rendering.
- Details preview rendering.
- Worker message orchestration.

Initial JSON parsing uses native `JSON.parse` in a Worker. The first version does not use a streaming parser and does not show precise parse percentage. It should show an indeterminate loading state while parsing.

Every parse, run, query, diff, index, and view-window task carries a `jobId`. The UI accepts only the latest relevant job result. Switching nodes, running new code, editing code, or canceling a task invalidates previous jobs. If a task cannot be interrupted directly, stale results are discarded. When necessary, the app may terminate and recreate a Worker.

## JS Execution Boundary

JS nodes run in a dedicated Worker, not on the main thread.

The first version treats JS nodes as user-owned local code, not as untrusted third-party code. It should avoid exposing DOM APIs such as `window` and `document`, but it does not promise a hardened security sandbox.

Future stronger isolation options may include sandboxed iframes, SES, or QuickJS WASM if the product later needs to run untrusted code.

## Virtualized JSON Rendering

All JSON result views are custom viewer implementations. Monaco is not used for JSON viewing.

Columns view virtualizes rows inside each visible column.

Tree view flattens expanded visible nodes into a list and virtualizes that list.

Source view generates visible source lines or chunks on demand and virtualizes those rows. It must not require full pretty-printed JSON text to be stored in React state.

Search, path lookup, related values, and source-line navigation should ask the Worker for indexes or targeted results. The UI should keep lightweight references, summaries, and visible windows rather than full large JSON text or full flattened structures.

Monaco is used only for JS and SQL editing. It should be lazy loaded when a node editor opens to avoid increasing the initial bundle cost.

## Components

Recommended component boundaries:

- `ProjectStore`: IndexedDB access and project lifecycle.
- `PipelineModel`: node list, active node, invalidation state, and runtime result status.
- `PipelineExecutor`: coordinates Worker jobs that run JS and DuckDB nodes up to a selected endpoint.
- `PipelineFlow`: compact node chain, selection, add-node controls, node states.
- `NodeEditor`: lazy Monaco JS or DuckDB editor, Run and Save controls, draft output state.
- `JsonViewer`: columns, tree, and source modes over a shared selection model.
- `DetailsPreview`: selected value, path, provenance, diff, and related values.
- `ErrorBanner`: execution error summary and expanded diagnostics.

Each unit should have a narrow interface so execution logic, persistence, and rendering remain independently testable.

## Data Flow

1. User opens or creates a local project.
2. The app loads Raw source metadata, any persisted Raw JSON, pipeline nodes, active node, view mode, and selected path from IndexedDB.
3. If Raw JSON is available, the app parses it in a Worker and executes to the active node. If Raw JSON is unavailable, the app waits for the user to reload or re-provide it.
4. Selecting a pipeline node asks the executor for the output from `Raw` through that node.
5. The result viewer asks the Worker for the visible data window and renders that output in the chosen view.
6. Selecting a JSON path updates the shared selection model.
7. Details preview asks for value details, path, source node, diff, and related values.
8. Editing a node creates a draft. `Run` previews draft output. `Save` persists the node configuration, invalidates downstream state, and collapses the editor.

## Testing Strategy

Test the system at three levels:

- Pipeline model tests for node selection, inactive downstream nodes, invalidation, and `Raw` rollback.
- Executor tests for JS transform behavior, DuckDB `input` mapping, JSON-serializable outputs, and error propagation.
- UI integration tests for Run versus Save, view switching with preserved path, error banner behavior, and IndexedDB restore after refresh.
- Worker protocol tests for `jobId` invalidation, cancellation, stale result dropping, and unavailable Raw restoration.
- Persistence tests for URL, File, and Paste source rules, including the `10 MiB` Raw persistence threshold.

Large JSON performance should be checked with representative nested objects and arrays before calling the viewer complete.
