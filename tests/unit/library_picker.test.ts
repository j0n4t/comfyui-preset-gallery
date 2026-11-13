import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import ExportUtils from "../../web/ExportUtils.js";
import ModalUtils from "../../web/ModalUtils.js";

// The picker is the editable preview of an import or export: one row per
// library, each with a name, a pencil, a consequence line and a preset tree.

const SERVED = [
  { id: "main", name: "Main", default: true },
  { id: "styles", name: "Styles", default: false },
];

type PickerRowInput = { sourceId: string; name: string; presets: PresetCache };

type PickerOptions = {
  rows?: PickerRowInput[];
  served?: Array<{ id: string; name: string }>;
  existingCachesById?: Record<string, PresetCache> | null;
  mode?: "import" | "export";
};

type Picker = {
  element: HTMLElement;
  getRows(): Array<{
    sourceId: string;
    name: string;
    presets: PresetCache;
    selectedKeys: string[];
  }>;
  getShape(): Record<string, PresetCache>;
  getSelection(): Record<string, string[]>;
  getStrategy(): string;
};

function picker(overrides: PickerOptions = {}): Picker {
  return ExportUtils.buildLibraryPicker({
    rows: [
      {
        sourceId: "main",
        name: "main",
        presets: { "faces/portrait": { preset: "portrait" } },
      },
    ],
    served: SERVED,
    existingCachesById: { main: {}, styles: {} },
    ...overrides,
  });
}

function consequenceLines(p: Picker): Array<string | null> {
  return Array.from(
    p.element.querySelectorAll(".j0n4t-pg-bundle-consequence"),
  ).map((el) => el.textContent);
}

function rowNames(p: Picker): Array<string | null> {
  return Array.from(p.element.querySelectorAll(".j0n4t-pg-bundle-name")).map(
    (el) => el.textContent,
  );
}

/** The folder group row for `group`, wherever it currently lives. */
function groupEl(p: Picker, group: string): HTMLElement | null {
  const found = Array.from(
    p.element.querySelectorAll(".j0n4t-pg-tree-group"),
  ).find(
    (el) =>
      el.querySelector<HTMLInputElement>(".j0n4t-pg-group-cb")?.dataset.group ===
      group,
  );
  return (found as HTMLElement | undefined) ?? null;
}

/** Click a folder's rename button and let the prompt resolve. */
async function renameFolder(
  p: Picker,
  group: string,
  answer: string,
): Promise<void> {
  const originalPrompt = ModalUtils.prompt;
  try {
    ModalUtils.prompt = (async () => answer) as typeof ModalUtils.prompt;
    const btn = groupEl(p, group)?.querySelector<HTMLElement>(
      ".j0n4t-pg-edit-group-btn",
    );
    assert.ok(btn, `no rename button for ${group}`);
    btn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    ModalUtils.prompt = originalPrompt;
  }
}

test("the picker renders one row per library", () => {
  const p = picker({
    rows: [
      {
        sourceId: "main",
        name: "main",
        presets: {
          "faces/portrait": { preset: "portrait" },
          "faces/macro": { preset: "macro" },
        },
      },
      {
        sourceId: "styles",
        name: "styles",
        presets: { "urban/night": { preset: "night" } },
      },
    ],
  });

  assert.equal(p.element.querySelectorAll(".j0n4t-pg-bundle-group").length, 2);
  assert.deepEqual(rowNames(p), ["main (2/2)", "styles (1/1)"]);
  assert.equal(
    p.element.querySelectorAll(".j0n4t-pg-item-cb").length,
    3,
    "every library's presets are listed",
  );
});

test("the consequence line says what writing a row will do", () => {
  const p = picker({
    rows: [
      {
        sourceId: "main",
        name: "main",
        presets: { "faces/portrait": { preset: "portrait" } },
      },
      {
        sourceId: "styles",
        name: "portrait_pack",
        presets: { "urban/night": { preset: "night" } },
      },
    ],
    existingCachesById: {
      main: {},
      styles: { "urban/night": { preset: "old" } },
    },
  });

  assert.deepEqual(consequenceLines(p), [
    "restores in place · 1 preset, 0 duplicates",
    "creates a new library · 1 preset",
  ]);
});

test("renaming onto a served library reports the merge and its duplicates", async () => {
  const originalPrompt = ModalUtils.prompt;
  try {
    ModalUtils.prompt = async () => "styles";
    const p = picker({
      rows: [
        {
          sourceId: "main",
          name: "main",
          presets: { "faces/portrait": { preset: "portrait" } },
        },
      ],
      existingCachesById: {
        main: {},
        styles: { "faces/portrait": { preset: "old" } },
      },
    });

    p.element
      .querySelector(".j0n4t-pg-bundle-rename")
      ?.dispatchEvent(new Event("click"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(
      consequenceLines(p)[0],
      "merges into Styles · 1 preset, 1 duplicate",
    );
    assert.deepEqual(Object.keys(p.getShape()), ["styles"]);
  } finally {
    ModalUtils.prompt = originalPrompt;
  }
});

test("the pencil renames the row and creates a new library", async () => {
  const originalPrompt = ModalUtils.prompt;
  try {
    ModalUtils.prompt = async () => "portrait_pack";
    const p = picker();

    p.element
      .querySelector(".j0n4t-pg-bundle-rename")
      ?.dispatchEvent(new Event("click"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(p.getRows()[0].name, "portrait_pack");
    assert.deepEqual(Object.keys(p.getShape()), ["portrait_pack"]);
    assert.equal(
      consequenceLines(p)[0],
      "creates a new library · 1 preset",
    );
  } finally {
    ModalUtils.prompt = originalPrompt;
  }
});

test("renaming onto another row folds the two rows into one", async () => {
  const originalPrompt = ModalUtils.prompt;
  try {
    ModalUtils.prompt = async () => "styles";
    const p = picker({
      rows: [
        {
          sourceId: "main",
          name: "main",
          presets: { "faces/portrait": { preset: "portrait" } },
        },
        {
          sourceId: "styles",
          name: "styles",
          presets: { "urban/night": { preset: "night" } },
        },
      ],
    });

    p.element
      .querySelector(".j0n4t-pg-bundle-rename")
      ?.dispatchEvent(new Event("click"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(rowNames(p), ["styles (2/2)"]);
    assert.deepEqual(Object.keys(p.getShape().styles).sort(), [
      "faces/portrait",
      "urban/night",
    ]);
  } finally {
    ModalUtils.prompt = originalPrompt;
  }
});

test("an invalid library name is refused", async () => {
  const originalPrompt = ModalUtils.prompt;
  const originalAlert = ModalUtils.alert;
  const alerts: string[] = [];
  try {
    ModalUtils.prompt = async () => "bad name";
    ModalUtils.alert = (async (message: string) => {
      alerts.push(message);
    }) as typeof ModalUtils.alert;
    const p = picker();

    p.element
      .querySelector(".j0n4t-pg-bundle-rename")
      ?.dispatchEvent(new Event("click"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(p.getRows()[0].name, "main");
    assert.equal(alerts.length, 1, "the reason is reported");
  } finally {
    ModalUtils.prompt = originalPrompt;
    ModalUtils.alert = originalAlert;
  }
});

test("cancelling the prompt leaves the row alone", async () => {
  const originalPrompt = ModalUtils.prompt;
  try {
    ModalUtils.prompt = async () => null;
    const p = picker();

    p.element
      .querySelector(".j0n4t-pg-bundle-rename")
      ?.dispatchEvent(new Event("click"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(p.getRows()[0].name, "main");
  } finally {
    ModalUtils.prompt = originalPrompt;
  }
});

test("the row checkbox selects and clears every preset in the row", () => {
  const p = picker({
    rows: [
      {
        sourceId: "main",
        name: "main",
        presets: {
          "faces/portrait": { preset: "portrait" },
          "faces/macro": { preset: "macro" },
        },
      },
    ],
  });

  const box = p.element.querySelector<HTMLInputElement>(
    ".j0n4t-pg-bundle-lib-cb",
  );
  assert.ok(box);
  box.checked = false;
  box.dispatchEvent(new Event("change"));

  assert.deepEqual(p.getSelection().main, []);
  assert.equal(rowNames(p)[0], "main (0/2)");

  box.checked = true;
  box.dispatchEvent(new Event("change"));
  assert.equal(p.getSelection().main.length, 2);
  assert.equal(rowNames(p)[0], "main (2/2)");
});

test("the master checkbox clears every row", () => {
  const p = picker({
    rows: [
      {
        sourceId: "main",
        name: "main",
        presets: { "faces/portrait": { preset: "portrait" } },
      },
      {
        sourceId: "styles",
        name: "styles",
        presets: { "urban/night": { preset: "night" } },
      },
    ],
  });

  const master = p.element.querySelector<HTMLInputElement>(
    "#j0n4t-pg-picker-sel-all",
  );
  assert.ok(master);
  master.checked = false;
  master.dispatchEvent(new Event("change"));

  assert.deepEqual(p.getSelection(), { main: [], styles: [] });
});

test("getShape returns the libraries to write", () => {
  const p = picker();
  assert.deepEqual(Object.keys(p.getShape()), ["main"]);
  assert.deepEqual(p.getShape().main, {
    "faces/portrait": { preset: "portrait" },
  });
});

test("a folder renamed to another library moves into that row", async () => {
  const p = picker({
    rows: [
      {
        sourceId: "main",
        name: "main",
        presets: {
          "faces/portrait": { preset: "portrait" },
          "faces/macro": { preset: "macro" },
          "urban/night": { preset: "night" },
          faces: { __color__: "#ff0000" },
        },
      },
      { sourceId: "styles", name: "styles", presets: {} },
    ],
    existingCachesById: { main: {}, styles: {} },
  });

  await renameFolder(p, "faces", "styles#Urban");

  // the folder left the main row, keeping its colour
  assert.equal(p.getShape().main["faces/portrait"], undefined);
  assert.equal(p.getShape().main["faces/macro"], undefined);
  assert.equal(p.getShape().main["faces"], undefined);
  assert.equal(p.getShape().main["urban/night"]?.preset, "night");
  // and landed in the styles row under its new name
  assert.equal(p.getShape().styles["urban/portrait"]?.preset, "portrait");
  assert.equal(p.getShape().styles["urban/macro"]?.preset, "macro");
  assert.equal(p.getShape().styles["urban"]?.__color__, "#ff0000");
});

test("a folder colour follows a move even when its key spells the folder differently", async () => {
  const p = picker({
    rows: [
      {
        sourceId: "main",
        name: "main",
        presets: {
          "Faces/portrait": { preset: "portrait" },
          faces: { __color__: "#ff0000" },
        },
      },
      { sourceId: "styles", name: "styles", presets: {} },
    ],
    existingCachesById: { main: {}, styles: {} },
  });

  await renameFolder(p, "Faces", "styles#Urban");

  assert.equal(
    p.getShape().styles["urban"]?.__color__,
    "#ff0000",
    "the colour was carried to the new folder",
  );
  assert.equal(
    p.getShape().main["faces"],
    undefined,
    "the old colour entry was removed rather than left behind",
  );
});

test("a move to a library that is not a row creates one", async () => {
  const p = picker({
    rows: [
      {
        sourceId: "main",
        name: "main",
        presets: {
          "faces/portrait": { preset: "portrait" },
          faces: { __color__: "#ff0000" },
        },
      },
    ],
  });

  await renameFolder(p, "faces", "portrait_pack#Faces");

  assert.deepEqual(Object.keys(p.getShape()).sort(), [
    "main",
    "portrait_pack",
  ]);
  assert.equal(
    p.getShape().portrait_pack["faces/portrait"]?.preset,
    "portrait",
  );
  assert.equal(p.getShape().portrait_pack["faces"]?.__color__, "#ff0000");
  assert.equal(
    consequenceLines(p)[1],
    "creates a new library · 1 preset",
    "the new row says what it is",
  );
});

test("a move carries the checked state of the presets", async () => {
  const p = picker({
    rows: [
      {
        sourceId: "main",
        name: "main",
        presets: {
          "faces/portrait": { preset: "portrait" },
          "faces/macro": { preset: "macro" },
        },
      },
    ],
    existingCachesById: { main: {}, styles: {} },
  });

  // leave faces/macro unchecked before moving the folder
  const macro = p.element.querySelector<HTMLInputElement>(
    ".j0n4t-pg-item-cb[value='faces/macro']",
  );
  assert.ok(macro);
  macro.checked = false;
  macro.dispatchEvent(new Event("change"));

  // the target is not a row yet, so the move has to create one
  await renameFolder(p, "faces", "portrait_pack#Faces");

  // main stays as an empty original row; portrait_pack holds the move
  assert.deepEqual(Object.keys(p.getShape()).sort(), [
    "main",
    "portrait_pack",
  ]);
  assert.deepEqual(p.getSelection().portrait_pack, ["faces/portrait"]);
});

test("a plain folder rename stays in its row", async () => {
  const p = picker({
    rows: [
      {
        sourceId: "main",
        name: "main",
        presets: { "faces/portrait": { preset: "portrait" } },
      },
    ],
  });

  await renameFolder(p, "faces", "Faces/Editorial");

  assert.equal(
    p.getShape().main["faces/editorial/portrait"]?.preset,
    "portrait",
  );
  assert.deepEqual(Object.keys(p.getShape()), ["main"]);
});

test("a plain rename carries a folder colour whose key spells the folder differently", async () => {
  const p = picker({
    rows: [
      {
        sourceId: "main",
        name: "main",
        presets: {
          "faces/portrait": { preset: "portrait" },
          Faces: { __color__: "#ff0000" },
        },
      },
    ],
  });

  await renameFolder(p, "faces", "Faces/Editorial");

  const shape = p.getShape().main;
  assert.equal(
    shape["faces/editorial"]?.__color__,
    "#ff0000",
    "the colour followed the rename into its new folder",
  );
  assert.equal(shape["Faces"], undefined, "the old entry was removed");
});

test("a row created by a move goes away when it empties", async () => {
  const p = picker({
    rows: [
      {
        sourceId: "main",
        name: "main",
        presets: { "faces/portrait": { preset: "portrait" } },
      },
    ],
  });

  await renameFolder(p, "faces", "portrait_pack#Faces");
  assert.deepEqual(Object.keys(p.getShape()).sort(), [
    "main",
    "portrait_pack",
  ]);

  // move the same folder on into the main row; portrait_pack empties and goes
  await renameFolder(p, "faces", "main#Faces");
  assert.deepEqual(Object.keys(p.getShape()), ["main"]);
  assert.equal(p.getShape().main["faces/portrait"]?.preset, "portrait");
});

test("changing the duplicate switch re-applies the selection in every row", () => {
  const p = picker({
    rows: [
      {
        sourceId: "main",
        name: "main",
        presets: { "faces/portrait": { preset: "portrait" } },
      },
    ],
    existingCachesById: { main: { "faces/portrait": { preset: "old" } } },
  });
  const strategy = p.element.querySelector<HTMLSelectElement>(
    "#j0n4t-pg-picker-strategy",
  );
  assert.ok(strategy);
  // a replaced preset is checked by default
  assert.deepEqual(p.getSelection().main, ["faces/portrait"]);

  strategy.value = "skip";
  strategy.dispatchEvent(new Event("change"));
  assert.deepEqual(
    p.getSelection().main,
    [],
    "skip unchecks the replaced preset",
  );

  strategy.value = "keep_both";
  strategy.dispatchEvent(new Event("change"));
  assert.deepEqual(p.getSelection().main, ["faces/portrait"]);
});

test("the duplicate switch is global, and only in import mode", () => {
  const imp = picker({ mode: "import" });
  const strategy = imp.element.querySelector<HTMLSelectElement>(
    "#j0n4t-pg-picker-strategy",
  );
  assert.ok(strategy, "import shows the switch");
  assert.equal(imp.getStrategy(), "overwrite");
  strategy.value = "keep_both";
  assert.equal(imp.getStrategy(), "keep_both");

  const exp = picker({ mode: "export" });
  assert.equal(
    exp.element.querySelector("#j0n4t-pg-picker-strategy"),
    null,
    "export has nothing to merge on the server",
  );
  assert.equal(exp.getStrategy(), "overwrite");
});

test("collapse all collapses the folders and any preset's expanded contents", () => {
  const p = picker({
    rows: [
      {
        sourceId: "main",
        name: "main",
        presets: { "Faces/Portrait": { preset: "portrait" } },
      },
    ],
  });
  document.body.appendChild(p.element);

  // Open one preset's details drawer and its inline editor.
  p.element.querySelector<HTMLElement>(".j0n4t-pg-details-btn")?.click();
  p.element.querySelector<HTMLElement>(".j0n4t-pg-edit-btn")?.click();
  const details = p.element.querySelector<HTMLElement>(
    ".j0n4t-pg-details-container",
  );
  const editor = p.element.querySelector<HTMLElement>(
    ".j0n4t-pg-edit-container",
  );
  assert.equal(details?.style.display, "block", "the drawer starts open");
  assert.equal(editor?.style.display, "block", "the editor starts open");

  const toggle = p.element.querySelector<HTMLElement>(
    "#j0n4t-pg-picker-toggle-collapse",
  );
  assert.ok(toggle);
  toggle.click();
  toggle.click();

  // Expanding brings the rows and folders back, but a preset's own contents
  // were opened by hand and stay closed.
  assert.equal(
    details?.style.display,
    "none",
    "the details drawer collapsed with the rest",
  );
  assert.equal(
    editor?.style.display,
    "none",
    "the inline editor collapsed with the rest",
  );
  assert.equal(
    p.element.querySelector<HTMLElement>(".j0n4t-pg-tree-group-items")?.style
      .display,
    "",
    "the folder group expanded again",
  );
  assert.equal(
    p.element.querySelector<HTMLElement>(".j0n4t-pg-collapse-btn")
      ?.textContent,
    "▼",
  );

  p.element.remove();
});

test("export mode keeps the pencil but drops the consequence line", () => {
  const exp = picker({ mode: "export" });
  assert.ok(
    exp.element.querySelector(".j0n4t-pg-bundle-rename"),
    "a row can still be renamed, which names the library written",
  );
  assert.equal(
    exp.element.querySelector(".j0n4t-pg-bundle-consequence"),
    null,
    "export has nothing to merge on the server",
  );
});

test("renaming a row rebuilds the tree and keeps the user's selection", async () => {
  const originalPrompt = ModalUtils.prompt;
  try {
    ModalUtils.prompt = async () => "second";
    const p = picker({
      rows: [
        {
          sourceId: "main",
          name: "main",
          presets: { "Faces/Portrait": { preset: "portrait" } },
        },
      ],
      served: [
        { id: "main", name: "Main" },
        { id: "second", name: "Second" },
      ],
      existingCachesById: { second: { "Faces/Portrait": { preset: "old" } } },
    });
    document.body.appendChild(p.element);

    const box = p.element.querySelector<HTMLInputElement>(
      ".j0n4t-pg-item-cb",
    );
    assert.ok(box);
    box.checked = false;
    box.dispatchEvent(new Event("change"));

    p.element
      .querySelector<HTMLElement>(".j0n4t-pg-bundle-rename")
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const rebuilt = p.element.querySelector<HTMLInputElement>(
      ".j0n4t-pg-item-cb",
    );
    assert.ok(rebuilt, "the tree is rebuilt against the new destination");
    assert.equal(
      rebuilt.checked,
      false,
      "the user's choice survives the rebuild",
    );
    assert.deepEqual(p.getSelection(), { second: [] });

    p.element.remove();
  } finally {
    ModalUtils.prompt = originalPrompt;
  }
});
