# JSON Import Landing Page Design

## Purpose

Replace the current pre-import workbench layout with a dedicated, full-page landing experience. Importing valid JSON is the prerequisite for every workbench feature, so the application must not show empty Pipeline, Viewer, or Details regions before raw JSON has loaded.

The page may take information-architecture inspiration from [JSON Hero](https://jsonhero.io/)—a focused import action followed by product capability explanations—but it must use its own composition, copy, and Astryx visual language.

## Goals

- Make JSON import the complete initial experience rather than a module inside an empty workbench.
- Give file selection, URL loading, and pasted JSON equal visual weight.
- Explain the product using only capabilities that already exist.
- Preserve all current import, restore, project-switching, worker, and persistence behavior unless this design explicitly changes its presentation.
- Enter the existing three-region workbench immediately after a successful parse.

## Non-Goals

- Adding sample JSON documents or example API shortcuts.
- Adding authentication, cloud upload, sharing, or server-side storage.
- Changing pipeline execution, JSON parsing, persistence records, or Zustand domain state.
- Redesigning the loaded workbench, JSON viewer, pipeline editor, or details inspector.
- Copying JSON Hero branding, illustrations, screenshots, colors, or wording.

## Chosen Direction

Use three equal import cards beneath a centered product introduction.

On desktop, the cards form a single three-column row. On medium widths they reflow to two columns with the third card on the next row. On narrow screens they form one vertical column. All three card headings remain visible at every width; tabs or other controls must not hide an import method.

The visual direction is a restrained, dark, editorial data-tool surface. The memorable element is the clear transition from three equivalent starting routes into one focused workbench. Astryx theme tokens and component variants provide the final color, typography, elevation, spacing, and shape treatment.

## Page Frame and Region Budget

The landing page uses its own Astryx `AppShell` with `height="auto"` so the capability narrative can extend below the viewport. It does not render inside the existing workbench shell.

Desktop region budget:

- Top navigation: approximately 56 px.
- Hero and import region: at least 600 px, including heading, three import cards, and trust copy.
- Capability introduction: content-driven sections below the hero.
- Footer: compact product identity and local-first description.

The content column is centered and capped so the three import cards remain readable on wide displays. Region dimensions should use Astryx component sizing props where available; custom styling uses Astryx tokens rather than raw visual values.

## Information Architecture

### Top Navigation

The top navigation contains the JSON Hunter identity and a concise product descriptor. When the landing page was opened from an already loaded project, the end slot contains `Back to current project`.

The navigation does not introduce unrelated product links or menus.

### Hero

The hero establishes the product promise in one heading and one short paragraph. Copy remains in English to match the existing application surface.

Proposed direction:

- Eyebrow: `Inspect · Transform · Understand`
- Heading: `Make complex JSON feel navigable.`
- Description: `Open a file, load a URL, or paste raw JSON. Every route leads to the same focused workbench.`

Final wording may be polished during implementation without changing meaning or adding unsupported claims.

### Equal Import Grid

The grid contains three discrete, equal-height `Card` regions:

1. **Open a file** — Astryx `FileInput` in drop-zone mode, accepting `.json` and `application/json`.
2. **Load from URL** — Astryx `TextInput` and submit `Button`.
3. **Paste JSON** — Astryx `TextArea` and submit `Button`.

The cards share consistent heading placement, control height, action placement, loading treatment, and error space. File import may submit immediately after selection; URL and pasted JSON submit through forms so pressing Enter works where appropriate.

### Trust Copy

A compact line under the import grid may state only behavior supported by the application:

- Runs in the browser.
- Warns before parsing memory-risk JSON.
- Stores project state locally.

This is supporting copy, not a badge row or decorative status display.

### Capability Introduction

The capability section uses Astryx `Section`, `Grid`, `Stack`, `Heading`, and `Text`, not a repeated marketing-card grid. It introduces three existing capability groups:

1. **Inspect** — Columns, Tree, Table, and Source views stay connected to the selected JSON path.
2. **Transform** — JavaScript and DuckDB nodes form a visible processing pipeline.
3. **Continue** — local project persistence restores available source and workbench state.

The content should remain concise. It may use small interface compositions made from Astryx primitives, but it must not require new product functionality.

## Application States

`App` chooses exactly one top-level surface:

1. **Hydrating** — a full-page loading state while persisted projects are being restored. This prevents the landing page from flashing before an existing project opens.
2. **Landing** — no raw JSON is loaded, or the user intentionally selected `Open another JSON`.
3. **Restore** — a persisted project exists but its raw JSON text is unavailable. This is a full-page, source-aware restore surface rather than an empty workbench.
4. **Workbench** — a project and successfully parsed raw value are available, and the project launcher is not open.

The existing workbench shell remains unchanged and is mounted only for the Workbench state.

## Import Interaction

Each import method uses the existing application handlers and worker parsing pipeline.

### Submission

- File selection or drop starts file reading and parsing immediately.
- URL submission fetches the resource, reads its response body, and parses the JSON.
- Paste submission parses the entered raw text.
- Empty URL and paste values are rejected locally before worker work begins.

### Pending State

The selected card shows an Astryx loading state. All three import methods are temporarily disabled while the request is pending so concurrent submissions cannot create competing active projects. Pending import method is presentation state and does not require a Zustand schema change.

### Success

Project creation still occurs only after worker parsing succeeds. The parsed value becomes the raw and displayed value, and `App` switches directly to the existing workbench.

### Failure

Fetch, file-read, and parse failures keep the user on the landing page. The attempted card shows an Astryx error status or `Banner`, and URL/paste input remains intact. If the landing page was opened from an existing project, that project remains unchanged because project creation follows successful parsing.

Submitting again replaces the prior import error. Returning to the existing project clears launcher-only error presentation.

### Memory-Risk Confirmation

Replace the native `window.confirm` used for JSON above the current size threshold with an Astryx `Dialog`. Confirm continues parsing; cancel returns to the landing or restore surface with all input preserved. The threshold and memory-warning semantics do not change.

## Restore and Project Switching

Selecting `Open another JSON` from the workbench opens the same landing page and exposes `Back to current project` in the top navigation.

- Returning mounts the prior workbench without altering its project, pipeline, selected path, or displayed output.
- A failed new import leaves that prior project untouched.
- A successful new import creates and enters the new active project.

When a persisted project lacks raw JSON text, render a full-page restore experience using the existing source-specific actions:

- URL source: reload the stored URL.
- File source: reselect the original file.
- Paste source: paste the JSON again.

The restore surface may be more focused than the generic three-card launcher because it is completing a known project rather than starting a new one. It still must not show empty Pipeline, Viewer, or Details regions.

## Component Architecture

### `LandingPage`

Owns the landing `AppShell`, `TopNav`, hero, equal import grid, capability sections, footer, responsive composition, and return-to-project action.

It receives asynchronous callbacks for file, URL, and paste import. It owns only presentation state such as pending method, last attempted method, input text, and local validation feedback.

### Import Cards

Use focused components or well-bounded internal units for the three import methods. Each unit exposes its input and submit behavior through explicit props and does not know about workers, persistence, or the workbench store.

Shared presentation requirements—equal height, heading alignment, action placement, disabled state, and error treatment—are implemented through Astryx composition rather than duplicated custom markup.

### `ProjectRestorePage`

Wraps the existing restore actions in a full-page surface. It accepts the known source metadata and renders only the applicable restore control.

### `App`

Retains orchestration of fetching, file reading, worker parsing, project creation, hydration, and workbench state. It derives the top-level surface and returns one page shell rather than always constructing the workbench shell.

### Workbench `AppShell`

The existing workbench `AppShell` continues to own Pipeline, Viewer, and Details regions. Its loaded-project layout and resizable inspector behavior remain out of scope.

## Astryx Implementation Rules

- Start with Astryx `AppShell` as the landing frame and `TopNav` for product identity.
- Use `Section` for page regions and `Grid` for the responsive import layout.
- Use `Card` only for the three discrete, independently interactive import methods.
- Use Astryx inputs, buttons, loading states, banner/status feedback, and dialog primitives.
- Use `Stack`, `Grid`, `Section`, and other Astryx primitives for layout; do not add layout `<div>` elements.
- Prefer component props before custom `className` or `style`.
- Any required CSS uses Astryx color, spacing, size, typography, radius, border, elevation, and motion tokens.
- Do not add raw hex, rgba, or arbitrary pixel visual values to application CSS.
- Do not override semantic `--color-*` variables in `:root`; use the Astryx theme mechanism for brand or accent treatment.
- Do not introduce Tailwind, StyleX utility classes, or a separate styling system.

## Responsive Contract

- At 1024 px and above: three equal columns.
- From 640 px through 1023 px: two columns with the third card wrapping to the next row while retaining the same minimum width and visual hierarchy.
- Below 640 px: one vertical column.
- The hero copy and import controls remain fully visible without horizontal scrolling.
- The top navigation keeps the brand visible; the return action may use a compact button label but must remain accessible.
- Capability sections reflow to a single readable column on narrow screens.

## Accessibility

- The landing page has one level-one heading.
- Each import method has a visible heading and an accessible region or form name.
- Inputs retain explicit Astryx labels even when a visual treatment hides a redundant label.
- URL and paste submissions use semantic forms and support keyboard submission.
- Loading controls expose busy state; disabled controls remain understandable from surrounding visible text.
- Errors are associated with the relevant input and announced through Astryx status or alert semantics.
- The memory-risk dialog traps focus, labels its purpose, and returns focus to the triggering control after cancel.
- Keyboard and screen-reader users can reach all three import methods in the same logical order shown visually.

## Testing

### Component Tests

Update `ProjectLauncher` tests or replace them with landing-page tests that verify:

- Pasted JSON submits the unchanged text.
- URL input submits the entered URL through click and keyboard submission.
- Selecting a `.json` file submits the selected `File`.
- Pending import locks all three methods and marks the active method as loading.
- Import failure preserves URL or pasted text and displays associated feedback.
- `Back to current project` renders only when a return callback exists and calls it correctly.

### Application Tests

Extend `App` tests to verify:

- Hydration does not flash the landing page before restoring an available project.
- With no project, Pipeline, JSON Viewer, and Details regions are absent.
- Successful parse transitions from landing page to workbench.
- Failed parse remains on the landing page and does not create or replace a project.
- Opening another JSON and returning preserves the current project.
- A persisted project without raw text uses the full-page restore surface.
- Memory-risk input uses the Astryx confirmation dialog and handles confirm/cancel correctly.

### Visual and End-to-End Tests

Use Playwright at desktop and mobile viewport widths to verify:

- The three import headings are simultaneously visible.
- The import grid forms three, two, and one columns at the declared breakpoints.
- A representative import reaches the loaded workbench.
- The landing page has no horizontal overflow.

Do not make screenshot tests depend on animated intermediate frames. Respect reduced-motion preferences for any entrance motion.

### Verification Commands

Run:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run e2e`

## Acceptance Criteria

- With no loaded raw JSON, the application presents a full-page landing or restore surface rather than the three-region workbench.
- File, URL, and paste import methods have equal prominence and remain discoverable at all supported widths.
- A successful import enters the existing workbench; a failed import remains recoverable on the landing page.
- Opening another JSON offers a path back to the unchanged current project.
- Persisted projects missing raw input use a full-page restore surface.
- The native large-JSON confirmation is replaced by an accessible Astryx dialog.
- Capability copy describes only functionality present in the repository.
- The implementation follows Astryx component, layout, token, and styling rules from `AGENTS.md`.
- Relevant unit, application, responsive, and end-to-end tests pass.
