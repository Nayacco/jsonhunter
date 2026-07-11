# Source JSON Viewer Design

Date: 2026-07-11

## Goal

Change the JSON viewer's `source` mode from a plain list of pretty-printed rows into a structured, readonly JSON source viewer similar to the approved screenshot: indented JSON, visible nesting guides, collapsible object and array branches, and syntax-colored tokens.

The source view remains a JSON browser, not an editor.

## Decision

Use a custom readonly JSON viewer for the default `source` mode instead of Monaco.

Monaco stays appropriate for the pipeline node editor, where users edit JavaScript and SQL. The source view has different requirements: select JSON paths, preserve app breadcrumb state, virtualize large data, and fold JSON branches by data path. Those behaviors fit the existing `ViewerRowWindow`, `VirtualRows`, and `selectedPath` model better than a text editor model.

Monaco can be added later as a secondary raw-text view if the product needs editor-native search, full-text copy, or diagnostics. It should not replace the primary source browser.

## Intended Interaction

- The source view shows the full displayed JSON, not only the currently selected path.
- Clicking a source row updates `selectedPath` and the breadcrumb/details panel.
- Object and array opening rows have disclosure controls.
- Collapsing a branch hides descendant rows while keeping sibling rows visible.
- Indentation guide rails show nesting depth.
- Keys, strings, numbers, booleans, null, punctuation, and commas are visually distinguishable.
- The view remains readonly. Users cannot edit JSON in source mode.
- The existing `Reset path` action remains available.

## Architecture

Extend the source row model instead of introducing a text editor abstraction.

`viewerRows.ts` should continue to derive `source` rows from the JSON value, but source rows should expose enough metadata for rendering tokenized JSON:

- `path`: JSON path represented by the row.
- `depth`: nesting depth.
- `hasChildren`: whether the row represents an expandable object or array.
- row kind or token parts for object open, array open, property scalar, primitive, and close rows.

`SourceView` should manage collapsed paths locally, matching the existing tree view pattern. When the full row set is available in the current window, it can filter hidden descendants client-side. If source windowing is partial, it should still render the provided rows and keep virtualization behavior intact.

`VirtualRows` should remain the scrolling primitive so large JSON files do not force the UI to render every visible line at once.

## Astryx UI Design

Implementation must follow `AGENTS.md`:

- Use Astryx components for structure and controls, especially `Section`, `HStack`, `VStack`, `Heading`, `Text`, `Icon`, `IconButton`, `Button`, and `EmptyState`.
- Do not add raw layout `<div>` wrappers in app feature code.
- Dense source lines stay edge-to-edge in the scroll area.
- Use Astryx tokens for custom CSS: `var(--color-*)`, `var(--spacing-*)`, `var(--radius-*)`, and size tokens.
- Do not use raw hex colors, raw pixel values, Tailwind utilities, or a new custom design system.

The visual target is a compact JSON code browser with a light background, monospaced text, subtle guide rails, and clear but restrained token colors.

## Components

- `SourceView`
  - Renders tokenized JSON rows with indentation guides.
  - Handles path selection and branch collapse/expand.
  - Keeps the existing empty state and reset action.

- `viewerRows.ts`
  - Adds source-specific metadata while preserving existing source window behavior.
  - Keeps source rows anchored to the full JSON when `selectedPath` changes.

- `app.css`
  - Adds source row, token, disclosure spacer, and guide rail styles using Astryx tokens.
  - Reuses the existing virtual scroll surface where practical.

## Testing

Use TDD before production edits.

Add unit tests for source row derivation:

- Source rows include path, depth, and child metadata for objects and arrays.
- Pretty JSON output remains anchored to the full JSON after selecting a path.
- Scalar rows and close rows map to sensible paths.

Add React tests for `SourceView`:

- Renders JSON with branch disclosure controls.
- Clicking a source line updates the selected path.
- Collapsing a branch hides descendant source rows and preserves siblings.
- Nested rows render guide metadata for depth.

Run the unit suite and typecheck after implementation.
