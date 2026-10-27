# Frontend Logic Refactor Plan

This plan targets simpler ownership and easier-to-follow data flow without
changing the documented user behavior. The current user-facing feature list and
Playwright coverage are the compatibility contract for the work.

## Current shape

The frontend is already split into modules, but several boundaries still cross
multiple owners:

- **Prompt composition and host lifecycle:** `PresetGalleryRegistration.js`
  expands the widget value in both the widget callback and
  `serializeValue()`. Serialization also detects seed changes and schedules a
  delayed roll. The host adapter therefore combines formatting, stateful roll
  tracking, and a future UI mutation in one critical path.
- **Selection state:** the widget string is the selection source for much of
  the UI, `PresetSession` owns pins and roll state, and `PresetBasket` owns
  per-tab snapshots. `PresetGalleryContext.js` forwards operations between
  these owners. Normal edits go through `updateWidgetValue()`, while tab
  restoration writes the widget directly and manually synchronizes the grid
  and Basket.
- **Basket responsibilities:** `PresetBasket.js` is about 2,184 lines and
  handles tab lifecycle/persistence, tab transfer, drag-and-drop, image drops,
  clipboard, multi-selection and keyboard operations, rendering, and chip
  updates. The controller is consequently the shared dependency for many
  unrelated interactions.
- **Preset semantics:** `PresetLogic.js` is about 1,073 lines after phases
  4a and 4b. It contains token parsing, recursive expansion, variant
  resolution, preset matching, and chip evaluation. Grouped-chip projection
  is in `ChipProjection` and display metadata in `PresetDisplay`. Its
  cache-derived indexes are performance-sensitive; replacing the parser or
  indexes wholesale would make regressions hard to isolate.
- **Cross-cutting persistence and API defaults:** `localStorage` reads/writes
  are spread through the app, Basket, Grid, Settings, and Session. The API
  client also has a static active-library fallback, so some operations depend
  on implicit target state rather than an explicit library argument.

The primary refactor risk is not file size alone: state can be changed through
the host widget callback, a Basket action, tab restoration, or a delayed
automatic roll, and each path must preserve the same visible selection and
serialized prompt.

## Ordered plan

### 1. Define and centralize prompt composition

- Trace the ComfyUI widget callback and serialization lifecycle, including
  automatic generation and seed-change rolls.
- Define one composition entry point for raw selection, cache, and roll state;
  use it from both the displayed evaluated widget and serialization.
- Keep automatic rolling behavior explicit and host-safe. Do not move its
  trigger until the supported ComfyUI lifecycle point is established; ensure a
  serialization call cannot unexpectedly schedule duplicate mutations.
- Preserve expansion order, nested presets, weights, `None`, and stable variant
  choices.

**Done when:** callback display and serialized output agree for the same state,
and automatic rolling happens once on the intended event without changing
manual roll behavior.

### 2. Establish a single selection transition boundary

- Document the authoritative state for the current Basket and the state stored
  per tab: ordered selection, pins, and rolled choices.
- Route user edits and tab restoration through explicit selection operations
  rather than having components write `widget.value` and separately repair
  related UI.
- Keep the ComfyUI widget as the adapter boundary; avoid making UI components
  depend on callback side effects to complete a transition.
- Preserve the current optimization that a single edit produces one Basket
  render.

**Done when:** add, edit, reorder, delete, paste, roll, and tab-switch actions
each have one understandable transition path and keep widget, tab, pin, grid,
and prompt state aligned.

### 3. Split Basket behavior by responsibility

Extract incrementally while keeping `PresetBasket` as a small coordinating
facade:

1. Move tab snapshots, tab switching, and tab persistence into a tab-state
   component.
2. Move clipboard and multi-selection commands into a selection controller.
3. Separate drag/drop and image-drop handling from the selection commands.
4. Keep chip rendering and the DOM-facing controller focused on presenting
   state and forwarding user actions.

Do not change interaction semantics during extraction. Reuse existing browser
tests for order, pins, keyboard access, persistence, and transfers; add focused
unit tests for any new pure state transitions.

**Done when:** each extracted unit has one responsibility, and the Basket
controller no longer owns tab storage, clipboard parsing, drag geometry, and
rendering together.

### 4. Separate preset semantics from chip presentation

- Keep token grammar and recursive expansion together initially; characterize
  them with existing unit tests before moving code.
- Extract chip grouping/projection as a separate pure module with explicit
  inputs and outputs.
- Extract search/folder/display helpers only where their dependencies are
  genuinely independent.
- Do NOT add a facade: `PresetDisplay` imports `PresetLogic`'s grammar, so
  re-exporting the display helpers back from `PresetLogic` would put a cycle
  between the two - the shape phase 4a went out of its way to avoid. Call sites
  import the module that owns the helper, and the tests follow.
- Retain the cache-derived indexes and their measured behavior; change their
  ownership or invalidation only with dedicated performance and correctness
  coverage.

**Done when:** parser/expansion behavior can be reasoned about independently of
chip labels, tooltips, search, and folder metadata, with no syntax or prompt
regressions.

### 5. Make app services and persistence explicit

- Replace the mutable peer references in `GalleryContext` with a typed set of
  dependencies or commands; remove `any` where it obscures the actual
  component contract.
- Pass target library IDs explicitly through read/write operations instead of
  relying on `PresetGalleryAPI.activeLibraryId` defaults.
- Centralize browser-storage key access and parsing at a small boundary, keeping
  existing key names and data formats compatible.
- Keep settings UI and rendering separate from settings normalization and
  persistence.

**Done when:** core components can be constructed with clear dependencies in
tests, and app behavior does not depend on hidden mutable API or storage
defaults.

### 6. Revisit supporting UI modules

After the state and semantic boundaries are stable, review `ChipMenuManager`,
`RawTextareaManager`, and `ExportUtils`. Extract only separable behavior:
variant editing commands, text-token synchronization, and import/export format
handling should not be split merely to reduce line counts.

**Done when:** each module has a coherent reason to change, with import/export,
autocomplete, and raw-text behavior covered by focused tests.

## Working rules

- Land one phase at a time; avoid a broad rewrite of Basket and parser logic.
- Keep the six user-facing Playwright scenarios green throughout.
- For state-flow changes, run the relevant unit tests and full
  `npm run test:e2e`; run `npm run lint` and `npm test` before each phase lands.
- Compare prompt strings and selection order exactly, not only visible labels.
- Do not add a framework or a generic state-management layer unless a concrete
  phase demonstrates that existing modules cannot express the needed boundary.

## Progress

- [x] 1. Prompt composition — `PresetSession.composePrompt()` is the one entry
      point for both the displayed evaluated widget and `serializeValue`;
      automatic rolling is `PresetGalleryApp.scheduleAutomaticRoll()` and
      schedules at most one roll per queue press (it used to roll once per
      batch item). Commit `1dbc7c4`.
- [x] 2. Selection transition — `writeSelection()` is the only write to the
      widget; `updateWidgetValue()` (edit, prunes pins first) and
      `restoreTabSelection()` (tab) are the two transitions. Tab switching
      renders once; `docs/PresetBasket.md` has the state-ownership table.
      Commit `88566eb`.
- [x] 3. Basket split — `PresetBasketTabs` (tab state/persistence),
      `BasketSelectionController` (selection + clipboard),
      `BasketDragDrop` (drop geometry + image drops). `PresetBasket` went from
      2143 to 1463 lines and keeps its method names as delegations. Commits
      `b3b2ec5`, `5fa28fc`, `9ec289a`.
- [x] 4a. Grouped-chip projection — `ChipProjection.getGroupedChips` owns the
      chip grouping (one chip per token, weight-stripped core, qualified keys),
      and `PresetLogic` no longer carries it. The per-cache index record moved
      out to `CacheDerived` so both modules index a cache once between them
      instead of each keeping a copy: neither module imports the other for it.
      The four basket modules import `ChipProjection` directly. `PresetLogic`
      went from 1397 to 1232 lines; grammar and expansion are untouched.
      `docs/ChipProjection.md` documents the contract, and
      `tests/unit/chip_projection.test.ts` pins it (17 tests) with 8
      `mutation_check` entries - the three moved lookup entries plus five for
      the grouping decisions.
- [x] 4b. Display metadata — `PresetDisplay` owns how a preset is named,
      labelled, coloured and searched for: the folder/name/base-folder/ui-folder
      helpers, `toTitleCase`, `getHashColor`, `getPresetColor`,
      `getAllPresetFolders`, `getPresetInitials`, `getPresetTitle`,
      `getSearchBlob` and `getTopMatches`. `PresetLogic` keeps the grammar, the
      expansion and chip evaluation, and binds the two path helpers its
      module-level index builders call. The nine rendering modules import
      `PresetDisplay` directly, so ownership is visible at the import and
      `ChipProjection` now depends on the grammar only. No facade: that would
      re-create the cycle phase 4a avoided. `PresetLogic` went from 1232 to
      1073 lines, and `PresetDisplay` is 224. `docs/PresetDisplay.md` documents the contract,
      `tests/unit/preset_display.test.ts` pins it (19 tests) with 9
      `mutation_check` entries - one per moved decision.
- [x] 4c. Chip evaluation — probed, and deliberately NOT split. The dependency
      is already one way (`parseBasketChip` calls the display helpers, nothing
      calls back), so there is no cycle to break the way 4a and 4b had. And the
      two halves are interleaved and share intermediate state: `tooltipTitle`
      needs `chipExpanded`, `cleanLabel` needs `segmentedLabels`, which needs
      the expansion's roll tracer restored to `beforeCounts`. Splitting means a
      wide intermediate struct between two modules that both must understand it,
      for one consumer (`PresetDOM.renderBasketChip`) that wants the whole
      object at once.
      The probe did find a real gap, of a different kind: six decisions in the
      cluster were mutated and the existing suite was run per file. Two were
      already caught - `hasMoreVar` by `preset_dom.test.ts` (it drives the ⋯
      affordance) and the `[{<]` gate on `segmentedLabels` by
      `preset_basket.test.ts` (it stops a plain chip getting segment spans) -
      but no `mutation_check` entry pointed at either. Both entries are added.
      The third, the `^\{[^{}:]+` guard on the single-segment rule, could not be
      distinguished by any input constructed: when it fires, `segmentTitles[0]`
      and `toTitleCase(getPresetName(evalId))` are the same string, because
      `evalId` is the resolved preset and the segment title is that preset's
      name. It is left in place rather than removed on a "no counterexample
      found" argument.
- [x] 5a. Storage boundary — `GalleryStorage` owns every key name and the
      meaning of a bad value. It replaces three unguarded `JSON.parse` calls in
      `PresetSession`: the pins read is in its constructor, so one corrupt value
      threw and the gallery never mounted, and a valid-but-wrong-typed value
      (`"a string"`, `42`) used to be handed to callers that call `includes` on
      it. The settings panel's defaults were listed twice and are now one
      method. The four components that read the global now go through
      `defaultStorage()`, so a browser that blocks storage yields the defaults
      instead of throwing. Key names are unchanged and pinned by test — they are
      the user's saved state. 16 new tests, 6 new `mutation_check` entries.
      `docs/GalleryStorage.md` documents the contract.
- [x] 5b. Explicit library targeting — the module-level
      `PresetGalleryAPI.activeLibraryId` is gone. Every read and write names
      its library, defaulting to the bundled one, and `libraryUrl` always
      carries the id (the route treats `?library=main` and no query the same,
      so there was no reason to depend on which form a call got). Import and
      export take the preselect as a parameter from the app instead of reading
      a global, and the app declares its own default rather than leaving it
      undefined until the library list arrives. 4 new `mutation_check` entries.
- [x] 5c. Typed context dependencies — `createGalleryContext`'s params are
      typed (`dom` is the built structure, `widget` is `{ value, hidden,
      callback? }`) instead of `any`, and the two `editor`/`grid` placeholders
      are typed as `| null` rather than `any`. The `any` was hiding a real
      contract: the typing now reaches the test stub, which had to declare the
      widget members it was relying on. The peer references themselves stay -
      the siblings genuinely reference each other, and the app attaches them
      once all three exist.
- [ ] 6. Supporting UI modules.
  - [x] 6.1. Review `ChipMenuManager` and isolate the variant-editing/selection
        commands from the popup container and basket mutation logic.
        Split landed in commit `55e8bd5`: `ChipMenuManager.js` (400 lines) keeps
        show/close/autocomplete/positioning; `ChipMenuCommands.js` (362 lines)
        owns pin/unpin, weight toggle/change, edit, swap, locate, create,
        delete, variant-group selection, re-roll, and keyboard shortcuts. Container
        dispatches to commands; selection and close(true) still handled by manager.
        `chip_menu_manager.test.ts` covers the manager-testable behaviour.
  - [x] 6.2. Review `RawTextareaManager` and separate token-highlighting,
        hover metadata, and raw-text autocomplete synchronization from the
        textarea-specific event glue.
        Split landed in commit `92b1da9` (re-typed in `2fa14be`): `RawTextareaManager`
        is a thin coordinator; `RawTextHighlighting` owns token highlights, `RawTextHover`
        owns hover metadata, and `RawTextAutocomplete` wraps `AutocompleteManager`.
        Three focused test files cover the splits (7 + 3 + 2 tests) and each has a
        `mutation_check` entry — all mutations caught.
  - [x] 6.3. Review `ExportUtils` and keep import/export format handling,
        duplicate selection summaries, and folder selection logic in one
        coherent boundary.
        ExportUtils.js is a single decoupled module: `getSelectionSummary`
        (pure selection counters) is shared by export and import; `buildPresetSelectorTree`
        (folder selection state) is the shared UI controller; `exportPresets`
        (ZIP/YAML/JSON, full/preset-only, colour toggle) and `showImportModal` +
        `importFile` (ZIP/YAML/JSON import, duplicate strategies) are the
        format handlers. `export_utils.test.ts` pins 13 tests; the mutation
        guard entry for `getSelectionSummary` is caught. `docs/ExportUtils.md`
        documents the module. Boundary verified coherent: no cross-module
        duplication of format or summary logic.
  - [x] 6.4. Ran the focused unit tests for the touched modules and the
        mutation guard (`tools/mutation_check.py`) before calling the phase
        done: 594 tests pass (0 fail), and all four raw-text `mutation_check`
        entries were caught.

Notes for the next session: `tools/mutation_check.py` is the guard that the
unit suites still catch their own mutations — run it after touching a module it
lists, and repoint its entries when code moves between modules (a mutation
whose pattern no longer matches aborts the run rather than passing silently).
Moving code without adding entries leaves the moved decisions uncovered, which
is how a guard dies: phase 4b added nine, one per decision that moved.
An entry whose pattern no longer matches aborts the run rather than passing
silently - which is what happened when phase 5a dedented a block - so repoint
them whenever the surrounding code moves.
`dev/index.html` plus `npx playwright test` is the only browser coverage;
the harness stubs the ComfyUI host object and nothing else.

Two traps hit while landing phase 4b, both worth remembering:
- **Editing these files with Python text mode rewrites their line endings.**
  Read bytes, normalise, write bytes back with the file's own ending. Nine files
  were reverted and redone because `write_text` turned their LF into a mixed
  file; the `patch` tool handles CRLF correctly and is the safer route.
- **A `\n` inside a `mutation_check.py` entry is a Python escape, not the two
  characters the JS source holds.** An entry written that way parses to a real
  newline, matches nothing, and aborts the run. It needs `\\n` in the source.
