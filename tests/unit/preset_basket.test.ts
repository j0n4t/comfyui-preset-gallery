import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import PresetBasket from "../../web/PresetBasket.js";
import RollManager from "../../web/RollManager.js";

// PresetBasket is the largest module (2168 lines). This suite covers the
// state that matters without the ComfyUI host: tab state and persistence,
// chip rendering, selection semantics, pin persistence, keyboard edits and
// the clipboard payload. The context is a fake that records calls; the
// ChipMenuManager/InlineEditorManager/RawTextareaManager it constructs are
// real, and drag/drop geometry stays e2e.

const CACHE: PresetCache = {
  "faces/portrait": { preset: "portrait, solo" },
  "faces/macro": { preset: "macro" },
  "scenery/hills": { preset: "hills" },
};

function fakeStorage(
  initial: Record<string, string> = {},
): Map<string, string> {
  const map = new Map<string, string>(Object.entries(initial));
  globalThis.localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  } as unknown as Storage;
  return map;
}

function makeBasketEnv() {
  const container = document.createElement("div");
  container.className = "j0n4t-pg-basket-container";
  const textarea = document.createElement("textarea");
  container.appendChild(textarea);
  const basketEl = document.createElement("div");
  basketEl.className = "j0n4t-pg-basket-pool";
  const basketTitle = document.createElement("span");
  basketTitle.className = "j0n4t-pg-basket-title";
  const titleParent = document.createElement("div");
  titleParent.appendChild(basketTitle);
  const editorEl = document.createElement("div");
  const gridEl = document.createElement("div");
  const searchEl = document.createElement("input");
  const btnBasketMultiSelect = document.createElement("button");
  const btnCopyBasket = document.createElement("button");
  const btnBasketPaste = document.createElement("button");
  const btnBasketPin = document.createElement("button");
  const btnBasketDelete = document.createElement("button");
  const chkBasketRaw = document.createElement("input");
  chkBasketRaw.type = "checkbox";
  document.body.append(
    container,
    basketEl,
    titleParent,
    editorEl,
    gridEl,
    searchEl,
    btnBasketMultiSelect,
    btnCopyBasket,
    btnBasketPaste,
    btnBasketPin,
    btnBasketDelete,
    chkBasketRaw,
  );

  let widgetValue = "";
  const pinned = new Set<string>();
  const calls = {
    updateWidgetValue: [] as string[][],
    restoreTabSelection: [] as {
      basket?: string[];
      pins?: string[];
      rolls?: Record<string, string>;
    }[],
    transferPin: [] as [string, string][],
    savePins: 0,
    syncUI: [] as string[],
    openEditorForPreset: [] as [string, boolean?][],
  };

  const context = {
    cache: CACHE,
    pinnedChips: pinned,
    rollManager: new RollManager(),
    dom: {
      basket: basketEl,
      basketTitle,
      editor: editorEl,
      grid: gridEl,
      search: searchEl,
      wrap: document.createElement("div"),
      btnHideGallery: document.createElement("button"),
      btnBasketMultiSelect,
      btnCopyBasket,
      btnBasketPaste,
      btnBasketPin,
      btnBasketDelete,
      btnBasketDisable: document.createElement("button"),
      chkBasketRaw,
      basketContainer: container,
    },
    widget: { value: "", callback: () => {} },
    editor: {
      isSaved: true,
      classList: editorEl.classList,
      clearFields: () => {},
      dom: {},
      rawPresetManager: null,
    },
    getSelectedArray: () =>
      widgetValue
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    updateWidgetValue: (arr: string[]) => {
      calls.updateWidgetValue.push(arr);
      widgetValue = arr.join(", ");
      context.widget.value = widgetValue; // the real context keeps the widget in sync
    },
    restoreTabSelection: (tab: {
      basket?: string[];
      pins?: string[];
      rolls?: Record<string, string>;
    }) => {
      calls.restoreTabSelection.push(tab);
      pinned.clear();
      for (const pin of tab.pins ?? []) pinned.add(pin);
      calls.savePins++;
      context.rollManager.rolls = { ...(tab.rolls ?? {}) };
      const arr = tab.basket ?? [];
      widgetValue = arr.join(", ");
      context.widget.value = widgetValue;
    },
    transferPin: (oldVal: string, newVal: string) => {
      calls.transferPin.push([oldVal, newVal]);
      // The real context moves the pin into the new key; the suite relies on
      // that to prove the pin survives a key rename.
      if (pinned.has(oldVal)) {
        pinned.delete(oldVal);
        pinned.add(newVal);
      }
    },
    savePins: () => {
      calls.savePins++;
    },
    syncUI: (val: string) => {
      calls.syncUI.push(val);
    },
    openEditorForPreset: (key: string, focus?: boolean) => {
      calls.openEditorForPreset.push([key, focus]);
    },
    setPanelCollapseState: () => {},
    grid: { syncSelection: () => {} },
  };

  // The real context exposes `pinnedChips` as an accessor onto the session, so
  // assigning it replaces the set every reader sees. Model that over one set so
  // `env.pinned` stays valid across an assignment.
  Object.defineProperty(context, "pinnedChips", {
    get: () => pinned,
    set: (value: Set<string>) => {
      pinned.clear();
      for (const pin of value) pinned.add(pin);
    },
    enumerable: true,
    configurable: true,
  });

  return {
    container,
    textarea,
    basket: basketEl,
    context: context as unknown as GalleryContext,
    calls,
    pinned,
    basketTitle,
    widgetValue: () => widgetValue,
  };
}

function makeBasket() {
  const env = makeBasketEnv();
  const { basket: basketEl, ...rest } = env;
  const basket = new PresetBasket(
    rest.container,
    basketEl,
    rest.textarea,
    rest.context,
  );
  return { basket, ...rest };
}

/**
 * A basket whose fake transitions render, the way the real ones do.
 *
 * The host's `set value(v)` fires the widget callback, and that callback calls
 * syncUI -> basket.render. The plain mock above only records the call, so a
 * test using it cannot see a render at all - and cannot tell one render from
 * three. Use this when counting renders per interaction.
 */
function makeRenderingBasket() {
  const env = makeBasketEnv();
  const { basket: basketEl, ...rest } = env;
  const basket = new PresetBasket(
    rest.container,
    basketEl,
    rest.textarea,
    rest.context,
  );
  const render = () => basket.render(rest.context.getSelectedArray());

  const recordUpdate = rest.context.updateWidgetValue;
  rest.context.updateWidgetValue = (arr: string[]) => {
    recordUpdate(arr);
    render();
  };
  const recordRestore = rest.context.restoreTabSelection;
  rest.context.restoreTabSelection = (tab) => {
    recordRestore(tab);
    render();
  };
  return { basket, ...rest };
}

/** Count how many times the real render body runs. */
function countRenders(basket: PresetBasket, fn: () => void): number {
  let renders = 0;
  const original = basket.render;
  basket.render = (...args: string[][]) => {
    renders++;
    return original.apply(basket, args as [string[]]);
  };
  try {
    fn();
  } finally {
    basket.render = original;
  }
  return renders;
}

function chips(basket: PresetBasket): HTMLElement[] {
  return Array.from(
    basket.basket.querySelectorAll<HTMLElement>(".j0n4t-pg-basket-chip"),
  );
}

function tabItems(basket: PresetBasket): HTMLElement[] {
  return Array.from(
    basket.container.querySelectorAll<HTMLElement>(".j0n4t-pg-basket-tab-item"),
  );
}

function click(el: HTMLElement, init: MouseEventInit = {}): void {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init }));
}

beforeEach(() => {
  fakeStorage();
});

// --- construction and tabs ---

test("the constructor builds the sidebar and a default tab", () => {
  const { basket } = makeBasket();
  assert.ok(
    basket.container.querySelector(".j0n4t-pg-basket-tabs-sidebar"),
    "sidebar is added",
  );
  assert.equal(basket.tabState.tabs.length, 1);
  assert.equal(basket.tabState.tabs[0].title, "Basket");
  assert.equal(basket.tabState.activeTabId, basket.tabState.tabs[0].id);
  assert.equal(tabItems(basket).length, 1);
});

test("initTabs restores saved tabs and their widget/pin state", () => {
  fakeStorage({
    comfy_preset_gallery_basket_tabs: JSON.stringify({
      tabs: [
        {
          id: "t1",
          title: "One",
          basket: ["faces/portrait"],
          pins: ["faces/portrait"],
          rolls: {},
        },
        { id: "t2", title: "Two", basket: [], pins: [], rolls: {} },
      ],
      activeTabId: "t2",
    }),
  });
  const env = makeBasketEnv();
  const basket = new PresetBasket(
    env.container,
    env.basket,
    env.textarea,
    env.context,
  );

  assert.equal(basket.tabState.tabs.length, 2);
  assert.equal(basket.tabState.activeTabId, "t2");
  assert.equal(
    env.widgetValue(),
    "",
    "the active tab's basket is loaded into the widget",
  );
  assert.deepEqual([...env.pinned], [], "pins come from the active tab");
  assert.equal(basket.tabState.tabs[0].title, "One");
});

test("persistTabs writes the active tab id", () => {
  // The tab state resolves its storage when the basket is built, so the fake
  // has to be in place first.
  const map = fakeStorage();
  const { basket } = makeBasket();
  basket.render(["faces/portrait"]);

  const saved = JSON.parse(map.get("comfy_preset_gallery_basket_tabs")!) as {
    tabs: unknown[];
    activeTabId: string;
  };
  assert.equal(
    saved.activeTabId,
    basket.tabState.activeTabId,
    "the persisted payload carries the active tab",
  );
  assert.equal(saved.tabs.length, 1);
});

test("switchTab moves to another tab and renders its basket", () => {
  fakeStorage({
    comfy_preset_gallery_basket_tabs: JSON.stringify({
      tabs: [
        {
          id: "t1",
          title: "One",
          basket: ["faces/portrait"],
          pins: [],
          rolls: {},
        },
        { id: "t2", title: "Two", basket: [], pins: [], rolls: {} },
      ],
      activeTabId: "t1",
    }),
  });
  const { basket } = makeRenderingBasket();

  click(tabItems(basket)[1]);

  assert.equal(basket.tabState.activeTabId, "t2");
  // the restored basket renders as chips
  assert.equal(chips(basket).length, 0, "the empty tab has no chips");
  assert.ok(tabItems(basket)[1].classList.contains("active"));
  assert.ok(!tabItems(basket)[0].classList.contains("active"));
});

test("switchTab renders the restored tab once", () => {
  fakeStorage({
    comfy_preset_gallery_basket_tabs: JSON.stringify({
      tabs: [
        {
          id: "t1",
          title: "One",
          basket: ["faces/portrait"],
          pins: [],
          rolls: {},
        },
        {
          id: "t2",
          title: "Two",
          basket: ["faces/macro"],
          pins: [],
          rolls: {},
        },
      ],
      activeTabId: "t1",
    }),
  });
  const { basket } = makeRenderingBasket();
  const targetId = basket.tabState.tabs[1].id;

  assert.equal(
    countRenders(basket, () => basket.switchTab(targetId)),
    1,
  );
  assert.equal(chips(basket).length, 1);
});

test("createNewTab empties the basket and the widget", () => {
  const { basket, calls, widgetValue } = makeBasket();
  basket.render(["faces/portrait"]);

  click(basket.container.querySelector(".j0n4t-pg-basket-tab-add-btn")!);

  assert.equal(basket.tabState.tabs.length, 2);
  assert.deepEqual(
    calls.restoreTabSelection.at(-1)?.basket,
    [],
    "the new tab starts empty",
  );
  assert.equal(widgetValue(), "", "the widget follows the new tab");
  assert.equal(basket.tabState.tabs[1].title, "Basket 2");
});

test("addChipsToNewTab via the documented custom event", () => {
  const { container, basket } = makeBasket();

  container.dispatchEvent(
    new CustomEvent("preset-gallery:add-chips-to-new-tab", {
      detail: { chips: ["faces/portrait", "faces/macro"] },
    }),
  );

  assert.equal(basket.tabState.tabs.length, 2);
  assert.equal(
    basket.tabState.tabs[1].basket.join(", "),
    "faces/portrait, faces/macro",
  );
  assert.equal(basket.context.widget.value, "faces/portrait, faces/macro");
});

test("dragging a basket chip to the tab bar creates a tab with its spread contents", () => {
  const { basket } = makeBasket();
  basket.render(["faces/portrait"]);
  const values = new Map<string, string>();
  const dataTransfer = {
    types: [] as string[],
    setData(type: string, value: string) {
      values.set(type, value);
      if (!this.types.includes(type)) this.types.push(type);
    },
    getData(type: string) {
      return values.get(type) || "";
    },
  };
  const dragStart = new Event("dragstart", { bubbles: true });
  Object.defineProperty(dragStart, "dataTransfer", { value: dataTransfer });
  chips(basket)[0].dispatchEvent(dragStart);

  const sidebar = basket.container.querySelector<HTMLElement>(
    ".j0n4t-pg-basket-tabs-sidebar",
  )!;
  const drop = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(drop, "dataTransfer", { value: dataTransfer });
  sidebar.dispatchEvent(drop);

  assert.equal(basket.tabState.tabs.length, 2);
  assert.deepEqual(basket.tabState.tabs[1].basket, ["portrait", "solo"]);
  assert.equal(basket.tabState.activeTabId, basket.tabState.tabs[1].id);
});

test("duplicateTab copies a tab with a Copy title", () => {
  const { basket, context } = makeBasket();
  basket.render(["faces/portrait"]);
  context.updateWidgetValue(["faces/portrait"]); // the app keeps the widget in sync
  const sourceId = basket.tabState.tabs[0].id;

  basket.duplicateTab(sourceId);

  assert.equal(basket.tabState.tabs.length, 2);
  const copy = basket.tabState.tabs[1];
  assert.equal(copy.title, "Basket Copy");
  assert.deepEqual(copy.basket, ["faces/portrait"]);
  assert.equal(basket.tabState.activeTabId, copy.id);
});

// --- one render per interaction ---
//
// updateWidgetValue renders (the host's value setter fires the widget callback,
// which calls syncUI -> basket.render). Any extra render() in the same handler
// is a second full rebuild of the basket, and on a 120-chip basket that was
// measured at ~250 ms of avoidable work per interaction.

test("createNewTab renders the basket once", () => {
  const { basket } = makeRenderingBasket();
  assert.equal(
    countRenders(basket, () => basket.createNewTab()),
    1,
  );
});

test("duplicateTab renders the basket once", () => {
  const { basket } = makeRenderingBasket();
  basket.render(["faces/portrait"]);
  assert.equal(
    countRenders(basket, () => basket.duplicateTab(basket.tabState.tabs[0].id)),
    1,
  );
});

test("createNewTab leaves the new tab empty and the previous tab intact", () => {
  // Guards the ordering this fix depends on: render() snapshots the active
  // tab's pins and rolls, so the shared pin state has to be cleared before the
  // value write or the new tab inherits the previous tab's pins.
  const { basket, context } = makeRenderingBasket();
  context.pinnedChips = new Set(["faces/portrait"]);
  context.updateWidgetValue(["faces/portrait"]);

  basket.createNewTab();

  assert.deepEqual(
    basket.tabState.tabs[0].basket,
    ["faces/portrait"],
    "the old tab keeps its basket",
  );
  assert.deepEqual(
    basket.tabState.tabs[0].pins,
    ["faces/portrait"],
    "the old tab keeps its pins",
  );
  assert.deepEqual(
    basket.tabState.tabs[1].basket,
    [],
    "the new tab starts empty",
  );
  assert.deepEqual(
    basket.tabState.tabs[1].pins,
    [],
    "the new tab does not inherit the old pins",
  );
});

test("duplicateTab snapshots the duplicate's own pins, not the source's", () => {
  const { basket, context } = makeRenderingBasket();
  context.pinnedChips = new Set(["faces/portrait"]);
  context.updateWidgetValue(["faces/portrait"]);

  basket.duplicateTab(basket.tabState.tabs[0].id);

  assert.deepEqual(basket.tabState.tabs[1].basket, ["faces/portrait"]);
  assert.deepEqual(
    basket.tabState.tabs[1].pins,
    ["faces/portrait"],
    "the copy carries the duplicated pins",
  );
});

test("deleteTab removes the tab and falls back to a neighbour", () => {
  const { basket } = makeBasket();
  basket.duplicateTab(basket.tabState.tabs[0].id);
  const targetId = basket.tabState.tabs[1].id;

  basket.deleteTab(targetId);

  assert.equal(basket.tabState.tabs.length, 1);
  assert.equal(basket.tabState.activeTabId, basket.tabState.tabs[0].id);
});

// --- render ---

test("render builds chips with labels and data attributes, and expands the textarea", () => {
  const { basket, textarea } = makeBasket();
  basket.render(["faces/portrait"]);

  const chipEls = chips(basket);
  assert.equal(chipEls.length, 1);
  assert.equal(chipEls[0].dataset.index, "0");
  assert.equal(chipEls[0].dataset.start, "0");
  assert.equal(chipEls[0].dataset.end, "1");
  assert.equal(chipEls[0].dataset.id, "faces/portrait");
  assert.equal(
    chipEls[0]
      .querySelector(".j0n4t-pg-basket-chip-label")
      ?.textContent?.trim(),
    "Portrait",
  );
  assert.equal(
    textarea.value,
    "portrait, solo",
    "the textarea holds the expanded preset",
  );
});

test("render marks pinned chips", () => {
  const { basket, pinned } = makeBasket();
  pinned.add("faces/portrait");
  basket.render(["faces/portrait"]);

  assert.ok(chips(basket)[0].classList.contains("pinned"));
});

test("render leaves the textarea alone while _updatingTextarea is set", () => {
  const { basket, textarea } = makeBasket();
  basket.render(["faces/portrait"]);
  textarea.value = "manual edit";

  basket._updatingTextarea = true;
  basket.render(["faces/macro"]);
  assert.equal(
    textarea.value,
    "manual edit",
    "an external edit is not overwritten mid-update",
  );
  basket._updatingTextarea = false;
});

test("spreadPresetToChips splits a preset into its comma tokens", () => {
  const { basket } = makeBasket();
  assert.deepEqual(basket.spreadPresetToChips("faces/portrait"), [
    "portrait",
    "solo",
  ]);
  assert.deepEqual(basket.spreadPresetToChips("unknown"), ["unknown"]);
  assert.deepEqual(basket.spreadPresetToChips(""), []);
});

// --- chip state updates ---

test("updateChipSelection swaps the entry, transfers the pin and updates the widget", () => {
  const { basket, calls, context } = makeBasket();
  context.updateWidgetValue(["faces/portrait"]);
  basket.updateChipSelection(0, 1, "faces/macro");

  assert.deepEqual(calls.updateWidgetValue.at(-1), ["faces/macro"]);
  assert.deepEqual(calls.transferPin, [["faces/portrait", "faces/macro"]]);
});

test("togglePin adds and removes the pinned marker", () => {
  const { basket, pinned, calls, context } = makeBasket();
  basket.render(["faces/portrait"]);
  context.updateWidgetValue(["faces/portrait"]);
  const chip = chips(basket)[0];

  basket.togglePin(chip);
  assert.ok(pinned.has("faces/portrait"));
  assert.ok(chip.classList.contains("pinned"));
  assert.equal(calls.savePins, 1);

  basket.togglePin(chip);
  assert.ok(!pinned.has("faces/portrait"));
  assert.ok(!chip.classList.contains("pinned"));
});

test("toggleSelectedPins pins every selected chip when not all are pinned", () => {
  const { basket, pinned, calls, context } = makeBasket();
  basket.render(["faces/portrait", "scenery/hills"]);
  context.updateWidgetValue(["faces/portrait", "scenery/hills"]);
  basket.selection.selected = new Set([0, 1]);

  basket.toggleSelectedPins();

  assert.ok(pinned.has("faces/portrait") && pinned.has("scenery/hills"));
  assert.deepEqual(calls.syncUI.at(-1), basket.context.widget.value);
  assert.equal(calls.savePins, 1);
});

test("deleteSelectedChips removes the selected chip range", () => {
  const { basket, calls, context } = makeBasket();
  // two entries that would previously collapse into one two-token chip now
  // stay as two separate chips (raw contents are not re-grouped)
  basket.render(["portrait", "solo"]);
  assert.equal(chips(basket).length, 2);
  context.updateWidgetValue(["portrait", "solo"]);
  basket.selection.selected = new Set([0]);

  basket.deleteSelectedChips();

  assert.deepEqual(
    calls.updateWidgetValue.at(-1),
    ["solo"],
    "only the selected chip is removed",
  );
  assert.equal(basket.selection.selected.size, 0);
});

// --- selection semantics ---

test("a plain click selects exactly one chip", () => {
  const { basket } = makeBasket();
  basket.render(["faces/portrait", "scenery/hills"]);

  click(chips(basket)[1]);

  assert.deepEqual([...basket.selection.selected], [1]);
  assert.ok(chips(basket)[1].classList.contains("selected"));
  assert.ok(!chips(basket)[0].classList.contains("selected"));
});

test("ctrl-click toggles a second chip", () => {
  const { basket } = makeBasket();
  basket.render(["faces/portrait", "scenery/hills"]);

  click(chips(basket)[1], { ctrlKey: true });
  assert.deepEqual([...basket.selection.selected], [1]);

  click(chips(basket)[0], { ctrlKey: true });
  assert.deepEqual([...basket.selection.selected].sort(), [0, 1]);

  click(chips(basket)[1], { ctrlKey: true });
  assert.deepEqual([...basket.selection.selected], [0]);
});

test("shift-click selects the range from the anchor", () => {
  const { basket } = makeBasket();
  basket.render(["faces/portrait", "faces/macro", "scenery/hills"]);

  click(chips(basket)[0]);
  click(chips(basket)[2], { shiftKey: true });

  assert.deepEqual([...basket.selection.selected].sort(), [0, 1, 2]);
});

// --- keyboard edits ---

test("the + key adjusts the chip weight", () => {
  const { basket, calls, context } = makeBasket();
  basket.render(["faces/portrait"]);
  context.updateWidgetValue(["faces/portrait"]);

  chips(basket)[0].dispatchEvent(
    new KeyboardEvent("keydown", { key: "+", bubbles: true }),
  );

  assert.deepEqual(calls.updateWidgetValue.at(-1), ["(faces/portrait:1.05)"]);
  assert.deepEqual(calls.transferPin, [
    ["faces/portrait", "(faces/portrait:1.05)"],
  ]);
  // the chip DOM is not re-rendered here; the selection is what changed
});

test("the Delete key removes the focused chip", () => {
  const { basket, calls, context } = makeBasket();
  basket.render(["faces/portrait", "scenery/hills"]);
  context.updateWidgetValue(["faces/portrait", "scenery/hills"]);

  chips(basket)[0].dispatchEvent(
    new KeyboardEvent("keydown", { key: "Delete", bubbles: true }),
  );

  assert.deepEqual(calls.updateWidgetValue.at(-1), ["scenery/hills"]);
});

test("the p key toggles the pin", () => {
  const { basket, pinned, context } = makeBasket();
  basket.render(["faces/portrait"]);
  context.updateWidgetValue(["faces/portrait"]);

  chips(basket)[0].dispatchEvent(
    new KeyboardEvent("keydown", { key: "p", bubbles: true }),
  );

  assert.ok(pinned.has("faces/portrait"));
  assert.ok(chips(basket)[0].classList.contains("pinned"));
});

// --- focus and rename ---

test("focusChip focuses the chip at the start index", async () => {
  const { basket } = makeBasket();
  basket.render(["faces/portrait", "scenery/hills"]);

  basket.focusChip(1);
  for (let i = 0; i < 10 && document.activeElement !== chips(basket)[1]; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(
    document.activeElement,
    chips(basket)[1],
    "focus lands after the 50ms delay",
  );
});

test("renameActiveTab commits the new title on Enter", () => {
  const { basket, basketTitle } = makeBasket();
  basket.renameActiveTab();

  const input = basketTitle.parentElement!.querySelector<HTMLInputElement>(
    ".j0n4t-pg-inline-edit",
  );
  assert.ok(input, "an inline input replaces the title");
  input!.value = "My Presets";
  input!.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );

  assert.equal(basket.tabState.tabs[0].title, "My Presets");
  assert.equal(basketTitle.style.display, "", "the title is restored");
});

// --- clipboard payload ---

test("copySelectedChips round-trips through readBasketClipboard via a clipboard stub", async () => {
  let written = "";
  const originalClipboard = Object.getOwnPropertyDescriptor(
    globalThis.navigator,
    "clipboard",
  );
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (async (text: string) => {
        written = text;
      }) as unknown as () => Promise<void>,
      readText: (async () => written) as unknown as () => Promise<string>,
    },
  });
  try {
    const { basket, context } = makeBasket();
    basket.render(["faces/portrait"]);
    context.updateWidgetValue(["faces/portrait"]);

    await basket.copySelectedChips(chips(basket)[0]);

    assert.equal(written, "faces/portrait", "the joined chip text is written");
    const payload = await basket.readBasketClipboard();
    assert.equal(payload?.type, "comfy-preset-gallery-basket");
    assert.equal(payload?.version, 1);
    assert.equal(payload?.text, "faces/portrait");
    assert.equal(payload?.chips[0].items.join(","), "faces/portrait");
    assert.equal(payload?.chips[0].pinned, false);
  } finally {
    if (originalClipboard) {
      Object.defineProperty(
        globalThis.navigator,
        "clipboard",
        originalClipboard,
      );
    }
  }
});

test("isBasketClipboardPayload accepts a valid payload and rejects malformed ones", () => {
  const { basket } = makeBasket();
  const valid = {
    type: "comfyui-preset-gallery-basket",
    version: 1,
    chips: [
      {
        items: ["a"],
        styleKey: "a",
        pinned: true,
        rolls: { g: [{ offset: 0, value: "b" }] },
      },
    ],
  };
  assert.equal(basket.isBasketClipboardPayload(valid), true);
  assert.equal(basket.isBasketClipboardPayload(null), false);
  assert.equal(
    basket.isBasketClipboardPayload({ type: "other", version: 1, chips: [] }),
    false,
  );
  assert.equal(
    basket.isBasketClipboardPayload({
      ...valid,
      chips: [{ items: [], styleKey: "a", pinned: true, rolls: {} }],
    }),
    false,
    "a chip needs at least one item",
  );
  assert.equal(
    basket.isBasketClipboardPayload({
      ...valid,
      chips: [
        {
          items: ["a"],
          styleKey: "a",
          pinned: true,
          rolls: { g: [{ offset: "0", value: "b" }] },
        },
      ],
    }),
    false,
    "roll offsets must be numbers",
  );
});

test("rendered chip uses the grid item tooltip without placing it on its label", () => {
  const { basket } = makeBasket();
  basket.render(["faces/portrait"]);
  const chipEl = chips(basket)[0];
  const labelEl = chipEl.querySelector(".j0n4t-pg-basket-chip-label");
  assert.ok(labelEl, "chip label exists");
  assert.equal(labelEl.getAttribute("title"), null);
  assert.equal(
    chipEl.getAttribute("title"),
    "Portrait [faces/portrait]\nportrait, solo",
  );
});

test("rendered chip tooltip shows the evaluated value of a plain tag", () => {
  const { basket } = makeBasket();
  basket.render(["<lora:my lora:1.2>"]);
  assert.equal(chips(basket)[0].getAttribute("title"), "<lora:my lora:1.2>");
});

test("rendered chip tooltip shows the evaluated value when it differs from the preset", () => {
  const cacheWithMacro: PresetCache = {
    "look/simple": { preset: "simple look" },
    "look/combo": { preset: "look/simple, extra" },
  };
  const env = makeBasketEnv();
  env.context.cache = cacheWithMacro;
  const basket = new PresetBasket(
    env.container,
    env.basket,
    env.textarea,
    env.context,
  );
  basket.render(["look/combo"]);
  const chipEl = Array.from(
    env.basket.querySelectorAll(".j0n4t-pg-basket-chip"),
  )[0];
  assert.equal(
    chipEl.getAttribute("title"),
    "simple look, extra\n\nCombo [look/combo]\nlook/simple, extra",
  );
});

test("rendered chip keeps the library qualifier in its tooltip", () => {
  const { basket, context } = makeBasket();
  context.session = {
    ownerOfKey(key: string) {
      return key === "scenery/hills" ? "socks" : "main";
    },
    isDuplicateKey: () => false,
    libraryName: (id: string) => id,
  } as unknown as GalleryContext["session"];

  basket.render(["scenery/hills"]);
  assert.equal(
    chips(basket)[0].getAttribute("title"),
    "Hills [socks#scenery/hills]\nhills",
  );
});

test("rendered chip survives a session whose ownerOfKey reads its own state", () => {
  // Regression: the session's ownerOfKey is a method that reads `this`. It must
  // be called as a method, not detached - a detached call throws and kills the
  // whole render, leaving no chips at all.
  class FakeSession {
    owners = new Map<string, string>([["scenery/hills", "socks"]]);
    ownerOfKey(key: string) {
      return this.owners.get(key) ?? "main";
    }
    isDuplicateKey() {
      return false;
    }
    libraryName(id: string) {
      return id;
    }
  }
  const { basket, context } = makeBasket();
  context.session = new FakeSession() as unknown as GalleryContext["session"];

  basket.render(["scenery/hills"]);
  assert.equal(chips(basket).length, 1, "the chip still renders");
  assert.equal(
    chips(basket)[0].getAttribute("title"),
    "Hills [socks#scenery/hills]\nhills",
  );
});

test("rendered chip displays library badge for qualified or non-main presets", () => {
  const { basket, context } = makeBasket();
  context.session = {
    ownerOfKey: (k: string) =>
      k.startsWith("socks#") || k === "socks/wool" ? "socks" : "main",
    isDuplicateKey: () => false,
    libraryName: (id: string) => (id === "socks" ? "Socks" : "Main"),
  } as unknown as GalleryContext["session"];

  basket.render(["faces/portrait", "socks#faces/macro", "socks/wool"]);
  const rendered = chips(basket);
  assert.equal(rendered.length, 3);

  // 1: default main preset has no badge
  assert.equal(rendered[0].querySelector(".j0n4t-pg-lib-badge"), null);

  // 2: qualified preset has badge
  const badge2 = rendered[1].querySelector(".j0n4t-pg-lib-badge");
  assert.ok(badge2, "qualified preset has badge");
  assert.equal(badge2.textContent, "Socks");

  // 3: non-main library preset has badge
  const badge3 = rendered[2].querySelector(".j0n4t-pg-lib-badge");
  assert.ok(badge3, "non-main preset has badge");
  assert.equal(badge3.textContent, "Socks");
});

test("rendered chip can hide library badges while keeping them enabled by default", () => {
  const { basket, context } = makeBasket();
  context.session = {
    ownerOfKey: (key: string) => (key === "socks/wool" ? "socks" : "main"),
    isDuplicateKey: () => false,
    libraryName: () => "Socks",
  } as unknown as GalleryContext["session"];
  context.settings = {
    showChipLibraryBadges: false,
  } as GalleryContext["settings"];

  basket.render(["socks/wool"]);
  assert.equal(chips(basket)[0].querySelector(".j0n4t-pg-lib-badge"), null);
});

test("a disabled chip keeps its pinned state", () => {
  const env = makeBasket();
  env.context.pinnedChips.add("faces/portrait");
  env.context.updateWidgetValue(["faces/portrait"]);
  env.basket.render(["faces/portrait"]);

  // Disable the chip.
  env.basket.toggleChipDisabled(0);
  assert.deepEqual(env.calls.updateWidgetValue.at(-1), ["~faces/portrait~"]);

  // The pin must follow the renamed key.
  assert.equal(env.context.pinnedChips.has("~faces/portrait~"), true);
  assert.equal(env.context.pinnedChips.has("faces/portrait"), false);
  assert.deepEqual(env.calls.transferPin, [
    ["faces/portrait", "~faces/portrait~"],
  ]);
});

test("an enabled chip keeps its pinned state", () => {
  const env = makeBasket();
  env.context.pinnedChips.add("~faces/portrait~");
  env.context.updateWidgetValue(["~faces/portrait~"]);
  env.basket.render(["~faces/portrait~"]);

  // Enable the chip.
  env.basket.toggleChipDisabled(0);
  assert.deepEqual(env.calls.updateWidgetValue.at(-1), ["faces/portrait"]);

  // The pin must follow the renamed key.
  assert.equal(env.context.pinnedChips.has("faces/portrait"), true);
  assert.equal(env.context.pinnedChips.has("~faces/portrait~"), false);
  assert.deepEqual(env.calls.transferPin, [
    ["~faces/portrait~", "faces/portrait"],
  ]);
});

test("a batch disable keeps all pinned chips", () => {
  const env = makeBasket();
  env.context.pinnedChips.add("faces/portrait");
  env.context.pinnedChips.add("scenery/hills");
  env.context.updateWidgetValue(["faces/portrait", "scenery/hills"]);
  env.basket.render(["faces/portrait", "scenery/hills"]);

  env.basket.selection.selected = new Set([0, 1]);
  env.basket.toggleDisabledSelected();

  assert.deepEqual(env.calls.updateWidgetValue.at(-1), [
    "~faces/portrait~",
    "~scenery/hills~",
  ]);
  assert.equal(env.context.pinnedChips.has("~faces/portrait~"), true);
  assert.equal(env.context.pinnedChips.has("~scenery/hills~"), true);
  assert.equal(env.context.pinnedChips.has("faces/portrait"), false);
  assert.equal(env.context.pinnedChips.has("scenery/hills"), false);
  assert.deepEqual(env.calls.transferPin, [
    ["faces/portrait", "~faces/portrait~"],
    ["scenery/hills", "~scenery/hills~"],
  ]);
});
