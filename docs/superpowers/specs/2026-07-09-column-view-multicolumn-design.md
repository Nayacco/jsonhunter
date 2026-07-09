# Column View Multicolumn Design

Date: 2026-07-09

## Goal

Change the JSON viewer's `columns` mode from a single scoped list into a Finder-style multicolumn browser. Clicking into an expandable object or array keeps ancestor columns visible and loads the selected child as a new column on the right.

The user approved this direction with one constraint: the app UI must use Astryx components and tokens, not a custom visual system.

## Current Behavior

`ColumnsView` receives one `ViewerRowWindow` for the current `selectedPath`. Clicking a row calls `onSelectPath(row.path)`, `App` derives a new rows object scoped to that path, and the previous level disappears.

This is correct for tree/table/source scoping, but it does not match the intended column browser interaction.

## Intended Interaction

- The first column always represents `root`.
- Clicking an expandable object or array row appends its children as a new column to the right.
- Ancestor columns remain visible.
- If the user clicks a different row in an earlier column, every column to the right of that row is replaced by the new branch.
- Clicking a primitive value still updates `selectedPath` and details, but does not add an empty right-side column.
- The current path chain should be visually selected across columns.
- Existing mode switching and breadcrumb behavior should continue to use the same persisted `selectedPath`.

## Architecture

Add a column-specific view model in `viewerRows.ts` instead of making `ColumnsView` infer tree structure from a single row window.

Proposed data shape:

```ts
export type ViewerColumn = {
  id: string
  title: string
  path: JsonPath
  rows: ViewerRowWindow
  selectedChildPath?: JsonPath
}
```

Add `deriveColumnViewFromJson(rawValue, selectedPath, windows)`:

- Start at `root` path `[]`.
- Walk the selected path segment by segment.
- For each path whose value is an object or array, create a `ViewerColumn` with its child rows.
- Stop before adding a column for a primitive leaf.
- Keep windowing bounded per column so large arrays are not fully read.

`deriveViewerRowsFromJson` can stay as the scoped model for tree/table/source. `App` should pass the raw/displayed JSON value to the column view model only when needed.

## Astryx UI Design

Implementation must follow `AGENTS.md`:

- Use Astryx components for structure and controls, especially `Section`, `HStack`, `VStack`, `Item`, `Heading`, `Text`, `Button`, and `EmptyState`.
- Do not introduce raw `<div>` layout wrappers in app code.
- Dense JSON rows stay edge-to-edge inside each column; do not wrap every row in cards.
- Use Astryx props first. If CSS is needed for column width, overflow, selected state, or borders, use existing class names with Astryx tokens such as `var(--color-*)`, `var(--spacing-*)`, and `var(--radius-*)`.
- Do not use raw hex colors, raw pixel values in CSS, Tailwind utilities, or a new custom design language.

The visual target is the approved mockup: fixed-width columns in a horizontal scroller, each with a compact header and a compact row list.

## Components

- `ColumnsView`
  - Receives a `columns` view model instead of one `rows` window.
  - Renders a horizontally scrolling set of column panels.
  - Emits `onSelectPath` for row clicks.
  - Emits `onColumnWindowChange(path, window)` for virtualized column scrolling.

- `viewerRows.ts`
  - Exposes helpers for deriving child-row windows at arbitrary paths.
  - Reuses existing bounded child-entry logic so large JSON arrays remain safe.

- `App`
  - Maintains column windows keyed by path while keeping existing mode windows for other views.
  - Clears column windows when displayed source changes.
  - Keeps `selectedPath` as the single source of truth for breadcrumb/details/persistence.

## Testing

Use TDD before production edits.

Add unit tests for the new column derivation:

- Root selection produces only the root column.
- Selecting an expandable nested path produces root plus each expandable ancestor column.
- Selecting a primitive leaf highlights/selects the primitive row but does not add an empty primitive column.
- Switching branches replaces right-side descendants because the model is derived from `selectedPath`.
- Large arrays only read the requested window for each column.

Add React tests for `ColumnsView`:

- Renders multiple columns at once.
- Clicking a nested row keeps ancestor column labels visible.
- Empty/non-expandable values use Astryx empty/value presentation instead of a blank column.

Run the existing unit test suite and typecheck after implementation.
