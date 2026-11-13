import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import ExportUtils from "../../web/ExportUtils.js";

// Perf guard for the picker's bulk checkboxes.
//
// The picker's "Select / Deselect All Libraries" and each library's own
// checkbox used to set every preset checkbox and fire a `change` event for
// each one. Every event re-ran the tree's group scan, which queried each
// group's items - O(items x groups) per event - so one click in a large
// library blocked the page. Measured in a browser with 2008 presets across
// three libraries: tens of seconds before, 10 ms after. In jsdom the same
// click reads 1.0 s against 0.09 s at 1000 presets.
//
// The budget is a multiple of a calibration pass rather than an absolute
// time, for the reason preset_logic.perf.test.ts gives: `node --test` runs
// every file at once and the machine's other load is not ours to control.
// The calibration is the slowest of several runs, because a single run of a
// sub-millisecond loop is mostly timer noise. What the ratio catches is the
// quadratic shape coming back - a per-preset event, or a per-group query
// inside a per-item loop.

const FOLDERS = 100;
const PER_FOLDER = 10;
const CALIBRATION_RUNS = 5;
const RATIO_BUDGET = 400;
const ONE_CLICK_BUDGET = 100;

function bigLibrary(): PresetCache {
  const presets: PresetCache = {};
  for (let f = 0; f < FOLDERS; f++) {
    for (let i = 0; i < PER_FOLDER; i++) {
      presets[`Folder${f}/Preset${i}`] = { preset: `preset ${f} ${i}` };
    }
  }
  return presets;
}

test("checking a whole library is one bulk pass, not one event per preset", () => {
  const picker = ExportUtils.buildLibraryPicker({
    rows: [{ sourceId: "big", name: "big", presets: bigLibrary() }],
    served: [{ id: "big", name: "Big" }],
    mode: "export",
  });
  document.body.appendChild(picker.element);

  const boxes = Array.from(
    picker.element.querySelectorAll<HTMLInputElement>(".j0n4t-pg-item-cb"),
  );
  assert.equal(boxes.length, FOLDERS * PER_FOLDER);

  const master = picker.element.querySelector<HTMLInputElement>(
    "#j0n4t-pg-picker-sel-all",
  );
  assert.ok(master);
  // The master starts checked, so clear it first: the measured click is the
  // "check everything" one, and the assertion below can be about the result.
  if (master.checked) master.click();
  assert.ok(boxes.every((b) => !b.checked), "the master cleared every preset");

  // Calibration: one plain pass over the same checkboxes, no events fired.
  let calibrationMs = 0;
  for (let i = 0; i < CALIBRATION_RUNS; i++) {
    const start = performance.now();
    boxes.forEach((b) => {
      b.checked = false;
    });
    calibrationMs = Math.max(calibrationMs, performance.now() - start);
  }

  const start = performance.now();
  master.click();
  const bulkMs = performance.now() - start;

  assert.ok(
    bulkMs <= calibrationMs * RATIO_BUDGET,
    `bulk check took ${bulkMs.toFixed(1)}ms against a ` +
      `${calibrationMs.toFixed(1)}ms calibration (budget ${RATIO_BUDGET}x)`,
  );
  assert.ok(boxes.every((b) => b.checked), "every preset is checked");

  // One preset click re-runs the group scan. Querying each group's items for
  // every scan is O(items x groups) for a single click, which reads ~200 ms
  // here against ~35 ms for one pass.
  const oneStart = performance.now();
  boxes[0].click();
  const oneMs = performance.now() - oneStart;
  assert.ok(
    oneMs <= calibrationMs * ONE_CLICK_BUDGET,
    `one preset click took ${oneMs.toFixed(1)}ms against a ` +
      `${calibrationMs.toFixed(2)}ms calibration (budget ${ONE_CLICK_BUDGET}x)`,
  );

  picker.element.remove();
});
