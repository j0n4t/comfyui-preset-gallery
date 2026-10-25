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
  assert.equal(server.calls[0].url, "/preset_gallery/presets?library=main");
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

// --- libraries ---

/** A stub that answers the libraries route without touching the network. */
function fakeLibraryServer(libraries: unknown[]) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(libraries), { status: 200 })) as typeof fetch;
}

test("fetchLibraries GETs the libraries route", async () => {
  fakeLibraryServer([{ id: "default", name: "Presets", default: true }]);
  assert.deepEqual(await PresetGalleryAPI.fetchLibraries(), [
    { id: "default", name: "Presets", default: true },
  ]);
});

test("fetchLibraries returns an empty list on a network error", async () => {
  globalThis.fetch = (async () => {
    throw new Error("offline");
  }) as typeof fetch;
  assert.deepEqual(await PresetGalleryAPI.fetchLibraries(), []);
});

test("libraryUrl names the library, defaulting to the bundled one", () => {
  // The route treats `?library=main` and no query as the same file, so there is
  // no reason for a caller to depend on which form it gets.
  assert.equal(PresetGalleryAPI.libraryUrl(), "/preset_gallery/presets?library=main");
  assert.equal(PresetGalleryAPI.libraryUrl("main"), "/preset_gallery/presets?library=main");
  assert.equal(PresetGalleryAPI.libraryUrl("sample"), "/preset_gallery/presets?library=sample");
});

test("a read and a write both default to the bundled library", async () => {
  // No module-level pointer: the default is a parameter, so a test that does
  // not pass an id targets `main` without touching any shared state.
  const server = fakeServer({ "Faces/Portrait": { preset: "portrait" } });
  await PresetGalleryAPI.fetchGallery();
  await PresetGalleryAPI.savePresets({ "Faces/Portrait": { preset: "portrait" } });
  assert.equal(server.calls[0].url, "/preset_gallery/presets?library=main");
  assert.equal(server.calls[0].method, "GET");
  assert.equal(server.calls[1].url, "/preset_gallery/presets?library=main");
  assert.equal(server.calls[1].method, "POST");
});

test("an explicit library is used over the default", async () => {
  const server = fakeServer({ "Faces/Portrait": { preset: "portrait" } });
  await PresetGalleryAPI.fetchGallery("sample");
  await PresetGalleryAPI.savePresets({ "Faces/Portrait": { preset: "portrait" } }, "sample");
  assert.equal(server.calls[0].url, "/preset_gallery/presets?library=sample");
  assert.equal(server.calls[1].url, "/preset_gallery/presets?library=sample");
});

// --- one library at a time ---

/** A stub that serves a different library per `?library=`, like the real route. */
function fakeMultiServer(libraries: Record<string, PresetCache>) {
  const calls: FetchCall[] = [];
  const store = { ...libraries };
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    // no `?library=` and `?library=main` are the same file - the bundled one
    const id = new URL(url, "http://localhost").searchParams.get("library") ?? "main";
    calls.push({ url, method: init?.method ?? "GET", body: init?.body ? String(init.body) : null });
    if (init?.method === "POST") {
      store[id] = JSON.parse(String(init.body)) as PresetCache;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response(JSON.stringify(store[id] ?? {}), { status: 200 });
  }) as typeof fetch;
  return { calls, getLibrary: (id: string) => store[id] };
}

test("fetchLibraryCaches reads each id and returns them keyed", async () => {
  const server = fakeMultiServer({
    main: { "Faces/Portrait": { preset: "portrait" } },
    socks: { "wear/sock/ankle": { preset: "ankle" } },
  });
  assert.deepEqual(await PresetGalleryAPI.fetchLibraryCaches(["main", "socks"]), {
    main: { "Faces/Portrait": { preset: "portrait" } },
    socks: { "wear/sock/ankle": { preset: "ankle" } },
  });
  assert.deepEqual(
    server.calls.map((c) => c.url),
    [
      "/preset_gallery/presets?library=main",
      "/preset_gallery/presets?library=socks",
    ]
  );
});

test("a library that fails to load contributes an empty cache, not a rejection", async () => {
  globalThis.fetch = (async (input: unknown) => {
    const url = String(input);
    if (url.includes("library=socks")) return new Response("boom", { status: 500 });
    return new Response(JSON.stringify({ "Faces/Portrait": { preset: "portrait" } }), { status: 200 });
  }) as typeof fetch;

  assert.deepEqual(await PresetGalleryAPI.fetchLibraryCaches(["main", "socks"]), {
    main: { "Faces/Portrait": { preset: "portrait" } },
    socks: {},
  });
});

test("savePreset writes to the named library, not the active one", async () => {
  const server = fakeMultiServer({
    main: { "Faces/Portrait": { preset: "portrait" } },
    socks: { "wear/sock/ankle": { preset: "ankle" } },
  });
  await save({
    name: "Crew",
    folder: "wear/sock",
    presetText: "crew socks",
    imageData: null,
    clearImage: false,
    editingKey: "",
    mode: "new",
    libraryId: "socks",
  });

  assert.deepEqual(server.getLibrary("socks"), {
    "wear/sock/ankle": { preset: "ankle" },
    "wear/sock/crew": { preset: "crew socks" },
  });
  assert.deepEqual(server.getLibrary("main"), { "Faces/Portrait": { preset: "portrait" } });
});

test("savePreset edits the plain key of the library a qualified key points at", async () => {
  const server = fakeMultiServer({
    main: { "wear/sock/ankle": { preset: "main ankle" } },
    socks: { "wear/sock/ankle": { preset: "socks ankle" } },
  });

  // main is shadowed in the merged cache, so the grid names it `main#...`
  const result = await save({
    name: "ankle",
    folder: "wear/sock",
    presetText: "edited ankle",
    imageData: null,
    clearImage: false,
    editingKey: "main#wear/sock/ankle",
    mode: "edit",
    libraryId: "main",
  });

  assert.deepEqual(result, { success: true, key: "wear/sock/ankle" });
  assert.deepEqual(server.getLibrary("main"), { "wear/sock/ankle": { preset: "edited ankle" } });
  assert.deepEqual(server.getLibrary("socks"), { "wear/sock/ankle": { preset: "socks ankle" } });
});

test("deletePreset removes the plain key from the named library", async () => {
  // The library is named as a NON-default one, and the two libraries hold
  // DIFFERENT keys. Both halves matter:
  //
  // - naming `main` would pass even if the argument were dropped, because the
  //   default is `main` too;
  // - sharing a key would also pass, because then reading the wrong library
  //   and writing the emptied copy to the right one is indistinguishable.
  //
  // With different keys, dropping the argument reads `main` (where the key is
  // absent, so the delete is a no-op) and then writes main's whole cache over
  // `socks` - the fixture below makes that visible.
  const server = fakeMultiServer({
    main: { "Faces/Portrait": { preset: "portrait" } },
    socks: { "wear/sock/ankle": { preset: "socks ankle" } },
  });

  await PresetGalleryAPI.deletePreset("socks#wear/sock/ankle", "socks");
  assert.deepEqual(server.getLibrary("socks"), {}, "only the named library loses the key");
  assert.deepEqual(
    server.getLibrary("main"),
    { "Faces/Portrait": { preset: "portrait" } },
    "the other library is untouched"
  );
});

test("renameFolder moves the folder inside the named library only", async () => {
  const server = fakeMultiServer({
    main: { "Faces/Portrait": { preset: "portrait" } },
    socks: { "Faces/Portrait": { preset: "other portrait" } },
  });

  await PresetGalleryAPI.renameFolder("Faces", "People", "socks");
  assert.deepEqual(server.getLibrary("socks"), { "People/Portrait": { preset: "other portrait" } });
  assert.deepEqual(server.getLibrary("main"), { "Faces/Portrait": { preset: "portrait" } });
});

// --- moveFolder ---

test("moveFolder moves a folder into another library and empties the source", async () => {
  const server = fakeMultiServer({
    main: { "Faces/Portrait": { preset: "p" }, "Faces/Macro": { preset: "m" }, Scenery: { preset: "s" } },
    socks: { "wear/sock/ankle": { preset: "a" } },
  });

  const res = await PresetGalleryAPI.moveFolder("Faces", "People", "socks", "main");
  assert.deepEqual(res, { success: true });
  assert.deepEqual(server.getLibrary("socks"), {
    "wear/sock/ankle": { preset: "a" },
    "People/Portrait": { preset: "p" },
    "People/Macro": { preset: "m" },
  });
  assert.deepEqual(server.getLibrary("main"), { Scenery: { preset: "s" } });
});

test("moveFolder moves a bare folder key (a colour-only entry) too", async () => {
  const server = fakeMultiServer({
    main: { Faces: { __color__: "#ff0000" }, "Faces/Portrait": { preset: "p" } },
    socks: {},
  });
  await PresetGalleryAPI.moveFolder("Faces", "People", "socks", "main");
  assert.deepEqual(server.getLibrary("socks"), {
    People: { __color__: "#ff0000" },
    "People/Portrait": { preset: "p" },
  });
  assert.deepEqual(server.getLibrary("main"), {});
});

test("moveFolder reports failure when the folder is not in the source library", async () => {
  const server = fakeMultiServer({ main: {}, socks: {} });
  const res = await PresetGalleryAPI.moveFolder("Ghost", "People", "socks", "main");
  assert.equal(res.success, false);
  assert.deepEqual(server.getLibrary("socks"), {}, "nothing was written");
  assert.deepEqual(server.getLibrary("main"), {});
});

test("moveFolder renames in place when no library is named", async () => {
  const server = fakeMultiServer({
    main: { "Faces/Portrait": { preset: "p" }, Scenery: { preset: "s" } },
  });
  await PresetGalleryAPI.moveFolder("Faces", "People");
  assert.deepEqual(server.getLibrary("main"), {
    "People/Portrait": { preset: "p" },
    Scenery: { preset: "s" },
  });
});

// --- savePreset moving between libraries ---

test("savePreset edits in place when the target is the library it came from", async () => {
  const server = fakeMultiServer({ main: { "faces/portrait": { preset: "p" } } });
  await save({
    name: "Portrait",
    folder: "Faces",
    presetText: "edited",
    imageData: null,
    clearImage: false,
    editingKey: "main#Faces/Portrait",
    mode: "edit",
    libraryId: "main",
    sourceLibraryId: "main",
  });
  assert.deepEqual(server.getLibrary("main"), { "faces/portrait": { preset: "edited" } });
});

test("savePreset deletes the original when the entry moves to another library", async () => {
  const server = fakeMultiServer({
    main: { "faces/portrait": { preset: "p" } },
    socks: { "wear/sock/ankle": { preset: "a" } },
  });
  await save({
    name: "Portrait",
    folder: "Faces",
    presetText: "moved",
    imageData: null,
    clearImage: false,
    editingKey: "main#faces/portrait",
    mode: "edit",
    libraryId: "socks",
    sourceLibraryId: "main",
  });
  assert.deepEqual(server.getLibrary("main"), {}, "the source no longer holds it");
  assert.deepEqual(server.getLibrary("socks"), {
    "wear/sock/ankle": { preset: "a" },
    "faces/portrait": { preset: "moved" },
  });
});

// --- removeLibrary ---

test("removeLibrary sends a DELETE to that library", async () => {
  const server = fakeMultiServer({ main: { "Faces/Portrait": { preset: "p" } }, socks: {} });
  const calls = server.calls.filter((c) => c.method === "DELETE");
  assert.equal(calls.length, 0, "no DELETE before the call");

  assert.equal(await PresetGalleryAPI.removeLibrary("socks"), true);
  assert.equal(server.calls.at(-1)?.method, "DELETE");
  assert.equal(server.calls.at(-1)?.url, "/preset_gallery/presets?library=socks");
});

test("removeLibrary refuses the bundled library and reports a failed request", async () => {
  const server = fakeMultiServer({ main: { "Faces/Portrait": { preset: "p" } } });
  assert.equal(await PresetGalleryAPI.removeLibrary("main"), false);
  // an omitted id is the bundled library, which is refused for the same reason
  assert.equal(await PresetGalleryAPI.removeLibrary(), false);
  assert.equal(server.calls.length, 0, "nothing was sent");
});

test("removeLibrary reports failure when the server refuses", async () => {
  globalThis.fetch = (async () => new Response("no", { status: 409 })) as typeof fetch;
  assert.equal(await PresetGalleryAPI.removeLibrary("socks"), false);
});
