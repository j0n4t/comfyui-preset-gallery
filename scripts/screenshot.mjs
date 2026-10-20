// README screenshot: the sample workflow on the real ComfyUI canvas, with the
// gallery showing the sample presets and the composed prompt in the preview
// node.
//
// Why this is not part of `npm run verify`:
//
//   * It needs a running ComfyUI, so it cannot run offline against the dev
//     harness - the harness has no canvas chrome, so a shot of it would
//     document a layout the user never sees.
//   * It opens a real browser window on purpose: this is a document, and a
//     headful window matches what a user sees (the dev harness proves the UI,
//     this proves where it sits in the graph).
//   * A PNG is not reproducible across machines (fonts, DPI, antialiasing), so
//     unlike an artifact it cannot be freshness-gated in CI.
//
// It is therefore a local, on-demand tool. Run:  npm run screenshot
//
// Requires ComfyUI to be running (COMFY_URL, default http://127.0.0.1:8188).
// The gallery is served the sample presets from presets_sample.yml, converted
// to the flat library shape by the extension's own YAML and nesting helpers -
// the same conversion the import button performs, so the shot cannot drift
// from what an import shows.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import NestedPresetUtils from "../web/NestedPresetUtils.js";
import YAMLUtils from "../web/YAMLUtils.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMFY_URL = process.env.COMFY_URL || "http://127.0.0.1:8188";
const WORKFLOW = join(ROOT, "workflows", "sample_preset_gallery.json");
const SAMPLE = join(ROOT, "presets_sample.yml");
const OUT = join(ROOT, "sample.png");

// A desktop viewport, so the canvas is laid out the way a desktop user sees it.
const VIEWPORT = { width: 1520, height: 900 };
// 2x, so the text in the README is crisp rather than upscaled.
const SCALE = 2;
// How much of the canvas the nodes should fill after fitting.
const FIT_ZOOM = 0.8;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Poll a page expression until truthy, or give up. */
async function waitFor(page, expression, label, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await page.evaluate(expression);
    if (last) return last;
    await delay(150);
  }
  throw new Error(`timed out waiting for ${label} (last: ${JSON.stringify(last)})`);
}

async function main() {
  const sample = NestedPresetUtils.nestedToFlat(
    YAMLUtils.parse(readFileSync(SAMPLE, "utf8"))
  );
  const workflow = JSON.parse(readFileSync(WORKFLOW, "utf8"));

  const browser = await chromium.launch({ headless: false });
  try {
    await shoot(browser, { sample, workflow });
  } finally {
    await browser.close();
  }
}

async function shoot(browser, { sample, workflow }) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
  });
  const page = await context.newPage();

  // Serve the sample instead of whatever library the server has. Both routes
  // the gallery reads are covered: the library list (so the picker shows one
  // library) and the presets (so the grid is filled from the sample).
  await page.route("**/preset_gallery/libraries**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: "default", name: "Presets", default: true }]),
    });
  });
  await page.route("**/preset_gallery/presets**", async (route) => {
    const body =
      route.request().method() === "POST"
        ? JSON.stringify({ status: "success" })
        : JSON.stringify(sample);
    await route.fulfill({ status: 200, contentType: "application/json", body });
  });

  await page.goto(COMFY_URL, { waitUntil: "domcontentloaded" });
  await waitFor(
    page,
    "typeof window.app === 'object' && !!window.app && !!window.app.graph",
    "the ComfyUI app"
  );
  console.log(`comfyui: ${COMFY_URL}`);

  await page.evaluate(async (wf) => {
    await window.app.loadGraphData(wf);
  }, workflow);
  await waitFor(
    page,
    "document.querySelectorAll('.j0n4t-pg-item').length > 0",
    "the sample presets to render"
  );
  console.log(`sample:   ${Object.keys(sample).length} presets from ${SAMPLE}`);

  // The grid is capped at the node height, so the row landing on the bottom edge
  // can be cut in half. Grow the node to the next row boundary instead: the grid
  // content depends on the library, so a fixed height would drift.
  await page.evaluate(() => {
    const wrap = document.querySelector(".j0n4t-pg-wrap");
    const grid = wrap.querySelector(".j0n4t-pg-grid");
    const node = window.app.graph._nodes.find(
      (n) => n.type === "PresetGalleryNode"
    );
    const gap = parseFloat(getComputedStyle(grid).rowGap) || 0;
    const wrapRect = wrap.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    // The grid height tracks the node height one for one, offset by the chrome
    // above the grid and the node's own chrome.
    const fixed = gridRect.top - wrapRect.top + (node.size[1] - wrapRect.height);
    let bottom = 0;
    const boundaries = Array.from(grid.children).map((child) => {
      bottom += child.getBoundingClientRect().height + gap;
      return bottom;
    });
    // The first boundary past the current grid height is the bottom of the row
    // that is currently cut, so growing to it makes that row whole.
    const next = boundaries.find((b) => b > gridRect.height);
    if (next) {
      node.size[1] = Math.round(next + fixed);
      node.setSize([node.size[0], node.size[1]]);
    }
  });
  await delay(400);

  // Report where the grid ended up, so a change in the library or the UI is
  // visible in the run output rather than only in the image.
  const geometry = await page.evaluate(() => {
    const wrap = document.querySelector(".j0n4t-pg-wrap");
    const grid = wrap?.querySelector(".j0n4t-pg-grid");
    const item = grid?.querySelector(".j0n4t-pg-item");
    const node = window.app.graph._nodes.find(
      (n) => n.type === "PresetGalleryNode"
    );
    if (!wrap || !grid || !item) return null;
    const style = getComputedStyle(grid);
    const wrapRect = wrap.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const pitch = itemRect.height + (parseFloat(style.rowGap) || 0);
    const rows = Math.floor(gridRect.height / pitch);
    return {
      nodeHeight: node.size[1],
      wrapHeight: Math.round(wrapRect.height),
      gridHeight: Math.round(gridRect.height),
      gridTop: Math.round(gridRect.top - wrapRect.top),
      itemHeight: Math.round(itemRect.height),
      rowGap: style.rowGap,
      pitch: Math.round(pitch * 10) / 10,
      wholeRows: rows,
      leftover: Math.round((gridRect.height - rows * pitch) * 10) / 10,
    };
  });
  console.log(`geometry: ${JSON.stringify(geometry)}`);

  // The management panel is what makes the shot informative, and it starts
  // expanded; only toggle when it is actually collapsed.
  await page.evaluate(() => {
    const editor = document.querySelector(".j0n4t-pg-editor");
    if (editor?.classList.contains("collapsed")) {
      document.querySelector("#j0n4t-pg-toggle")?.click();
    }
  });

  // Two presets into the basket: enough to show the chips and to give the
  // preview node something to compose, and the last one clicked is the one the
  // detail card is showing.
  const items = page.locator(".j0n4t-pg-item:not(.j0n4t-pg-hidden)");
  const total = await items.count();
  console.log(`grid:     ${total} visible items`);
  for (const index of [0, Math.min(4, total - 1)]) {
    await items.nth(index).click();
    console.log(`clicked:  item ${index}`);
  }
  await delay(400);

  const chips = await page.locator(".j0n4t-pg-basket-chip").count();

  // The preview node only shows the composed text after a run, so queue one and
  // wait for the text to land. The shot is worthless without it.
  await page.evaluate(async () => {
    await window.app.queuePrompt(-1);
  });
  // PreviewAny exposes its text through a preview_text widget. Reading the
  // widget rather than scraping the node's DOM keeps the check on the value the
  // node really holds, which is what ends up in the shot.
  await waitFor(
    page,
    `(() => {
      const node = window.app.graph._nodes.find((n) => n.type === "PreviewAny");
      return node?.widgets?.find((w) => w.name === "preview_text")?.value?.length > 0;
    })()`,
    "the preview node to hold the composed preset"
  );

  const preview = await page.evaluate(() => {
    const node = window.app.graph._nodes.find((n) => n.type === "PreviewAny");
    return (
      node?.widgets?.find((w) => w.name === "preview_text")?.value ?? ""
    );
  });
  console.log(`basket:   ${chips} chips`);
  console.log(`preview:  ${preview.split("\n")[0].slice(0, 70).replace(/\s+/g, " ")}`);

  // The shot is only meaningful if the canvas is actually showing that text,
  // so confirm the rendered widget agrees with the node's value.
  const rendered = await page.evaluate(
    () => document.querySelector(".widget-text-preview textarea")?.value ?? ""
  );
  if (chips < 2 || !preview) {
    throw new Error(
      "the shot needs a selection in the basket and text in the preview node"
    );
  }
  if (rendered !== preview) {
    throw new Error(
      "the preview node holds the text but the canvas is not showing it"
    );
  }

  // Queueing leaves a "Job queued" toast on screen for a few seconds. It is
  // transient, so give it time to appear and then wait for it to clear, rather
  // than crop around it.
  await delay(1500);
  await waitFor(
    page,
    "document.querySelector('[data-testid=\"toast\"]') === null",
    "the queue toast to clear",
    20000
  );

  // Fit the whole canvas: nothing selected, so the fit covers every node.
  await page.evaluate(({ zoom }) => {
    const canvas = window.app.canvas;
    canvas.selectedItems?.clear();
    const [width, height] = canvas.ds.getViewportSize();
    canvas.fitViewToSelectionAnimated({ viewport: [0, 0, width, height], zoom });
  }, { zoom: FIT_ZOOM });
  await delay(700); // let the fit animation finish

  const view = await page.evaluate(() => ({
    scale: window.app.canvas.ds.scale,
    offset: window.app.canvas.ds.offset,
  }));
  console.log(
    `view:     scale ${view.scale.toFixed(2)} offset [${Math.round(
      view.offset[0]
    )}, ${Math.round(view.offset[1])}]`
  );

  const bounds = await page.evaluate(() =>
    window.app.graph._nodes.reduce(
      (box, node) => ({
        minX: Math.min(box.minX, node.pos[0]),
        minY: Math.min(box.minY, node.pos[1]),
        maxX: Math.max(box.maxX, node.pos[0] + node.size[0]),
        maxY: Math.max(box.maxY, node.pos[1] + node.size[1]),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    )
  );
  console.log(
    `bounds:   ${Math.round(bounds.maxX - bounds.minX)}x${Math.round(
      bounds.maxY - bounds.minY
    )} graph units`
  );

  // Crop to the canvas itself: the shot documents the graph, not the window
  // chrome around it.
  const canvas = page.locator(".graph-canvas-container");
  const rect = await canvas.boundingBox();
  if (!rect) throw new Error("the canvas has no box - is the graph area visible?");

  // Prove the two things the shot is meant to show, rather than eyeball them:
  // no toast left on screen, and no grid row cut at the node's bottom edge.
  // Only items overlapping the viewport count as clipped - ones scrolled out of
  // view entirely are normal.
  const clean = await page.evaluate(() => {
    const grid = document.querySelector(".j0n4t-pg-grid");
    const view = grid.getBoundingClientRect();
    const clipped = Array.from(grid.querySelectorAll(".j0n4t-pg-item")).filter(
      (el) => {
        const r = el.getBoundingClientRect();
        const overlaps = r.bottom > view.top && r.top < view.bottom;
        const contained = r.top >= view.top - 1 && r.bottom <= view.bottom + 1;
        return overlaps && !contained;
      }
    ).length;
    return {
      toast: document.querySelector('[data-testid="toast"]') !== null,
      clipped,
    };
  });
  console.log(`clean:    toast=${clean.toast} clippedRows=${clean.clipped}`);
  if (clean.toast) throw new Error("a toast is still on screen");
  if (clean.clipped > 0) {
    throw new Error("a grid row is cut at the node's bottom edge");
  }

  await page.screenshot({ path: OUT, clip: rect });
  console.log(`wrote:    ${OUT} (${Math.round(rect.width * SCALE)}x${Math.round(rect.height * SCALE)} px)`);
}

main().catch((error) => {
  console.error(`\n!! ${error.message}`);
  process.exitCode = 1;
});
