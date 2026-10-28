# RawTextareaManager contract

Phase 6.2 split the raw-text editing behaviour out of
`PresetBasket`/`PresetEditor` into four focused modules. This document records
the ownership boundary so the work is re-usable and reviewable.

## Ownership

| Module                       | Responsibility                                                                                                                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/RawTextareaManager.js`  | Thin coordinator: styles, the static `extractGroupName` helper, DOM wrapper assembly, style injection, and the textarea-specific event glue (`input`, `scroll`, `change`, `mousedown`, `mousemove`, `mouseleave`).           |
| `web/RawTextHighlighting.js` | Token highlighting: renders the overlay (`highlightsEl`) from parsed tokens — plain text, tags, variants, and presets. Reads `context.cache` and `PresetLogic` grammar; imports `PresetDisplay` for colours and titles only. |
| `web/RawTextHover.js`        | Hover metadata: char position, token lookup, tooltip title. Reads `context.cache` for the token; imports `PresetDisplay` for titles only.                                                                                    |
| `web/RawTextAutocomplete.js` | Raw-text autocomplete sync: wraps `AutocompleteManager` and re-runs `manager.updateHighlights` after every edit. Imports `AutocompleteManager` plus `PresetLogic`/`PresetDisplay` for matching and expansion.                |

`RawTextareaManager` constructs one instance of each sub-module and wires them:

- `highlighting` — `attach()` is called with the overlay element in `initWrapper()`.
- `hover` — `getTokenAtPosition`/`getCharPositionAt` answer the mousemove tooltip.
- `autocomplete` — receives `this` (the manager) as `manager`, so `onSelect` re-runs
  `updateHighlights`.

## Public surface

`RawTextareaManager` exposes:

- `highlightsEl` — the overlay div; `null` until `initWrapper()` has run.
- `updateHighlights(ignorePreset)` — re-renders the overlay.
- `getCharPositionAt(x, y)` — char position under the pointer.
- `getTokenAtPosition(pos)` — token under a character position.
- `handleMouseMove(e)` — updates the textarea `title` tooltip.
- `extractGroupName(tokenText)` — static; strips `{...}` and returns the group name.

`RawTextHighlighting` exposes:

- `attach(highlightsEl)` — sets the overlay element.
- `updateHighlights(ignorePreset)` — (re)renders the overlay.
- `extractGroupName(tokenText)` — static group-name extractor.

`RawTextHover` exposes:

- `handleMouseMove(e)`, `getCharPositionAt(x, y)`,
  `_normalizeTokenPosition(pos)`, `getTokenAtPosition(pos)`.

`RawTextAutocomplete` exposes:

- `init()` — attaches the event listeners through `AutocompleteManager`.

## Tests

- `tests/unit/raw_textarea_manager.test.ts` — wrapper, highlight rendering,
  char-position math, and the mousemove tooltip.
- `tests/unit/raw_text_highlighting.test.ts` — the highlighting module directly.
- `tests/unit/raw_text_hover.test.ts` — the hover module directly.
- `tests/unit/raw_text_autocomplete.test.ts` — the autocomplete module directly.
- `tests/unit/variant_color.test.ts` — `extractGroupName` and group-colour-on-variants.

## Mutation guard

`tools/mutation_check.py` holds one entry per module in this boundary. Each
mutation is a small, behavioural change (dropping an escape, snapping a clamp,
discarding a default). The named test file in that entry must fail when the
mutation is applied; a missed mutation means a decision here is no longer
covered.
