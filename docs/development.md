# Development Notes

## Architecture

JSON Hunter is a Vite + React frontend with no backend services. The app shell lives in `src/app`, persistence is handled through IndexedDB in `src/persistence`, and worker-facing execution/parsing helpers live in `src/workers`.

The current workbench flow is:

1. Create or restore a project from pasted JSON, a local file, or a URL.
2. Persist project metadata and eligible raw payloads through `ProjectRepository`.
3. Render the pipeline strip, active editor/viewer pane, and details preview from shared Zustand state.

## Viewer and pipeline notes

- The raw node uses the four viewer modes in `src/features/viewer`: Columns, Tree, Table, and Source.
- Raw viewer rows are derived from the in-memory `rawValue` in `App` and passed into `JsonViewer` as bounded windows.
- Viewer rows are rendered through `VirtualRows`, which keeps the fallback DOM footprint bounded instead of rendering an entire large result set at once.
- JS and DuckDB nodes share the Monaco-backed editor surface in `NodeEditor`.
- Processing-node execution still is not connected; Run shows the current placeholder error state.
- The details panel summarizes the selected JSON path and keeps provenance anchored to the active pipeline node.

## Persistence rules

- The IndexedDB database name is `jsonhunter`.
- Raw JSON from URL sources is never persisted.
- Raw JSON from paste/file sources is persisted only when the UTF-8 byte size is at or below `10 * 1024 * 1024`.
- Node outputs are not persisted.
- When persisted raw JSON is unavailable on refresh, the restore panel prompts the user to paste again, reselect the file, or reload the URL.

## Verification workflow

Use this sequence before handing off changes:

```bash
npm run typecheck
npm test
npm run e2e
npm run build
```

For bundle inspection, start a short-lived preview server:

```bash
npm run preview -- --host 127.0.0.1
```

Check the locally built app at `http://127.0.0.1:4173`, verify paste-project creation, and switch through Columns, Tree, Table, and Source without layout overlap at desktop width.
