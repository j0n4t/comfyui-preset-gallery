import { test } from "node:test";
import assert from "node:assert/strict";
import PresetGalleryAPI from "../../web/PresetGalleryAPI.js";

// PresetGalleryAPI talks to the /preset_gallery/presets route. The tests
// stub globalThis.fetch with an in-memory library so every read and write is
// observable without a server.

type FetchCall = { url: string; method: string; body: string | null };

type SavePresetData = Parameters<typeof PresetGalleryAPI.savePreset>[0];

/** savePreset with imageData relaxed to null (the unit tests never send images). */
function save(data: Omit<SavePresetData, "imageData"> & { imageData: string | null }) {
  return PresetGalleryAPI.savePreset(data as SavePresetData);
}

function fakeServer(initial: PresetCache = {}): {
  calls: FetchCall[];
  getLibrary: () => PresetCache;
} {
  let library: PresetCache = initial;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? "GET", body: init?.body ? String(init.body) : null });
    if (init?.method === "POST") {
      library = JSON.parse(String(init.body)) as PresetCache;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response(JSON.stringify(library), { status: 200 });
  }) as typeof fetch;
  return { calls, getLibrary: () => library };
}

// --- fetchGallery / getPresets ---

test("fetchGallery GETs the endpoint and returns the parsed library", async () => {
  const server = fakeServer({ "Faces/Portrait": { preset: "portrait" } });
  const presets = await PresetGalleryAPI.fetchGallery();
  assert.deepEqual(presets, { "Faces/Portrait": { preset: "portrait" } });
  assert.equal(server.calls.length, 1);
  assert.equal(server.calls[0].url, "/preset_gallery/presets");
  assert.equal(server.calls[0].method, "GET");
});

test("fetchGallery returns an empty object on an HTTP error", async () => {
  globalThis.fetch = (async () => new Response("boom", { status: 500 })) as typeof fetch;
  assert.deepEqual(await PresetGalleryAPI.fetchGallery(), {});
});

test("fetchGallery returns an empty object on a network error", async () => {
  globalThis.fetch = (async () => {
    throw new Error("offline");
  }) as typeof fetch;
  assert.deepEqual(await PresetGalleryAPI.fetchGallery(), {});
});

test("getPresets delegates to fetchGallery", async () => {
  fakeServer({ RootPreset: { preset: "root" } });
  assert.deepEqual(await PresetGalleryAPI.getPresets(), { RootPreset: { preset: "root" } });
});

// --- savePresets: cleaning and ordering ---

test("savePresets drops items without content and keeps folder colors for active folders", async () => {
  const server = fakeServer();
  await PresetGalleryAPI.savePresets({
    "B/Second": { preset: "b" },
    "A/First": { preset: "a" },
    "Empty/Blank": { preset: "" },
    Faces: { __color__: "#ff0000" },
    "Faces/Portrait": { preset: "p" },
  });
  assert.deepEqual(server.getLibrary(), {
    "A/First": { preset: "a" },
    "B/Second": { preset: "b" },
    Faces: { __color__: "#ff0000" },
    "Faces/Portrait": { preset: "p" },
  });
});

test("savePresets drops color-only entries for folders with no active presets", async () => {
  const server = fakeServer();
  await PresetGalleryAPI.savePresets({ Ghost: { __color__: "#000000" } });
  assert.deepEqual(server.getLibrary(), {});
});

test("savePresets sorts hidden underscore keys after visible ones", async () => {
  const server = fakeServer();
  await PresetGalleryAPI.savePresets({
    "_/config/prepend/Faces": { preset: "pre" },
    "Faces/Portrait": { preset: "p" },
    RootPreset: { preset: "r" },
  });
  assert.deepEqual(Object.keys(server.getLibrary()), [
    "Faces/Portrait",
    "RootPreset",
    "_/config/prepend/Faces",
  ]);
});

test("savePresets POSTs the cleaned library and returns the server response", async () => {
  const server = fakeServer();
  const result = await PresetGalleryAPI.savePresets({ RootPreset: { preset: "r" } });
  assert.deepEqual(result, { success: true });
  assert.equal(server.calls.length, 1);
  assert.equal(server.calls[0].method, "POST");
  assert.deepEqual(server.calls[0].body, JSON.stringify({ RootPreset: { preset: "r" } }));
});

test("savePresets returns a failure object when the POST fails", async () => {
  globalThis.fetch = (async () => {
    throw new Error("offline");
  }) as typeof fetch;
  const result = await PresetGalleryAPI.savePresets({ RootPreset: { preset: "r" } });
  assert.equal(result.success, false);
});

// --- setGroupColor ---

test("setGroupColor adds a color to a group that has presets", async () => {
  const server = fakeServer({ "Faces/Portrait": { preset: "p" } });
  const result = await PresetGalleryAPI.setGroupColor("Faces", "#ff0000");
  assert.deepEqual(result, { success: true });
  assert.deepEqual(server.getLibrary(), {
    Faces: { __color__: "#ff0000" },
    "Faces/Portrait": { preset: "p" },
  });
});

test("setGroupColor on a folder without presets does not persist the color", async () => {
  // savePresets only keeps color-only entries for folders that contain at
  // least one preset with content, so a color on an empty folder is dropped
  const server = fakeServer();
  const result = await PresetGalleryAPI.setGroupColor("Faces", "#ff0000");
  assert.deepEqual(result, { success: true });
  assert.deepEqual(server.getLibrary(), {});
});

test("setGroupColor removes the color when called without one", async () => {
  const server = fakeServer({ Faces: { __color__: "#ff0000" }, "Faces/Portrait": { preset: "p" } });
  await PresetGalleryAPI.setGroupColor("Faces", "");
  // the colour-less folder entry is dropped on save; the preset survives
  assert.deepEqual(server.getLibrary(), { "Faces/Portrait": { preset: "p" } });
});

// --- savePreset: key normalization and edit mode ---

test("savePreset normalizes the name and builds a folder/name key", async () => {
  const server = fakeServer();
  const result = await save({
    name: "My Cool Preset",
    folder: "Faces",
    presetText: "some text",
    imageData: null,
    clearImage: false,
    editingKey: "",
    mode: "new",
  });
  assert.deepEqual(result, { success: true, key: "faces/my_cool_preset" });
  assert.deepEqual(server.getLibrary(), { "faces/my_cool_preset": { preset: "some text" } });
});

test("savePreset trims slashes and maps root-like folders to the root", async () => {
  const server = fakeServer();
  for (const folder of [" Root ", "root presets", "none"]) {
    const result = await save({
      name: "Thing",
      folder,
      presetText: "text",
      imageData: null,
      clearImage: false,
      editingKey: "",
      mode: "new",
    });
    assert.equal(result.key, "thing");
  }
  assert.deepEqual(Object.keys(server.getLibrary()), ["thing"]);
});

test("savePreset rejects an empty name without saving", async () => {
  const server = fakeServer();
  const result = await save({
    name: "   ",
    folder: "",
    presetText: "text",
    imageData: null,
    clearImage: false,
    editingKey: "",
    mode: "new",
  });
  assert.equal(result.success, false);
  assert.equal(server.calls.length, 1, "only the GET happens, no POST");
});

test("savePreset rejects empty content without saving", async () => {
  const server = fakeServer();
  const result = await save({
    name: "Thing",
    folder: "",
    presetText: "   ",
    imageData: null,
    clearImage: false,
    editingKey: "",
    mode: "new",
  });
  assert.equal(result.success, false);
  assert.equal(server.calls.length, 1, "only the GET happens, no POST");
});

test("savePreset in edit mode deletes the old key when the name changes", async () => {
  const server = fakeServer({ "Faces/Old": { preset: "x" } });
  const result = await save({
    name: "New",
    folder: "Faces",
    presetText: "y",
    imageData: null,
    clearImage: false,
    editingKey: "Faces/Old",
    mode: "edit",
  });
  assert.deepEqual(result, { success: true, key: "faces/new" });
  assert.deepEqual(server.getLibrary(), { "faces/new": { preset: "y" } });
});

test("savePreset in edit mode keeps the same key when the name is unchanged", async () => {
  const server = fakeServer({ "faces/thing": { preset: "x" } });
  await save({
    name: "Thing",
    folder: "Faces",
    presetText: "updated",
    imageData: null,
    clearImage: false,
    editingKey: "faces/thing",
    mode: "edit",
  });
  assert.deepEqual(server.getLibrary(), { "faces/thing": { preset: "updated" } });
});

// --- deletePreset ---

test("deletePreset removes the key and saves", async () => {
  const server = fakeServer({ "A/One": { preset: "a" }, "B/Two": { preset: "b" } });
  const result = await PresetGalleryAPI.deletePreset("A/One");
  assert.deepEqual(result, { success: true });
  assert.deepEqual(server.getLibrary(), { "B/Two": { preset: "b" } });
});

// --- renameFolder ---

test("renameFolder rewrites the prefix of every key under the folder", async () => {
  const server = fakeServer({
    "Faces/Portrait": { preset: "p" },
    "Faces/Nature/Hills": { preset: "h" },
    "Scenery/Sky": { preset: "s" },
  });
  const result = await PresetGalleryAPI.renameFolder("Faces", "People");
  assert.deepEqual(result, { success: true });
  assert.deepEqual(server.getLibrary(), {
    "People/Portrait": { preset: "p" },
    "People/Nature/Hills": { preset: "h" },
    "Scenery/Sky": { preset: "s" },
  });
});

test("renameFolder moves a bare folder key (such as a color-only entry)", async () => {
  const server = fakeServer({
    Faces: { __color__: "#ff0000" },
    "Faces/Portrait": { preset: "p" },
  });
  await PresetGalleryAPI.renameFolder("Faces", "People");
  assert.deepEqual(server.getLibrary(), {
    People: { __color__: "#ff0000" },
    "People/Portrait": { preset: "p" },
  });
});
