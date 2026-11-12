import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import ExportUtils from "../../web/ExportUtils.js";
import ModalUtils from "../../web/ModalUtils.js";
import PresetGalleryAPI from "../../web/PresetGalleryAPI.js";

// ExportUtils.getSelectionSummary is pure; buildPresetSelectorTree builds a
// real checkbox tree, which needs a DOM. The harness is imported first so
// jsdom globals exist before ExportUtils is loaded.

// --- getExportStem ---

test("getExportStem keeps a plain library name", () => {
  assert.equal(ExportUtils.getExportStem("Main"), "Main");
});

test("getExportStem sanitizes spaces and punctuation to underscores", () => {
  assert.equal(ExportUtils.getExportStem("Sdxl Styles"), "Sdxl_Styles");
  assert.equal(ExportUtils.getExportStem("my--lib  v2!"), "my_lib_v2");
});

test("getExportStem falls back to presets when nothing usable remains", () => {
  assert.equal(ExportUtils.getExportStem(), "presets");
  assert.equal(ExportUtils.getExportStem("  --  "), "presets");
});

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

test("buildPresetSelectorTree nested drops its own controls and scroll cap", () => {
  const tree = ExportUtils.buildPresetSelectorTree(PRESETS, null, {
    nested: true,
  });

  assert.equal(
    tree.element.querySelector(".j0n4t-pg-selector-controls"),
    null,
    "a nested tree brings no select-all of its own",
  );
  assert.equal(tree.element.querySelector("#j0n4t-pg-sel-all"), null);
  assert.equal(
    tree.element.querySelectorAll(".j0n4t-pg-item-cb").length,
    3,
    "the nested tree still lists every preset",
  );
  assert.equal(tree.element.style.maxHeight, "none");
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

test("import modal compares against the row's library", async () => {
  const originalFetchLibraries = PresetGalleryAPI.fetchLibraries;
  const originalGetPresets = PresetGalleryAPI.getPresets;
  const originalFetchCaches = PresetGalleryAPI.fetchLibraryCaches;
  const originalConfirm = ModalUtils.confirm;
  const originalPrompt = ModalUtils.prompt;
  let importTarget: string | undefined;

  try {
    PresetGalleryAPI.fetchLibraries = async () => [
      { id: "main", name: "Main", default: true },
      { id: "second", name: "Second", default: false },
    ];
    const held: Record<string, PresetCache> = {
      main: { Imported: { preset: "existing" } },
      second: {},
    };
    PresetGalleryAPI.getPresets = async (libraryId) =>
      held[libraryId ?? ""] ?? {};
    PresetGalleryAPI.fetchLibraryCaches = async () => ({ ...held });
    ModalUtils.confirm = async () => true;

    await ExportUtils.showImportModal(
      { Imported: { preset: "new" } },
      "main",
      ({ rows }) => {
        importTarget = rows[0].name;
      },
    );

    // main already holds Imported, so the row reports the duplicate
    assert.match(
      document.querySelector(".j0n4t-pg-bundle-consequence")?.textContent ??
        "",
      /merges into Main · 1 preset, 1 duplicate/,
    );

    // renaming the row to a library that does not hold it clears the duplicate
    ModalUtils.prompt = async () => "second";
    document
      .querySelector<HTMLElement>(".j0n4t-pg-bundle-rename")
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.match(
      document.querySelector(".j0n4t-pg-bundle-consequence")?.textContent ??
        "",
      /merges into Second · 1 preset, 0 duplicates/,
    );

    document
      .querySelector<HTMLButtonElement>("#j0n4t-pg-imp-confirm")
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(importTarget, "second");
  } finally {
    PresetGalleryAPI.fetchLibraries = originalFetchLibraries;
    PresetGalleryAPI.getPresets = originalGetPresets;
    PresetGalleryAPI.fetchLibraryCaches = originalFetchCaches;
    ModalUtils.confirm = originalConfirm;
    ModalUtils.prompt = originalPrompt;
    document
      .querySelectorAll(".j0n4t-pg-modal-overlay")
      .forEach((overlay) => overlay.remove());
  }
});

test("import modal can target a new library", async () => {
  const originalFetchLibraries = PresetGalleryAPI.fetchLibraries;
  const originalGetPresets = PresetGalleryAPI.getPresets;
  const originalFetchCaches = PresetGalleryAPI.fetchLibraryCaches;
  const originalConfirm = ModalUtils.confirm;
  const originalPrompt = ModalUtils.prompt;
  let importTarget: string | undefined;

  try {
    PresetGalleryAPI.fetchLibraries = async () => [
      { id: "main", name: "Main", default: true },
    ];
    PresetGalleryAPI.getPresets = async () => ({});
    PresetGalleryAPI.fetchLibraryCaches = async () => ({ main: {} });
    ModalUtils.confirm = async () => true;
    ModalUtils.prompt = async () => "new_styles";

    await ExportUtils.showImportModal(
      { Imported: { preset: "new" } },
      "main",
      ({ rows }) => {
        importTarget = rows[0].name;
      },
    );

    document
      .querySelector<HTMLElement>(".j0n4t-pg-bundle-rename")
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.match(
      document.querySelector(".j0n4t-pg-bundle-consequence")?.textContent ??
        "",
      /creates a new library · 1 preset/,
    );

    document
      .querySelector<HTMLButtonElement>("#j0n4t-pg-imp-confirm")
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(importTarget, "new_styles");
  } finally {
    PresetGalleryAPI.fetchLibraries = originalFetchLibraries;
    PresetGalleryAPI.getPresets = originalGetPresets;
    PresetGalleryAPI.fetchLibraryCaches = originalFetchCaches;
    ModalUtils.confirm = originalConfirm;
    ModalUtils.prompt = originalPrompt;
    document
      .querySelectorAll(".j0n4t-pg-modal-overlay")
      .forEach((overlay) => overlay.remove());
  }
});

test("import modal can target a new library", async () => {
  const originalFetchLibraries = PresetGalleryAPI.fetchLibraries;
  const originalGetPresets = PresetGalleryAPI.getPresets;
  const originalFetchCaches = PresetGalleryAPI.fetchLibraryCaches;
  const originalConfirm = ModalUtils.confirm;
  const originalPrompt = ModalUtils.prompt;
  let importTarget: string | undefined;

  try {
    PresetGalleryAPI.fetchLibraries = async () => [
      { id: "main", name: "Main", default: true },
    ];
    PresetGalleryAPI.getPresets = async () => ({});
    PresetGalleryAPI.fetchLibraryCaches = async () => ({ main: {} });
    ModalUtils.confirm = async () => true;
    ModalUtils.prompt = async () => "new_styles";

    await ExportUtils.showImportModal(
      { Imported: { preset: "new" } },
      "main",
      ({ rows }) => {
        importTarget = rows[0].name;
      },
    );

    document
      .querySelector<HTMLElement>(".j0n4t-pg-bundle-rename")
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.match(
      document.querySelector(".j0n4t-pg-bundle-consequence")?.textContent ?? "",
      /creates a new library · 1 preset/,
    );

    document.querySelector<HTMLButtonElement>("#j0n4t-pg-imp-confirm")?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(importTarget, "new_styles");
  } finally {
    PresetGalleryAPI.fetchLibraries = originalFetchLibraries;
    PresetGalleryAPI.getPresets = originalGetPresets;
    PresetGalleryAPI.fetchLibraryCaches = originalFetchCaches;
    ModalUtils.confirm = originalConfirm;
    ModalUtils.prompt = originalPrompt;
    document
      .querySelectorAll(".j0n4t-pg-modal-overlay")
      .forEach((overlay) => overlay.remove());
  }
});

test("renaming a nested folder uses and preserves its slash-separated path", async () => {
  const originalPrompt = ModalUtils.prompt;
  let promptDefault: string | undefined;
  const presets: PresetCache = {
    "Faces/Portraits/Studio": { preset: "studio" },
    "Faces/Portraits": { __color__: "#ff0000" },
  };

  try {
    ModalUtils.prompt = (async (_message: string, defaultValue = "") => {
      promptDefault = defaultValue;
      return "Faces/Editorial";
    }) as typeof ModalUtils.prompt;
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
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(promptDefault, "Faces/Portraits");
    assert.equal(
      group.querySelector<HTMLInputElement>(".j0n4t-pg-item-cb")?.value,
      "faces/editorial/Studio",
    );
    assert.equal(presets["faces/editorial/Studio"]?.preset, "studio");
    assert.equal(presets["faces/editorial"]?.__color__, "#ff0000");
    assert.equal(presets["Faces/Portraits/Studio"], undefined);
  } finally {
    ModalUtils.prompt = originalPrompt;
  }
});

test("a folder move is refused when no picker is there to receive it", async () => {
  const originalPrompt = ModalUtils.prompt;
  const originalAlert = ModalUtils.alert;
  const alerts: string[] = [];
  try {
    ModalUtils.prompt = (async () => "otherlib#Faces") as typeof ModalUtils.prompt;
    ModalUtils.alert = (async (message: string) => {
      alerts.push(message);
    }) as typeof ModalUtils.alert;
    const presets: PresetCache = { "faces/portrait": { preset: "portrait" } };
    const tree = ExportUtils.buildPresetSelectorTree(presets, null, {
      libraryId: "main",
    });
    const group = tree.element.querySelector(".j0n4t-pg-tree-group");
    assert.ok(group);
    group.querySelector<HTMLElement>(".j0n4t-pg-edit-group-btn")?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(alerts.length, 1);
    assert.equal(
      presets["faces/portrait"]?.preset,
      "portrait",
      "nothing moved",
    );
  } finally {
    ModalUtils.prompt = originalPrompt;
    ModalUtils.alert = originalAlert;
  }
});

test("a library qualifier with no library name is refused", async () => {
  const originalPrompt = ModalUtils.prompt;
  const originalAlert = ModalUtils.alert;
  const alerts: string[] = [];
  try {
    ModalUtils.prompt = (async () => "#Faces") as typeof ModalUtils.prompt;
    ModalUtils.alert = (async (message: string) => {
      alerts.push(message);
    }) as typeof ModalUtils.alert;
    const tree = ExportUtils.buildPresetSelectorTree(
      { "faces/portrait": { preset: "portrait" } },
      null,
      { libraryId: "main" },
    );
    tree.element
      .querySelector<HTMLElement>(".j0n4t-pg-edit-group-btn")
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(alerts.length, 1);
  } finally {
    ModalUtils.prompt = originalPrompt;
    ModalUtils.alert = originalAlert;
  }
});

test("a tree with no library of its own refuses a move", async () => {
  const originalPrompt = ModalUtils.prompt;
  const originalAlert = ModalUtils.alert;
  const alerts: string[] = [];
  let received = 0;
  try {
    ModalUtils.prompt = (async () => "main#Faces") as typeof ModalUtils.prompt;
    ModalUtils.alert = (async (message: string) => {
      alerts.push(message);
    }) as typeof ModalUtils.alert;
    const presets: PresetCache = { "faces/portrait": { preset: "portrait" } };
    // a receiver is present, so only the missing library can refuse the move
    const tree = ExportUtils.buildPresetSelectorTree(presets, null, {
      onMove: () => {
        received += 1;
      },
    });
    tree.element
      .querySelector<HTMLElement>(".j0n4t-pg-edit-group-btn")
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(alerts.length, 1);
    assert.equal(received, 0, "the move was never handed over");
    assert.equal(presets["faces/portrait"]?.preset, "portrait");
  } finally {
    ModalUtils.prompt = originalPrompt;
    ModalUtils.alert = originalAlert;
  }
});

// --- filterExportPresets ---

test("filterExportPresets narrows to the selection and keeps the folders it reaches", () => {
  const filtered = ExportUtils.filterExportPresets(
    {
      "Faces/Portrait": { preset: "portrait" },
      "Faces/Macro": { preset: "macro" },
      Faces: { __color__: "#ff0000" },
      Ghost: { __color__: "#000000" },
    },
    ["Faces/Portrait"],
  );

  assert.deepEqual(filtered, {
    "Faces/Portrait": { preset: "portrait" },
    Faces: { __color__: "#ff0000" },
  });
});

test("filterExportPresets drops folder colours when includeColors is false", () => {
  const filtered = ExportUtils.filterExportPresets(
    {
      "Faces/Portrait": { preset: "portrait" },
      Faces: { __color__: "#ff0000" },
    },
    ["Faces/Portrait"],
    false,
  );

  assert.deepEqual(filtered, { "Faces/Portrait": { preset: "portrait" } });
});

test("filterExportPresets drops content-less entries and sorts keys", () => {
  const filtered = ExportUtils.filterExportPresets({
    "B/Two": { preset: "two" },
    Ghost: { __color__: "#000000" },
    "A/One": { preset: "one" },
  });

  assert.deepEqual(Object.keys(filtered), ["A/One", "B/Two"]);
});

// --- addPresetZipEntries ---

function recordingZip(): {
  files: Record<string, string>;
  file: (path: string, contents: string) => void;
} {
  const files: Record<string, string> = {};
  return {
    files,
    file: (path, contents) => {
      files[path] = contents;
    },
  };
}

test("addPresetZipEntries writes text, image and colour entries under a prefix", () => {
  const zip = recordingZip();
  ExportUtils.addPresetZipEntries(
    zip,
    "main",
    {
      "Faces/Portrait": {
        preset: "portrait",
        filename: "data:image/png;base64,AAAA",
      },
      Faces: { __color__: "#ff0000" },
    },
    "full",
    true,
  );

  assert.deepEqual(Object.keys(zip.files).sort(), [
    "main/Faces/Portrait.png",
    "main/Faces/Portrait.txt",
    "main/Faces/__color__.txt",
  ]);
  assert.equal(zip.files["main/Faces/Portrait.txt"], "portrait");
  assert.equal(zip.files["main/Faces/__color__.txt"], "#ff0000");
});

test("addPresetZipEntries skips images in preset-only mode and honours an empty prefix", () => {
  const zip = recordingZip();
  ExportUtils.addPresetZipEntries(
    zip,
    "",
    { Root: { preset: "root", filename: "data:image/png;base64,AAAA" } },
    "preset-only",
    true,
  );

  assert.deepEqual(Object.keys(zip.files), ["Root.txt"]);
});

// --- applyImportSelection ---

test("applyImportSelection overwrites an existing key by default", () => {
  const merged = ExportUtils.applyImportSelection(
    { "Faces/Portrait": { preset: "old" } },
    { "Faces/Portrait": { preset: "new" } },
    ["Faces/Portrait"],
    "overwrite",
    true,
  );

  assert.deepEqual(merged, { "Faces/Portrait": { preset: "new" } });
});

test("applyImportSelection skip leaves the existing key alone", () => {
  const merged = ExportUtils.applyImportSelection(
    { "Faces/Portrait": { preset: "old" } },
    { "Faces/Portrait": { preset: "new" } },
    ["Faces/Portrait"],
    "skip",
    true,
  );

  assert.deepEqual(merged, { "Faces/Portrait": { preset: "old" } });
});

test("applyImportSelection keep_both files the import under a copy suffix", () => {
  const merged = ExportUtils.applyImportSelection(
    { "Faces/Portrait": { preset: "old" } },
    { "Faces/Portrait": { preset: "new" } },
    ["Faces/Portrait"],
    "keep_both",
    true,
  );

  assert.deepEqual(merged, {
    "Faces/Portrait": { preset: "old" },
    "Faces/Portrait_copy_1": { preset: "new" },
  });
});

test("applyImportSelection carries folder colours only when asked", () => {
  const incoming: PresetCache = {
    "Faces/Portrait": { preset: "new" },
    Faces: { __color__: "#ff0000" },
  };

  const withColors = ExportUtils.applyImportSelection(
    {},
    incoming,
    ["Faces/Portrait"],
    "overwrite",
    true,
  );
  assert.equal(withColors["Faces"]?.__color__, "#ff0000");

  const withoutColors = ExportUtils.applyImportSelection(
    {},
    incoming,
    ["Faces/Portrait"],
    "overwrite",
    false,
  );
  assert.equal(withoutColors["Faces"], undefined);
});
