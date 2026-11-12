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
