import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import BasketDragDrop from "../../web/BasketDragDrop.js";

// The parts of the drop handling that are pure: which file a drop carries, what
// the image-metadata preview looks like, and what a chosen prompt adds. The drop
// indicator geometry needs real layout, so it stays with the e2e drag tests.

const CACHE: PresetCache = {
  "faces/portrait": { preset: "portrait, solo" },
  "scenery/hills": { preset: "hills" },
};

function makeEnv({ selection = [] as string[] } = {}) {
  const pool = document.createElement("div");
  pool.className = "j0n4t-pg-basket-pool";
  const container = document.createElement("div");
  container.appendChild(pool);
  document.body.appendChild(container);

  let widgetValue = selection.join(", ");
  const calls = { updateWidgetValue: [] as string[][] };
  const context = {
    cache: CACHE,
    getSelectedArray: () => widgetValue.split(",").map((s) => s.trim()).filter(Boolean),
    updateWidgetValue: (arr: string[]) => {
      calls.updateWidgetValue.push(arr);
      widgetValue = arr.join(", ");
    },
  };
  const basket = { basket: pool, container, selection: { selected: new Set<number>(), anchor: null, apply: () => {} } };

  const dragDrop = new BasketDragDrop(
    context as unknown as GalleryContext,
    basket as unknown as import("../../web/PresetBasket.js").default
  );
  return { dragDrop, pool, container, calls, widgetValue: () => widgetValue };
}

const dropEvent = (files: File[]) => {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files, types: ["Files"], getData: () => "" } });
  return event;
};

// --- dropped files ---

test("getImageFileFromDrop returns the first image among the files", () => {
  const env = makeEnv();
  const text = new File(["x"], "notes.txt", { type: "text/plain" });
  const png = new File(["x"], "shot.png", { type: "image/png" });

  assert.equal(env.dragDrop.getImageFileFromDrop(dropEvent([text, png]) as unknown as DragEvent), png);
});

test("getImageFileFromDrop ignores non-images and empty drops", () => {
  const env = makeEnv();
  const text = new File(["x"], "notes.txt", { type: "text/plain" });

  assert.equal(env.dragDrop.getImageFileFromDrop(dropEvent([text]) as unknown as DragEvent), null);
  assert.equal(env.dragDrop.getImageFileFromDrop(dropEvent([]) as unknown as DragEvent), null);
});

// --- image metadata preview ---

test("renderChipPreview draws one chip per selection, using the preset label", () => {
  const env = makeEnv();

  const html = env.dragDrop.renderChipPreview("faces/portrait, misty dawn");

  assert.match(html, /j0n4t-pg-basket-chip/);
  assert.match(html, /Portrait/, "a known preset shows its name");
  assert.match(html, /misty dawn/, "unknown text is kept as typed");
});

test("renderChipPreview says so when there is nothing to show", () => {
  const env = makeEnv();

  assert.match(env.dragDrop.renderChipPreview(""), /\(empty\)/);
});

// --- adding a chosen prompt ---

test("addPromptAsChips appends the resolved keys and writes the selection", () => {
  const env = makeEnv({ selection: ["scenery/hills"] });

  env.dragDrop.addPromptAsChips("faces/portrait, misty dawn");

  assert.deepEqual(env.calls.updateWidgetValue.at(-1), ["scenery/hills", "faces/portrait", "misty dawn"]);
  assert.equal(env.widgetValue(), "scenery/hills, faces/portrait, misty dawn");
});

test("addPromptAsChips does nothing for text that yields no tokens", () => {
  const env = makeEnv();

  env.dragDrop.addPromptAsChips("   ");

  assert.equal(env.calls.updateWidgetValue.length, 0);
});

// --- raw mode ---

test("a drop is ignored in raw mode, where the textarea owns the input", () => {
  const env = makeEnv();
  env.dragDrop.init();
  env.container.classList.add("raw-mode");
  let handled = false;
  env.dragDrop.handleImageDrop = async () => { handled = true; };
  const png = new File(["x"], "shot.png", { type: "image/png" });

  env.pool.dispatchEvent(dropEvent([png]));

  assert.equal(handled, false);
  assert.equal(env.calls.updateWidgetValue.length, 0);
});
