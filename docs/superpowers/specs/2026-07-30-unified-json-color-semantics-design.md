# Unified JSON Color Semantics Design

## Goal

Apply one semantic color system to every JSON data presentation in Columns, Tree, Table, Source, and Details without changing layout or interaction behavior.

## Semantic roles

- Keys use `var(--color-text-gray)`.
- Primitive JSON values use `var(--color-data-orange-4)`.
- Structural and supporting metadata use `var(--color-text-secondary)`.

Supporting metadata includes array item counts, object field counts, selected paths, source punctuation, and collapsed-source summaries. It is not treated as a JSON value even when it currently occupies a value slot.

## Data model

Viewer rows will carry an explicit presentation role that distinguishes primitive values from structural metadata. The role is assigned while deriving rows from JSON data, where the original value type is still known. Renderers will not infer semantics from formatted strings such as `2 fields` or `[3 items]`.

Source tokens already distinguish keys, primitive values, and punctuation. Their existing token kinds remain intact, while shared semantic classes provide the unified colors.

## View treatment

- Columns, Tree, and Table render row labels as keys. Primitive row values use the value role; array and object summaries use the metadata role.
- Source renders key tokens as keys; string, number, boolean, and null tokens as values; punctuation and collapsed summaries as metadata.
- Details renders Type, Value, and Source labels as keys. Their displayed contents are values. The selected path is metadata, and explanatory prose outside the JSON selection remains unchanged.

## Styling

Shared presentation classes define key, value, and metadata colors. Components use Astryx `Text` nodes in rich `Item` slots where necessary so styles attach to application-owned markup. Existing typography, truncation, selection, density, and accessibility behavior remain unchanged.

## Verification

- Row-derivation tests verify primitive and structural metadata roles.
- Component tests verify semantic classes across all four viewers and Details.
- CSS tests verify the three shared classes reference the approved Astryx tokens.
- Run focused tests, type checking, the full unit suite, and a production build.
