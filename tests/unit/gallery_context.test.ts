import { test } from "node:test";
import assert from "node:assert/strict";
import PresetSession from "../../web/PresetSession.js";
import createGalleryContext from "../../web/PresetGalleryContext.js";
import ChipMenuManager from "../../web/ChipMenuManager.js";
import type PresetBasket from "../../web/PresetBasket.js";

// Before this refactor the context handed to every component WAS the
// PresetGalleryApp instance, so no component could be constructed without a
// live ComfyUI node, a real DOM and localStorage. These tests pin down that a
// context can now be assembled from a session plus a handful of stubs, and that
// a real component can be built on top of it.

/** In-memory stand-in for localStorage. */
function fakeStorage(initial: Record<string, string> = {}): Storage & { _map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
    _map: map,
  };
}

type FakeView = {
  setPanelCollapseState: (collapsed: boolean) => void;
  syncEditorHighlight: () => void;
  openEditorForPreset: (styleKey: string, focus?: boolean) => void;
  syncUI: (val: string) => void | Promise<void>;
  loadGallery: () => Promise<void>;
  updateWidgetValue: (arr: string[]) => void;
  applyLibraries: (ids: string[]) => void;
  selectionKey: (key: string) => string;
};

/** Records which view/host methods the context forwarded to. */
function fakeView(): FakeView & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const record = (name: string) => (...args: unknown[]) => { calls.push([name, ...args]); };
  return {
    calls,
    setPanelCollapseState: record("setPanelCollapseState"),
    syncEditorHighlight: record("syncEditorHighlight"),
    openEditorForPreset: record("openEditorForPreset"),
    syncUI: record("syncUI"),
    updateWidgetValue: record("updateWidgetValue"),
    applyLibraries: record("applyLibraries"),
    selectionKey: (key: string) => { calls.push(["selectionKey", key]); return key; },
    loadGallery: () => { calls.push(["loadGallery"]); return Promise.resolve(); },
  };
}

function makeContext({ widgetValue = "", storage = fakeStorage() }: {
  widgetValue?: string;
  storage?: Storage | null;
} = {}) {
  const session = new PresetSession({ storage, rng: () => 0.5 });
  const widget = { value: widgetValue };
  const view = fakeView();
  const context = createGalleryContext({ session, dom: {}, widget, view });
  return { session, widget, view, context };
}

// --- state is a live view onto the session ---

test("context.cache reflects a cache reassigned on the session", () => {
  const { session, context } = makeContext();
  assert.deepEqual(context.cache, {});
  session.cache = { "Faces/Portrait": { preset: "portrait" } };
  assert.deepEqual(Object.keys(context.cache), ["Faces/Portrait"]);
});

test("context.cache can be written through", () => {
  const { session, context } = makeContext();
  context.cache = { "Scenery/Hills": { preset: "hills" } };
  assert.deepEqual(Object.keys(session.cache), ["Scenery/Hills"]);
});

test("assigning context.pinnedChips updates the session, not just the context", () => {
  // PresetBasket.initTabs() replaces the set wholesale, so the accessor has to
  // write through or the new pins would be lost.
  const { session, context } = makeContext();
  context.pinnedChips = new Set(["Faces/Portrait"]);
  assert.deepEqual([...session.pinnedChips], ["Faces/Portrait"]);
  assert.deepEqual([...context.pinnedChips], ["Faces/Portrait"]);
});

test("context.rollManager is the session's roll manager", () => {
  const { session, context } = makeContext();
  assert.equal(context.rollManager, session.rollManager);
});

// --- session-backed methods ---

test("getSelectedArray reads the widget value at call time", () => {
  const { widget, context } = makeContext({ widgetValue: "Faces/Portrait" });
  assert.deepEqual(context.getSelectedArray(), ["Faces/Portrait"]);
  widget.value = "Faces/Portrait, Scenery/Hills";
  assert.deepEqual(context.getSelectedArray(), ["Faces/Portrait", "Scenery/Hills"]);
});

test("pin and folder helpers delegate to the session", () => {
  const { session, context } = makeContext();

  context.pinnedChips = new Set(["Faces/Portrait"]);
  context.savePins();
  context.transferPin("Faces/Portrait", "Faces/Renamed");
  assert.deepEqual([...session.pinnedChips], ["Faces/Renamed"]);

  context.setCollapsedFolders(["Faces"]);
  assert.deepEqual(context.getCollapsedFolders(), ["Faces"]);
  context.setExcludedRollFolders(["Animals"]);
  assert.deepEqual(context.getExcludedRollFolders(), ["Animals"]);
});

// --- view / host forwarding ---

test("view methods forward their arguments to the supplied view", () => {
  const { view, context } = makeContext();

  context.setPanelCollapseState(true);
  context.syncEditorHighlight();
  context.openEditorForPreset("Faces/Portrait", true);
  context.syncUI("Faces/Portrait");
  context.loadGallery();
  context.updateWidgetValue(["Faces/Portrait"]);
  context.applyLibraries(["main", "socks"]);
  context.selectionKey("socks#wear/sock");

  assert.deepEqual(view.calls, [
    ["setPanelCollapseState", true],
    ["syncEditorHighlight"],
    ["openEditorForPreset", "Faces/Portrait", true],
    ["syncUI", "Faces/Portrait"],
    ["loadGallery"],
    ["updateWidgetValue", ["Faces/Portrait"]],
    ["applyLibraries", ["main", "socks"]],
    ["selectionKey", "socks#wear/sock"],
  ]);
});

// --- a real component builds on a fake context ---

test("ChipMenuManager can be constructed with a fake context and no DOM", () => {
  const { context } = makeContext({ widgetValue: "Faces/Portrait" });
  const basketStub = { basket: null } as unknown as PresetBasket;

  const manager = new ChipMenuManager(context, basketStub);

  assert.equal(manager.context, context);
  assert.equal(manager.basket, basketStub);
  assert.equal(manager.popupEl, null);
});

test("ChipMenuManager methods that do not touch the DOM work on a fake context", () => {
  const { context } = makeContext();
  const manager = new ChipMenuManager(context, {} as unknown as PresetBasket);

  // The two sentinel values return before touching the input element.
  const noInput = null as unknown as HTMLInputElement;
  assert.equal(manager._resolveInputValue(noInput, "🎲 Random"), "");
  assert.equal(manager._resolveInputValue(noInput, "🚫 None (Omit)"), "none");

  const input = { _options: [{ key: "Faces/Portrait", display: "Portrait" }] } as unknown as HTMLInputElement;
  assert.equal(manager._resolveInputValue(input, "Portrait"), "Faces/Portrait");
  assert.equal(manager._resolveInputValue(input, "Faces/Portrait"), "Faces/Portrait");
  assert.equal(manager._resolveInputValue(input, "Unknown"), "Unknown");
  assert.equal(manager._resolveInputValue({} as unknown as HTMLInputElement, "Faces/Portrait"), "Faces/Portrait");
});
