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

// A laptop-ish viewport: the README renders this image at roughly 800px wide,
// so a narrower canvas keeps more rows of the grid on screen instead of
// spending the height on empty canvas around the nodes.
const VIEWPORT = { width: 1280, height: 720 };
// 2x, so the text in the README is crisp rather than upscaled.
const SCALE = 2;
// How much of the canvas the nodes should fill after fitting.
const FIT_ZOOM = 0.85;
// The gallery starts in the large view, which fills a README shot with empty
// canvas. The small view packs the same presets into a fraction of the node
// height, and a smaller node means less canvas is needed to frame it.
const SHOT_VIEW = "small";
// Margin kept around the nodes when fitting the view. The whole point of a
// smaller shot is that the nodes fill the canvas, so this stays tight - it is
// still enough to keep a node title or the zoom widget off the edge.
const FIT_PADDING = 16;

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

  // Compose the gallery's own state before anything is measured. The panels
  // below the control bar are draggable and the view is a stored preference, so
  // the node height this shot ends up with would otherwise depend on the
  // previous session.
  await page.evaluate(({ view }) => {
    const wrap = document.querySelector(".j0n4t-pg-wrap");

    // The basket's height is a user preference when "remember panel sizes" is
    // on, so drop any inline height the last session left and let the stylesheet
    // decide. Its `min-height` beats an inline `height`, so capping it that way
    // silently does nothing.
    const basket = wrap.querySelector(".j0n4t-pg-basket-container");
    if (basket) {
      basket.style.height = "";
      basket.style.minHeight = "";
    }

    // The management panel is what makes the shot informative, and it starts
    // collapsed. Open it, then size it to its own content: a fixed height
    // either clips the preview row or leaves the content overflowing into the
    // grid, because the editor's `overflow` is `visible` and the grid paints
    // over whatever spills.
    const editor = wrap.querySelector(".j0n4t-pg-editor");
    if (editor) {
      if (editor.classList.contains("collapsed")) {
        wrap.querySelector("#j0n4t-pg-toggle")?.click();
      }
      // A remembered editor size stretches the keyword box, so clear it before
      // measuring - otherwise the editor grows past what the shot has room for.
      const keywords = wrap.querySelector("#j0n4t-pg-preset");
      if (keywords) keywords.style.height = "";
      editor.style.height = "auto";
      editor.style.height = `${editor.offsetHeight}px`;
    }

    // Small view: the same library in a fraction of the node height. Done last
    // so it is the grid's own layout that is measured, not the default one.
    wrap.querySelector(`.j0n4t-pg-view-btn[data-view="${view}"]`)?.click();
  }, { view: SHOT_VIEW });

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
  // The selection changes the grid's own content (the last clicked item is the
  // one the detail card shows), so the layout has to settle before the node is
  // sized to it.
  await delay(800);

  // The grid scrolls inside the node, so the row straddling the node's bottom
  // edge is cut in half. End the node on a row boundary instead.
  //
  // A row boundary is not a child's own bottom: the items of one row are
  // siblings that share a top and a bottom, so the rows have to be grouped by
  // top first. And the node's height and the grid's height are in different
  // units - graph units against CSS px, with the canvas scale between them - so
  // the relation is measured with a probe step rather than derived from the
  // node chrome.
  const readGridState = () =>
    page.evaluate(() => {
      const wrap = document.querySelector(".j0n4t-pg-wrap");
      const grid = wrap.querySelector(".j0n4t-pg-grid");
      const node = window.app.graph._nodes.find(
        (n) => n.type === "PresetGalleryNode"
      );
      const top = grid.getBoundingClientRect().top;
      const rows = new Map();
      for (const child of grid.children) {
        const rect = child.getBoundingClientRect();
        const rowTop = Math.round(rect.top - top);
        const rowBottom = Math.round(rect.bottom - top);
        rows.set(rowTop, Math.max(rows.get(rowTop) ?? 0, rowBottom));
      }
      return {
        nodeH: node.size[1],
        gridH: grid.getBoundingClientRect().height,
        scrolls: grid.scrollHeight > grid.clientHeight + 1,
        boundaries: [...rows.values()].sort((a, b) => a - b),
      };
    });

  const setNodeHeight = (height) =>
    page.evaluate((h) => {
      const node = window.app.graph._nodes.find(
        (n) => n.type === "PresetGalleryNode"
      );
      node.size[1] = Math.max(120, Math.round(h));
      node.setSize([node.size[0], node.size[1]]);
    }, height);

  // The last boundary the grid already shows is where shrinking to drops the
  // cut row; the first one past it is where growing to completes that row.
  // Shrinking is preferred - a smaller node is the point of this shot, and the
  // grid still scrolls, so the shot does not claim the library fits.
  const state = await readGridState();
  const lastShown = [...state.boundaries]
    .reverse()
    .find((b) => b <= state.gridH + 0.5);
  const next = state.boundaries.find((b) => b > state.gridH + 0.5);
  const target = state.scrolls && lastShown ? lastShown : next;
  if (!target) throw new Error("the grid has no row boundary to size to");

  await setNodeHeight(state.nodeH + 50);
  await delay(400);
  const stepped = await readGridState();
  const slope = (stepped.gridH - state.gridH) / 50;
  if (!Number.isFinite(slope) || slope <= 0) {
    throw new Error(`the grid does not track the node height (slope ${slope})`);
  }
  await setNodeHeight(stepped.nodeH + (target - stepped.gridH) / slope);
  // `setSize` re-lays the node out asynchronously, so give it a frame before
  // reading the grid's row geometry back.
  await delay(600);

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

  // Fit the whole canvas: nothing selected, so the fit covers every node. The
  // nodes are centred in the viewport, so a padding equal on all sides is what
  // keeps the whole graph inside the crop - `FIT_ZOOM` alone scales a viewport
  // that is far larger than the graph and leaves the nodes small in the middle.
  await page.evaluate(({ zoom, padding }) => {
    const canvas = window.app.canvas;
    canvas.selectedItems?.clear();
    const [width, height] = canvas.ds.getViewportSize();
    canvas.fitViewToSelectionAnimated({
      viewport: [0, 0, width, height],
      zoom,
      padding,
    });
  }, { zoom: FIT_ZOOM, padding: FIT_PADDING });
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
