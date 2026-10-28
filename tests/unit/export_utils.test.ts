import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import ExportUtils from "../../web/ExportUtils.js";
import ModalUtils from "../../web/ModalUtils.js";
import PresetGalleryAPI from "../../web/PresetGalleryAPI.js";

// ExportUtils.getSelectionSummary is pure; buildPresetSelectorTree builds a
// real checkbox tree, which needs a DOM. The harness is imported first so
// jsdom globals exist before ExportUtils is loaded.

// --- getSelectionSummary ---

test("getSelectionSummary counts everything as new without an existing library", () => {
  const summary = ExportUtils.getSelectionSummary(["A/One", "B/Two"], {
    "A/One": { preset: "a" },
    "B/Two": { preset: "b" },
  });
  assert.deepEqual(summary, {
    newCount: 2,
    replacedCount: 0,
    sameCount: 0,
    total: 2,
  });
});

test("getSelectionSummary classifies replaced, same and new against the existing library", () => {
  const summary = ExportUtils.getSelectionSummary(
    ["A/One", "B/Two", "C/Three", "D/Gone"],
    {
      "A/One": { preset: "a2" },
      "B/Two": { preset: "b" },
      "C/Three": { filename: "x.png" },
    },
    {
      "A/One": { preset: "a" },
      "B/Two": { preset: "b" },
      "C/Three": { filename: "y.png" },
    },
  );
  assert.deepEqual(summary, {
    newCount: 0,
    replacedCount: 2,
    sameCount: 1,
    total: 4,
  });
});

test("getSelectionSummary counts an unchanged preset as same, not new", () => {
  const summary = ExportUtils.getSelectionSummary(
    ["A/One"],
    { "A/One": { preset: "a" } },
    { "A/One": { preset: "a" } },
  );
  assert.equal(summary.sameCount, 1);
  assert.equal(summary.newCount, 0);
});

test("getSelectionSummary keeps missing keys in the total but in no bucket", () => {
  const summary = ExportUtils.getSelectionSummary(["A/One", "Missing"], {
    "A/One": { preset: "a" },
  });
  assert.equal(summary.total, 2);
  assert.equal(summary.newCount, 1);
});

// --- buildPresetSelectorTree ---

const PRESETS: PresetCache = {
  "Faces/Portrait": { preset: "portrait" },
  "Faces/Macro": { preset: "macro" },
  RootPreset: { preset: "root" },
  Ghost: { __color__: "#000000" },
};

function sorted(keys: string[]): string[] {
  return [...keys].sort();
}

test("buildPresetSelectorTree groups presets by folder and skips color-only entries", () => {
  const tree = ExportUtils.buildPresetSelectorTree(PRESETS);
  const groups = tree.element.querySelectorAll(".j0n4t-pg-tree-group");
  assert.equal(
    groups.length,
    2,
    "ghost folder has no content and is not rendered",
  );

  const names = Array.from(groups).map(
    (g) => g.querySelector(".j0n4t-pg-group-name")?.textContent ?? "",
  );
  assert.ok(
    names.some((n) => n.includes("Faces (2)")),
    `unexpected group names: ${names}`,
  );
  assert.ok(
    names.some((n) => n.includes("Root Presets (1)")),
    `unexpected group names: ${names}`,
  );

  const items = tree.element.querySelectorAll(".j0n4t-pg-tree-item");
  assert.equal(items.length, 3);
});

test("buildPresetSelectorTree checks every item when there is no existing library", () => {
  const tree = ExportUtils.buildPresetSelectorTree(PRESETS);
  assert.deepEqual(
    sorted(tree.getSelectedKeys()),
    ["Faces/Macro", "Faces/Portrait", "RootPreset"].sort(),
  );
});

test("buildPresetSelectorTree marks identical presets as same and leaves them unchecked", () => {
  const tree = ExportUtils.buildPresetSelectorTree(PRESETS, {
    "Faces/Portrait": { preset: "portrait" },
  });
  const portrait = tree.element.querySelector<HTMLInputElement>(
    '.j0n4t-pg-item-cb[value="Faces/Portrait"]',
  );
  assert.equal(portrait?.dataset.status, "same");
  assert.equal(portrait?.checked, false);

  const selected = tree.getSelectedKeys();
  assert.ok(!selected.includes("Faces/Portrait"));
  assert.equal(selected.length, 2);
});

test("buildPresetSelectorTree marks changed text as replaced and shows the diff", () => {
  const tree = ExportUtils.buildPresetSelectorTree(PRESETS, {
    "Faces/Portrait": { preset: "something else" },
  });
  const portrait = tree.element.querySelector<HTMLInputElement>(
    '.j0n4t-pg-item-cb[value="Faces/Portrait"]',
  );
  assert.equal(portrait?.dataset.status, "replaced");
  assert.equal(portrait?.checked, true);

  const row = portrait?.closest(".j0n4t-pg-tree-item");
  const details = row?.querySelector(".j0n4t-pg-details-container");
  assert.ok(details, "replaced items render a details container");
  const html = details?.innerHTML ?? "";
  assert.ok(html.includes("- Current:"), "diff shows the current text");
  assert.ok(html.includes("+ Imported:"), "diff shows the imported text");
});

test("buildPresetSelectorTree marks an image-only change as replaced", () => {
  const tree = ExportUtils.buildPresetSelectorTree(
    { "Faces/Portrait": { preset: "portrait", filename: "new.png" } },
    { "Faces/Portrait": { preset: "portrait", filename: "old.png" } },
  );
  const portrait = tree.element.querySelector<HTMLInputElement>(
    '.j0n4t-pg-item-cb[value="Faces/Portrait"]',
  );
  assert.equal(portrait?.dataset.status, "replaced");
});

test("buildPresetSelectorTree marks unknown presets as new and checks them", () => {
  const tree = ExportUtils.buildPresetSelectorTree(
    { "Faces/Portrait": { preset: "portrait" } },
    { RootPreset: { preset: "root" } },
  );
  const portrait = tree.element.querySelector<HTMLInputElement>(
    '.j0n4t-pg-item-cb[value="Faces/Portrait"]',
  );
  assert.equal(portrait?.dataset.status, "new");
  assert.equal(portrait?.checked, true);
});

// --- applyDuplicateStrategy ---

function buildDiffTree() {
  // Faces/Macro is replaced, Faces/Portrait and RootPreset are same
  return ExportUtils.buildPresetSelectorTree(PRESETS, {
    "Faces/Portrait": { preset: "portrait" },
    "Faces/Macro": { preset: "old macro" },
    RootPreset: { preset: "root" },
  });
}

function checkboxes(
  tree: ReturnType<typeof ExportUtils.buildPresetSelectorTree>,
) {
  return tree.element.querySelectorAll<HTMLInputElement>(".j0n4t-pg-item-cb");
}

test("applyDuplicateStrategy skip unchecks replaced and new but keeps user-modified items", () => {
  const tree = buildDiffTree();
  const macro = Array.from(checkboxes(tree)).find(
    (cb) => cb.value === "Faces/Macro",
  );
  assert.ok(macro);
  macro.dataset.userModified = "true";
  macro.checked = true;

  tree.applyDuplicateStrategy("skip");

  assert.equal(
    macro.checked,
    true,
    "a user-modified checkbox is never touched",
  );
  const selected = tree.getSelectedKeys();
  assert.ok(!selected.includes("Faces/Portrait"), "same items stay unchecked");
});

test("applyDuplicateStrategy overwrite checks only the replaced items", () => {
  const tree = buildDiffTree();
  tree.applyDuplicateStrategy("overwrite");
  assert.deepEqual(sorted(tree.getSelectedKeys()), ["Faces/Macro"]);
});

test("applyDuplicateStrategy keep_both checks every non-user-modified item", () => {
  const tree = buildDiffTree();
  tree.applyDuplicateStrategy("keep_both");
  assert.deepEqual(sorted(tree.getSelectedKeys()), [
    "Faces/Macro",
    "Faces/Portrait",
    "RootPreset",
  ]);
});

test("getPresets returns the map the tree was built with", () => {
  const tree = ExportUtils.buildPresetSelectorTree(PRESETS);
  assert.equal(tree.getPresets(), PRESETS);
});

test("export modal switches libraries and reports the selected library", async () => {
  const originalFetchLibraries = PresetGalleryAPI.fetchLibraries;
  const originalGetPresets = PresetGalleryAPI.getPresets;
  const originalConfirm = ModalUtils.confirm;
  let exportedConfig:
    | { libraryId?: string; selectedKeys?: string[] | null }
    | undefined;

  try {
    PresetGalleryAPI.fetchLibraries = async () => [
      { id: "main", name: "Main", default: true },
      { id: "second", name: "Second", default: false },
    ];
    PresetGalleryAPI.getPresets = async (libraryId) => {
      const presets: PresetCache = {};
      presets[libraryId === "second" ? "Second" : "First"] = {
        preset: libraryId === "second" ? "second" : "first",
      };
      return presets;
    };
    ModalUtils.confirm = async () => true;

    await ExportUtils.showExportModal("main", (config) => {
      exportedConfig = config;
    });

    const librarySelect = document.querySelector<HTMLSelectElement>(
      "#j0n4t-pg-exp-library",
    );
    assert.ok(librarySelect);
    librarySelect.value = "second";
    librarySelect.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const selectedPreset = document.querySelector<HTMLInputElement>(
      '.j0n4t-pg-item-cb[value="Second"]',
    );
    assert.ok(selectedPreset);
    document.querySelector<HTMLButtonElement>("#j0n4t-pg-exp-confirm")?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(exportedConfig?.libraryId, "second");
    assert.deepEqual(exportedConfig?.selectedKeys, ["Second"]);
  } finally {
    PresetGalleryAPI.fetchLibraries = originalFetchLibraries;
    PresetGalleryAPI.getPresets = originalGetPresets;
    ModalUtils.confirm = originalConfirm;
    document
      .querySelectorAll(".j0n4t-pg-modal-overlay")
      .forEach((overlay) => overlay.remove());
  }
});

test("import modal compares against and targets the selected library", async () => {
  const originalFetchLibraries = PresetGalleryAPI.fetchLibraries;
  const originalGetPresets = PresetGalleryAPI.getPresets;
  const originalConfirm = ModalUtils.confirm;
  let importTarget: string | undefined;

  try {
    PresetGalleryAPI.fetchLibraries = async () => [
      { id: "main", name: "Main", default: true },
      { id: "second", name: "Second", default: false },
    ];
    PresetGalleryAPI.getPresets = async (libraryId) => {
      const presets: PresetCache = {};
      if (libraryId === "main") presets.Imported = { preset: "existing" };
      return presets;
    };
    ModalUtils.confirm = async () => true;

    await ExportUtils.showImportModal(
      { Imported: { preset: "new" } },
      "main",
      ({ libraryId }) => {
        importTarget = libraryId;
      },
    );

    assert.match(
      document.querySelector("#j0n4t-pg-dup-label")?.textContent ?? "",
      /1 detected/,
    );
    const librarySelect = document.querySelector<HTMLSelectElement>(
      "#j0n4t-pg-imp-library",
    );
    assert.ok(librarySelect);
    librarySelect.value = "second";
    librarySelect.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.match(
      document.querySelector("#j0n4t-pg-dup-label")?.textContent ?? "",
      /0 detected/,
    );
    document.querySelector<HTMLButtonElement>("#j0n4t-pg-imp-confirm")?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(importTarget, "second");
  } finally {
    PresetGalleryAPI.fetchLibraries = originalFetchLibraries;
    PresetGalleryAPI.getPresets = originalGetPresets;
    ModalUtils.confirm = originalConfirm;
    document
      .querySelectorAll(".j0n4t-pg-modal-overlay")
      .forEach((overlay) => overlay.remove());
  }
});

test("import modal can target a new library", async () => {
  const originalFetchLibraries = PresetGalleryAPI.fetchLibraries;
  const originalGetPresets = PresetGalleryAPI.getPresets;
  const originalConfirm = ModalUtils.confirm;
  const originalPrompt = ModalUtils.prompt;
  let importTarget: string | undefined;

  try {
    PresetGalleryAPI.fetchLibraries = async () => [
      { id: "main", name: "Main", default: true },
    ];
    PresetGalleryAPI.getPresets = async () => ({});
    ModalUtils.confirm = async () => true;
    ModalUtils.prompt = async () => "new_styles";

    await ExportUtils.showImportModal(
      { Imported: { preset: "new" } },
      "main",
      ({ libraryId }) => {
        importTarget = libraryId;
      },
    );

    const librarySelect = document.querySelector<HTMLSelectElement>(
      "#j0n4t-pg-imp-library",
    );
    assert.ok(librarySelect);
    librarySelect.value = "__create_new_library__";
    librarySelect.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(librarySelect.value, "new_styles");
    assert.ok(librarySelect.querySelector('option[value="new_styles"]'));
    document.querySelector<HTMLButtonElement>("#j0n4t-pg-imp-confirm")?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(importTarget, "new_styles");
  } finally {
    PresetGalleryAPI.fetchLibraries = originalFetchLibraries;
    PresetGalleryAPI.getPresets = originalGetPresets;
    ModalUtils.confirm = originalConfirm;
    ModalUtils.prompt = originalPrompt;
    document
      .querySelectorAll(".j0n4t-pg-modal-overlay")
      .forEach((overlay) => overlay.remove());
  }
});

test("renaming a nested folder uses and preserves its slash-separated path", () => {
  const originalPrompt = globalThis.prompt;
  let promptDefault: string | undefined;
  const presets: PresetCache = {
    "Faces/Portraits/Studio": { preset: "studio" },
    "Faces/Portraits": { __color__: "#ff0000" },
  };

  try {
    globalThis.prompt = (_message, defaultValue) => {
      promptDefault = defaultValue;
      return "Faces/Editorial";
    };
    const tree = ExportUtils.buildPresetSelectorTree(presets);
    const group = Array.from(
      tree.element.querySelectorAll(".j0n4t-pg-tree-group"),
    ).find(
      (element) =>
        element.querySelector<HTMLInputElement>(".j0n4t-pg-group-cb")?.dataset
          .group === "Faces/Portraits",
    );
    assert.ok(group);
    group.querySelector<HTMLElement>(".j0n4t-pg-edit-group-btn")?.click();

    assert.equal(promptDefault, "Faces/Portraits");
    assert.equal(
      group.querySelector<HTMLInputElement>(".j0n4t-pg-item-cb")?.value,
      "faces/editorial/Studio",
    );
    assert.equal(presets["faces/editorial/Studio"]?.preset, "studio");
    assert.equal(presets["faces/editorial"]?.__color__, "#ff0000");
    assert.equal(presets["Faces/Portraits/Studio"], undefined);
  } finally {
    globalThis.prompt = originalPrompt;
  }
});
