# Unified Viewer Colors Design

## Goal

Use one key/value color treatment across the Columns, Tree, Table, and Source JSON views without changing their layout or interaction behavior.

## Color treatment

- Keys use `var(--color-text-gray)`. This gives keys a neutral near-black appearance in light mode while preserving contrast in dark mode.
- Values use `var(--color-data-orange-4)`.
- Source punctuation and collapsed summaries keep their existing secondary text color because they are structural annotations rather than keys or values.
- Source strings, numbers, booleans, and null literals all use the shared value color.

## Implementation

Add shared `json-viewKey` and `json-viewValue` presentation classes to the rendered key and value text in all four views. Source token selectors may share the same declarations where necessary, but each value token kind remains present in the DOM for semantic tests and future syntax behavior.

Use Astryx `Text` nodes in `Item` slots where a view currently passes plain strings, so the color classes attach to owned markup instead of relying on Astryx component internals.

## Verification

- Component tests verify that Columns, Tree, and Table render the shared key/value classes.
- Source tests verify that keys retain their source token class and each literal type receives the shared value treatment.
- CSS tests verify both shared classes reference the approved Astryx tokens.
- Run the focused viewer and CSS tests, followed by type checking and the full test suite.
