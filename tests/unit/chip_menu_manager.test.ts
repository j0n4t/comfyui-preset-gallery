import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import ChipMenuManager from "../../web/ChipMenuManager.js";
import type PresetBasket from "../../web/PresetBasket.js";

// ChipMenuManager builds the right-click popup on a basket chip: pin, weight,
// edit, swap, locate/create, del, per-variant rows and re-roll. The basket
// delegate and the gallery context are fakes that record calls; the popup
// itself is real DOM.

const CACHE: PresetCache = {
  "Faces/Portrait": { preset: "{Scenery:hills} look" },
  "Scenery/Hills": { preset: "hills" },
  "Scenery/Sky": { preset: "sky" },
};

function makeBasketDelegate(basketEl: HTMLElement) {
  const calls = {
    updateChipSelection: 0,
    saveCurrentState: 0,
    focusChip: [] as (string | undefined)[],
    reRollChipGroup: [] as unknown[],
    locatePreset: [] as string[],
    spawn: [] as unknown[],
  };
  const delegate = {
    basket: basketEl,
    updateChipSelection: () => {
      calls.updateChipSelection++;
      return true;
    },
    saveCurrentState: () => {
      calls.saveCurrentState++;
    },
    focusChip: (start?: string) => {
      calls.focusChip.push(start);
    },
    reRollChipGroup: (index: number, group: string, gIndex: number) => {
      calls.reRollChipGroup.push([index, group, gIndex]);
    },
    locatePreset: (key: string) => {
      calls.locatePreset.push(key);
    },
    inlineEditorManager: {
      spawn: (chip: HTMLElement, val: string, start?: number, end?: number) => {
        calls.spawn.push([chip, val, start, end]);
      },
    },
  };
  return { delegate: delegate as unknown as PresetBasket, calls };
}

function makeContext(selection: string[]) {
  let widgetValue = selection.join(", ");
  const pinned = new Set<string>();
  const calls = {
    updateWidgetValue: [] as string[][],
    savePins: 0,
    openEditorForPreset: [] as unknown[],
    setPanelCollapseState: [] as boolean[],
    clearFields: 0,
    updateHighlights: 0,
  };

  const inpPreset = document.createElement("input");
  const inpName = document.createElement("input");
  const basketPool = document.createElement("div");

  const context = {
    cache: CACHE,
    pinnedChips: pinned,
    dom: { basketPool },
    getSelectedArray: () =>
      widgetValue
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    updateWidgetValue: (arr: string[]) => {
      calls.updateWidgetValue.push(arr);
      widgetValue = arr.join(", ");
    },
    savePins: () => {
      calls.savePins++;
    },
    openEditorForPreset: (key: string, focus?: boolean) => {
      calls.openEditorForPreset.push([key, focus]);
    },
    setPanelCollapseState: (collapsed: boolean) => {
      calls.setPanelCollapseState.push(collapsed);
    },
    editor: {
      clearFields: () => {
        calls.clearFields++;
      },
      dom: { inpPreset, inpName },
      rawPresetManager: {
        updateHighlights: () => {
          calls.updateHighlights++;
        },
      },
    },
    rollManager: { rolls: {} },
    transferPin: (oldVal: string, newVal: string) => {
      if (pinned.has(oldVal)) {
        pinned.delete(oldVal);
        pinned.add(newVal);
      }
    },
  };
  return {
    context: context as unknown as GalleryContext,
    calls,
    pinned,
    widgetValue: () => widgetValue,
    inpPreset,
    inpName,
  };
}

function makeChip(
  basketEl: HTMLElement,
  opts: {
    id: string;
    index?: string;
    start?: string;
    end?: string;
    preset?: string;
  },
): HTMLDivElement {
  const chip = document.createElement("div");
  chip.className = "j0n4t-pg-basket-chip";
  chip.dataset.id = opts.id;
  if (opts.index !== undefined) chip.dataset.index = opts.index;
  if (opts.start !== undefined) chip.dataset.start = opts.start;
  if (opts.end !== undefined) chip.dataset.end = opts.end;
  if (opts.preset !== undefined) chip.dataset.preset = opts.preset;
  const label = document.createElement("span");
  label.className = "j0n4t-pg-basket-chip-label";
  chip.appendChild(label);
  basketEl.appendChild(chip);
  return chip;
}

function makeManager(selection: string[]) {
  const basketEl = document.createElement("div");
  basketEl.className = "j0n4t-pg-basket";
  document.body.appendChild(basketEl);
  const { delegate, calls } = makeBasketDelegate(basketEl);
  const env = makeContext(selection);
  const manager = new ChipMenuManager(env.context, delegate);
  return { manager, basketEl, basketCalls: calls, env };
}

function popup(manager: ChipMenuManager): HTMLElement | null {
  return manager.popupEl;
}

function action(manager: ChipMenuManager, name: string): HTMLElement | null {
  return manager.popupEl?.querySelector(`[data-action="${name}"]`) ?? null;
}

// --- show / toggle ---

test("show builds a popup and marks the chip active; toggle on the same chip closes it", () => {
  const { manager, basketEl, basketCalls } = makeManager(["Faces/Portrait"]);
  const chip = makeChip(basketEl, {
    id: "Faces/Portrait",
    index: "0",
    start: "0",
    end: "1",
  });

  manager.show(chip);

  assert.ok(popup(manager), "popup is mounted");
  assert.ok(
    chip.classList.contains("active-menu"),
    "the chip carries active-menu",
  );
  assert.ok(
    popup(manager)?.querySelector(".j0n4t-pg-chip-popup-actions"),
    "actions bar renders",
  );

  manager.toggle(chip);
  assert.equal(manager.popupEl, null, "toggling the same chip closes");
  assert.ok(!chip.classList.contains("active-menu"));
  assert.deepEqual(
    basketCalls.focusChip,
    ["0"],
    "close restores focus to the chip",
  );

  manager.show(chip);
  assert.ok(popup(manager), "showing again reopens");
});

test("showing a different chip moves active-menu and replaces the popup", () => {
  const { manager, basketEl } = makeManager([
    "Faces/Portrait",
    "Scenery/Hills",
  ]);
  const first = makeChip(basketEl, {
    id: "Faces/Portrait",
    index: "0",
    start: "0",
    end: "1",
  });
  const second = makeChip(basketEl, {
    id: "Scenery/Hills",
    index: "1",
    start: "1",
    end: "2",
  });

  manager.show(first);
  manager.show(second);

  assert.ok(!first.classList.contains("active-menu"));
  assert.ok(second.classList.contains("active-menu"));
  assert.equal(manager.activeChipMenuEl, second);
});

// --- pin / unpin ---

test("pin adds the raw selection to pinnedChips and marks the action", () => {
  const { manager, basketEl, env } = makeManager(["Faces/Portrait"]);
  const chip = makeChip(basketEl, {
    id: "Faces/Portrait",
    index: "0",
    start: "0",
    end: "1",
  });
  manager.show(chip);

  const pinBtn = action(manager, "pin")!;
  pinBtn.click();

  assert.ok(env.pinned.has("Faces/Portrait"), "the raw selection is pinned");
  assert.ok(chip.classList.contains("pinned"));
  assert.ok(pinBtn.classList.contains("active-pin"));
  assert.equal(pinBtn.title, "Unpin");
  assert.equal(
    pinBtn.querySelector("svg")?.getAttribute("fill"),
    "currentColor",
  );
  assert.equal(env.calls.savePins, 1);
});

test("pinning again unpins and restores the action", () => {
  const { manager, basketEl, env } = makeManager(["Faces/Portrait"]);
  const chip = makeChip(basketEl, {
    id: "Faces/Portrait",
    index: "0",
    start: "0",
    end: "1",
  });
  manager.show(chip);
  const pinBtn = action(manager, "pin")!;

  pinBtn.click();
  manager.show(chip);
  action(manager, "pin")!.click();

  assert.ok(!env.pinned.has("Faces/Portrait"));
  assert.ok(!chip.classList.contains("pinned"));
  assert.equal(action(manager, "pin")?.title, "Pin");
  assert.equal(
    action(manager, "pin")?.querySelector("svg")?.getAttribute("fill"),
    "none",
  );
});

test("disable moves a chip's pin to its tilde-wrapped key", () => {
  const { manager, basketEl, env } = makeManager([
    "faces/portrait",
    "scenery/hills",
  ]);
  const chip = makeChip(basketEl, {
    id: "faces/portrait",
    index: "0",
    start: "0",
    end: "1",
  });
  manager.show(chip);

  action(manager, "pin")!.click();
  assert.ok(
    env.pinned.has("faces/portrait"),
    "the chip is pinned before disable",
  );

  action(manager, "disable")!.click();

  assert.ok(
    env.pinned.has("~faces/portrait~"),
    "the pin follows the disabled key",
  );
  assert.ok(!env.pinned.has("faces/portrait"), "the old key is unpinned");
  assert.deepEqual(env.calls.updateWidgetValue.at(-1), [
    "~faces/portrait~",
    "scenery/hills",
  ]);
});

test("enable moves a chip's pin back to its plain key", () => {
  const { manager, basketEl, env } = makeManager([
    "~faces/portrait~",
    "scenery/hills",
  ]);
  const chip = makeChip(basketEl, {
    id: "~faces/portrait~",
    index: "0",
    start: "0",
    end: "1",
  });
  manager.show(chip);

  action(manager, "pin")!.click();
  assert.ok(env.pinned.has("~faces/portrait~"), "the disabled chip is pinned");

  action(manager, "disable")!.click();

  assert.ok(
    env.pinned.has("faces/portrait"),
    "the pin returns to the plain key",
  );
  assert.ok(!env.pinned.has("~faces/portrait~"), "the wrapped key is unpinned");
  assert.deepEqual(env.calls.updateWidgetValue.at(-1), [
    "faces/portrait",
    "scenery/hills",
  ]);
});

// --- del / edit / swap / locate / create ---

test("del splices the chip range out of the selection", () => {
  const { manager, basketEl, env } = makeManager([
    "Faces/Portrait",
    "Scenery/Hills",
  ]);
  const chip = makeChip(basketEl, {
    id: "Scenery/Hills",
    index: "1",
    start: "1",
    end: "2",
  });
  manager.show(chip);

  action(manager, "del")!.click();

  assert.equal(env.widgetValue(), "Faces/Portrait");
  assert.deepEqual(env.calls.updateWidgetValue.at(-1), ["Faces/Portrait"]);
});

test("edit with a cached item opens the editor for it", () => {
  const { manager, basketEl, env } = makeManager(["Faces/Portrait"]);
  const chip = makeChip(basketEl, {
    id: "Faces/Portrait",
    index: "0",
    start: "0",
    end: "1",
  });
  manager.show(chip);

  action(manager, "edit")!.click();

  assert.deepEqual(env.calls.openEditorForPreset, [["Faces/Portrait", true]]);
  assert.equal(manager.popupEl, null, "the popup closes on edit");
});

test("edit without a cached item spawns the inline editor with the chip text", () => {
  const { manager, basketEl, basketCalls } = makeManager(["<lora:xyz:0.5>"]);
  const chip = makeChip(basketEl, {
    id: "<lora:xyz:0.5>",
    index: "0",
    start: "0",
    end: "1",
    preset: "raw preset",
  });
  manager.show(chip);

  action(manager, "edit")!.click();

  const spawned = basketCalls.spawn[0] as [HTMLElement, string, number, number];
  assert.equal(spawned[0], chip);
  assert.equal(
    spawned[1],
    "raw preset",
    "dataset.preset seeds the editor when present",
  );
  assert.deepEqual(spawned.slice(2), [0, 1]);
});

test("swap without a cached item spawns the inline editor with the preset text, weight preserved", () => {
  const { manager, basketEl, basketCalls } = makeManager(["Faces/Portrait"]);
  const chip = makeChip(basketEl, {
    id: "(Faces/Portrait:1.5)",
    index: "0",
    start: "0",
    end: "1",
    preset: "some preset",
  });
  manager.show(chip);

  action(manager, "swap")!.click();

  const spawned = basketCalls.spawn[0] as [HTMLElement, string, number, number];
  assert.equal(
    spawned[1],
    "({Scenery:hills} look:1.5)",
    "swap uses the cache preset, weight preserved",
  );
});

test("swap on a non-weighted chip spawns without a weight", () => {
  const { manager, basketEl, basketCalls } = makeManager(["Faces/Portrait"]);
  const chip = makeChip(basketEl, {
    id: "Faces/Portrait",
    index: "0",
    start: "0",
    end: "1",
    preset: "some preset",
  });
  manager.show(chip);

  action(manager, "swap")!.click();

  assert.equal(
    (basketCalls.spawn[0] as [HTMLElement, string])[1],
    "{Scenery:hills} look",
  );
});

test("locate resolves dataset.preset to its cache key", () => {
  const { manager, basketEl, basketCalls } = makeManager(["Faces/Portrait"]);
  const chip = makeChip(basketEl, {
    id: "Faces/Portrait",
    index: "0",
    start: "0",
    end: "1",
    preset: "{Scenery:hills} look",
  });
  manager.show(chip);

  action(manager, "locate")!.click();

  assert.deepEqual(basketCalls.locatePreset, ["Faces/Portrait"]);
});

test("create (no cache item) fills the editor fields from the chip text", () => {
  const { manager, basketEl, env } = makeManager(["<lora:xyz:0.5>"]);
  const chip = makeChip(basketEl, {
    id: "<lora:xyz:0.5>",
    index: "0",
    start: "0",
    end: "1",
  });
  manager.show(chip);

  action(manager, "create")!.click();

  assert.deepEqual(env.calls.setPanelCollapseState, [false]);
  assert.equal(env.calls.clearFields, 1);
  assert.equal(env.calls.updateHighlights, 1);
  assert.equal(
    env.inpPreset.value,
    "<lora:xyz:0.5>",
    "the preset field is seeded",
  );
  assert.equal(env.inpName.value, "xyz", "the name is derived from the key");
});

// --- variant rows ---

test("a chip whose preset embeds {group:val} renders variant rows", () => {
  const { manager, basketEl } = makeManager(["Faces/Portrait"]);
  const chip = makeChip(basketEl, {
    id: "Faces/Portrait",
    index: "0",
    start: "0",
    end: "1",
    preset: "{Scenery:hills} look",
  });
  manager.show(chip);

  const input = manager.popupEl?.querySelector<HTMLInputElement>(
    ".j0n4t-pg-var-input",
  );
  assert.ok(input, "a variant row is rendered");
  assert.equal(input.dataset.group, "Scenery");
  assert.equal(
    input.value,
    "Hills",
    "the current variant is the display value",
  );
});

test("changing a variant input replaces the variant inside the unrolled preset", () => {
  const { manager, basketEl, basketCalls } = makeManager(["Faces/Portrait"]);
  const chip = makeChip(basketEl, {
    id: "Faces/Portrait",
    index: "0",
    start: "0",
    end: "1",
    preset: "{Scenery:hills} look",
  });
  manager.show(chip);

  // the input holds display values, not cache keys
  const input = manager.popupEl!.querySelector<HTMLInputElement>(
    ".j0n4t-pg-var-input",
  )!;
  input.value = "Sky";
  input.dispatchEvent(new Event("change", { bubbles: true }));

  assert.equal(
    chip.dataset.id,
    "{Scenery:Scenery/Sky} look",
    "the variant embeds the resolved key",
  );
  assert.equal(chip.dataset.preset, "{Scenery:Scenery/Sky} look");
  assert.equal(basketCalls.updateChipSelection, 1);
  assert.ok(
    chip.classList.contains("active-menu"),
    "the chip menu re-arms on the replaced chip",
  );
  assert.ok(manager.popupEl, "a non-core replacement keeps the popup open");
});

test("the reroll button delegates to the basket and closes the popup", () => {
  const { manager, basketEl, basketCalls } = makeManager(["Faces/Portrait"]);
  const chip = makeChip(basketEl, {
    id: "Faces/Portrait",
    index: "0",
    start: "0",
    end: "1",
    preset: "{Scenery:hills} look",
  });
  manager.show(chip);

  const reroll = manager.popupEl!.querySelector<HTMLButtonElement>(
    ".j0n4t-pg-var-reroll-btn",
  )!;
  reroll.click();

  assert.deepEqual(
    basketCalls.reRollChipGroup,
    [[0, "Scenery", "0"]],
    "gindex stays a string, as in the DOM",
  );
  assert.equal(manager.popupEl, null);
});

// --- weight ---

test("weight buttons adjust the value and rewrite the dataset id", () => {
  const { manager, basketEl, basketCalls } = makeManager([
    "(Faces/Portrait:1.5)",
  ]);
  const chip = makeChip(basketEl, {
    id: "(Faces/Portrait:1.5)",
    index: "0",
    start: "0",
    end: "1",
    preset: "pro",
  });
  manager.show(chip);

  const weightInput = manager.popupEl!.querySelector<HTMLInputElement>(
    ".j0n4t-pg-weight-input",
  )!;
  assert.equal(weightInput.value, "1.5", "the weight input is seeded");

  manager
    .popupEl!.querySelector<HTMLButtonElement>('[data-action="weight-plus"]')!
    .click();
  assert.equal(chip.dataset.id, "(Faces/Portrait:1.55)", "plus adds 0.05");
  assert.equal(basketCalls.updateChipSelection, 1);

  weightInput.value = "1";
  weightInput.dispatchEvent(new Event("change", { bubbles: true }));
  assert.equal(
    chip.dataset.id,
    "Faces/Portrait",
    "a weight of 1 drops the parentheses",
  );
});

test("toggle-weight reveals and hides the weight modifier", () => {
  const { manager, basketEl } = makeManager(["Faces/Portrait"]);
  const chip = makeChip(basketEl, {
    id: "Faces/Portrait",
    index: "0",
    start: "0",
    end: "1",
  });
  manager.show(chip);

  const modifier = manager.popupEl!.querySelector<HTMLElement>(
    ".j0n4t-pg-weight-modifier",
  )!;
  assert.equal(modifier.style.display, "none", "hidden by default");

  action(manager, "toggle-weight")!.click();
  assert.equal(modifier.style.display, "flex");

  action(manager, "toggle-weight")!.click();
  assert.equal(modifier.style.display, "none");
});

// --- keyboard and outside click ---

test("Escape closes the popup with focus restore", () => {
  const { manager, basketEl, basketCalls } = makeManager(["Faces/Portrait"]);
  const chip = makeChip(basketEl, {
    id: "Faces/Portrait",
    index: "0",
    start: "0",
    end: "1",
  });
  manager.show(chip);

  manager.popupEl!.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape" }),
  );

  assert.equal(manager.popupEl, null);
  assert.deepEqual(basketCalls.focusChip, ["0"]);
});

test("clicking outside closes the popup without focus restore", async () => {
  const { manager, basketEl, basketCalls } = makeManager(["Faces/Portrait"]);
  const chip = makeChip(basketEl, {
    id: "Faces/Portrait",
    index: "0",
    start: "0",
    end: "1",
  });
  manager.show(chip);

  // the outside-click handler is registered on document after a 10ms delay
  await new Promise((resolve) => setTimeout(resolve, 30));
  document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

  assert.equal(manager.popupEl, null);
  assert.ok(!chip.classList.contains("active-menu"));
  assert.deepEqual(
    basketCalls.focusChip,
    [],
    "no focus restore on an outside click",
  );
});
