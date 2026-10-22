import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import PresetEditor from "../../web/PresetEditor.js";
import ModalUtils from "../../web/ModalUtils.js";
import PresetGalleryAPI from "../../web/PresetGalleryAPI.js";

// shouldConfirmOverwrite is a static on PresetEditor, extracted there in
// Phase 1 exactly so it could be tested without a DOM. The decision tests
// below call the real static; the DOM-driven tests cover the panel:
// field state, save/delete flows, quick save, paste suggestion and image
// state. The save/delete paths go through PresetGalleryAPI statics and
// ModalUtils.confirm, which are stubbed per test.

const CACHE: PresetCache = {
  "faces/portrait": { preset: "portrait, solo", filename: "data:image/png;base64,x" },
  "scenery/landscape": { preset: "nature" },
};

const originalSave = PresetGalleryAPI.savePreset;
const originalDelete = PresetGalleryAPI.deletePreset;
const originalConfirm = ModalUtils.confirm;

let saveCalls: Record<string, unknown>[] = [];
let deleteCalls: string[] = [];
let confirmResult = true;
let confirmCalls = 0;

const originalAlert = ModalUtils.alert;

beforeEach(() => {
  saveCalls = [];
  deleteCalls = [];
  confirmCalls = 0;
  ModalUtils.alert = (async () => {}) as typeof ModalUtils.alert;
  PresetGalleryAPI.savePreset = (async (data: Record<string, unknown>) => {
    saveCalls.push(data);
    const folder = data.folder ? String(data.folder) : "";
    const key = folder ? `${folder}/${String(data.name)}` : String(data.name);
    return { success: true, key };
  }) as typeof PresetGalleryAPI.savePreset;
  PresetGalleryAPI.deletePreset = (async (key: string) => {
    deleteCalls.push(key);
    return { success: true };
  }) as typeof PresetGalleryAPI.deletePreset;
  ModalUtils.confirm = (async () => {
    confirmCalls++;
    return confirmResult;
  }) as typeof ModalUtils.confirm;
});

afterEach(() => {
  PresetGalleryAPI.savePreset = originalSave;
  PresetGalleryAPI.deletePreset = originalDelete;
  ModalUtils.confirm = originalConfirm;
  ModalUtils.alert = originalAlert;
});

interface FakeDom {
  editor: HTMLDivElement;
  banner: HTMLDivElement;
  inpName: HTMLInputElement;
  inpFolder: HTMLInputElement;
  inpPreset: HTMLTextAreaElement;
  editorPreview: HTMLDivElement;
  inpFile: HTMLInputElement;
  btnSave: HTMLButtonElement;
  btnDel: HTMLButtonElement;
  btnClearFields: HTMLButtonElement;
}

function makeDom(): FakeDom {
  const editor = document.createElement("div");
  editor.className = "j0n4t-pg-editor no-image";
  const banner = document.createElement("div");
  banner.className = "j0n4t-pg-editor-banner";
  const inpName = document.createElement("input");
  const inpFolder = document.createElement("input");
  const inpPreset = document.createElement("textarea");
  const editorPreview = document.createElement("div");
  editorPreview.className = "j0n4t-pg-editor-preview";
  const inpFile = document.createElement("input");
  inpFile.type = "file";
  const btnSave = document.createElement("button");
  const btnDel = document.createElement("button");
  const btnClearFields = document.createElement("button");
  document.body.append(editor, banner, inpName, inpFolder, inpPreset, editorPreview, inpFile, btnSave, btnDel, btnClearFields);
  return { editor, banner, inpName, inpFolder, inpPreset, editorPreview, inpFile, btnSave, btnDel, btnClearFields };
}

function makeEditor(dom: FakeDom): {
  editor: PresetEditor;
  calls: {
    loadGallery: number;
    updateWidgetValue: string[][];
    syncEditorHighlight: number;
    setPanelCollapseState: boolean[];
  };
} {
  const calls = { loadGallery: 0, updateWidgetValue: [] as string[][], syncEditorHighlight: 0, setPanelCollapseState: [] as boolean[] };
  const context = {
    dom,
    cache: CACHE,
    session: {
      libraryCaches: new Map([["main", CACHE]]),
      libraries: [{ id: "main", name: "Main" }],
    },
    syncEditorHighlight: () => { calls.syncEditorHighlight++; },
    setPanelCollapseState: (collapsed: boolean) => { calls.setPanelCollapseState.push(collapsed); },
    loadGallery: () => { calls.loadGallery++; return Promise.resolve(); },
    refreshLibraries: () => Promise.resolve(),
    settleEmptiedLibrary: () => Promise.resolve(),
    getSelectedArray: () => [],
    updateWidgetValue: (arr: string[]) => { calls.updateWidgetValue.push(arr); },
  };
  return { editor: new PresetEditor(context as unknown as GalleryContext), calls };
}

function click(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function typeInto(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// --- shouldConfirmOverwrite (the real static) ---

test("new mode: confirms overwrite when key exists in cache", () => {
  assert.equal(PresetEditor.shouldConfirmOverwrite("new", "", "faces/portrait", CACHE), true);
});

test("new mode: no confirmation when key does not exist", () => {
  assert.equal(PresetEditor.shouldConfirmOverwrite("new", "", "new/preset", CACHE), false);
});

test("edit mode: no confirmation when saving to same key (no rename)", () => {
  assert.equal(PresetEditor.shouldConfirmOverwrite("edit", "faces/portrait", "faces/portrait", CACHE), false);
});

test("edit mode: no confirmation when renamed to a new unique key", () => {
  assert.equal(PresetEditor.shouldConfirmOverwrite("edit", "faces/portrait", "faces/renamed", CACHE), false);
});

test("edit mode: confirms overwrite when renamed to an existing different key", () => {
  assert.equal(PresetEditor.shouldConfirmOverwrite("edit", "faces/portrait", "scenery/landscape", CACHE), true);
});

// --- banner / field state ---

test("clearFields resets the panel to the new-preset state", () => {
  const dom = makeDom();
  const { editor } = makeEditor(dom);
  editor.openPreset("faces/portrait");
  editor.clearFields();

  assert.equal(dom.inpName.value, "");
  assert.equal(dom.inpFolder.value, "");
  assert.equal(dom.inpPreset.value, "");
  assert.equal(dom.banner.innerText, "✨ Creating New Preset");
  assert.equal(dom.btnSave.innerText, "Save");
  assert.ok(dom.editor.classList.contains("no-image"), "the image state resets");
  assert.ok(dom.editorPreview.innerHTML.includes("j0n4t-pg-initials"), "the preview falls back to initials");
});

test("openPreset fills the fields and marks the edit mode", () => {
  const dom = makeDom();
  const { editor, calls } = makeEditor(dom);

  editor.openPreset("faces/portrait");

  assert.equal(dom.inpName.value, "portrait", "the name comes from the lowercased key");
  assert.equal(dom.inpFolder.value, "faces");
  assert.equal(dom.inpPreset.value, "portrait, solo");
  assert.equal(dom.banner.innerText, "✅ faces/portrait");
  assert.equal(dom.btnSave.innerText, "Saved!");
  assert.equal(calls.syncEditorHighlight, 1);
  assert.deepEqual(calls.setPanelCollapseState, [false], "the panel expands");
});

test("openPreset with focus focuses the preset field", () => {
  const dom = makeDom();
  const { editor } = makeEditor(dom);

  editor.openPreset("faces/portrait", true);

  assert.equal(document.activeElement, dom.inpPreset);
});

test("openPreset ignores an unknown key", () => {
  const dom = makeDom();
  const { editor, calls } = makeEditor(dom);

  editor.openPreset("Faces/Unknown");

  assert.equal(dom.inpName.value, "");
  assert.equal(calls.syncEditorHighlight, 0, "nothing is touched");
});

test("typing marks the edit dirty", () => {
  const dom = makeDom();
  const { editor } = makeEditor(dom);
  editor.openPreset("faces/portrait");
  assert.equal(dom.banner.innerText, "✅ faces/portrait");

  typeInto(dom.inpName, "Renamed");

  assert.equal(dom.banner.innerText, "📝 faces/portrait", "the banner switches to dirty");
  assert.equal(dom.btnSave.innerText, "Save", "the button invites saving");
});

// --- save flow ---

test("handleSave in edit mode persists through the API and reloads", async () => {
  const dom = makeDom();
  const { editor, calls } = makeEditor(dom);
  editor.openPreset("faces/portrait");
  typeInto(dom.inpPreset, "updated text");

  click(dom.btnSave);
  await new Promise((resolve) => setTimeout(resolve, 0)); // let the async save run

  assert.equal(saveCalls.length, 1);
  assert.equal(saveCalls[0].name, "portrait", "the saved name is lowercased");
  assert.equal(saveCalls[0].presetText, "updated text");
  assert.equal(saveCalls[0].mode, "edit");
  assert.equal(calls.loadGallery, 1, "the library reloads after save");
  assert.equal(dom.banner.innerText, "✅ faces/portrait", "the banner returns to saved");
});

test("handleSave derives the name from the preset text when the name is empty", async () => {
  const dom = makeDom();
  const { editor } = makeEditor(dom);
  editor.clearFields();
  dom.inpFolder.value = "";
  typeInto(dom.inpPreset, "Hello World");

  click(dom.btnSave);
  await new Promise((resolve) => setTimeout(resolve, 0)); // let the async save run

  assert.equal(saveCalls.length, 1);
  assert.equal(saveCalls[0].name, "hello_world", "spaces become underscores and the case is lowered");
  assert.equal(saveCalls[0].presetText, "Hello World");
});

test("handleSave without a name or preset text refuses to save", async () => {
  const dom = makeDom();
  const { editor } = makeEditor(dom);
  editor.clearFields();

  click(dom.btnSave);

  assert.equal(saveCalls.length, 0, "nothing is posted");
});

test("handleSave asks before overwriting and aborts on cancel", async () => {
  const dom = makeDom();
  const { editor } = makeEditor(dom);
  editor.clearFields();
  dom.inpFolder.value = "Faces";
  typeInto(dom.inpName, "Portrait");
  typeInto(dom.inpPreset, "something new");
  confirmResult = false;

  click(dom.btnSave);

  assert.equal(confirmCalls, 1, "the overwrite is confirmed");
  assert.equal(saveCalls.length, 0, "a cancelled confirmation aborts the save");
});

test("handleSave proceeds when the overwrite is confirmed", async () => {
  const dom = makeDom();
  const { editor } = makeEditor(dom);
  editor.clearFields();
  dom.inpFolder.value = "Faces";
  typeInto(dom.inpName, "Portrait");
  typeInto(dom.inpPreset, "something new");
  confirmResult = true;

  click(dom.btnSave);
  await new Promise((resolve) => setTimeout(resolve, 0)); // let the async save run

  assert.equal(saveCalls.length, 1);
  assert.equal(saveCalls[0].name, "portrait");
});

// --- quick save and paste ---

test("Shift+Enter triggers a quick save", async () => {
  const dom = makeDom();
  const { editor } = makeEditor(dom);
  editor.clearFields();
  typeInto(dom.inpPreset, "quick save");

  dom.inpPreset.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true }));

  assert.equal(saveCalls.length, 1);
  assert.equal(saveCalls[0].name, "quick_save");
});

test("paste suggests a name when the name field is empty", () => {
  const dom = makeDom();
  const { editor } = makeEditor(dom);
  editor.clearFields();

  const pasteEvent = new Event("paste");
  (pasteEvent as unknown as { clipboardData: { getData: (t: string) => string } }).clipboardData = {
    getData: () => "My Cool Preset!",
  };
  dom.inpPreset.dispatchEvent(pasteEvent);

  assert.equal(dom.inpName.value, "my_cool_preset", "the suggestion is cleaned into a name");
});

test("paste does not suggest a name once one exists in edit mode", () => {
  const dom = makeDom();
  const { editor } = makeEditor(dom);
  editor.openPreset("faces/portrait", false);
  typeInto(dom.inpName, "keep me");

  const pasteEvent = new Event("paste");
  (pasteEvent as unknown as { clipboardData: { getData: (t: string) => string } }).clipboardData = {
    getData: () => "My Cool Preset!",
  };
  dom.inpPreset.dispatchEvent(pasteEvent);

  assert.equal(dom.inpName.value, "keep me");
});

// --- delete flow ---

test("handleDelete removes the preset, reloads and clears the form", async () => {
  const dom = makeDom();
  const { editor, calls } = makeEditor(dom);
  editor.openPreset("faces/portrait");

  click(dom.btnDel);
  await new Promise((resolve) => setTimeout(resolve, 0)); // let the async delete run

  assert.deepEqual(deleteCalls, ["faces/portrait"]);
  assert.equal(calls.loadGallery, 1);
  assert.equal(dom.inpName.value, "", "the form clears after delete");
  assert.equal(dom.banner.innerText, "✨ Creating New Preset");
});

test("handleDelete without a target does nothing", async () => {
  const dom = makeDom();
  makeEditor(dom); // construction binds the delete handler

  click(dom.btnDel);

  assert.equal(deleteCalls.length, 0);
});

test("handleDelete respects a cancelled confirmation", async () => {
  const dom = makeDom();
  const { editor } = makeEditor(dom);
  editor.openPreset("faces/portrait");
  confirmResult = false;

  click(dom.btnDel);

  assert.equal(confirmCalls, 1);
  assert.equal(deleteCalls.length, 0);
});

// --- image state ---

test("resetImageState clears the file input and the has-image class", () => {
  const dom = makeDom();
  const { editor } = makeEditor(dom);
  dom.editor.classList.replace("no-image", "has-image");

  editor.resetImageState();

  // a file input can only be programmatically cleared, never set
  assert.equal(dom.inpFile.value, "");
  assert.ok(dom.editor.classList.contains("no-image"));
  assert.ok(!dom.editor.classList.contains("has-image"));
  assert.ok(dom.editorPreview.innerHTML.includes("j0n4t-pg-initials"), "the preview resets to initials");
});
