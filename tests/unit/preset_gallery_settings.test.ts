import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import PresetGallerySettings from "../../web/PresetGallerySettings.js";
import ExportUtils from "../../web/ExportUtils.js";
import PresetGalleryAPI from "../../web/PresetGalleryAPI.js";

// PresetGallerySettings persists the roll preferences to localStorage and
// mirrors them onto the reroll dice button's classes. The context is a stub
// that records syncUI; localStorage is an in-memory mock.

function fakeStorage(
  initial: Record<string, string> = {},
): Map<string, string> {
  const map = new Map<string, string>(Object.entries(initial));
  globalThis.localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  } as unknown as Storage;
  return map;
}

type DomStub = {
  wrap: HTMLDivElement;
  basketContainer: HTMLDivElement;
  inpPreset: HTMLTextAreaElement;
};

function makeSettings(dom?: DomStub): {
  settings: PresetGallerySettings;
  syncUI: (val: string) => void;
  widgetValue: string;
} {
  const state = { widgetValue: "Faces/Portrait" };
  const syncUI = (val: string) => {
    state.widgetValue = val;
  };
  const settings = new PresetGallerySettings({
    syncUI,
    widget: { value: state.widgetValue },
    ...(dom ? { dom } : {}),
  } as unknown as GalleryContext);
  return { settings, syncUI, widgetValue: state.widgetValue };
}

// The gallery elements the settings mirror their state onto.
function makeDom(): DomStub {
  const wrap = document.createElement("div");
  wrap.className = "j0n4t-pg-wrap";
  const basketContainer = document.createElement("div");
  basketContainer.className = "j0n4t-pg-basket-container";
  const inpPreset = document.createElement("textarea");
  inpPreset.id = "j0n4t-pg-preset";
  wrap.append(basketContainer, inpPreset);
  document.body.appendChild(wrap);
  return { wrap, basketContainer, inpPreset };
}

function makeDiceButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "j0n4t-pg-basket-reroll-btn";
  document.body.appendChild(btn);
  return btn;
}

// the constructor defers updateDiceVisuals by a macrotask
function tick(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- load and save ---

test("loads defaults when nothing is saved", () => {
  fakeStorage();
  const { settings } = makeSettings();
  assert.equal(settings.rollMin, 10);
  assert.equal(settings.rollMax, 20);
  assert.equal(settings.rollOnGeneration, false);
  assert.equal(settings.rollOnSeedChange, false);
  assert.equal(settings.diceBehavior, "variants");
  assert.equal(settings.heightMode, "fit", "fit is the default height mode");
  assert.equal(settings.heightFixed, 640);
  assert.equal(settings.rememberPanelSizes, false, "panel sizes are opt-in");
  assert.deepEqual(settings.panelSizes, {});
  assert.deepEqual(
    settings.disabledLibraries,
    [],
    "nothing is switched off by default",
  );
  assert.deepEqual(
    settings.libraryOrder,
    [],
    "the server's order is used until the user picks one",
  );
  assert.equal(
    settings.qualifyChips,
    true,
    "chips keep their library tag by default",
  );
  assert.equal(
    settings.showChipLibraryBadges,
    true,
    "chip library badges are shown by default",
  );
  assert.equal(
    settings.showGridLibraryBadges,
    true,
    "grid library badges are shown by default",
  );
});

test("loads previously saved values", () => {
  fakeStorage({
    pg_settings: JSON.stringify({
      rollMin: 3,
      rollMax: 7,
      rollOnGeneration: true,
      rollOnSeedChange: true,
      diceBehavior: "overwrite",
      heightMode: "fixed",
      heightFixed: 420,
    }),
  });
  const { settings } = makeSettings();
  assert.equal(settings.rollMin, 3);
  assert.equal(settings.rollMax, 7);
  assert.equal(settings.rollOnGeneration, true);
  assert.equal(settings.rollOnSeedChange, true);
  assert.equal(settings.diceBehavior, "overwrite");
  assert.equal(settings.heightMode, "fixed");
  assert.equal(settings.heightFixed, 420);
});

test("falls back to the default height mode for an unrecognised one", () => {
  fakeStorage({
    pg_settings: JSON.stringify({ heightMode: "stretchy", heightFixed: 420 }),
  });
  const { settings } = makeSettings();
  assert.equal(settings.heightMode, "fit");
  assert.equal(
    settings.heightFixed,
    420,
    "the valid half of the pair is still honoured",
  );
});

test("falls back to the default fixed height when the stored one is unusable", () => {
  fakeStorage({
    pg_settings: JSON.stringify({ heightMode: "fixed", heightFixed: 0 }),
  });
  const { settings } = makeSettings();
  assert.equal(settings.heightMode, "fixed");
  assert.equal(settings.heightFixed, 640, "0 is not a height");
});

test("falls back to defaults when the stored JSON is corrupt", () => {
  fakeStorage({ pg_settings: "{not json" });
  const { settings } = makeSettings();
  assert.equal(settings.rollMin, 10);
  assert.equal(settings.rollMax, 20);
  assert.equal(settings.diceBehavior, "variants");
  assert.equal(settings.heightMode, "fit");
  assert.equal(settings.heightFixed, 640);
});

test("save writes all preferences", () => {
  const map = fakeStorage();
  const { settings } = makeSettings();
  settings.rollMin = 4;
  settings.rollMax = 9;
  settings.rollOnGeneration = true;
  settings.rollOnSeedChange = true;
  settings.diceBehavior = "overwrite";
  settings.heightMode = "fixed";
  settings.heightFixed = 300;
  settings.rememberPanelSizes = true;
  settings.panelSizes = { basket: 120, editor: 60 };
  settings.save();
  assert.equal(
    map.get("pg_settings"),
    JSON.stringify({
      rollMin: 4,
      rollMax: 9,
      rollOnGeneration: true,
      rollOnSeedChange: true,
      diceBehavior: "overwrite",
      rememberDicePerTab: false,
      heightMode: "fixed",
      heightFixed: 300,
      rememberPanelSizes: true,
      panelSizes: { basket: 120, editor: 60 },
      qualifyChips: true,
      showChipLibraryBadges: true,
      showGridLibraryBadges: true,
      disabledLibraries: [],
      libraryOrder: [],
    }),
  );
});

// --- updateDiceVisuals ---

test("updateDiceVisuals is a no-op when the dice button is absent", () => {
  fakeStorage();
  const { settings } = makeSettings();
  settings.diceBehavior = "overwrite";
  assert.doesNotThrow(() => settings.updateDiceVisuals());
});

test("updateDiceVisuals reflects the dice behavior and auto-roll flags", async () => {
  fakeStorage();
  makeDiceButton();
  const { settings } = makeSettings();
  await tick();

  const btn = document.querySelector<HTMLButtonElement>(
    ".j0n4t-pg-basket-reroll-btn",
  )!;
  assert.ok(btn.classList.contains("roll-variants"), "default behavior class");
  assert.ok(!btn.classList.contains("auto-roll"));
  assert.ok(!btn.classList.contains("auto-roll-seed"));

  settings.diceBehavior = "overwrite";
  settings.rollOnGeneration = true;
  settings.rollOnSeedChange = true;
  settings.updateDiceVisuals();

  assert.ok(btn.classList.contains("roll-overwrite"));
  assert.ok(
    !btn.classList.contains("roll-variants"),
    "the old behavior class is removed",
  );
  assert.ok(btn.classList.contains("auto-roll"));
  assert.ok(btn.classList.contains("auto-roll-seed"));
});

// --- per-tab rolling options ---

test("loads a saved rememberDicePerTab flag", () => {
  fakeStorage({ pg_settings: JSON.stringify({ rememberDicePerTab: true }) });
  const { settings } = makeSettings();
  assert.equal(settings.rememberDicePerTab, true);
});

test("applyTabDice installs, persists and mirrors a tab's rolling options", async () => {
  const map = fakeStorage();
  makeDiceButton();
  const { settings } = makeSettings();
  await tick();

  settings.applyTabDice({
    behavior: "overwrite",
    onGeneration: true,
    onSeedChange: true,
    min: 2,
    max: 4,
  });

  assert.equal(settings.diceBehavior, "overwrite");
  assert.equal(settings.rollOnGeneration, true);
  assert.equal(settings.rollOnSeedChange, true);
  assert.equal(settings.rollMin, 2);
  assert.equal(settings.rollMax, 4);
  const saved = JSON.parse(map.get("pg_settings")!) as Record<string, unknown>;
  assert.equal(saved.diceBehavior, "overwrite");
  assert.equal(saved.rollOnGeneration, true);
  assert.equal(saved.rollMin, 2);
  const btn = document.querySelector<HTMLButtonElement>(
    ".j0n4t-pg-basket-reroll-btn",
  )!;
  assert.ok(btn.classList.contains("roll-overwrite"));
  assert.ok(btn.classList.contains("auto-roll"));
  assert.ok(btn.classList.contains("auto-roll-seed"));
});

test("applyTabDice validates a corrupt snapshot", () => {
  fakeStorage();
  const { settings } = makeSettings();

  settings.applyTabDice({
    behavior: "sideways",
    onGeneration: true,
    onSeedChange: false,
    min: 0,
    max: -3,
  } as unknown as BasketTabDice);

  assert.equal(settings.diceBehavior, "variants");
  assert.equal(settings.rollMin, 10, "0 is not a count");
  assert.equal(
    settings.rollMax,
    20,
    "a negative max falls back to the default",
  );

  settings.applyTabDice({
    behavior: "overwrite",
    onGeneration: false,
    onSeedChange: false,
    min: 7,
    max: 5,
  });
  assert.equal(settings.rollMin, 7);
  assert.equal(settings.rollMax, 7, "the max is raised to the min");
});

test("the Rolling Options tab offers the per-tab flag and saves it", async () => {
  const map = fakeStorage();
  const { settings } = makeSettings();
  const promise = settings.openModal();
  const modal = document.querySelector(".j0n4t-pg-modal-overlay")!;
  const check = modal.querySelector<HTMLInputElement>(
    "#j0n4t-pg-remember-dice-tab",
  )!;
  assert.equal(check.checked, false, "off by default");

  check.checked = true;
  modal.querySelector<HTMLButtonElement>('button[data-index="1"]')?.click();

  assert.equal(await promise, true);
  assert.equal(settings.rememberDicePerTab, true);
  assert.equal(
    (JSON.parse(map.get("pg_settings")!) as Record<string, unknown>)
      .rememberDicePerTab,
    true,
  );
});

// --- openModal ---

test("openModal renders the settings tab and switches tabs", async () => {
  fakeStorage();
  const { settings } = makeSettings();
  const promise = settings.openModal();

  const modal = document.querySelector(".j0n4t-pg-modal-overlay");
  assert.ok(modal, "modal is mounted");
  const minInput = modal.querySelector<HTMLInputElement>("#j0n4t-pg-roll-min");
  assert.equal(
    minInput?.value,
    "10",
    "min input is seeded from the loaded value",
  );

  const tab = (name: string) =>
    modal.querySelector<HTMLButtonElement>(
      `.j0n4t-pg-tab-btn[data-tab="${name}"]`,
    )!;
  const isActive = (name: string) =>
    modal
      .querySelector(`#j0n4t-pg-tab-${name}`)
      ?.classList.contains("active") ?? false;

  tab("display").click();
  assert.ok(isActive("display"));
  assert.ok(!isActive("settings"));

  tab("shortcuts").click();
  assert.ok(isActive("shortcuts"));
  assert.ok(!isActive("display"));

  tab("settings").click();
  assert.ok(isActive("settings"));

  modal.querySelector<HTMLButtonElement>('button[data-index="0"]')?.click(); // Cancel
  assert.equal(await promise, false);
});

test("openModal save persists the inputs and syncs the widget", async () => {
  const map = fakeStorage();
  let synced: string | null = null;
  const settings = new PresetGallerySettings({
    syncUI: (val: string) => {
      synced = val;
    },
    widget: { value: "Faces/Portrait" },
  } as unknown as GalleryContext);

  const promise = settings.openModal();
  const modal = document.querySelector(".j0n4t-pg-modal-overlay")!;
  modal.querySelector<HTMLInputElement>("#j0n4t-pg-roll-min")!.value = "3";
  modal.querySelector<HTMLInputElement>("#j0n4t-pg-roll-max")!.value = "7";
  modal.querySelector<HTMLInputElement>("#j0n4t-pg-roll-on-gen")!.checked =
    true;
  modal.querySelector<HTMLSelectElement>("#j0n4t-pg-dice-behavior")!.value =
    "overwrite";
  modal.querySelector<HTMLInputElement>(
    "#j0n4t-pg-show-chip-library-badges",
  )!.checked = false;
  modal.querySelector<HTMLInputElement>(
    "#j0n4t-pg-show-grid-library-badges",
  )!.checked = false;
  modal.querySelector<HTMLButtonElement>('button[data-index="1"]')?.click(); // Save

  assert.equal(await promise, true, "Save resolves the modal promise");
  assert.equal(
    map.get("pg_settings"),
    JSON.stringify({
      rollMin: 3,
      rollMax: 7,
      rollOnGeneration: true,
      rollOnSeedChange: false,
      diceBehavior: "overwrite",
      rememberDicePerTab: false,
      heightMode: "fit",
      heightFixed: 640,
      rememberPanelSizes: false,
      panelSizes: {},
      qualifyChips: true,
      showChipLibraryBadges: false,
      showGridLibraryBadges: false,
      disabledLibraries: [],
      libraryOrder: [],
    }),
  );
  assert.equal(settings.showChipLibraryBadges, false);
  assert.equal(settings.showGridLibraryBadges, false);
  assert.equal(synced, "Faces/Portrait", "syncUI receives the widget value");
});

test("openModal save clamps an invalid min and an empty max to at least the min", async () => {
  // the inputs are type="number", which never holds non-numeric text: an
  // invalid entry reads back as "" (Number("") === 0) and is raised to the min
  const map = fakeStorage();
  const { settings } = makeSettings();
  const promise = settings.openModal();

  const modal = document.querySelector(".j0n4t-pg-modal-overlay")!;
  modal.querySelector<HTMLInputElement>("#j0n4t-pg-roll-min")!.value = "0";
  modal.querySelector<HTMLInputElement>("#j0n4t-pg-roll-max")!.value = "abc";
  modal.querySelector<HTMLButtonElement>('button[data-index="1"]')?.click(); // Save

  assert.equal(await promise, true);
  assert.equal(settings.rollMin, 1, "min is clamped up to 1");
  assert.equal(
    settings.rollMax,
    1,
    "an unparsable max reads as 0 and is raised to the min",
  );
  const saved = JSON.parse(map.get("pg_settings")!) as Record<string, unknown>;
  assert.equal(saved.rollMin, 1);
  assert.equal(saved.rollMax, 1);
});

test("openModal save keeps the max at least equal to the min", async () => {
  const map = fakeStorage();
  const { settings } = makeSettings();
  const promise = settings.openModal();

  const modal = document.querySelector(".j0n4t-pg-modal-overlay")!;
  modal.querySelector<HTMLInputElement>("#j0n4t-pg-roll-min")!.value = "5";
  modal.querySelector<HTMLInputElement>("#j0n4t-pg-roll-max")!.value = "2";
  modal.querySelector<HTMLButtonElement>('button[data-index="1"]')?.click(); // Save

  assert.equal(await promise, true);
  assert.equal(settings.rollMax, 5, "a max below the min is raised to the min");
  const saved = JSON.parse(map.get("pg_settings")!) as Record<string, unknown>;
  assert.equal(saved.rollMax, 5);
});

// --- height mode ---

test("applyHeightMode mirrors the mode onto the gallery element", () => {
  fakeStorage();
  const dom = makeDom();
  const { settings } = makeSettings(dom);

  assert.equal(
    dom.wrap.dataset.heightMode,
    "fit",
    "the default is applied on construction",
  );
  assert.equal(dom.wrap.style.getPropertyValue("--pg-fixed-height"), "640px");

  settings.heightMode = "unlimited";
  settings.heightFixed = 350;
  settings.applyHeightMode();
  assert.equal(dom.wrap.dataset.heightMode, "unlimited");
  assert.equal(dom.wrap.style.getPropertyValue("--pg-fixed-height"), "350px");
});

test("applyHeightMode is a no-op when the gallery element is absent", () => {
  fakeStorage();
  const { settings } = makeSettings();
  assert.doesNotThrow(() => settings.applyHeightMode());
});

test("a saved height mode is applied on construction", () => {
  fakeStorage({
    pg_settings: JSON.stringify({ heightMode: "fixed", heightFixed: 420 }),
  });
  const dom = makeDom();
  makeSettings(dom);
  assert.equal(dom.wrap.dataset.heightMode, "fixed");
  assert.equal(dom.wrap.style.getPropertyValue("--pg-fixed-height"), "420px");
});

test("the Display tab seeds the mode and hides the pixel field unless fixed", async () => {
  fakeStorage({
    pg_settings: JSON.stringify({ heightMode: "fit", heightFixed: 420 }),
  });
  const { settings } = makeSettings(makeDom());
  const promise = settings.openModal();

  const modal = document.querySelector(".j0n4t-pg-modal-overlay");
  assert.ok(modal);
  const modeSelect = modal.querySelector<HTMLSelectElement>(
    "#j0n4t-pg-height-mode",
  )!;
  const fixedField = modal.querySelector<HTMLDivElement>(
    "#j0n4t-pg-height-fixed-field",
  )!;
  const fixedInput = modal.querySelector<HTMLInputElement>(
    "#j0n4t-pg-height-fixed",
  )!;

  assert.equal(
    modeSelect.value,
    "fit",
    "the select is seeded from the loaded mode",
  );
  assert.equal(
    fixedInput.value,
    "420",
    "the input is seeded from the loaded height",
  );
  assert.equal(
    fixedField.style.display,
    "none",
    "hidden while the mode is not fixed",
  );

  modeSelect.value = "fixed";
  modeSelect.dispatchEvent(new Event("change"));
  assert.equal(fixedField.style.display, "", "revealed in fixed mode");

  modal.querySelector<HTMLButtonElement>('button[data-index="0"]')?.click(); // Cancel
  assert.equal(await promise, false);
});

test("openModal save applies the chosen height mode to the gallery element", async () => {
  const map = fakeStorage();
  const dom = makeDom();
  const { settings } = makeSettings(dom);
  const promise = settings.openModal();

  const modal = document.querySelector(".j0n4t-pg-modal-overlay")!;
  modal.querySelector<HTMLSelectElement>("#j0n4t-pg-height-mode")!.value =
    "fixed";
  modal.querySelector<HTMLInputElement>("#j0n4t-pg-height-fixed")!.value =
    "480";
  modal.querySelector<HTMLButtonElement>('button[data-index="1"]')?.click(); // Save

  assert.equal(await promise, true);
  assert.equal(settings.heightMode, "fixed");
  assert.equal(settings.heightFixed, 480);
  assert.equal(dom.wrap.dataset.heightMode, "fixed");
  assert.equal(dom.wrap.style.getPropertyValue("--pg-fixed-height"), "480px");
  const saved = JSON.parse(map.get("pg_settings")!) as Record<string, unknown>;
  assert.equal(saved.heightMode, "fixed");
  assert.equal(saved.heightFixed, 480);
});

test("openModal save rounds the fixed height and falls back on an emptied one", async () => {
  const map = fakeStorage();
  const { settings } = makeSettings(makeDom());

  const first = settings.openModal();
  const modal = document.querySelector(".j0n4t-pg-modal-overlay")!;
  modal.querySelector<HTMLSelectElement>("#j0n4t-pg-height-mode")!.value =
    "fixed";
  modal.querySelector<HTMLInputElement>("#j0n4t-pg-height-fixed")!.value =
    "480.6";
  modal.querySelector<HTMLButtonElement>('button[data-index="1"]')?.click(); // Save
  assert.equal(await first, true);
  assert.equal(settings.heightFixed, 481, "rounded to a whole pixel");

  const second = settings.openModal();
  const emptied = document.querySelector(".j0n4t-pg-modal-overlay")!;
  emptied.querySelector<HTMLInputElement>("#j0n4t-pg-height-fixed")!.value = "";
  emptied.querySelector<HTMLButtonElement>('button[data-index="1"]')?.click(); // Save
  assert.equal(await second, true);
  assert.equal(
    settings.heightFixed,
    640,
    "an emptied input falls back to the default",
  );
  assert.equal(
    (JSON.parse(map.get("pg_settings")!) as Record<string, unknown>)
      .heightFixed,
    640,
  );
});

// --- preset libraries ---

test("the Display tab lists the libraries the server serves as a checkbox list", async () => {
  fakeStorage();
  const served = [
    { id: "main", name: "Main", default: true },
    { id: "socks", name: "Socks", default: false },
  ];
  // The list is filled from the fetch the modal kicks off, so it has to answer.
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(served), { status: 200 })) as typeof fetch;

  const { settings } = makeSettings();
  settings.disabledLibraries = ["socks"];

  const promise = settings.openModal();
  const modal = document.querySelector(".j0n4t-pg-modal-overlay")!;
  await new Promise((resolve) => setTimeout(resolve, 60));

  const rows = modal.querySelectorAll(".j0n4t-pg-library-row");
  assert.equal(rows.length, 2, "one row per served library");
  assert.equal(
    rows[0].getAttribute("data-id"),
    "main",
    "the enabled one comes first",
  );
  assert.equal(
    rows[1].getAttribute("data-id"),
    "socks",
    "the disabled one after it",
  );
  // the bundled library is always on and cannot be switched off
  assert.equal(
    rows[0].querySelector<HTMLInputElement>("input[data-role='enabled']")!
      .disabled,
    true,
  );
  assert.equal(
    rows[1].querySelector<HTMLInputElement>("input[data-role='enabled']")!
      .checked,
    false,
  );

  modal.querySelector<HTMLButtonElement>('button[data-index="0"]')?.click(); // Cancel
  assert.equal(await promise, false);
});

test("every library the server serves is enabled until the user switches one off", () => {
  fakeStorage();
  const dom = makeDom();
  const settings = new PresetGallerySettings({
    syncUI: () => {},
    widget: { value: "" },
    dom,
  } as unknown as GalleryContext);
  settings.libraries = [
    { id: "main", name: "Main", default: true },
    { id: "socks", name: "Socks", default: false },
    { id: "hair", name: "Hair", default: false },
  ];

  assert.deepEqual(
    settings.enabledIds(),
    ["main", "socks", "hair"],
    "the server's own order",
  );
  assert.equal(settings.isLibraryEnabled("hair"), true);
});

test("a saved order is honoured, and a library the server stopped serving is dropped", () => {
  fakeStorage({
    pg_settings: JSON.stringify({ libraryOrder: ["hair", "main"] }),
  });
  const dom = makeDom();
  const settings = new PresetGallerySettings({
    syncUI: () => {},
    widget: { value: "" },
    dom,
  } as unknown as GalleryContext);
  settings.libraries = [
    { id: "main", name: "Main", default: true },
    { id: "socks", name: "Socks", default: false },
    { id: "hair", name: "Hair", default: false },
  ];

  assert.deepEqual(settings.enabledIds(), ["hair", "main", "socks"]);
});

test("applyLibraries hands the enabled set to the gallery and persists the choice", () => {
  fakeStorage();
  const dom = makeDom();
  const calls: string[][] = [];
  const settings = new PresetGallerySettings({
    syncUI: () => {},
    widget: { value: "" },
    dom,
    applyLibraries: (ids: string[]) => calls.push(ids),
  } as unknown as GalleryContext);
  settings.libraries = [
    { id: "main", name: "Main", default: true },
    { id: "socks", name: "Socks", default: false },
  ];

  settings.applyLibraries(["main", "socks"]);
  assert.deepEqual(
    calls,
    [["main", "socks"]],
    "the gallery is asked to re-merge",
  );
  assert.deepEqual(
    (
      JSON.parse(localStorage.getItem("pg_settings")!) as Record<
        string,
        unknown
      >
    ).libraryOrder,
    ["main", "socks"],
  );
});

test("a saved single library id from before the multi-library change means all of them", () => {
  fakeStorage({ pg_settings: JSON.stringify({ libraryId: "sample" }) });
  const dom = makeDom();
  const settings = new PresetGallerySettings({
    syncUI: () => {},
    widget: { value: "" },
    dom,
  } as unknown as GalleryContext);
  settings.libraries = [
    { id: "main", name: "Main", default: true },
    { id: "sample", name: "Sample", default: false },
  ];
  assert.deepEqual(settings.enabledIds(), ["main", "sample"]);
});

test("toggleLibrary switches one library off and leaves the rest alone", () => {
  fakeStorage();
  const dom = makeDom();
  const calls: string[][] = [];
  const settings = new PresetGallerySettings({
    syncUI: () => {},
    widget: { value: "" },
    dom,
    applyLibraries: (ids: string[]) => calls.push(ids),
  } as unknown as GalleryContext);
  settings.libraries = [
    { id: "main", name: "Main", default: true },
    { id: "socks", name: "Socks", default: false },
    { id: "hair", name: "Hair", default: false },
  ];
  settings.modal = document.createElement("div");

  settings.toggleLibrary("socks");
  assert.deepEqual(settings.disabledLibraries, ["socks"]);
  assert.deepEqual(settings.enabledIds(), ["main", "hair"]);
  assert.deepEqual(calls, [["main", "hair"]]);

  settings.toggleLibrary("socks");
  assert.deepEqual(settings.disabledLibraries, [], "switching back on");
  // the stored merge order has socks at the end, so that is where it returns
  assert.deepEqual(settings.enabledIds(), ["main", "hair", "socks"]);
  assert.deepEqual(calls[1], ["main", "hair", "socks"]);
});

test("moveLibrary reorders the priority and clamps at both ends", () => {
  fakeStorage();
  const dom = makeDom();
  const calls: string[][] = [];
  const settings = new PresetGallerySettings({
    syncUI: () => {},
    widget: { value: "" },
    dom,
    applyLibraries: (ids: string[]) => calls.push(ids),
  } as unknown as GalleryContext);
  settings.libraries = [
    { id: "main", name: "Main", default: true },
    { id: "socks", name: "Socks", default: false },
    { id: "hair", name: "Hair", default: false },
  ];
  settings.modal = document.createElement("div");

  settings.moveLibrary("hair", -1);
  assert.deepEqual(settings.enabledIds(), ["main", "hair", "socks"]);
  assert.deepEqual(settings.libraryOrder, ["main", "hair", "socks"]);

  settings.moveLibrary("main", -1);
  assert.deepEqual(
    settings.enabledIds(),
    ["main", "hair", "socks"],
    "the top is clamped",
  );

  settings.moveLibrary("socks", 1);
  assert.deepEqual(
    settings.enabledIds(),
    ["main", "hair", "socks"],
    "the bottom is clamped",
  );

  settings.moveLibrary("ghost", -1);
  assert.deepEqual(
    settings.enabledIds(),
    ["main", "hair", "socks"],
    "an unknown id is ignored",
  );
  assert.equal(calls.length, 1, "only the real move re-applied");
});

test("syncLibraryList puts enabled libraries first and disables the bundled one", () => {
  fakeStorage();
  const dom = makeDom();
  const settings = new PresetGallerySettings({
    syncUI: () => {},
    widget: { value: "" },
    dom,
  } as unknown as GalleryContext);
  settings.libraries = [
    { id: "hair", name: "Hair", default: false },
    { id: "main", name: "Main", default: true },
    { id: "socks", name: "Socks", default: false },
  ];
  settings.disabledLibraries = ["hair"];
  settings.libraryOrder = ["socks", "main"];

  const modal = document.createElement("div");
  modal.innerHTML = `<div id="j0n4t-pg-library-list"></div>`;
  settings.syncLibraryList(modal);

  const rows = [...modal.querySelectorAll(".j0n4t-pg-library-row")];
  assert.deepEqual(
    rows.map((row) => row.getAttribute("data-id")),
    ["socks", "main", "hair"],
    "enabled in merge order, then the disabled ones",
  );
  assert.equal(
    rows[1].querySelector<HTMLInputElement>("input[data-role='enabled']")!
      .disabled,
    true,
    "the bundled library cannot be switched off",
  );
  assert.equal(
    rows[2].querySelector<HTMLInputElement>("input[data-role='enabled']")!
      .checked,
    false,
    "a served but disabled library is listed unchecked",
  );
});

// --- panel sizes ---

test("applyPanelSizes restores the stored sizes as inline heights", () => {
  fakeStorage({
    pg_settings: JSON.stringify({
      rememberPanelSizes: true,
      panelSizes: { basket: 150, editor: 70 },
    }),
  });
  const dom = makeDom();
  makeSettings(dom);

  assert.equal(dom.basketContainer.style.height, "150px");
  assert.equal(dom.inpPreset.style.height, "70px");
});

test("applyPanelSizes leaves the panels alone while the option is off", () => {
  fakeStorage({
    pg_settings: JSON.stringify({
      rememberPanelSizes: false,
      panelSizes: { basket: 150, editor: 70 },
    }),
  });
  const dom = makeDom();
  const { settings } = makeSettings(dom);

  assert.equal(
    dom.basketContainer.style.height,
    "",
    "the stored size is not applied",
  );
  assert.equal(dom.inpPreset.style.height, "");

  // Turning it off again clears whatever the browser had written on a drag.
  dom.basketContainer.style.height = "300px";
  settings.rememberPanelSizes = true;
  settings.applyPanelSizes();
  assert.equal(dom.basketContainer.style.height, "150px");
  settings.rememberPanelSizes = false;
  settings.applyPanelSizes();
  assert.equal(dom.basketContainer.style.height, "");
});

test("drops panel sizes that are not usable heights", () => {
  fakeStorage({
    pg_settings: JSON.stringify({
      rememberPanelSizes: true,
      panelSizes: { basket: "tall", editor: -5 },
    }),
  });
  const { settings } = makeSettings();
  assert.deepEqual(settings.panelSizes, {});
});

test("the Display tab remembers the panel-size flag", async () => {
  const map = fakeStorage({
    pg_settings: JSON.stringify({
      rememberPanelSizes: true,
      panelSizes: { basket: 150 },
    }),
  });
  const dom = makeDom();
  const { settings } = makeSettings(dom);
  assert.equal(
    dom.basketContainer.style.height,
    "150px",
    "restored before the modal opens",
  );

  const promise = settings.openModal();
  const modal = document.querySelector(".j0n4t-pg-modal-overlay")!;
  const check = modal.querySelector<HTMLInputElement>(
    "#j0n4t-pg-remember-panels",
  )!;
  assert.equal(check.checked, true, "seeded from the loaded value");

  check.checked = false;
  modal.querySelector<HTMLButtonElement>('button[data-index="1"]')?.click(); // Save

  assert.equal(await promise, true);
  assert.equal(settings.rememberPanelSizes, false);
  assert.equal(
    dom.basketContainer.style.height,
    "",
    "the applied size is cleared",
  );
  const saved = JSON.parse(map.get("pg_settings")!) as Record<string, unknown>;
  assert.equal(saved.rememberPanelSizes, false);
  assert.deepEqual(
    saved.panelSizes,
    { basket: 150 },
    "the sizes are kept for when it is turned back on",
  );
});

// --- the Import / Export tab ---

type ServedLibrary = { id: string; name: string; default: boolean };

/** The libraries the tab reads, and the caches it merges for the tree. */
function stubServedLibraries(
  libraries: ServedLibrary[],
  caches: Record<string, PresetCache>,
) {
  const originalFetchLibraries = PresetGalleryAPI.fetchLibraries;
  const originalFetchCaches = PresetGalleryAPI.fetchLibraryCaches;
  PresetGalleryAPI.fetchLibraries = async () => libraries;
  PresetGalleryAPI.fetchLibraryCaches = async () => caches;
  return () => {
    PresetGalleryAPI.fetchLibraries = originalFetchLibraries;
    PresetGalleryAPI.fetchLibraryCaches = originalFetchCaches;
  };
}

const SERVED: ServedLibrary[] = [
  { id: "main", name: "Main", default: true },
  { id: "styles", name: "Styles", default: false },
];

test("the Import / Export tab exports the libraries picked in bundle scope", async () => {
  fakeStorage();
  const { settings } = makeSettings();
  const restoreLibraries = stubServedLibraries(SERVED, {
    main: { "Faces/Portrait": { preset: "portrait" } },
    styles: { "Urban/Night": { preset: "night" } },
  });
  const originalExport = ExportUtils.exportLibraryBundle;
  /** @type {unknown[]} */
  let exported: unknown[] = [];

  try {
    ExportUtils.exportLibraryBundle = async (...args) => {
      exported = args;
    };

    const promise = settings.openModal();
    await tick(20);
    const modal = document.querySelector(".j0n4t-pg-modal-overlay");
    assert.ok(modal, "modal is mounted");
    modal.querySelector<HTMLButtonElement>(
      '.j0n4t-pg-tab-btn[data-tab="io"]',
    )?.click();
    await tick(20);

    const scope = modal.querySelector<HTMLSelectElement>(
      "#j0n4t-pg-io-scope",
    );
    assert.ok(scope);
    scope.value = "bundle";
    scope.dispatchEvent(new Event("change"));
    await tick();

    const boxes = modal.querySelectorAll<HTMLInputElement>(
      "#j0n4t-pg-io-bundle-tree .j0n4t-pg-bundle-lib-cb",
    );
    assert.equal(boxes.length, 2, "one row per library");
    assert.ok(boxes[0].checked && boxes[1].checked, "every library is picked");

    boxes[1].checked = false;
    boxes[1].dispatchEvent(new Event("change"));

    const format = modal.querySelector<HTMLSelectElement>(
      "#j0n4t-pg-io-format",
    );
    const mode = modal.querySelector<HTMLSelectElement>(
      "#j0n4t-pg-io-mode",
    );
    const colors = modal.querySelector<HTMLInputElement>(
      "#j0n4t-pg-io-colors",
    );
    if (format) format.value = "json";
    if (mode) mode.value = "preset-only";
    if (colors) colors.checked = false;

    modal.querySelector<HTMLButtonElement>("#j0n4t-pg-io-export")?.click();
    await tick(20);

    const picked = exported[0] as Array<{ id: string }>;
    assert.deepEqual(
      picked.map((library) => library.id),
      ["main"],
      "only the checked library is exported",
    );
    assert.equal(exported[2], "json");
    assert.equal(exported[3], "preset-only");
    assert.equal(exported[4], false);

    modal.querySelector<HTMLButtonElement>('button[data-index="0"]')?.click();
    assert.equal(await promise, false);
  } finally {
    ExportUtils.exportLibraryBundle = originalExport;
    restoreLibraries();
  }
});

test("the Import / Export tab exports the selected presets of one library", async () => {
  fakeStorage();
  const { settings } = makeSettings();
  const restoreLibraries = stubServedLibraries(SERVED, {
    main: {
      "Faces/Portrait": { preset: "portrait" },
      "Faces/Macro": { preset: "macro" },
    },
    styles: { "Urban/Night": { preset: "night" } },
  });
  const originalExport = ExportUtils.exportPresets;
  /** @type {Record<string, unknown> | undefined} */
  let exported: Record<string, unknown> | undefined;

  try {
    ExportUtils.exportPresets = async (config) => {
      exported = config as Record<string, unknown>;
    };

    const promise = settings.openModal();
    await tick(20);
    const modal = document.querySelector(".j0n4t-pg-modal-overlay");
    assert.ok(modal, "modal is mounted");
    modal.querySelector<HTMLButtonElement>(
      '.j0n4t-pg-tab-btn[data-tab="io"]',
    )?.click();
    await tick(20);

    const librarySelect = modal.querySelector<HTMLSelectElement>(
      "#j0n4t-pg-io-library",
    );
    assert.ok(librarySelect);
    assert.deepEqual(
      Array.from(librarySelect.options).map((option) => option.value),
      ["main", "styles"],
    );
    assert.equal(librarySelect.value, "main");

    const boxes = modal.querySelectorAll<HTMLInputElement>(
      "#j0n4t-pg-io-tree .j0n4t-pg-item-cb",
    );
    assert.equal(boxes.length, 2);
    for (const box of boxes) {
      box.checked = false;
      box.dispatchEvent(new Event("change"));
    }
    const portrait = modal.querySelector<HTMLInputElement>(
      '#j0n4t-pg-io-tree .j0n4t-pg-item-cb[value="Faces/Portrait"]',
    );
    assert.ok(portrait);
    portrait.checked = true;
    portrait.dispatchEvent(new Event("change"));

    modal.querySelector<HTMLButtonElement>("#j0n4t-pg-io-export")?.click();
    await tick(20);

    assert.equal(exported?.libraryId, "main");
    assert.equal(exported?.libraryName, "Main");
    assert.equal(exported?.format, "zip");
    assert.equal(exported?.mode, "full");
    assert.equal(exported?.includeColors, true);
    assert.deepEqual(exported?.selectedKeys, ["Faces/Portrait"]);

    modal.querySelector<HTMLButtonElement>('button[data-index="0"]')?.click();
    assert.equal(await promise, false);
  } finally {
    ExportUtils.exportPresets = originalExport;
    restoreLibraries();
  }
});

test("the settings tabs share one width and a moderate height", () => {
  // At 420px the four tab labels wrapped onto two lines: the labels need 456px
  // and the modal only offered 386. The tab bar is now wide enough, and a label
  // wraps as a whole rather than breaking mid-word.
  assert.match(
    PresetGallerySettings.STYLES,
    /\.j0n4t-pg-tab-btn\s*\{[^}]*white-space:\s*nowrap/,
    "tab labels never wrap mid-label",
  );
  assert.match(
    PresetGallerySettings.STYLES,
    /\.j0n4t-pg-tab-nav\s*\{[^}]*flex-wrap:\s*wrap/,
    "the tab bar wraps as a group when the viewport is too narrow",
  );

  // Rolling, Display and Keyboard Shortcuts measured 360 / 506 / 378 before
  // this, so the dialog jumped around as the tabs were switched.
  assert.match(
    PresetGallerySettings.STYLES,
    /\.j0n4t-pg-tab-panel\.active\s*\{[^}]*height:\s*55vh[^}]*min-height:\s*360px/,
    "every tab panel is one responsive height with a reasonable floor",
  );

  // The preset area is the flexible part of the Import / Export tab: it takes
  // what the tab height leaves and scrolls, so the tab never grows with the
  // library count.
  assert.match(
    PresetGallerySettings.STYLES,
    /\.j0n4t-pg-io-tree-field\s*\{[^}]*flex:\s*1[^}]*min-height:\s*0/,
    "the preset field yields to the tab height",
  );
  assert.match(
    PresetGallerySettings.STYLES,
    /\.j0n4t-pg-io-tree-field > div\s*\{[^}]*overflow-y:\s*auto/,
    "the preset view scrolls instead of the whole tab",
  );
});
