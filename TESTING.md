# Testing

How to run and maintain the test suites. The plan, phase history and probe
findings live in `docs/TESTING.md`.

## Running

| Command | What it does |
|---|---|
| `npm test` | Unit tests (`node --test`, `tests/unit`) |
| `npm run test:py` | Pytest wiring tests (`tests/python`) |
| `npm run verify` | lint + typecheck + unit + pytest — the gate before pushing |
| `npm run test:e2e` | Playwright suite against the `dev/` harness (chromium, serialized) |
| `npm run test:e2e:smoke` | The `@smoke`-tagged load/search/basket tests only |
| `python tools/mutation_check.py` | Applies source mutations; each must fail its test file |

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
