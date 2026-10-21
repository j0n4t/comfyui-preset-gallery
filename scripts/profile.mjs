// Whole-app bottleneck finder: drives the real UI in a browser and reports
// where the time actually goes.
//
// Why this is a local, on-demand tool rather than part of `npm run verify`:
//
//   * It measures wall-clock time, and this machine's external load is not ours
//     to control - the same render has been measured at 60 ms and 350 ms within
//     the hour, and a fixed calibration loop swung 13.6x with no code change.
//     A timing threshold in CI would flake; tests/unit/preset_logic.perf.test.ts
//     covers the guards, and it compares against a calibration rather than ms.
//   * It needs a browser, so it is slower and heavier than the unit suite.
//
// What it gives you instead: a ranked, load-normalised picture of the app, with
// the call counts that tell you *why* a frame is hot.
//
// Run:  npm run profile                    all scenarios
//       npm run profile -- basket-render   one scenario
//       npm run profile -- --headful       watch it happen
//       npm run profile -- --json          machine-readable
//       npm run profile -- --top 20        more frames per scenario
//
// It serves the dev harness (dev/serve.py) against a stubbed ComfyUI host, so
// no ComfyUI and no backend are needed. That harness has no canvas chrome: it
// profiles the gallery's own work, not ComfyUI's.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PROFILE_PORT || 8878);
const URL = `http://127.0.0.1:${PORT}/dev/index.html`;

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const HEADFUL = flag("headful");
const AS_JSON = flag("json");
const TOP = Number(value("top", 12));
const only = argv.filter((a) => !a.startsWith("--") && a !== value("top", null));

/**
 * PresetLogic helpers worth counting. Each was a measured hotspot at some
 * point, so a count that jumps is the first thing to look at when a scenario
 * gets slower.
 */
const COUNTED = [
  "getPresetFolder",
  "getWrappedPreset",
  "getGroupMatches",
  "resolveVariantKey",
  "findPresetMatch",
  "expandRecursively",
  "parseTokens",
  "getGroupedChips",
  "getPresetColor",
  "getAllVariants",
];

/** The app's own work, in the order a user meets it. */
const SCENARIOS = [
  { name: "grid-compile", what: "library load: rebuild the grid" },
  { name: "grid-filter", what: "search: filter the grid" },
  { name: "basket-render", what: "render a 120-chip basket" },
  { name: "raw-typing", what: "one keystroke in the raw textarea" },
  { name: "expand", what: "expand the basket into the textarea" },
];

/** Inject the driver. Runs in the page, after the harness has mounted. */
const INSTALL_BENCH = () => {
  const gallery = window.__gallery;
  const cache = gallery.session.cache;
  const keys = Object.keys(cache).filter(
    (k) => cache[k]?.preset?.trim() && cache[k].preset.length > 12
  );

  const longText = keys.slice(0, 120).map((k) => cache[k].preset).join(", ");

  // A fixed CPU-bound loop over the same data. Everything below is reported as
  // a multiple of this, so the numbers survive a busy machine.
  const calibrate = () => {
    const cacheKeys = Object.keys(cache);
    let sink = 0;
    const start = performance.now();
    for (let pass = 0; pass < 10000; pass++) {
      for (const k of cacheKeys) sink += k.length;
    }
    if (sink < 0) throw new Error("unreachable");
    return performance.now() - start;
  };

  const scenarios = {
    "grid-compile": () => gallery.grid.compile(cache),
    "grid-filter": () => gallery.grid.executeFilterPipeline("gen"),
    "basket-render": () => gallery.basket.render(keys.slice(0, 120)),
    "raw-typing": () => {
      gallery.basket.textarea.value = longText;
      gallery.basket.rawManager.updateHighlights();
    },
    expand: () => {
      const rm = gallery.session.rollManager;
      rm.resetCounts();
      for (const key of keys.slice(0, 120)) {
        window.__PresetLogic.expandRecursively(key, cache, new Set(), rm);
      }
    },
  };

  window.__bench = {
    entries: Object.keys(cache).length,
    basket: keys.length,
    calibrate,
    /** Fastest of `runs`, because the minimum is the least-contended sample. */
    fastest(fn, runs) {
      fn();
      let best = Infinity;
      for (let i = 0; i < runs; i++) {
        const start = performance.now();
        fn();
        best = Math.min(best, performance.now() - start);
      }
      return best;
    },
    run: (name) => scenarios[name](),
    names: () => Object.keys(scenarios),
    /** Run a scenario with the counted helpers instrumented. */
    runWithCounts(name, counted) {
      const logic = window.__PresetLogic;
      const counts = {};
      const originals = {};
      for (const fn of counted) {
        originals[fn] = logic[fn];
        counts[fn] = 0;
        logic[fn] = function (...args) {
          counts[fn] += 1;
          return originals[fn].apply(this, args);
        };
      }
      try {
        scenarios[name]();
      } finally {
        for (const fn of counted) logic[fn] = originals[fn];
      }
      return counts;
    },
  };
};

// --- plumbing ------------------------------------------------------------

async function ensureServer() {
  try {
    const res = await fetch(URL);
    if (res.ok) return null;
  } catch {
    // not up yet
  }
  const child = spawn("python", ["dev/serve.py", String(PORT)], {
    cwd: ROOT,
    stdio: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      if ((await fetch(URL)).ok) return child;
    } catch {
      // still starting
    }
  }
  child.kill();
  throw new Error(`dev/serve.py did not answer on ${URL}`);
}

/** Rank self-time by function name from a CDP profile. */
function rankFrames(profile) {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const byName = new Map();
  let total = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const node = nodes.get(profile.samples[i]);
    const delta = profile.timeDeltas[i] || 0;
    total += delta;
    if (!node) continue;
    const frame = node.callFrame;
    const name = frame.functionName || "(anonymous)";
    const file = (frame.url || "").split("/").pop() || "";
    const key = file ? `${name}  ${file}` : name;
    byName.set(key, (byName.get(key) || 0) + delta);
  }
  const ranked = [...byName.entries()]
    .map(([key, us]) => ({ key, ms: us / 1000, pct: total ? (100 * us) / total : 0 }))
    .sort((a, b) => b.ms - a.ms);
  return { total: total / 1000, ranked };
}

async function profileScenario(page, cdp, scenario, bench) {
  // Warm up outside the profile so first-call setup is not attributed to it.
  await page.evaluate((name) => window.__bench.run(name), scenario.name);

  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
  await cdp.send("Profiler.start");
  await page.evaluate((name) => window.__bench.run(name), scenario.name);
  const { profile } = await cdp.send("Profiler.stop");

  const { total, ranked } = rankFrames(profile);
  const counts = await page.evaluate(
    ({ name, counted }) => window.__bench.runWithCounts(name, counted),
    { name: scenario.name, counted: COUNTED }
  );

  // Load-normalised: the same scenario timed against the calibration loop,
  // interleaved so both see the same conditions.
  const ms = await page.evaluate(
    (name) => window.__bench.fastest(() => window.__bench.run(name), 4),
    scenario.name
  );
  const calibration = await page.evaluate(() =>
    window.__bench.fastest(() => window.__bench.calibrate(), 4)
  );

  return {
    ...scenario,
    total,
    ratio: ms / calibration,
    ms,
    calibration,
    ranked: ranked.slice(0, TOP),
    counts,
  };
}

function report(results, meta) {
  if (AS_JSON) {
    console.log(JSON.stringify({ meta, results }, null, 2));
    return;
  }
  console.log(`\nlibrary: ${meta.entries} entries, ${meta.basket} basket-sized presets`);
  console.log("profiled through the dev harness (stubbed host, no ComfyUI)\n");

  for (const r of results) {
    console.log(`${r.name}  -  ${r.what}`);
    console.log(
      `  ${r.total.toFixed(0)} ms profiled   ${r.ms.toFixed(1)} ms timed` +
        `   ${r.ratio.toFixed(2)}x calibration (${r.calibration.toFixed(1)} ms)`
    );
    console.log("  top frames by self time:");
    for (const f of r.ranked) {
      console.log(`    ${f.ms.toFixed(1).padStart(7)} ms ${f.pct.toFixed(1).padStart(5)}%  ${f.key}`);
    }
    const hot = Object.entries(r.counts)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
    if (hot.length) {
      console.log("  calls:");
      for (const [name, n] of hot) console.log(`    ${String(n).padStart(8)}  ${name}`);
    }
    console.log("");
  }

  console.log("reading this:");
  console.log("  * A frame that is hot AND called a lot is the usual target.");
  console.log("  * Compare counts across runs, not milliseconds: a count that");
  console.log("    jumps is a regression the timing will not show you on a busy host.");
  console.log("  * The ratio is the number to compare between runs; ms is context.");
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch({ headless: !HEADFUL });
  let failed = 0;

  try {
    const page = await browser.newPage();
    await page.goto(URL);
    await page.waitForFunction(
      () => window.__report && window.__gallery && window.__report.report.length > 3,
      null,
      { timeout: 30_000 }
    );

    // The harness checks the UI mounted; a broken app would profile as fast.
    const harness = await page.evaluate(() => ({
      failed: window.__report.failed,
      total: window.__report.report.length,
      failures: window.__report.report.filter((r) => !r.ok).map((r) => r.name),
    }));
    if (harness.failed) {
      console.error(
        `harness is failing ${harness.failed}/${harness.total} checks: ${harness.failures.join(", ")}`
      );
      console.error("fix that first - these numbers describe a broken app\n");
      failed = harness.failed;
    }

    // PresetLogic is a module; the page needs a handle on it for `expand` and
    // for call counting.
    await page.evaluate(async () => {
      window.__PresetLogic = (await import("/web/PresetLogic.js")).default;
    });
    await page.evaluate(INSTALL_BENCH);

    const meta = await page.evaluate(() => ({
      entries: window.__bench.entries,
      basket: window.__bench.basket,
    }));

    const cdp = await page.context().newCDPSession(page);
    const wanted = SCENARIOS.filter((s) => only.length === 0 || only.includes(s.name));
    const missing = only.filter((n) => !SCENARIOS.some((s) => s.name === n));
    if (missing.length) {
      console.error(`unknown scenario(s): ${missing.join(", ")}`);
      console.error(`known: ${SCENARIOS.map((s) => s.name).join(", ")}`);
      process.exitCode = 1;
      return;
    }

    const results = [];
    for (const scenario of wanted) {
      results.push(await profileScenario(page, cdp, scenario, meta));
    }
    report(results, meta);
    if (failed) process.exitCode = 1;
  } finally {
    await browser.close();
    if (server) server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
