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

Editing an existing node opens the editor for that node. Saving a changed middle node invalidates downstream saved outputs because their inputs may no longer match.

## Run And Save Semantics

`Run` creates a temporary preview only. It updates the JSON result viewer with a draft output but does not commit the node into the saved pipeline.

`Save` stores the node configuration and its latest successful output, collapses the editor back to the flow view, and selects the saved node as the active pipeline endpoint.

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

The app stores data in IndexedDB, not localStorage, because raw JSON and cached pipeline outputs may be large.

The local project store persists:

- Project id and name.
- Raw JSON.
- Pipeline nodes.
- Node type and code or SQL.
- Saved node output cache.
- Active selected pipeline node.
- Result view mode.
- Selected JSON path.
- Relevant UI state.

Refreshing the page or reopening the app restores the last active project and its workbench state.

## Components

Recommended component boundaries:

- `ProjectStore`: IndexedDB access and project lifecycle.
- `PipelineModel`: node list, active node, invalidation state, saved outputs.
- `PipelineExecutor`: runs JS and DuckDB nodes up to a selected endpoint.
- `PipelineFlow`: compact node chain, selection, add-node controls, node states.
- `NodeEditor`: JS or DuckDB editor, Run and Save controls, draft output state.
- `JsonViewer`: columns, tree, and source modes over a shared selection model.
- `DetailsPreview`: selected value, path, provenance, diff, and related values.
- `ErrorBanner`: execution error summary and expanded diagnostics.

Each unit should have a narrow interface so execution logic, persistence, and rendering remain independently testable.

## Data Flow

1. User opens or creates a local project.
2. The app loads `Raw`, pipeline nodes, active node, view mode, and selected path from IndexedDB.
3. Selecting a pipeline node asks the executor for the output from `Raw` through that node.
4. The result viewer renders that output in the chosen view.
5. Selecting a JSON path updates the shared selection model.
6. Details preview renders value details, path, source node, diff, and related values.
7. Editing a node creates a draft. `Run` previews draft output. `Save` persists the node and output, invalidates downstream outputs, and collapses the editor.

## Testing Strategy

Test the system at three levels:

- Pipeline model tests for node selection, inactive downstream nodes, invalidation, and `Raw` rollback.
- Executor tests for JS transform behavior, DuckDB `input` mapping, JSON-serializable outputs, and error propagation.
- UI integration tests for Run versus Save, view switching with preserved path, error banner behavior, and IndexedDB restore after refresh.

Large JSON performance should be checked with representative nested objects and arrays before calling the viewer complete.
