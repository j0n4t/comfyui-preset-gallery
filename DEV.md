# Development

How to run and maintain the test suites, and how the generated assets in this
repo are produced. The plan, phase history and probe findings live in
`docs/TESTING.md`.

## Running

| Command | What it does |
|---|---|
| `npm test` | Unit tests (`node --test`, `tests/unit`) |
| `npm run test:py` | Pytest wiring tests (`tests/python`) |
| `npm run verify` | lint + typecheck + unit + pytest — the gate before pushing |
| `npm run test:e2e` | Playwright suite against the `dev/` harness (chromium, serialized) |
| `npm run test:e2e:smoke` | The `@smoke`-tagged load/search/basket tests only |
| `npm run profile` | Whole-app bottleneck report in a browser (see below) |
| `python tools/mutation_check.py` | Applies source mutations; each must fail its test file |
| `npm run screenshot` | Regenerates `sample.png` (see below) |

## Layout

- `tests/unit/` — node:test. No build step: Node 22 strips TypeScript types
  natively. Files must be named `*.test.ts` (`.spec.ts` is collected by
  neither runner). DOM-dependent tests import `./dom-harness.ts` (jsdom) at
  the top of the file, before the module under test.
- `tests/e2e/` — Playwright. `gallery.spec.ts` drives the real `web/` modules
  through `dev/index.html` (stubbed ComfyUI host, library served from an
  in-memory fixture) — no ComfyUI or backend needed. `comfyui_integration.spec.ts`
  needs a live ComfyUI on `:8188` and skips itself otherwise.
- `tests/python/` — pytest, backend wiring contract.
- `dev/` — the e2e harness: `serve.py` (static server + virtual
  `/scripts/app.js`), `index.html` (mounts the gallery against a fake node,
  exposes `window.__gallery` / `window.__report`), `host.js`.

## Finding bottlenecks

`npm run profile` drives the real UI through the `dev/` harness in a browser and
reports where the time goes. It is the tool to reach for before optimising
anything, and the one that produced the measurements in
`docs/chips-parsing-bottlenecks.md`.

```
npm run profile                     # every scenario
npm run profile -- basket-render    # one of them
npm run profile -- --headful        # watch it happen
npm run profile -- --json           # machine-readable
npm run profile -- --top 20         # more frames per scenario
```

Scenarios: `grid-compile` (library load), `grid-filter` (search),
`basket-render` (120 chips), `raw-typing` (one keystroke, through the real
`input` listener, so it includes the autocomplete popup), `expand` (basket into
the textarea).

For each it prints the ranked self-time frames, the call counts of the helpers
that have been hot before, and a **load-normalised ratio**.

**Read the ratio and the counts, not the milliseconds.** This machine's external
load is not ours to control — the same render has been measured at 60 ms and
350 ms within the hour, and a fixed calibration loop swung 13.6x with no code
change. The ratio divides by a calibration loop timed in the same run, which
cancels the load (~1.3x variation where the raw milliseconds vary ~4x). The call
counts are load-independent outright, and a count that jumps is a regression the
timing will not show you.

It is deliberately **not** part of `npm run verify`: a wall-clock threshold in CI
would flake, and it needs a browser. The guards that *do* gate a push live in
`tests/unit/preset_logic.perf.test.ts`, and they compare against a calibration
for the same reason.

## Regenerating the screenshot

`sample.png` in the README is generated, not hand-cropped. With ComfyUI running:

```
npm run screenshot
```

It loads `workflows/sample_preset_gallery.json`, serves the sample presets to the
gallery, queues a run so the preview node shows the composed prompt, and writes the
canvas to `sample.png`. It composes the gallery's own state first — small grid view, the
basket and editor panels capped, the management panel open — so the image does not depend
on whatever the previous session left in `localStorage`, then sizes the node to a whole
number of grid rows. It refuses to write a shot with a toast on screen or a grid row cut
at the node's bottom edge, so a failure means the image would have looked wrong.

## Conventions

- **e2e selectors:** `#j0n4t-pg-*` element IDs for controls, namespaced
  `.j0n4t-pg-*` classes for structure. No `data-testid` attributes — those
  names are pinned by the unit tests too, so a rename breaks both suites at
  once instead of one.
- **Runs are serialized** (`workers: 1` in `playwright.config.js`): this
  machine is throttled, and parallel workers starved firefox into intermittent
  mount races.
- **Browser split:** chromium locally (enough to gate a push); CI
  (`process.env.CI`) enables firefox and webkit plus the retry policy.
- **Frontend pin:** the live e2e suite asserts the served
  `build-manifest.json` commit (`FRONTEND_COMMIT`, comfyui_frontend 1.58.0)
  before running — update it when the frontend is upgraded, after re-validating
  the suite.
- **Mutation discipline:** every behaviour change ships with a test, and
  `tools/mutation_check.py` proves the suite still catches deliberate
  breakage (it restores the exact pre-run bytes; never `git checkout`).
- **Test content must be assertions about what the user sees** (widget values,
  rendered chips, persisted state), not structural mirrors of the source.
