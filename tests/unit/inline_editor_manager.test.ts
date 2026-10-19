import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import InlineEditorManager from "../../web/InlineEditorManager.js";
import type PresetBasket from "../../web/PresetBasket.js";

// InlineEditorManager turns a basket chip (or the add button) into a text
// input and applies the edit to the selection on finish. The context and the
// basket delegate are fakes that record calls; the AutocompleteManager it
// spawns internally is the real one.

const CACHE: PresetCache = {
  "Faces/Portrait": { preset: "pro" },
  "Faces/Macro": { preset: "macro" },
  "Scenery/Hills": { preset: "hills" },
};

function makeEnv(initialSelection: string[]) {
  let widgetValue = initialSelection.join(", ");
  const calls = { updateWidgetValue: [] as string[][], focusChip: [] as (number | undefined)[] };

  const basketEl = document.createElement("div");
  basketEl.className = "j0n4t-pg-basket";
  const addBtn = document.createElement("button");
  addBtn.className = "j0n4t-pg-basket-add-btn";
  basketEl.appendChild(addBtn);
  document.body.appendChild(basketEl);

  const context = {
    cache: CACHE,
    getSelectedArray: () => widgetValue.split(",").map((s) => s.trim()).filter(Boolean),
    updateWidgetValue: (arr: string[]) => {
      calls.updateWidgetValue.push(arr);
      widgetValue = arr.join(", ");
    },
  };
  const delegate = {
    basket: basketEl,
    focusChip: (idx?: number) => { calls.focusChip.push(idx); },
  };
  return {
    context: context as unknown as GalleryContext,
    delegate: delegate as unknown as PresetBasket,
    calls,
    basketEl,
    widgetValue: () => widgetValue,
  };
}

function spawnInput(env: ReturnType<typeof makeEnv>): HTMLInputElement {
  const editor = new InlineEditorManager(env.context, env.delegate);
  editor.spawn(null, "");
  const input = env.basketEl.querySelector<HTMLInputElement>(".j0n4t-pg-inline-edit");
  assert.ok(input, "spawn creates an inline edit input");
  return input;
}

test("spawn for a new chip inserts an editable chip before the add button and focuses it", () => {
  const env = makeEnv(["Faces/Portrait"]);
  const editor = new InlineEditorManager(env.context, env.delegate);
  editor.spawn(null, "");

  const chip = env.basketEl.querySelector(".j0n4t-pg-basket-chip.inline-editing");
  assert.ok(chip, "an editable chip was inserted");
  assert.equal(env.basketEl.querySelector(".j0n4t-pg-basket-add-btn")?.previousElementSibling, chip);
  assert.equal(document.activeElement, chip.querySelector("input"), "the input is focused");
});

test("spawn escapes the initial value in the HTML source", () => {
  const env = makeEnv([]);
  const editor = new InlineEditorManager(env.context, env.delegate);
  editor.spawn(null, "<b>");

  // escapeHTML of the attribute is covered in preset_dom.test.ts; here the
  // parsed value must be the plain text again, which is what editing needs
  assert.equal(env.basketEl.querySelector<HTMLInputElement>(".j0n4t-pg-inline-edit")?.value, "<b>");
});

test("completing a {group:preset} selection saves the new value and refocuses the basket", () => {
  const env = makeEnv(["Faces/Portrait"]);
  const editor = new InlineEditorManager(env.context, env.delegate);
  editor.spawn(null, "");

  const chip = env.basketEl.querySelector(".j0n4t-pg-basket-chip")!;
  const input = chip.querySelector<HTMLInputElement>("input")!;

  // group completion: typing inside braces offers the cache folders
  input.value = "{Fac";
  input.dispatchEvent(new Event("input"));
  const groupRow = document.querySelector(".j0n4t-pg-autocomplete-item");
  assert.ok(groupRow, "group suggestions open inside braces");
  assert.ok(groupRow.textContent?.includes("Faces"));

  groupRow.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  assert.equal(input.value, "{Faces:", "the group is inserted and the popup stays open");

  // preset completion: the closing brace is added by onSelect itself, so the
  // query is typed while the brace is still open
  input.value = "{Faces:Portrait";
  input.dispatchEvent(new Event("input"));
  const presetRow = Array.from(document.querySelectorAll(".j0n4t-pg-autocomplete-item")).find(
    (row) => row.textContent?.includes("Portrait")
  );
  assert.ok(presetRow, "preset suggestions open after the group");
  presetRow!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

  // onSelect embeds the full cache key into the value
  assert.equal(input.value, "{Faces:Faces/Portrait}");
  assert.equal(env.basketEl.querySelector(".j0n4t-pg-basket-chip"), null, "the chip is removed on save");
  assert.equal(env.widgetValue(), "Faces/Portrait, {Faces:Faces/Portrait}");
  assert.deepEqual(env.calls.updateWidgetValue.at(-1), ["Faces/Portrait", "{Faces:Faces/Portrait}"]);
  assert.deepEqual(env.calls.focusChip, [1], "focus moves to the appended chip");
});

test("Enter without a popup open saves the typed value", () => {
  const env = makeEnv(["Faces/Portrait"]);
  const input = spawnInput(env);

  input.value = "plain";
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

  assert.equal(env.widgetValue(), "Faces/Portrait, plain");
  assert.deepEqual(env.calls.updateWidgetValue.at(-1), ["Faces/Portrait", "plain"]);
  assert.deepEqual(env.calls.focusChip, [1]);
});

test("Escape discards the edit without touching the selection", () => {
  const env = makeEnv(["Faces/Portrait"]);
  const input = spawnInput(env);

  input.value = "abc";
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

  assert.equal(env.widgetValue(), "Faces/Portrait");
  assert.equal(env.calls.updateWidgetValue.length, 0);
  assert.equal(env.basketEl.querySelector(".j0n4t-pg-basket-chip"), null, "the chip is removed on cancel");
});

test("editing an existing chip replaces the selection entry", () => {
  const env = makeEnv(["Faces/Portrait"]);
  const chip = document.createElement("div");
  chip.className = "j0n4t-pg-basket-chip";
  chip.dataset.id = "Faces/Portrait";
  const label = document.createElement("span");
  label.className = "j0n4t-pg-basket-chip-label";
  chip.appendChild(label);
  env.basketEl.appendChild(chip);

  const editor = new InlineEditorManager(env.context, env.delegate);
  editor.spawn(chip, "Faces/Portrait", 0, 1);

  assert.ok(chip.classList.contains("inline-editing"), "the chip enters edit mode");
  assert.equal(label.style.display, "none", "the label is hidden while editing");

  const input = chip.querySelector<HTMLInputElement>("input")!;
  input.value = "Faces/Macro";
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

  assert.equal(env.widgetValue(), "Faces/Macro");
  assert.ok(!chip.classList.contains("inline-editing"), "edit mode is removed on finish");
  assert.equal(label.style.display, "", "the label is restored");
});

test("a comma separated replacement expands through splitPresets", () => {
  const env = makeEnv(["Faces/Portrait"]);
  const chip = document.createElement("div");
  chip.className = "j0n4t-pg-basket-chip";
  chip.dataset.id = "Faces/Portrait";
  env.basketEl.appendChild(chip);

  const editor = new InlineEditorManager(env.context, env.delegate);
  editor.spawn(chip, "Faces/Portrait", 0, 1);

  const input = chip.querySelector<HTMLInputElement>("input")!;
  input.value = "a, b";
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

  assert.equal(env.widgetValue(), "a, b");
  assert.deepEqual(env.calls.updateWidgetValue.at(-1), ["a", "b"], "the comma separates into two entries");
});

test("clearing the value without chip indices deletes the selection entry", () => {
  const env = makeEnv(["Faces/Portrait", "Scenery/Hills"]);
  const chip = document.createElement("div");
  chip.className = "j0n4t-pg-basket-chip";
  chip.dataset.id = "Scenery/Hills";
  env.basketEl.appendChild(chip);

  const editor = new InlineEditorManager(env.context, env.delegate);
  editor.spawn(chip, "Scenery/Hills");

  const input = chip.querySelector<HTMLInputElement>("input")!;
  input.value = "";
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

  assert.equal(env.widgetValue(), "Faces/Portrait");
});
