import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import ExportUtils from "../../web/ExportUtils.js";

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
        fakeZip({ "manifest.json": JSON.stringify({ version: 99 }) }),
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
    bundle.libraries[0].presets["Faces/Portrait"]?.preset,
    "portrait",
  );
});
