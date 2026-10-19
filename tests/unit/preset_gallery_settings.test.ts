import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import PresetGallerySettings from "../../web/PresetGallerySettings.js";

// PresetGallerySettings persists the roll preferences to localStorage and
// mirrors them onto the reroll dice button's classes. The context is a stub
// that records syncUI; localStorage is an in-memory mock.

function fakeStorage(initial: Record<string, string> = {}): Map<string, string> {
  const map = new Map<string, string>(Object.entries(initial));
  globalThis.localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
  } as unknown as Storage;
  return map;
}

function makeSettings(): {
  settings: PresetGallerySettings;
  syncUI: (val: string) => void;
  widgetValue: string;
} {
  const state = { widgetValue: "Faces/Portrait" };
  const syncUI = (val: string) => { state.widgetValue = val; };
  const settings = new PresetGallerySettings({
    syncUI,
    widget: { value: state.widgetValue },
  } as unknown as GalleryContext);
  return { settings, syncUI, widgetValue: state.widgetValue };
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
});

test("loads previously saved values", () => {
  fakeStorage({
    pg_settings: JSON.stringify({
      rollMin: 3,
      rollMax: 7,
      rollOnGeneration: true,
      rollOnSeedChange: true,
      diceBehavior: "overwrite",
    }),
  });
  const { settings } = makeSettings();
  assert.equal(settings.rollMin, 3);
  assert.equal(settings.rollMax, 7);
  assert.equal(settings.rollOnGeneration, true);
  assert.equal(settings.rollOnSeedChange, true);
  assert.equal(settings.diceBehavior, "overwrite");
});

test("falls back to defaults when the stored JSON is corrupt", () => {
  fakeStorage({ pg_settings: "{not json" });
  const { settings } = makeSettings();
  assert.equal(settings.rollMin, 10);
  assert.equal(settings.rollMax, 20);
  assert.equal(settings.diceBehavior, "variants");
});

test("save writes all five preferences", () => {
  const map = fakeStorage();
  const { settings } = makeSettings();
  settings.rollMin = 4;
  settings.rollMax = 9;
  settings.rollOnGeneration = true;
  settings.rollOnSeedChange = true;
  settings.diceBehavior = "overwrite";
  settings.save();
  assert.equal(
    map.get("pg_settings"),
    JSON.stringify({
      rollMin: 4,
      rollMax: 9,
      rollOnGeneration: true,
      rollOnSeedChange: true,
      diceBehavior: "overwrite",
    })
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

  const btn = document.querySelector<HTMLButtonElement>(".j0n4t-pg-basket-reroll-btn")!;
  assert.ok(btn.classList.contains("roll-variants"), "default behavior class");
  assert.ok(!btn.classList.contains("auto-roll"));
  assert.ok(!btn.classList.contains("auto-roll-seed"));

  settings.diceBehavior = "overwrite";
  settings.rollOnGeneration = true;
  settings.rollOnSeedChange = true;
  settings.updateDiceVisuals();

  assert.ok(btn.classList.contains("roll-overwrite"));
  assert.ok(!btn.classList.contains("roll-variants"), "the old behavior class is removed");
  assert.ok(btn.classList.contains("auto-roll"));
  assert.ok(btn.classList.contains("auto-roll-seed"));
});

// --- openModal ---

test("openModal renders the settings tab and switches tabs", async () => {
  fakeStorage();
  const { settings } = makeSettings();
  const promise = settings.openModal();

  const modal = document.querySelector(".j0n4t-pg-modal-overlay");
  assert.ok(modal, "modal is mounted");
  const minInput = modal.querySelector<HTMLInputElement>("#j0n4t-pg-roll-min");
  assert.equal(minInput?.value, "10", "min input is seeded from the loaded value");

  const tabs = modal.querySelectorAll<HTMLButtonElement>(".j0n4t-pg-tab-btn");
  tabs[1].click();
  assert.ok(modal.querySelector("#j0n4t-pg-tab-shortcuts")?.classList.contains("active"));
  assert.ok(!modal.querySelector("#j0n4t-pg-tab-settings")?.classList.contains("active"));
  tabs[0].click();
  assert.ok(modal.querySelector("#j0n4t-pg-tab-settings")?.classList.contains("active"));

  modal.querySelector<HTMLButtonElement>('button[data-index="0"]')?.click(); // Cancel
  assert.equal(await promise, false);
});

test("openModal save persists the inputs and syncs the widget", async () => {
  const map = fakeStorage();
  let synced: string | null = null;
  const settings = new PresetGallerySettings({
    syncUI: (val: string) => { synced = val; },
    widget: { value: "Faces/Portrait" },
  } as unknown as GalleryContext);

  const promise = settings.openModal();
  const modal = document.querySelector(".j0n4t-pg-modal-overlay")!;
  modal.querySelector<HTMLInputElement>("#j0n4t-pg-roll-min")!.value = "3";
  modal.querySelector<HTMLInputElement>("#j0n4t-pg-roll-max")!.value = "7";
  modal.querySelector<HTMLInputElement>("#j0n4t-pg-roll-on-gen")!.checked = true;
  modal.querySelector<HTMLSelectElement>("#j0n4t-pg-dice-behavior")!.value = "overwrite";
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
    })
  );
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
  assert.equal(settings.rollMax, 1, "an unparsable max reads as 0 and is raised to the min");
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
