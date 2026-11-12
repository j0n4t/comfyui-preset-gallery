import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import ExportUtils from "../../web/ExportUtils.js";
import ModalUtils from "../../web/ModalUtils.js";
import PresetGalleryAPI from "../../web/PresetGalleryAPI.js";

// A bundle is assembled from a plain record and read back through a fake zip,
// so no zip library is needed: `buildBundleEntries` produces the file table and
// `readBundleFromZip` only reads `zip.files`.

function fakeZip(entries: Record<string, string | { base64: string }>) {
  return {
    files: Object.fromEntries(
      Object.entries(entries).map(([path, contents]) => [
        path,
        {
          dir: false,
          async: async () =>
            typeof contents === "string" ? contents : contents.base64,
        },
      ]),
    ),
  };
}

test("buildBundleManifest records the version, layout and libraries", () => {
  const manifest = ExportUtils.buildBundleManifest(
    [
      { id: "main", name: "Main" },
      { id: "styles", name: "Styles" },
    ],
    "files",
  );

  assert.deepEqual(manifest, {
    version: 1,
    layout: "files",
    libraries: [
      { id: "main", name: "Main" },
      { id: "styles", name: "Styles" },
    ],
  });
});

test("bundleLayout names the zip format after the files it stores", () => {
  assert.equal(ExportUtils.bundleLayout("zip"), "files");
  assert.equal(ExportUtils.bundleLayout("json"), "json");
  assert.equal(ExportUtils.bundleLayout("yaml"), "yaml");
});

test("buildBundleEntries namespaces the single-library layout per library", () => {
  const presets: PresetCache = {
    "Faces/Portrait": { preset: "portrait" },
    Faces: { __color__: "#ff0000" },
  };
  const entries = ExportUtils.buildBundleEntries(
    [{ id: "main", name: "Main" }],
    { main: presets },
    "zip",
    "full",
    true,
  );

  const single: Record<string, string> = {};
  ExportUtils.addPresetZipEntries(
    {
      file: (path: string, contents: string) => {
        single[path] = contents;
      },
    },
    "",
    ExportUtils.filterExportPresets(presets, null, true),
    "full",
    true,
  );

  for (const [path, contents] of Object.entries(single)) {
    assert.equal(entries[`main/${path}`], contents, `missing main/${path}`);
  }
  assert.equal(entries["main/Faces/Portrait.txt"], "portrait");
  assert.equal(entries["main/Faces/__color__.txt"], "#ff0000");
  assert.ok(entries["manifest.json"], "the manifest is always written");
});

test("buildBundleEntries writes one document per library for json and yaml", () => {
  const caches = { main: { "Faces/Portrait": { preset: "portrait" } } };

  const jsonEntries = ExportUtils.buildBundleEntries(
    [{ id: "main", name: "Main" }],
    caches,
    "json",
    "full",
    true,
  );
  assert.deepEqual(
    JSON.parse(jsonEntries["libraries/main.json"] as string),
    { "Faces/Portrait": { preset: "portrait" } },
  );

  const yamlEntries = ExportUtils.buildBundleEntries(
    [{ id: "main", name: "Main" }],
    caches,
    "yaml",
    "full",
    true,
  );
  assert.match(yamlEntries["libraries/main.yaml"] as string, /portrait/);
});

test("serializeLibraryFile keeps images out of a preset-only document", () => {
  const presets: PresetCache = {
    Root: { preset: "root", filename: "data:image/png;base64,AAAA" },
  };

  const presetOnly = ExportUtils.serializeLibraryFile(presets, "json", "preset-only");
  assert.equal(presetOnly.includes("data:image"), false);

  const full = ExportUtils.serializeLibraryFile(presets, "json", "full");
  assert.match(full, /data:image\/png;base64,AAAA/);
});

test("readBundleFromZip returns null for an archive without a manifest", async () => {
  const bundle = await ExportUtils.readBundleFromZip(
    fakeZip({ "Faces/Portrait.txt": "portrait" }),
  );

  assert.equal(bundle, null);
});

test("readBundleFromZip treats an unparseable manifest as not a bundle", async () => {
  const bundle = await ExportUtils.readBundleFromZip(
    fakeZip({ "manifest.json": "not json" }),
  );

  assert.equal(bundle, null);
});

test("readBundleFromZip rejects a manifest it does not understand", async () => {
  await assert.rejects(
    () =>
      ExportUtils.readBundleFromZip(
        fakeZip({
          "manifest.json": JSON.stringify({
            version: 99,
            layout: "files",
            libraries: [],
          }),
        }),
      ),
    /Unsupported or corrupt/,
  );
});

test("readBundleFromZip reads per-library files and colours", async () => {
  const entries = ExportUtils.buildBundleEntries(
    [{ id: "main", name: "Main" }],
    {
      main: {
        "Faces/Portrait": { preset: "portrait" },
        Faces: { __color__: "#ff0000" },
      },
    },
    "zip",
    "full",
    true,
  );

  const bundle = await ExportUtils.readBundleFromZip(fakeZip(entries));

  assert.ok(bundle);
  assert.equal(bundle.layout, "files");
  assert.equal(bundle.libraries.length, 1);
  assert.equal(bundle.libraries[0].id, "main");
  assert.equal(bundle.libraries[0].name, "Main");
  // The zip layout normalises keys the way the single-library import always has.
  assert.equal(bundle.libraries[0].presets["faces/portrait"]?.preset, "portrait");
  assert.equal(bundle.libraries[0].presets["faces"]?.__color__, "#ff0000");
});

test("a json bundle round-trips through the same parser as a single-library file", async () => {
  const entries = ExportUtils.buildBundleEntries(
    [{ id: "styles", name: "Styles" }],
    { styles: { "Faces/Portrait": { preset: "portrait" } } },
    "json",
    "full",
    true,
  );

  const bundle = await ExportUtils.readBundleFromZip(fakeZip(entries));

  assert.ok(bundle);
  assert.equal(bundle.layout, "json");
  assert.equal(bundle.libraries[0].id, "styles");
  assert.equal(
    bundle.libraries[0].presets["faces/portrait"]?.preset,
    "portrait",
  );
});

test("presetsFromDocument normalizes keys the way every other write does", async () => {
  const presets = await ExportUtils.presetsFromDocument(
    JSON.stringify({
      Faces: { Portrait: "portrait", __color__: "#ff0000" },
      "Urban Night": "night",
    }),
    "json",
  );

  assert.deepEqual(presets, {
    "faces/portrait": { preset: "portrait" },
    faces: { __color__: "#ff0000" },
    urban_night: { preset: "night" },
  });
});

test("presetsFromDocument normalizes a yaml import the same way", async () => {
  const presets = await ExportUtils.presetsFromDocument(
    "Faces:\n  Portrait: portrait\n",
    "yaml",
  );

  assert.deepEqual(presets, { "faces/portrait": { preset: "portrait" } });
});

// --- bundle import routing ---

type SavedWrite = { libraryId: string; presets: PresetCache };

type StubOptions = {
  libraries: Array<{ id: string; name: string; default: boolean }>;
  entries: Record<string, string | { base64: string }>;
};

/**
 * Stand in for the server and the zip library: the archive is a fixed set of
 * entries, every library reads back empty, and every write is recorded.
 */
function stubBundleImport(options: StubOptions) {
  const win = window as unknown as { JSZip?: unknown };
  const originalJSZip = win.JSZip;
  const originalFetchLibraries = PresetGalleryAPI.fetchLibraries;
  const originalFetchCaches = PresetGalleryAPI.fetchLibraryCaches;
  const originalGetPresets = PresetGalleryAPI.getPresets;
  const originalSavePresets = PresetGalleryAPI.savePresets;
  const originalConfirm = ModalUtils.confirm;

  const writes: SavedWrite[] = [];
  win.JSZip = { loadAsync: async () => fakeZip(options.entries) };
  PresetGalleryAPI.fetchLibraries = async () => options.libraries;
  PresetGalleryAPI.fetchLibraryCaches = async () =>
    Object.fromEntries(options.libraries.map((library) => [library.id, {}]));
  PresetGalleryAPI.getPresets = async () => ({});
  PresetGalleryAPI.savePresets = async (presets: PresetCache, libraryId = "main") => {
    writes.push({ libraryId, presets });
    return { success: true };
  };
  ModalUtils.confirm = async () => true;

  return {
    writes,
    restore: () => {
      win.JSZip = originalJSZip;
      PresetGalleryAPI.fetchLibraries = originalFetchLibraries;
      PresetGalleryAPI.fetchLibraryCaches = originalFetchCaches;
      PresetGalleryAPI.getPresets = originalGetPresets;
      PresetGalleryAPI.savePresets = originalSavePresets;
      ModalUtils.confirm = originalConfirm;
      document
        .querySelectorAll(".j0n4t-pg-modal-overlay")
        .forEach((overlay) => overlay.remove());
    },
  };
}

test("importFile routes a bundle zip through the bundle dialog", async () => {
  const entries = ExportUtils.buildBundleEntries(
    [
      { id: "main", name: "Main" },
      { id: "styles", name: "Styles" },
    ],
    {
      main: { "Faces/Portrait": { preset: "portrait" } },
      styles: { "Urban/Night": { preset: "night" } },
    },
    "zip",
    "full",
    true,
  );
  const stub = stubBundleImport({
    libraries: [
      { id: "main", name: "Main", default: true },
      { id: "styles", name: "Styles", default: false },
    ],
    entries,
  });

  try {
    const promise = ExportUtils.importFile(
      { name: "bundle.zip" } as unknown as File,
      "main",
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const confirmBtn = document.querySelector<HTMLButtonElement>(
      "#j0n4t-pg-bimp-confirm",
    );
    assert.ok(confirmBtn, "the bundle dialog is showing");
    confirmBtn.click();

    const result = await promise;
    assert.equal(result.success, true);
    // Each library is restored under its own id, and the zip layout
    // normalises keys the way the single-library import always has.
    assert.deepEqual(
      stub.writes.map((write) => write.libraryId),
      ["main", "styles"],
    );
    assert.equal(stub.writes[0].presets["faces/portrait"]?.preset, "portrait");
    assert.equal(stub.writes[1].presets["urban/night"]?.preset, "night");
  } finally {
    stub.restore();
  }
});

test("a bundle row can target another library", async () => {
  const entries = ExportUtils.buildBundleEntries(
    [{ id: "main", name: "Main" }],
    { main: { "Faces/Portrait": { preset: "portrait" } } },
    "zip",
    "full",
    true,
  );
  const stub = stubBundleImport({
    libraries: [
      { id: "main", name: "Main", default: true },
      { id: "second", name: "Second", default: false },
    ],
    entries,
  });

  try {
    const promise = ExportUtils.importFile(
      { name: "bundle.zip" } as unknown as File,
      "main",
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const target = document.querySelector<HTMLSelectElement>(
      ".j0n4t-pg-bundle-target",
    );
    assert.ok(target, "the bundle dialog lists a target per library");
    target.value = "second";
    target.dispatchEvent(new Event("change"));
    document.querySelector<HTMLButtonElement>("#j0n4t-pg-bimp-confirm")?.click();

    const result = await promise;
    assert.equal(result.success, true);
    assert.deepEqual(
      stub.writes.map((write) => write.libraryId),
      ["second"],
    );
  } finally {
    stub.restore();
  }
});

test("a bundle dialog imports only the presets checked in its tree", async () => {
  const entries = ExportUtils.buildBundleEntries(
    [
      { id: "main", name: "Main" },
      { id: "styles", name: "Styles" },
    ],
    {
      main: {
        "faces/portrait": { preset: "portrait" },
        "faces/macro": { preset: "macro" },
      },
      styles: { "urban/night": { preset: "night" } },
    },
    "json",
    "full",
    true,
  );
  const stub = stubBundleImport({
    libraries: [
      { id: "main", name: "Main", default: true },
      { id: "styles", name: "Styles", default: false },
    ],
    entries,
  });

  try {
    const promise = ExportUtils.importFile(
      { name: "bundle.zip" } as unknown as File,
      "main",
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const boxes = document.querySelectorAll<HTMLInputElement>(
      "#j0n4t-pg-bimp-tree .j0n4t-pg-item-cb",
    );
    assert.equal(
      boxes.length,
      3,
      "the dialog lists every preset of every library",
    );
    for (const box of boxes) {
      if (box.value === "faces/portrait") continue;
      box.checked = false;
      box.dispatchEvent(new Event("change"));
    }

    document.querySelector<HTMLButtonElement>("#j0n4t-pg-bimp-confirm")?.click();

    const result = await promise;
    assert.equal(result.success, true);
    assert.equal(
      stub.writes.length,
      1,
      "a library with nothing selected is not written",
    );
    assert.deepEqual(Object.keys(stub.writes[0].presets), ["faces/portrait"]);
  } finally {
    stub.restore();
  }
});

test("a zip without a manifest still uses the single-library import", async () => {
  const stub = stubBundleImport({
    libraries: [{ id: "main", name: "Main", default: true }],
    entries: { "Faces/Portrait.txt": "portrait" },
  });
  const originalShowImportModal = ExportUtils.showImportModal;
  let captured: { presets?: PresetCache; libraryId?: string } = {};

  try {
    ExportUtils.showImportModal = async (presets, libraryId, onConfirm) => {
      captured = { presets, libraryId };
      await onConfirm({
        selectedKeys: Object.keys(presets),
        duplicateStrategy: "overwrite",
        importColors: true,
        editedPresets: presets,
        libraryId,
      });
    };

    const result = await ExportUtils.importFile(
      { name: "single.zip" } as unknown as File,
      "main",
    );

    assert.equal(result.success, true);
    assert.equal(captured.libraryId, "main");
    assert.equal(captured.presets?.["faces/portrait"]?.preset, "portrait");
    assert.deepEqual(
      stub.writes.map((write) => write.libraryId),
      ["main"],
    );
  } finally {
    ExportUtils.showImportModal = originalShowImportModal;
    stub.restore();
  }
});

test("buildBundleEntries honours a per-library selection and drops empty libraries", () => {
  const caches = {
    main: {
      "Faces/Portrait": { preset: "portrait" },
      "Faces/Macro": { preset: "macro" },
    },
    styles: { "Urban/Night": { preset: "night" } },
  };

  const entries = ExportUtils.buildBundleEntries(
    [
      { id: "main", name: "Main" },
      { id: "styles", name: "Styles" },
    ],
    caches,
    "json",
    "full",
    true,
    { main: ["Faces/Portrait"], styles: [] },
  );

  assert.deepEqual(
    JSON.parse(entries["libraries/main.json"] as string),
    { "Faces/Portrait": { preset: "portrait" } },
  );
  assert.equal(
    entries["libraries/styles.json"],
    undefined,
    "a library with nothing selected is left out",
  );
  assert.deepEqual(
    JSON.parse(entries["manifest.json"] as string).libraries,
    [{ id: "main", name: "Main" }],
    "the manifest lists only the libraries that made it into the bundle",
  );
});

// --- buildBundleSelectorTree ---

test("buildBundleSelectorTree puts one preset tree under each library row", () => {
  const tree = ExportUtils.buildBundleSelectorTree({
    libraries: [
      { id: "main", name: "Main" },
      { id: "styles", name: "Styles" },
    ],
    cachesById: {
      main: { "Faces/Portrait": { preset: "portrait" } },
      styles: { "Urban/Night": { preset: "night" } },
    },
  });

  assert.deepEqual(
    tree.rows.map((row) => row.id),
    ["main", "styles"],
  );
  assert.equal(
    tree.element.querySelectorAll(".j0n4t-pg-bundle-group").length,
    2,
    "one group row per library",
  );
  assert.equal(
    tree.element.querySelectorAll(".j0n4t-pg-item-cb").length,
    2,
    "every library's presets are listed",
  );
  assert.deepEqual(tree.getSelectedKeysByLibrary(), {
    main: ["Faces/Portrait"],
    styles: ["Urban/Night"],
  });
});

test("a library header checkbox toggles its whole subtree", () => {
  const tree = ExportUtils.buildBundleSelectorTree({
    libraries: [{ id: "main", name: "Main" }],
    cachesById: {
      main: {
        "Faces/Portrait": { preset: "portrait" },
        "Faces/Macro": { preset: "macro" },
      },
    },
  });

  const header = tree.element.querySelector<HTMLInputElement>(
    ".j0n4t-pg-bundle-lib-cb",
  );
  assert.ok(header, "the library row carries a checkbox");
  header.checked = false;
  header.dispatchEvent(new Event("change"));

  assert.equal(header.checked, false, "the header follows its subtree");
  assert.equal(header.indeterminate, false);
  assert.deepEqual(tree.getSelectedKeysByLibrary(), { main: [] });
});

test("the master checkbox clears every library", () => {
  const tree = ExportUtils.buildBundleSelectorTree({
    libraries: [
      { id: "main", name: "Main" },
      { id: "styles", name: "Styles" },
    ],
    cachesById: {
      main: { "Faces/Portrait": { preset: "portrait" } },
      styles: { "Urban/Night": { preset: "night" } },
    },
  });

  const master = tree.element.querySelector<HTMLInputElement>(
    "#j0n4t-pg-bundle-sel-all",
  );
  assert.ok(master);
  master.checked = false;
  master.dispatchEvent(new Event("change"));

  assert.deepEqual(tree.getSelectedKeysByLibrary(), { main: [], styles: [] });
});

test("the bundle tree adds a target and strategy per library when asked", () => {
  const tree = ExportUtils.buildBundleSelectorTree({
    libraries: [{ id: "main", name: "Main" }],
    cachesById: { main: { "Faces/Portrait": { preset: "portrait" } } },
    served: [
      { id: "main", name: "Main" },
      { id: "second", name: "Second" },
    ],
    importControls: true,
  });

  const target = tree.element.querySelector<HTMLSelectElement>(
    ".j0n4t-pg-bundle-target",
  );
  assert.ok(target, "the library row carries a target");
  assert.deepEqual(
    Array.from(target.options).map((option) => option.value),
    ["restore", "skip", "second", "__create_new_library__"],
    "the last entry asks for a new library",
  );
  assert.ok(
    tree.element.querySelector(".j0n4t-pg-bundle-strategy"),
    "the library row carries a duplicate strategy",
  );

  target.value = "second";
  target.dispatchEvent(new Event("change"));
  assert.equal(tree.rows[0].target, "second");
});

test("the bundle tree can import a library under a new name", async () => {
  const originalPrompt = ModalUtils.prompt;
  try {
    ModalUtils.prompt = async () => "portrait_pack";
    const tree = ExportUtils.buildBundleSelectorTree({
      libraries: [{ id: "main", name: "Main" }],
      cachesById: { main: { "faces/portrait": { preset: "portrait" } } },
      existingCachesById: { second: { "faces/portrait": { preset: "old" } } },
      served: [
        { id: "main", name: "Main" },
        { id: "second", name: "Second" },
      ],
      importControls: true,
    });

    const target = tree.element.querySelector<HTMLSelectElement>(
      ".j0n4t-pg-bundle-target",
    );
    assert.ok(target);
    target.value = "__create_new_library__";
    target.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(tree.rows[0].target, "portrait_pack");
    assert.equal(target.value, "portrait_pack");
    assert.ok(
      Array.from(target.options).some(
        (option) => option.value === "portrait_pack",
      ),
      "the new library becomes a real option once named",
    );
  } finally {
    ModalUtils.prompt = originalPrompt;
  }
});

test("cancelling the new-library prompt leaves the target alone", async () => {
  const originalPrompt = ModalUtils.prompt;
  try {
    ModalUtils.prompt = async () => null;
    const tree = ExportUtils.buildBundleSelectorTree({
      libraries: [{ id: "main", name: "Main" }],
      cachesById: { main: { "faces/portrait": { preset: "portrait" } } },
      served: [{ id: "main", name: "Main" }],
      importControls: true,
    });

    const target = tree.element.querySelector<HTMLSelectElement>(
      ".j0n4t-pg-bundle-target",
    );
    assert.ok(target);
    target.value = "__create_new_library__";
    target.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(tree.rows[0].target, "restore", "the target is unchanged");
    assert.equal(target.value, "restore", "the dropdown snaps back");
  } finally {
    ModalUtils.prompt = originalPrompt;
  }
});

test("an invalid new-library name is refused", async () => {
  const originalPrompt = ModalUtils.prompt;
  const originalAlert = ModalUtils.alert;
  /** @type {string[]} */
  const alerts = [];
  try {
    ModalUtils.prompt = async () => "bad name";
    ModalUtils.alert = (async (message: string) => {
      alerts.push(message);
    }) as typeof ModalUtils.alert;
    const tree = ExportUtils.buildBundleSelectorTree({
      libraries: [{ id: "main", name: "Main" }],
      cachesById: { main: { "faces/portrait": { preset: "portrait" } } },
      served: [{ id: "main", name: "Main" }],
      importControls: true,
    });

    const target = tree.element.querySelector<HTMLSelectElement>(
      ".j0n4t-pg-bundle-target",
    );
    assert.ok(target);
    target.value = "__create_new_library__";
    target.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(tree.rows[0].target, "restore");
    assert.equal(target.value, "restore");
    assert.equal(alerts.length, 1, "the reason is reported");
  } finally {
    ModalUtils.prompt = originalPrompt;
    ModalUtils.alert = originalAlert;
  }
});

test("a new-library name that is already taken is refused", async () => {
  const originalPrompt = ModalUtils.prompt;
  const originalAlert = ModalUtils.alert;
  /** @type {string[]} */
  const alerts = [];
  try {
    ModalUtils.prompt = async () => "second";
    ModalUtils.alert = (async (message: string) => {
      alerts.push(message);
    }) as typeof ModalUtils.alert;
    const tree = ExportUtils.buildBundleSelectorTree({
      libraries: [
        { id: "main", name: "Main" },
        { id: "styles", name: "Styles" },
      ],
      cachesById: { main: { "faces/portrait": { preset: "portrait" } } },
      served: [
        { id: "main", name: "Main" },
        { id: "second", name: "Second" },
      ],
      importControls: true,
    });

    const target = tree.element.querySelector<HTMLSelectElement>(
      ".j0n4t-pg-bundle-target",
    );
    assert.ok(target);
    target.value = "__create_new_library__";
    target.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(tree.rows[0].target, "restore");
    assert.equal(target.value, "restore");
    assert.equal(alerts.length, 1, "the collision is reported");
  } finally {
    ModalUtils.prompt = originalPrompt;
    ModalUtils.alert = originalAlert;
  }
});

test("a bundle dialog can import a library under a new name", async () => {
  const entries = ExportUtils.buildBundleEntries(
    [{ id: "main", name: "Main" }],
    { main: { "faces/portrait": { preset: "portrait" } } },
    "json",
    "full",
    true,
  );
  const stub = stubBundleImport({
    libraries: [{ id: "main", name: "Main", default: true }],
    entries,
  });
  const originalPrompt = ModalUtils.prompt;

  try {
    ModalUtils.prompt = async () => "portrait_pack";
    const promise = ExportUtils.importFile(
      { name: "bundle.zip" } as unknown as File,
      "main",
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const target = document.querySelector<HTMLSelectElement>(
      "#j0n4t-pg-bimp-tree .j0n4t-pg-bundle-target",
    );
    assert.ok(target, "the dialog lists a target per library");
    target.value = "__create_new_library__";
    target.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    document.querySelector<HTMLButtonElement>("#j0n4t-pg-bimp-confirm")?.click();

    const result = await promise;
    assert.equal(result.success, true);
    assert.deepEqual(
      stub.writes.map((write) => write.libraryId),
      ["portrait_pack"],
      "the library is written under its new name",
    );
  } finally {
    ModalUtils.prompt = originalPrompt;
    stub.restore();
  }
});

test("changing the target rebuilds the tree and keeps the user's selection", () => {
  const tree = ExportUtils.buildBundleSelectorTree({
    libraries: [{ id: "main", name: "Main" }],
    cachesById: { main: { "Faces/Portrait": { preset: "portrait" } } },
    existingCachesById: {
      second: { "Faces/Portrait": { preset: "old" } },
    },
    served: [
      { id: "main", name: "Main" },
      { id: "second", name: "Second" },
    ],
    importControls: true,
  });

  const box = tree.element.querySelector<HTMLInputElement>(
    ".j0n4t-pg-item-cb",
  );
  assert.ok(box);
  box.checked = false;
  box.dispatchEvent(new Event("change"));

  const target = tree.element.querySelector<HTMLSelectElement>(
    ".j0n4t-pg-bundle-target",
  );
  assert.ok(target);
  target.value = "second";
  target.dispatchEvent(new Event("change"));

  const rebuilt = tree.element.querySelector<HTMLInputElement>(
    ".j0n4t-pg-item-cb",
  );
  assert.ok(rebuilt, "the tree is rebuilt against the new target");
  assert.equal(
    rebuilt.checked,
    false,
    "the user's choice survives the rebuild",
  );
  assert.deepEqual(tree.getSelectedKeysByLibrary(), { main: [] });
});
