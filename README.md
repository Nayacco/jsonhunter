# JSON Hunter

JSON Hunter is a frontend JSON workbench for loading raw JSON from paste, file, or URL, then inspecting the current raw node and editing placeholder pipeline steps locally.

## Getting started

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173` to use the local workbench.

## Verification

Run the full local verification pass with:

```bash
npm run typecheck
npm test
npm run e2e
npm run build
```

For a production-bundle smoke check:

```bash
npm run preview -- --host 127.0.0.1
```

Then open `http://127.0.0.1:4173` and walk through paste-project creation plus the Columns, Tree, Table, and Source views.

## Persistence

Projects are stored in IndexedDB under the local `jsonhunter` database.

- URL-backed projects persist metadata only and require an explicit reload after refresh.
- Paste and file projects persist raw JSON only when the UTF-8 payload is 10 MiB or smaller.
- Pipeline metadata, active node, selected path, and active viewer mode are restored from persistence.
- Node execution outputs are not persisted yet.

More implementation notes live in [docs/development.md](/D:/github/jsonhunter/docs/development.md).
