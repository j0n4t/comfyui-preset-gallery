# Testing plan

Branch: `test/expand-coverage`
Status: planning — Phase 1 not started
Goal: make the test suites runnable and trustworthy, then close the coverage gap on the
`web/` modules.

Checkbox legend: `[ ]` todo, `[~]` in progress, `[x]` done.

---

## 1. Current state (verified by probe, not by reading)

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

### Coverage gap

16 of 18 `web/` modules have no unit test. Only `YAMLUtils.js` and
`PresetLogic.getPresetColor` are covered, plus the inlined `PresetEditor` copy.

| Module | Lines | Unit-tested |
|---|---|---|
| `PresetBasket.js` | 2168 | no |
| `PresetLogic.js` | 1020 | partial (color only) |
| `ExportUtils.js` | 967 | no |
| `ChipMenuManager.js` | 593 | no |
| `PresetGrid.js` | 518 | no |
| `PresetEditor.js` | 390 | no (inlined copy only) |
| `RawTextareaManager.js` | 374 | no |
| `PngMetadata.js` | 319 | no |
| `AutocompleteManager.js` | 253 | no |
| `InlineEditorManager.js` | 222 | no |
| `PresetGallerySettings.js` | 218 | no |
| `ModalUtils.js` | 193 | no |
| `YAMLUtils.js` | 177 | yes |
| `PresetGalleryAPI.js` | 175 | no |
| `PresetDOM.js` | 147 | no |
| `NestedPresetUtils.js` | 90 | no |
| `RollManager.js` | 66 | no |
| `PresetGalleryApp.js` | 750 | e2e only |

---

## 2. Plan

### Phase 1 — Make tests runnable and separable

- [ ] Split the suites by directory: `tests/unit/` (node:test) and `tests/e2e/`
      (Playwright). Remove the `.spec.ts` / `.test.ts` overlap.
- [ ] Rename the two node:test `.spec.ts` files to `*.test.ts`.
- [ ] Point Playwright `testDir` at `./tests/e2e`.
- [ ] Add scripts:
  - `test` → node:test over `tests/unit/`
  - `test:e2e` → `playwright test`
  - `verify` → `lint && typecheck && test`
- [ ] Fix `tests/unit/preset_editor.test.ts` to import the real
      `PresetEditor.shouldConfirmOverwrite` instead of inlining a copy (F5). Verified
      feasible: the static exists at `web/PresetEditor.js:175` and importing the real
      module works in bare Node.
- [ ] Prove the suite fails when a real assertion is broken (guard against a green suite
      that tests nothing).

### Phase 2 — Unit-test the pure-logic modules

No DOM needed; import the module and call it with fixtures.

- [ ] `NestedPresetUtils` — `flatToNested` / `nestedToFlat`: path nesting, color
      preservation, `presetOnly` filtering, roundtrip fidelity.
- [ ] `RollManager` — `getRoll`, `peekRoll`, `deleteRoll`, `getCount`, `cloneCounts`,
      `restoreCounts`, count reset semantics.
- [ ] `PresetLogic` — token splitting (comma vs `,` inside `()`/`<>`/`{}`), variant
      resolution, weight parsing, `isVirtualNull`, roll selection.
- [ ] `PngMetadata` — `isPng` signature check, `tEXt`/`iTXt`/`zTXt` chunk parsing,
      inflate path, malformed/truncated input.
- [ ] `PresetGalleryAPI` — key normalization, folder/path splitting, hidden-key detection,
      folder rename/prefix rewrite.
- [ ] `ExportUtils` — `getSelectionSummary`, `buildPresetSelectorTree`, diff detection.
      The DOM-driven export flow stays e2e.

### Phase 3 — Unit-test the DOM-dependent modules

Needs `document` but not a browser. Decide the harness in §3.

- [ ] `PresetDOM` — HTML escaping, data URL validation, weight/boolean rendering.
- [ ] `ModalUtils` — open/close lifecycle, button resolution, Escape handling, focus
      restore.
- [ ] `PresetGallerySettings` — load/save, dice visual state.
- [ ] `AutocompleteManager` — match filtering, keyboard nav, highlight.
- [ ] `InlineEditorManager` — edit lifecycle, save/cancel, bracket detection.
- [ ] `ChipMenuManager` — chip selection, variant replacement, pin/unpin.
- [ ] `RawTextareaManager` — token highlighting, char-position math, variant detection.
- [ ] `PresetGrid` — filter pipeline, sort/compile, view switching.
- [ ] `PresetEditor` — field validation, save/delete flow, image state.
- [ ] `PresetBasket` — tab state, chip serialization, roll counts, pin persistence.

### Phase 4 — Make the e2e suite survive

- [ ] Replace the menu-choreography `beforeEach` (F7) with a direct injection harness
      that mounts the gallery against mock data.
- [ ] Add `data-testid` hooks so tests stop depending on CSS class names.
- [ ] Split smoke (injection, search, basket add) from full regression.

### Phase 5 — CI

- [ ] `.github/workflows/test.yml` running `npm run verify` on push/PR.
- [ ] Decide whether e2e is in CI at all (needs a ComfyUI harness — see F8).

---

## 3. Decisions to make

1. **Directory layout.** `tests/unit` + `tests/e2e`, or keep one flat `tests/` and
   separate by extension? (F3/F4 push toward directories.)
2. **Runner.** `node --test` on `.ts` relies on Node's type stripping (works on Node
   22.23.2). Alternative: `tsx` as a devDependency for a more conventional setup.
3. **DOM harness for Phase 3.** F9 narrows this: module *loading* needs no DOM at all.
   Only the methods that touch `document` do. Options: `happy-dom` / `jsdom` as a
   devDependency, hand-rolled stubs, or push those methods to e2e instead.
4. **CI scope.** Unit only, or unit + e2e with a containerised ComfyUI.
5. **Module boundaries.** Some modules mix pure logic with DOM plumbing. Split the logic
   out (more testable, more churn) or test through the DOM (less churn, slower)?
6. **`PresetGalleryApp` coverage.** Its `scripts/app.js` import (F9) blocks unit testing
   entirely. Leave it e2e-only, or stub that import so the app's logic can be tested?
