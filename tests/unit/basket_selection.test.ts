import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import BasketSelectionController from "../../web/BasketSelectionController.js";

// The multi-selection and clipboard commands that used to sit inside
// PresetBasket. They are driven here directly: a chip list, a context that
// records what the commands asked the app to do, and a stub for the Basket
// methods a command calls back into (focus, chip menu, tab snapshot).

const CACHE: PresetCache = {
  "faces/portrait": { preset: "portrait" },
  "faces/macro": { preset: "macro" },
  "scenery/hills": { preset: "hills" },
};

function disabledButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.disabled = true;
  return button;
}

function makeEnv({
  selection = ["faces/portrait", "faces/macro", "scenery/hills"] as string[],
} = {}) {
  const chipList = document.createElement("div");
  chipList.className = "j0n4t-pg-basket-pool";
  for (let index = 0; index < selection.length; index++) {
    const chip = document.createElement("div");
    chip.className = "j0n4t-pg-basket-chip";
    chip.dataset.index = String(index);
    chip.tabIndex = 0;
    chipList.appendChild(chip);
  }
  document.body.appendChild(chipList);

  let widgetValue = selection.join(", ");
  const pinned = new Set<string>();
  const calls = {
    updateWidgetValue: [] as string[][],
    syncUI: [] as string[],
    savePins: 0,
    focusChip: [] as number[],
    closeMenu: 0,
    saveCurrentState: 0,
  };

  const context = {
    cache: CACHE,
    pinnedChips: pinned,
    dom: {
      // The buttons ship disabled in the basket template; a selection enables them.
      btnCopyBasket: disabledButton(),
      btnBasketPin: disabledButton(),
      btnBasketDisable: disabledButton(),
      btnBasketDelete: disabledButton(),
    },
    getSelectedArray: () =>
      widgetValue
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    updateWidgetValue: (arr: string[]) => {
      calls.updateWidgetValue.push(arr);
      widgetValue = arr.join(", ");
    },
    syncUI: (val: string) => {
      calls.syncUI.push(val);
    },
    savePins: () => {
      calls.savePins++;
    },
    widget: {
      get value() {
        return widgetValue;
      },
    },
  };

  const basket = {
    basket: chipList,
    chipMenuManager: {
      close: () => {
        calls.closeMenu++;
      },
    },
    focusChip: (index: number) => {
      calls.focusChip.push(index);
    },
    saveCurrentState: () => {
      calls.saveCurrentState++;
    },
  };

  const selectionController = new BasketSelectionController(
    context as unknown as GalleryContext,
    basket as unknown as import("../../web/PresetBasket.js").default,
  );

  const chipAt = (index: number) => chipList.children[index] as HTMLElement;
  return {
    selection: selectionController,
    chips: chipList,
    calls,
    context,
    pinned,
    widgetValue: () => widgetValue,
    chipAt,
  };
}

const event = (init: KeyboardEventInit = {}) =>
  new KeyboardEvent("keydown", { bubbles: true, ...init });

beforeEach(() => {
  document.body.innerHTML = "";
});

// --- selection transitions ---

test("a plain click selects only that chip and anchors it", () => {
  const env = makeEnv();

  env.selection.handleChip(env.chipAt(1), event());

  assert.deepEqual([...env.selection.selected], [1]);
  assert.equal(env.selection.anchor, 1);
  assert.ok(env.chipAt(1).classList.contains("selected"));
  assert.ok(!env.chipAt(0).classList.contains("selected"));
});

test("ctrl-click toggles a chip and leaves the rest selected", () => {
  const env = makeEnv();
  env.selection.handleChip(env.chipAt(0), event());
  env.selection.handleChip(env.chipAt(2), event({ ctrlKey: true }));

  assert.deepEqual([...env.selection.selected].sort(), [0, 2]);
  assert.equal(env.selection.anchor, 2, "the anchor follows the last click");

  env.selection.handleChip(env.chipAt(0), event({ ctrlKey: true }));

  assert.deepEqual([...env.selection.selected], [2]);
});

test("shift-click selects the inclusive range from the anchor", () => {
  const env = makeEnv();
  env.selection.handleChip(env.chipAt(0), event());
  env.selection.handleChip(env.chipAt(2), event({ shiftKey: true }));

  assert.deepEqual([...env.selection.selected].sort(), [0, 1, 2]);
});

test("shift-click backwards selects the same range", () => {
  const env = makeEnv();
  env.selection.handleChip(env.chipAt(2), event());
  env.selection.handleChip(env.chipAt(0), event({ shiftKey: true }));

  assert.deepEqual([...env.selection.selected].sort(), [0, 1, 2]);
});

test("select mode makes a plain click toggle", () => {
  const env = makeEnv();
  env.selection.multiSelect = true;

  env.selection.handleChip(env.chipAt(0), event());
  env.selection.handleChip(env.chipAt(1), event());
  env.selection.handleChip(env.chipAt(0), event());

  assert.deepEqual([...env.selection.selected], [1]);
});

test("clear empties the selection and the anchor", () => {
  const env = makeEnv();
  env.selection.handleChip(env.chipAt(1), event());

  env.selection.clear();

  assert.equal(env.selection.selected.size, 0);
  assert.equal(env.selection.anchor, null);
});

test("the action buttons follow the selection", () => {
  const env = makeEnv();
  const dom = env.context.dom as unknown as Record<string, HTMLButtonElement>;
  assert.equal(dom.btnBasketDelete.disabled, true);

  env.selection.handleChip(env.chipAt(0), event());
  assert.equal(dom.btnBasketDelete.disabled, false);
  assert.equal(dom.btnCopyBasket.disabled, false);

  env.pinned.add("faces/portrait");
  env.selection.updateActionButtons();
  assert.match(
    dom.btnBasketPin.innerHTML,
    /Unpin/,
    "an all-pinned selection offers Unpin",
  );
});

// --- commands ---

test("deleteSelected removes the selected tokens and clears the selection", () => {
  const env = makeEnv();
  env.selection.handleChip(env.chipAt(1), event());

  env.selection.deleteSelected();

  assert.deepEqual(env.calls.updateWidgetValue.at(-1), [
    "faces/portrait",
    "scenery/hills",
  ]);
  assert.equal(env.selection.selected.size, 0);
  assert.equal(env.calls.closeMenu, 1, "the chip menu is closed");
  assert.deepEqual(env.calls.focusChip, [1], "focus lands where the chip was");
});

test("moveSelected moves the selected chip past its target", () => {
  const env = makeEnv();
  env.selection.handleChip(env.chipAt(2), event());

  env.selection.moveSelected(0, true);

  assert.deepEqual(env.calls.updateWidgetValue.at(-1), [
    "faces/portrait",
    "scenery/hills",
    "faces/macro",
  ]);
  assert.deepEqual(
    [...env.selection.selected],
    [1],
    "the moved chip stays selected at its new index",
  );
});

test("moveSelected does nothing when the target is inside the selection", () => {
  const env = makeEnv();
  env.selection.handleChip(env.chipAt(0), event());

  env.selection.moveSelected(0, false);

  assert.equal(env.calls.updateWidgetValue.length, 0);
});

test("togglePins pins the whole selection, then unpins it", () => {
  const env = makeEnv();
  env.selection.handleChip(env.chipAt(0), event());
  env.selection.handleChip(env.chipAt(1), event({ ctrlKey: true }));

  env.selection.togglePins();
  assert.deepEqual([...env.pinned].sort(), ["faces/macro", "faces/portrait"]);
  assert.equal(env.calls.savePins, 1);
  assert.equal(env.calls.saveCurrentState, 1);

  env.selection.togglePins();
  assert.deepEqual([...env.pinned], []);
});

// --- clipboard payload validation ---

const payload = (overrides: Record<string, unknown> = {}) => ({
  type: "comfyui-preset-gallery-basket",
  version: 1,
  chips: [
    {
      items: ["faces/portrait"],
      styleKey: "faces/portrait",
      pinned: false,
      rolls: {},
    },
  ],
  ...overrides,
});

test("a well-formed payload is accepted", () => {
  assert.equal(makeEnv().selection.isClipboardPayload(payload()), true);
});

test("a payload from another source is rejected", () => {
  const env = makeEnv();
  assert.equal(
    env.selection.isClipboardPayload(payload({ type: "something-else" })),
    false,
  );
  assert.equal(
    env.selection.isClipboardPayload(payload({ version: 2 })),
    false,
  );
  assert.equal(env.selection.isClipboardPayload(null), false);
  assert.equal(env.selection.isClipboardPayload("text"), false);
});

test("chips with bad items or roll offsets are rejected", () => {
  const env = makeEnv();
  assert.equal(
    env.selection.isClipboardPayload(
      payload({
        chips: [{ items: [], styleKey: "x", pinned: false, rolls: {} }],
      }),
    ),
    false,
  );
  assert.equal(
    env.selection.isClipboardPayload(
      payload({
        chips: [{ items: [1], styleKey: "x", pinned: false, rolls: {} }],
      }),
    ),
    false,
  );
  assert.equal(
    env.selection.isClipboardPayload(
      payload({
        chips: [
          {
            items: ["x"],
            styleKey: "x",
            pinned: false,
            rolls: { g: [{ offset: -1, value: "v" }] },
          },
        ],
      }),
    ),
    false,
  );
  assert.equal(
    env.selection.isClipboardPayload(
      payload({
        chips: [
          {
            items: ["x"],
            styleKey: "x",
            pinned: false,
            rolls: { g: [{ offset: 0, value: "v" }] },
          },
        ],
      }),
    ),
    true,
  );
});
