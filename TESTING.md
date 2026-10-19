# Testing plan

Branch: `test/expand-coverage`
Status: Phases 0–4 done. 344 unit tests + 23 pytest passing,
`npm run verify` green. Phase 3 covered all nine DOM-dependent modules on the jsdom
harness, mutation-proven. Phase 4's e2e suite runs against the dev harness
(chromium locally, all three browsers in CI, serialized), the smoke split is
`npm run test:e2e:smoke`, and the live ComfyUI suite pins the frontend build
(F15). Remaining: Phase 5 (CI).

Checkbox legend: `[ ]` todo, `[~]` in progress, `[x]` done, `[!]` deliberately deferred.

---

## 1. State at the start of this work (verified by probe, not by reading)

| File | Runner | Tests | Actually executed today? |
|---|---|---|---|
| `tests/preset_editor.test.ts` | node:test | 5 | only if you run `node --test` by hand |
| `tests/variant_color.spec.ts` | node:test | 10 | no |
| `tests/yaml_roundtrip.spec.ts` | node:test | 10 | no |
| `tests/preset_gallery.spec.ts` | Playwright | 20 × 3 browsers = 60 | only with a live ComfyUI on `:8188` |

Source: 18 files, 8640 lines in `web/`.

Probes used:

```
node --test                          # → 5 tests, 1 file (preset_editor only)
node --test "tests/**/*.ts"          # → 26 tests, 1 FAIL (preset_gallery.spec.ts)
npx playwright test --list           # → 60 tests in 1 file (preset_gallery only)
npx playwright test variant_color.spec.ts --list   # → "No tests found", 0 tests in 0 files
```

### Findings

- **F1 — Nothing runs the unit tests.** `package.json` has `lint`, `lint:eslint`,
  `typecheck`. There is no `test` script and no `test:e2e`. The 25 node:test tests only
  run if someone types the command from memory.
- **F2 — Default globbing finds 5 of 25 node:test tests.** `node --test` matches
  `*.test.ts` but not `*.spec.ts`. The two `.spec.ts` unit files are invisible.
- **F3 — `node:test` files named `.spec.ts` are a naming trap.** They are not picked up by
  `node --test` (F2) and are not collected by Playwright either (`--list` reports 0 tests
  for `variant_color.spec.ts`). They belong to neither suite by convention.
- **F4 — The broad glob collides with the e2e spec.** `node --test "tests/**/*.ts"` loads
  `preset_gallery.spec.ts`, which imports `@playwright/test` and fails outside the
  Playwright runner. That failure is structural, not a real regression.
- **F5 — The one `PresetEditor` unit test tests a copy.** `tests/preset_editor.test.ts`
  inlines a re-implementation of `shouldConfirmOverwrite` and asserts against that. It
  cannot catch divergence from `web/PresetEditor.js`.
- **F6 — No CI.** No `.github/workflows/`. Nothing gates a push.
- **F7 — The e2e `beforeEach` is menu choreography.** It navigates ComfyUI, opens the menu,
  creates a graph, presses `Alt+-` five times, right-clicks the canvas and walks three
  nested node menus. Any ComfyUI UI change breaks all 20 tests at once.
- **F8 — The e2e suite needs a live backend.** `baseURL` is `http://localhost:8188` and the
  route mock only stubs the gallery API, not ComfyUI itself. It cannot run unattended.
- **F9 — 17 of 18 `web/` modules import cleanly in bare Node.** Probed by importing every
  module under `node --test` with no DOM: all pass except `PresetGalleryApp.js`, which
  imports ComfyUI's runtime `../../../scripts/app.js` and is therefore unresolvable
  outside a ComfyUI server. `PresetGalleryApp` is e2e-only unless that import is stubbed.
- **F10 — Node 22.23.2 strips TypeScript types natively.** The `.ts` node:test files run
  with no loader, no `tsx`, no build step. `node --test` is sufficient.
- **F11 — Two of the three node:test files assert against inlined copies, not the source.**
  `preset_editor.test.ts` re-implements `shouldConfirmOverwrite` (F5); `variant_color.spec.ts`
  re-implements `extractGroupName`, a copy of `web/RawTextareaManager.js:71-73`. 5 of its
  10 tests assert on the copy, so those 5 cannot detect divergence either. Making the suite
  runnable is not the same as making it meaningful.
- **F12 — `PresetGalleryApp` was the `context` object.** 5 components (PresetBasket,
  PresetEditor, PresetGrid, PresetGallerySettings, and the ChipMenuManager /
  InlineEditorManager / RawTextareaManager they own) consumed 20 members off the app
  instance itself. Combined with F9 that meant none of them could be constructed in a
  test: you needed a live ComfyUI node, a real DOM and localStorage.
- **F13 — The app's own pure logic had zero coverage.** `triggerRoll` (the dice algorithm,
  60 lines), `checkSeedChange` (32 lines) and the pin-pruning half of `updateWidgetValue`
  appear nowhere in `tests/`, unit or e2e. The e2e spec has no dice/roll test at all. The
  most intricate logic in the repo was entirely unexercised.
- **F14 — The combo default is prepended on top of the roll target.** `buildRollSelection`
  picks `targetTotal` presets and *then* unshifts `_/combo/_default` if it is in the cache,
  so the returned selection can exceed the configured max by one. Pinned by a test now
  (`buildRollSelection: the combo default is added on top of the target count`).
- **F15 — The e2e suite is broken against the installed frontend, independently of this
  work.** All 20 tests fail in `beforeEach` waiting for `.comfy-menu-button-wrapper`, which
  no longer exists in ComfyUI frontend 1.58.0. Probed live on `127.0.0.1:8188`:
  `hasLegacyMenuButton: false`, `hasGraphCanvas: true`. Nothing of the gallery is reached,
  so these failures predate the refactor. This is F7 made concrete: menu choreography
  against a frontend the suite does not pin.

### Coverage gap

16 of 18 `web/` modules have no unit test. Only `YAMLUtils.js` and
`PresetLogic.getPresetColor` are covered, plus the inlined `PresetEditor` copy.

| Module | Lines | Unit-tested |
|---|---|---|
| `PresetBasket.js` | 2168 | yes (25) |
| `PresetLogic.js` | 1020 | yes (57) |
| `ExportUtils.js` | 967 | yes (14) |
| `ChipMenuManager.js` | 593 | yes (14) |
| `PresetGrid.js` | 518 | yes (16) |
| `PresetEditor.js` | 390 | yes (25) |
| `RawTextareaManager.js` | 374 | yes (13) |
| `PngMetadata.js` | 319 | yes (23) |
| `AutocompleteManager.js` | 253 | yes (10) |
| `InlineEditorManager.js` | 222 | yes (8) |
| `PresetGallerySettings.js` | 218 | yes (10) |
| `ModalUtils.js` | 193 | yes (11) |
| `YAMLUtils.js` | 177 | yes |
| `PresetGalleryAPI.js` | 175 | yes (21) |
| `PresetDOM.js` | 147 | yes (13) |
| `NestedPresetUtils.js` | 90 | yes (16) |
| `RollManager.js` | 66 | yes (11) |
| `PresetGalleryApp.js` | 750 → 531 | e2e only (pure logic moved out in Phase 0) |

Modules created by Phase 0, both covered from the start:

| Module | Lines | Unit-tested |
|---|---|---|
| `PresetSession.js` | 225 | yes (30 tests) |
| `PresetGalleryContext.js` | 81 | yes (9 tests) |
| `PresetGalleryRegistration.js` | 116 | no — needs a ComfyUI host by definition |
| `PresetBasket.js` | 2168 | yes (25, jsdom) |
| `PresetGrid.js` | 518 | yes (16, jsdom) |
| `PresetEditor.js` | 390 | yes (25, jsdom) |
| `RawTextareaManager.js` | 374 | yes (13, jsdom) |
| `ChipMenuManager.js` | 593 | yes (14, jsdom) |
| `InlineEditorManager.js` | 222 | yes (8, jsdom) |
| `AutocompleteManager.js` | 253 | yes (10, jsdom) |
| `PresetGallerySettings.js` | 218 | yes (10, jsdom) |
| `ModalUtils.js` | 193 | yes (11, jsdom) |
| `PresetDOM.js` | 147 | yes (13, jsdom) |

Phase 2 covered the six pure-logic modules; Phase 3 covered the nine DOM-dependent
ones on the jsdom harness. 344 unit tests + 23 pytest, `npm run verify` green,
8 Phase 3 mutations probed and caught.

---

## 2. Plan

### Phase 0 — Architecture: make components constructible (done)

Decisions taken: new `PresetSession.js` for the stateful pure core; both steps in one go
(session *and* the context factory); `storage` and `rng` injected at construction.

`PresetGalleryApp` carried four jobs at once: ComfyUI host wiring, DOM construction and
event binding, pure session logic, and orchestration. Three of those now have their own
module:

- **`web/PresetSession.js`** (new) — the stateful pure core. Owns `cache`, `pinnedChips`,
  `rollManager`, the persisted view preferences, and the algorithms that used to live on
  the app: `getSelectedArray`, `prunePins` (the contiguous-run rule), `buildRollSelection`
  (the dice algorithm) and `detectSeedChange` (subgraph-recursing walk). `storage` and
  `rng` are constructor-injected with defaults, so both are deterministic in tests.
- **`web/PresetGalleryContext.js`** (new) — `createGalleryContext({ session, dom, widget,
  view })` builds the 20-member context. State is exposed as live accessors onto the
  session, not copies: consumers reassign `context.pinnedChips` (5 sites in
  `PresetBasket.initTabs`) so the accessor needs a setter that writes through.
- **`web/PresetGalleryRegistration.js`** (new) — the only module that imports ComfyUI's
  `../../../scripts/app.js`. Holds `registerExtension` and `focusActiveSearch`. ComfyUI
  loads every `.js` in the web directory, so importing this is what registers the
  extension.
- **`web/PresetGalleryApp.js`** — now 532 lines (was 751): host adapter + view +
  orchestration. It builds the session and the context and still passes that context to
  every component, so consumers needed no call-site changes.
- The `PresetLogic.RollManager` alias was removed as confusing indirection; `RollManager`
  is imported directly from `./RollManager.js` at each call site (4 files).
- `globals.d.ts` gained a `GalleryContext` typedef, and the 7 files that typed `context`
  as `import("./PresetGalleryApp.js").default` now use it.

- [x] Extract `PresetSession` and rewire `PresetGalleryApp` onto it.
- [x] Split the ComfyUI host wiring out into `PresetGalleryRegistration`.
- [x] Introduce the context factory and the `GalleryContext` contract.
- [x] Remove the `PresetLogic.RollManager` alias.
- [x] Unit-test the extracted logic (see the two new test files below).

Verified:

- 20 of 21 `web/` modules now import in bare Node. The single remaining failure is
  `PresetGalleryRegistration.js`, which is exactly the one that must import
  `scripts/app.js`. `PresetGalleryApp` is importable now (it was the failing one, F9).
- 60 unit tests pass, `npm run verify` exits 0.
- The typecheck still enforces the context: a throwaway probe with
  `ctx.dom.definitelyNotAKey` and `ctx.notAMethod()` was caught, and `ctx.dom` still
  carries the full 40-key inferred type rather than degrading to `any`.
- Behaviour preserved: the dice algorithm, seed detection, pin pruning and the storage
  keys are byte-for-byte the same logic, moved rather than rewritten.
- **Verified live against the real ComfyUI on `127.0.0.1:8188`** (frontend 1.58.0 from
  `ComfyUI_frontend/dist`, extension served from this working tree):
  - `Comfy.PresetGallery` appears in the frontend's extension registry.
  - Creating a `PresetGalleryNode` mounts the gallery: 1 `.j0n4t-pg-wrap`, grid, search,
    basket, editor and reroll button all present, and **477 preset items** rendered from
    the real API through the refactored `PresetSession.cache` → `PresetGrid.compile`.
  - Clicking a tile set the hidden widget to `action/cook` and rendered the `Cook` chip —
    the full `PresetGrid` → `context.updateWidgetValue` → `prunePins` → `syncUI` →
    `PresetBasket.render` chain.
  - Shift-clicking reroll produced an 11-preset selection across real folders with 11
    chips: `triggerRoll` → `session.buildRollSelection` → `updateWidgetValue` → `syncUI`.
  - Panel toggle flipped `collapsed` false→true→false (`setPanelCollapseState`).
  - Search filter: 332 visible → 0 for a bogus query → 12 for `genshin` → 332 restored,
    with the clear button shown. (The first probe of this checked `style.display` and read
    477/477; the real mechanism is the `j0n4t-pg-hidden` class. The probe was wrong, not
    the app.)

Deferred from this phase:

- [!] `PresetBasket` still takes `(container, basket, textarea, context)` and builds its
  own three managers. It is constructible now, but it is not yet split.

### Phase 1 — Make tests runnable and separable

Decisions taken: directories over flat layout; `.test.ts` for node:test files; plumbing
only for this phase (trust fixes deliberately deferred).

- [x] Split the suites by directory: `tests/unit/` (node:test) and `tests/e2e/`
      (Playwright). Removes the `.spec.ts` / `.test.ts` overlap.
- [x] Rename the two node:test `.spec.ts` files to `*.test.ts`.
- [x] Point Playwright `testDir` at `./tests/e2e`.
- [x] Add scripts:
  - `test` → `node --test "tests/unit/**/*.test.ts"`
  - `test:e2e` → `playwright test`
  - `verify` → `npm run lint && npm test`
- [x] Verified the plumbing:
  - `npm test` → 25 tests, 25 pass, exit 0.
  - `npm run test:e2e -- --list` → 60 tests in 1 file (only `preset_gallery.spec.ts`).
  - `npm run lint` → eslint + tsc clean.
  - Breaking one assertion by hand makes `npm test` and `npm run verify` exit 1 (probe was
    reverted, not committed) — the gate is real, not decorative.

Deferred — all three now done (commit "test: point the unit tests at the real implementations"):

- [x] `tests/unit/preset_editor.test.ts` imports the real
      `PresetEditor.shouldConfirmOverwrite` (web/PresetEditor.js:175); the inlined copy
      is gone. Mutation-verified: removing the `uniqueKey !== editingKey` guard from the
      static makes the suite fail.
- [x] `tests/unit/variant_color.test.ts` calls the real `extractGroupName`, extracted as
      a static on `RawTextareaManager` (mirroring the `PresetEditor.shouldConfirmOverwrite`
      precedent) and invoked from `renderHighlights`. Mutation-verified: dropping the
      colon-split makes the suite fail.
- [x] The committed regression guard is `tools/mutation_check.py` — applies 8 source
      mutations, runs the matching test file, expects failure, restores the exact
      pre-run bytes (write-back, never `git checkout`, so uncommitted work is safe).
      Run it with `python tools/mutation_check.py`; exits non-zero if any mutation slips
      through. Currently: 8/8 caught.

### Phase 2 — Unit-test the pure-logic modules

No DOM needed; import the module and call it with fixtures.

- [x] `PresetSession` (new module, extracted in Phase 0) — `getSelectedArray`, `prunePins`
      contiguous-run rule, per-node pin persistence, `transferPin`, collapsed/excluded
      folder round trips, `buildRollSelection` (min/max target, exclusions, dedupe, combo
      default, unreachable target, 25 seeded rng runs), `detectSeedChange` (first call,
      change detection, noise widgets, subgraph recursion, removal). 30 tests in
      `tests/unit/preset_session.test.ts`.
- [x] `PresetGalleryContext` (new module, extracted in Phase 0) — live accessors onto the
      session, write-through on `pinnedChips`, widget-value reads, view forwarding, and
      proof that a real `ChipMenuManager` builds on a fake context with no DOM. 9 tests in
      `tests/unit/gallery_context.test.ts`.
- [x] `NestedPresetUtils` — `flatToNested` / `nestedToFlat`: path nesting, color
      preservation, `presetOnly` filtering, roundtrip fidelity. 16 tests in
      `tests/unit/nested_preset_utils.test.ts`. (Roundtrips asserted per-field, not
      by `deepEqual` on the whole map: `presetOnly=true` drops `filename`, and
      `nestedToFlat` materialises explicit `undefined` keys.)
- [x] `RollManager` — `getRoll`, `peekRoll`, `deleteRoll`, `getCount`,
      `cloneCounts`, `restoreCounts`, count reset semantics. 11 tests in
      `tests/unit/roll_manager.test.ts`.
- [x] `PresetLogic` — token splitting (comma vs `,` inside `()`/`<>`/`{}`), variant
      resolution, weight parsing, `isVirtualNull`, roll selection, plus
      `getUnrolledTemplate`, `expandRecursively`, `getAllVariants`,
      `parseChipDetails`, `findPresetMatch`, `getGroupMatches`, `escapeRegExp`,
      `getWrappedPreset` and the path helpers. 57 tests in
      `tests/unit/preset_logic.test.ts`.
- [x] `PngMetadata` — `isPng` signature check, `tEXt`/`iTXt`/`zTXt` chunk parsing,
      inflate path, malformed/truncated input, `extract` (incl. NaN sanitisation),
      `extractFromFile`, `getPresetGalleryWidgets`, `getPromptText`. 23 tests in
      `tests/unit/png_metadata.test.ts`.
- [x] `PresetGalleryAPI` — key normalization, folder/path splitting, hidden-key
      detection, folder rename/prefix rewrite, all against a stubbed `fetch`
      with an in-memory library. 21 tests in
      `tests/unit/preset_gallery_api.test.ts`. Pinned two real behaviours: a
      colour on a folder with no presets does not survive `savePresets`
      (colour-only entries need an active folder), and folderless keys never
      match a group roll.
- [x] `ExportUtils` — `getSelectionSummary`, `buildPresetSelectorTree`, diff
      detection, duplicate strategies. 14 tests in
      `tests/unit/export_utils.test.ts`. The DOM-driven export flow stays e2e.

Phase 2 verification: mutation probes broke each of the six modules (count
advance, `includeColors`, depth tracking, the `zTXt` branch, the hidden-key sort,
the replaced/same classification) and in every case the matching new test file
failed while the rest of the suite stayed green; `git checkout` restored each
source afterwards.

### Phase 3 — Unit-test the DOM-dependent modules

Needs `document` but not a browser. Decide the harness in §3.

Harness settled: jsdom as a devDependency, installed in `tests/unit/dom-harness.ts`
(window, document, CSS, KeyboardEvent/MouseEvent/Event/CustomEvent, bound rAF,
a `checkVisibility` polyfill returning true, `pretendToBeVisual: true`).
8 new mutations across the 9 modules were probed; every one is caught by the
matching file. What stays e2e: canvas-dependent paths (jsdom fires neither
onload nor onerror for data URLs) and drag/drop geometry.

- [x] `PresetDOM` — HTML escaping, icon registry, thumbnail validation, injectStyles
      dedup, basket-chip render matrix.
- [x] `ModalUtils` — alert/confirm/prompt/show lifecycle, Enter/Escape, backdrop
      click, focus restore, stylesheet dedup.
- [x] `PresetGallerySettings` — load/save, modal save/load, clamping, dice classes.
- [x] `AutocompleteManager` — filtering, keyboard nav, highlight, selection.
- [x] `InlineEditorManager` — edit lifecycle, save/cancel, bracket detection.
- [x] `ChipMenuManager` — pin, weight, edit, swap, locate, del, variant rows, re-roll.
- [x] `RawTextareaManager` — token rendering, ignorePreset, position math, tooltip.
- [x] `PresetGrid` — compile, filter pipeline (query/folder/hidden/show-hidden/sort),
      group headers and badges, group/roll toggles, item selection, persistence.
- [x] `PresetEditor` — real `shouldConfirmOverwrite` static + DOM-driven panel tests.
- [x] `PresetBasket` — tab restore/create/duplicate/delete/persist (payload carries
      activeTabId), render, selection updates, pins, deletion (two-token chip range),
      keyboard edits, focus, inline rename, clipboard payload round-trip.

Verified behaviours pinned while writing these: root presets compile with no group
header (an empty uiFolder never differs from the initial lastGroup); the filter's
main-loop hidden clause is redundant while grouped — the group-header branch hides
underscore presets on its own; `render()` does not sync the widget (the app does
before calling render); a chip spans two tokens when two selection entries join to
match the expanded preset; the server normalizes cache keys to lowercase.

### Phase 4 — Make the e2e suite survive

The harness these tests should run against is in place:

- [x] `dev/` UI harness — `dev/serve.py` (static + a virtual `/scripts/app.js` + a
      scratch-backed `/preset_gallery/presets`), `dev/host.js` (a stand-in for ComfyUI's
      host module that mirrors the real shim, `export const app = window.comfyAPI.app.app`),
      and `dev/index.html`, which drives the real registration and node-creation hooks
      against a fake node and exposes `window.__gallery` / `window.__report`.
      The only thing faked is the host object — if the harness ever needs to fake more,
      the UI has grown a new host dependency.
- [x] Verified in a browser with no ComfyUI and no backend: 15/15 checks pass — extension
      registered, gallery mounted, grid/search/basket/editor present, library loaded from
      the served route, context wiring intact, an initial selection rendered as a chip, and
      `serializeValue` expanding to `portrait, studio lighting`.
- [x] Point the Playwright suite at the harness instead of booting ComfyUI. Done —
      `playwright.config.js` boots `dev/serve.py` and nothing opens ComfyUI's menus.
- [x] The scratch library under `dev/.data/` — the suite no longer uses it; the
      library is served from an in-memory fixture via `page.route` (below).
- [x] Fix the stale frontend selectors (F15) — the harness suite has no ComfyUI
      selectors at all now. The live suite is the one that targets a real frontend,
      and it now pins the build (below).
- [x] Replace the menu-choreography `beforeEach` (F7) — the harness `beforeEach`
      mounts the gallery against mock data and asserts the harness report; no menu
      walking anywhere in the repo.
- [x] "Add `data-testid` hooks" — decided against. The spec drives `#j0n4t-pg-*`
      element IDs for every control and the namespaced `.j0n4t-pg-*` classes for
      structure; those names are already pinned by the unit tests, so a rename breaks
      both suites together. A `data-testid` attribute would duplicate the contract
      rather than replace a dependency.
- [x] Split smoke (injection, search, basket add) from full regression — the nine
      load/search/basket tests carry `{ tag: '@smoke' }`; `npm run test:e2e:smoke`
      runs just them (`playwright test --grep @smoke`).
- [x] Pin the frontend version the suite targets — the live suite asserts the
      served `build-manifest.json` commit equals `FRONTEND_COMMIT`
      (`dc6160bf…`, comfyui_frontend 1.58.0), so a frontend swap fails up front
      with instructions instead of as a wall of LiteGraph errors.

Phase 4 outcome:

- [x] The Playwright suite now runs against the harness. `playwright.config.js` starts
      `dev/serve.py` as its `webServer` and uses it as `baseURL`; the menu choreography is
      gone. `tests/e2e/gallery.spec.ts` is 18 tests; locally they run on chromium,
      in CI on all three browsers.
- [x] The library is served from an in-memory fixture via `page.route`, so tests are
      isolated and the POST payload is observable. That pinned two real behaviours: the API
      normalises keys to lowercase (`Faces/HarnessPreset` -> `faces/harnesspreset`), and
      every edit POSTs the *whole* library back.
- [x] `tests/e2e/comfyui_integration.spec.ts` — 4 live assertions against `:8188`, skipped
      automatically when ComfyUI is not running: the extension is in `app.extensions`, a
      created node registers its `preset_gallery_ui` DOM widget with grid/search/basket and
      renders items, the two driven widgets are hidden, and `/object_info` reports the
      declared sockets (`base_preset` as `forceInput`, `final_preset` out).
- [x] `npx playwright install` — done; Firefox and WebKit 150.0.2 / 26.4 binaries are
      installed. They are CI-only projects: locally the suite runs chromium
      (enough to gate a push), in CI all three run, serialized.
- [x] Pin the frontend version the live suite targets (F15) — `FRONTEND_COMMIT`
      in `comfyui_integration.spec.ts`, asserted from the server-served
      `build-manifest.json` in `beforeAll`.

One more fix landed in `dev/index.html` while stabilising the suite: the harness
polled a fixed 120ms for `init()` and then took its report against whatever state
existed — under parallel browser load the API fetch outlasted the delay, every
check read the empty state, and the `ok`-defaulted checks reported 15/15 anyway.
It now polls until the grid has actually rendered presets, and the content checks
(`grid rendered presets`, `session cache loaded`, `initial selection rendered as
chips`) fail when the count is 0. The config also serializes runs (`workers: 1`) —
on this throttled machine the default 4-way parallelism starved firefox into
intermittent mount races.

Two things the live test deliberately does not assert: whether ComfyUI *draws* the node
(and therefore attaches the DOM widget to the document) depends on where the graph places
it, which is incidental — the assertion is on the registered widget, whose element is
queryable while detached. And `IS_CHANGED` forcing re-execution is covered by the pytest
wiring test (`value != value`) rather than by queueing twice, because ComfyUI's history
does not expose whether a node was cached.

### Phase 5 — CI

- [ ] `.github/workflows/test.yml` running `npm run verify` on push/PR.
- [ ] Decide whether e2e is in CI at all (needs a ComfyUI harness — see F8).

---

## 3. Decisions

Resolved:

1. **Directory layout.** `tests/unit` + `tests/e2e`. Done in Phase 1.
2. **Runner.** `node --test` with Node's native type stripping. No `tsx`, no build step
   (F10). Confirmed working on Node 22.23.2.
3. **Where the session logic lives.** New `web/PresetSession.js`, mirroring how
   `RollManager.js` was already extracted. Done in Phase 0.
4. **Randomness and storage.** Constructor-injected `rng` and `storage` with defaults,
   rather than module-level singletons. Done in Phase 0.
5. **The `PresetLogic.RollManager` alias.** Removed; `RollManager` is imported directly.
   Done in Phase 0.
6. **`PresetGalleryApp` coverage.** Solved by moving the `scripts/app.js` import into
   `PresetGalleryRegistration.js`, not by stubbing it. The app is now importable (F9).

Still open:

7. **DOM harness for Phase 3 — decided: jsdom.** `jsdom` + `@types/jsdom` added as
   devDependencies, installed via `tests/unit/dom-harness.ts` (import it before the
   module under test). Chosen over hand-rolled mock elements because
   `buildPresetSelectorTree` and the Phase 3 components parse `innerHTML` and query the
   result — a mock would reimplement the DOM and pass while the app is broken.
   `allowImportingTsExtensions` enabled in `tsconfig.json` (already `noEmit`) so the
   harness can be imported by its `.ts` extension, which Node's ESM loader requires.
8. **CI scope.** Unit only, or unit + e2e with a containerised ComfyUI (F8).
9. **Module boundaries — answered for `PresetBasket` too: test through the DOM.**
   The jsdom harness plus the Phase 0 context contract made `PresetBasket` testable
   without splitting it: its managers construct on a fake context, and its own state
   (tabs, pins, selection, clipboard) is observable through the DOM it builds. A
   2168-line split was the wrong trade — the module's cohesion is real, and the harness
   reaches it as-is.
