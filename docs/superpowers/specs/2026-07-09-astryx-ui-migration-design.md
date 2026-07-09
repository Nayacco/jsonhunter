# Astryx UI Migration Design

## Purpose

Migrate the existing JSON Pipeline Workbench UI to use Astryx as the primary component system while preserving the current product behavior.

The current app imports Astryx base CSS, but most UI is built from native elements, custom class names, and raw CSS values. This migration aligns the implementation with `AGENTS.md`: use Astryx components for app frame, layout, forms, controls, dense rows, status display, details panels, and error states.

## Scope

This migration covers the React presentation layer:

- App shell and pane layout.
- Project launcher and restore forms.
- Pipeline flow controls and node status display.
- Node editor action controls.
- JSON viewer toolbar, mode switching, row rendering, and empty states.
- Table-like JSON rendering.
- Details preview metadata layout.
- Error and status messages.
- CSS cleanup from raw custom visual styling to Astryx props and theme tokens.

This migration does not change:

- Pipeline execution semantics.
- Zustand store shape or actions except where UI wiring requires small adapter changes.
- Worker protocol, runtime execution, or persistence behavior.
- JSON path, summary, table mapping, or viewer windowing behavior.
- Monaco editor integration beyond wrapping it in Astryx layout components.

## Migration Mode

Use the pragmatic migration mode.

Primary application UI should use Astryx components rather than raw HTML. Low-level DOM remains acceptable when a third-party integration or browser API needs direct measurement, positioning, or mounting behavior. The allowed exceptions are:

- React root in `index.html`.
- Monaco editor mount containers.
- TanStack Virtual measurement and absolute-positioned rows.
- Small semantic wrappers only when Astryx has no equivalent for the required behavior.

Any retained custom DOM should be isolated, named clearly, and styled only with Astryx tokens.

## Astryx Component Mapping

The app frame should use Astryx `AppShell` as the outer wrapper and `Layout`, `LayoutContent`, and `LayoutPanel` for the workbench regions.

Recommended frame:

- `AppShell` with `contentPadding={0}` and `height="fill"`.
- Main `Layout` with content for the pipeline and viewer area.
- End `LayoutPanel` for the details preview, labelled as the inspector.
- Nested `Layout` in the content area with a header/panel for the pipeline flow and scrollable content for the JSON viewer.

Forms should use:

- `TextArea` for pasted JSON.
- `TextInput` for URL and project name fields.
- `Button` for actions.
- `Field` only for custom or third-party controls that do not already include labels.

Workbench controls should use:

- `Toolbar` for action rows and viewer headers.
- `TabList` and `Tab` for Columns, Tree, Table, and Source view selection.
- `Button` or `IconButton` for commands.
- `Token` for compact metadata such as node type, JSON type, and path fragments.
- `StatusDot` paired with visible text for node status.

Dense data should use:

- `List` and `Item` for pipeline nodes and JSON row-like views.
- `Table` for table-like JSON where rows and columns are uniform.
- `EmptyState` for empty or unsupported table data.

Details and feedback should use:

- `MetadataList` and `MetadataListItem` for details preview facts.
- `Section` for inspector subsections.
- `Banner` for errors.

## CSS Strategy

`src/styles/app.css` should stop acting as a full visual design system. The migration should remove broad raw styling for layout, colors, spacing, borders, buttons, inputs, and panels.

Custom CSS that remains must meet these rules:

- Use Astryx tokens such as `var(--color-*)`, `var(--spacing-*)`, `var(--radius-*)`, and size tokens.
- Avoid raw hex, raw rgba, and arbitrary pixel values for visual styling.
- Prefer Astryx props before custom classes.
- Keep CSS focused on bridge requirements such as Monaco sizing, virtual scrolling measurement, and overflow constraints.
- Do not override `--color-*`, `--spacing-*`, or `--radius-*` in `:root`.

Global CSS may keep only baseline app constraints that Astryx does not own, such as ensuring the root fills the viewport.

## Behavioral Compatibility

The migration should preserve the user-visible workflows:

- Create a project from pasted JSON.
- Load a project from URL when supported by existing logic.
- Restore a previous project.
- Add JS and DuckDB nodes.
- Run a draft node and view the draft output without saving.
- Save a node and collapse the editor.
- Cancel editing without losing the last successful preview.
- Switch between Columns, Tree, Table, and Source views.
- Select JSON rows and update the details preview.
- Show execution errors without destroying the last successful output.

Accessibility should improve where possible by relying on Astryx component roles and labels. Tests should prefer accessible roles and names over old CSS class names.

## Implementation Approach

Implement in small, testable slices:

1. Add or update tests that lock existing workflows and accessible labels.
2. Replace the app shell and major layout regions with Astryx components.
3. Replace launcher, restore, and editor controls with Astryx form and button components.
4. Replace viewer toolbar and mode switcher with Astryx `Toolbar` and `TabList`.
5. Replace row-like displays with `List` and `Item`, while keeping virtual scrolling internals where necessary.
6. Replace details preview with `MetadataList` and `Section`.
7. Replace error and empty displays with `Banner` and `EmptyState`.
8. Reduce `src/styles/app.css` to token-based bridge styles.

Each slice should keep the app buildable and tests passing.

## Testing

Use the existing test stack:

- Vitest and React Testing Library for component behavior.
- Existing worker and domain tests should remain unchanged unless imports move.
- Playwright should continue to verify the main workbench flow.

Add or adjust tests before production changes where behavior can regress. Tests should assert that:

- Primary buttons and fields remain discoverable by role/name.
- Viewer mode switching still renders the selected view.
- Pipeline node actions still call the correct handlers.
- Error states render as visible alerts.
- Details preview still reflects the selected JSON path.

Do not test Astryx internals. Test the app behavior and accessible surface.

## Risks

Astryx components may expose different DOM structure than the current custom markup. Tests that depend on class names or element nesting may need to move to role/name queries.

Virtualized rows and Monaco require direct DOM control. Forcing them fully into high-level components could break measurement, scrolling, or editor mounting. These areas should keep small bridge wrappers.

The current CSS controls the entire dark visual theme. Removing it will change the look to Astryx theme defaults unless a proper Astryx theme is introduced. This design intentionally avoids overriding Astryx token variables in `:root`; any brand or accent changes should use Astryx theme mechanisms in a separate step.

## Acceptance Criteria

The migration is complete when:

- App-level UI uses Astryx `AppShell`, `Layout`, and `LayoutPanel`.
- User-facing forms and action controls use Astryx inputs and buttons.
- Viewer mode switching uses Astryx tabs.
- Dense row UI uses Astryx list/item/table primitives except for necessary virtualization bridge elements.
- Error and empty states use Astryx components.
- Details preview uses Astryx metadata components.
- `src/styles/app.css` contains only token-based bridge styles and no broad custom theme.
- No Astryx semantic token variables are overridden in `:root`.
- Unit tests, typecheck, and e2e checks pass.
