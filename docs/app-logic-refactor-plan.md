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
- **Preset semantics:** `PresetLogic.js` is about 1,398 lines. It contains
  token parsing, recursive expansion, variant resolution, grouped-chip
  projection, preset matching/search, and display metadata. Its cache-derived
  indexes are performance-sensitive; replacing the parser or indexes wholesale
  would make regressions hard to isolate.
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
- Preserve `PresetLogic` exports as a compatibility facade during migration.
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
- [ ] 4b. Chip evaluation vs display metadata — not started. `parseBasketChip`,
      `resolvePresetSegment` and `parseChipDetails` are still in `PresetLogic`,
      as are the color/title/folder/initials/search helpers. Decide whether the
      remaining split earns its keep before starting it.
- [ ] 5. App services and persistence.
- [ ] 6. Supporting UI modules.

Notes for the next session: `tools/mutation_check.py` is the guard that the
unit suites still catch their own mutations — run it after touching a module it
lists, and repoint its entries when code moves between modules (a mutation
whose pattern no longer matches aborts the run rather than passing silently).
`dev/index.html` plus `npx playwright test` is the only browser coverage;
the harness stubs the ComfyUI host object and nothing else.
