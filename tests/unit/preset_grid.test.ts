import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import PresetGrid from "../../web/PresetGrid.js";
import PresetDisplay from "../../web/PresetDisplay.js";
import ModalUtils from "../../web/ModalUtils.js";
import PresetGalleryAPI from "../../web/PresetGalleryAPI.js";

// PresetGrid owns the item grid: compile (grouped HTML), the filter
// pipeline, view switching and selection sync. The context supplies the
// collapsed/excluded lists and the widget; localStorage is mocked because
// the view and grouping flags persist there.

const CACHE: PresetCache = {
  "faces/portrait": { preset: "portrait, solo", filename: "data:image/png;base64,x" },
  "faces/macro": { preset: "macro shot" },
  "scenery/hills": { preset: "rolling hills" },
  rootpreset: { preset: "root text" },
  "_/hidden/thing": { preset: "secret" },
};

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

function makeGridContext() {
  const grid = document.createElement("div");
  grid.className = "j0n4t-pg-grid";
  const search = document.createElement("input");
  const searchClear = document.createElement("button");
  const btnHideHidden = document.createElement("button");
  const chkGroup = document.createElement("button");
  const btnGlobalCollapse = document.createElement("button");
  const viewsContainer = document.createElement("div");
  for (const view of ["small", "big", "list"]) {
    const btn = document.createElement("button");
    btn.className = "j0n4t-pg-view-btn";
    btn.dataset.view = view;
    viewsContainer.appendChild(btn);
  }
  document.body.append(grid, search, searchClear, btnHideHidden, chkGroup, btnGlobalCollapse, viewsContainer);

  const dom = { grid, search, searchClear, btnHideHidden, chkGroup, btnGlobalCollapse, viewsContainer };
  const state = {
    widgetValue: "",
    collapsed: [] as string[],
    excluded: [] as string[],
  };
  const context = {
    dom,
    widget: { value: "", callback: () => {} },
    getSelectedArray: () => state.widgetValue.split(",").map((s) => s.trim()).filter(Boolean),
    updateWidgetValue: (arr: string[]) => { state.widgetValue = arr.join(", "); },
    selectionKey: (key: string) => key,
    getCollapsedFolders: () => state.collapsed,
    setCollapsedFolders: (list: string[]) => { state.collapsed = list; },
    getExcludedRollFolders: () => state.excluded,
    setExcludedRollFolders: (list: string[]) => { state.excluded = list; },
    syncEditorHighlight: () => {},
  };
  return { context: context as unknown as GalleryContext, dom, state };
}

function makeGrid(): {
  grid: PresetGrid;
  context: GalleryContext;
  dom: {
    grid: HTMLDivElement;
    search: HTMLInputElement;
    searchClear: HTMLButtonElement;
    btnHideHidden: HTMLButtonElement;
    chkGroup: HTMLButtonElement;
    btnGlobalCollapse: HTMLButtonElement;
    viewsContainer: HTMLDivElement;
  };
  state: { widgetValue: string; collapsed: string[]; excluded: string[] };
} {
  const { context, dom, state } = makeGridContext();
  const grid = new PresetGrid(context);
  return { grid, context, dom, state };
}

function items(grid: PresetGrid): HTMLElement[] {
  return Array.from(grid.dom.grid.querySelectorAll<HTMLElement>(".j0n4t-pg-item"));
}

function headers(grid: PresetGrid): HTMLElement[] {
  return Array.from(grid.dom.grid.querySelectorAll<HTMLElement>(".j0n4t-pg-group-header"));
}

function headerByGroup(grid: PresetGrid, rawGroup: string): HTMLElement | null {
  return headers(grid).find((h) => h.dataset.groupRaw === rawGroup) ?? null;
}

beforeEach(() => {
  fakeStorage();
});

// --- compile ---

test("compile renders one item per preset under a group header", () => {
  const { grid } = makeGrid();
  grid.compile(CACHE);

  assert.equal(items(grid).length, 5, "the underscore preset is compiled too");
  const groups = headers(grid).map((h) => h.dataset.group);
  // the root preset sorts first but compiles without a header: its uiFolder is
  // the empty string, which never differs from the initial lastGroup
  assert.deepEqual(groups, ["faces", "scenery", "_ › hidden"],
    "groups sort alphabetically with underscore folders last; root presets get no header");
});

test("compile fills the item attributes the filter and drag depend on", () => {
  const { grid } = makeGrid();
  grid.compile(CACHE);

  const portrait = items(grid).find((el) => el.dataset.style === "faces/portrait")!;
  assert.ok((portrait.dataset.searchBlob || "").includes("portrait"));
  assert.equal(portrait.getAttribute("aria-selected"), "false");
  assert.ok(portrait.title?.includes("[faces/portrait]"));
});

test("compile renders an image thumbnail only for items with a filename", () => {
  const { grid } = makeGrid();
  grid.compile(CACHE);

  const withImage = items(grid).find((el) => el.dataset.style === "faces/portrait")!;
  assert.ok(withImage.querySelector("img.j0n4t-pg-img"));

  const withoutImage = items(grid).find((el) => el.dataset.style === "faces/macro")!;
  assert.ok(!withoutImage.querySelector("img.j0n4t-pg-img"), "no img without a filename");
  assert.ok(withoutImage.querySelector(".j0n4t-pg-thumb-box svg"), "an icon placeholder renders instead");
});

test("compile renders folder badges only on nested presets", () => {
  const { grid } = makeGrid();
  grid.compile(CACHE);

  const portrait = items(grid).find((el) => el.dataset.style === "faces/portrait")!;
  assert.ok(portrait.querySelector(".j0n4t-pg-tag-badge"), "folder preset carries a badge");
  const root = items(grid).find((el) => el.dataset.style === "rootpreset")!;
  assert.ok(!root.querySelector(".j0n4t-pg-tag-badge"), "root preset carries none");
});

test("compile marks collapsed folders and excluded roll toggles", () => {
  const { grid, context } = makeGrid();
  context.setCollapsedFolders(["faces"]);
  context.setExcludedRollFolders(["scenery"]);
  grid.compile(CACHE);

  assert.ok(headerByGroup(grid, "faces")?.classList.contains("collapsed"));
  assert.equal(headerByGroup(grid, "faces")?.getAttribute("aria-expanded"), "false");
  assert.ok(headerByGroup(grid, "scenery")?.querySelector(".j0n4t-pg-group-roll-toggle.excluded"));
});

test("compile renders an empty-state message for an empty cache", () => {
  const { grid } = makeGrid();
  grid.compile({});
  assert.equal(items(grid).length, 0);
  assert.ok(grid.dom.grid.innerHTML.includes("No presets found"));
});

// --- executeFilterPipeline ---

test("executeFilterPipeline hides non-matching items and shows the clear button", () => {
  const { grid, dom } = makeGrid();
  grid.compile(CACHE);

  grid.executeFilterPipeline("portrait");
  assert.ok(!items(grid).find((el) => el.dataset.style === "faces/portrait")?.classList.contains("j0n4t-pg-hidden"));
  assert.equal(items(grid).filter((el) => el.classList.contains("j0n4t-pg-hidden")).length, 4);
  assert.equal(dom.searchClear.style.display, "flex");

  grid.executeFilterPipeline("");
  for (const el of items(grid)) {
    if (el.dataset.style?.startsWith("_")) continue;
    assert.ok(!el.classList.contains("j0n4t-pg-hidden"), `${el.dataset.style} is visible again`);
  }
  assert.equal(dom.searchClear.style.display, "none");
});

test("executeFilterPipeline hides underscore presets unless show-hidden is active", () => {
  const { grid, dom } = makeGrid();
  grid.compile(CACHE);

  grid.executeFilterPipeline("");
  const hidden = items(grid).find((el) => el.dataset.style === "_/hidden/thing")!;
  assert.ok(hidden.classList.contains("j0n4t-pg-hidden"), "underscore presets are hidden by default");

  dom.btnHideHidden.classList.add("active");
  grid.executeFilterPipeline("");
  assert.ok(!hidden.classList.contains("j0n4t-pg-hidden"), "the show-hidden toggle reveals them");
});

// --- switchView ---

test("switchView swaps the grid class, the active button and the stored view", () => {
  const { grid, dom } = makeGrid();

  grid.switchView("list");
  assert.ok(dom.grid.classList.contains("view-list"));
  assert.ok(!dom.grid.classList.contains("view-big"));
  const listBtn = dom.viewsContainer.querySelector<HTMLButtonElement>('[data-view="list"]')!;
  const bigBtn = dom.viewsContainer.querySelector<HTMLButtonElement>('[data-view="big"]')!;
  assert.ok(listBtn.classList.contains("active"));
  assert.equal(listBtn.getAttribute("aria-pressed"), "true");
  assert.ok(!bigBtn.classList.contains("active"));
  assert.equal(localStorage.getItem("comfy_preset_gallery_view"), "list");
});

// --- syncSelection ---

test("syncSelection marks the selected items", () => {
  const { grid } = makeGrid();
  grid.compile(CACHE);

  grid.syncSelection(["faces/portrait", "rootpreset"]);
  const portrait = items(grid).find((el) => el.dataset.style === "faces/portrait")!;
  const macro = items(grid).find((el) => el.dataset.style === "faces/macro")!;
  assert.ok(portrait.classList.contains("selected"));
  assert.equal(portrait.getAttribute("aria-selected"), "true");
  assert.ok(!macro.classList.contains("selected"));

  grid.syncSelection([]);
  assert.ok(!portrait.classList.contains("selected"));
});

// --- group collapse ---

test("clicking a group header collapses and expands its items", () => {
  const { grid, context } = makeGrid();
  grid.compile(CACHE);

  headerByGroup(grid, "faces")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.deepEqual(context.getCollapsedFolders(), ["faces"]);
  const portrait = items(grid).find((el) => el.dataset.style === "faces/portrait")!;
  assert.ok(portrait.classList.contains("j0n4t-pg-hidden"), "collapsed children are hidden");

  headerByGroup(grid, "faces")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.deepEqual(context.getCollapsedFolders(), []);
  assert.ok(!portrait.classList.contains("j0n4t-pg-hidden"));
});

// --- global collapse / grouping / show-hidden ---

test("the global collapse button collapses every header, then expands them", () => {
  const { grid, dom, context } = makeGrid();
  grid.compile(CACHE);
  dom.btnGlobalCollapse.title = "Collapse All";

  dom.btnGlobalCollapse.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.ok(headers(grid).every((h) => h.classList.contains("collapsed")));
  assert.deepEqual(context.getCollapsedFolders(), ["faces", "scenery", "_/hidden"]);
  assert.equal(dom.btnGlobalCollapse.title, "Expand All");

  dom.btnGlobalCollapse.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.ok(headers(grid).every((h) => !h.classList.contains("collapsed")));
});

test("the grouping checkbox hides the headers and persists the flag", () => {
  const { grid, dom } = makeGrid();
  grid.compile(CACHE);
  assert.ok(dom.grid.classList.contains("hide-folders") === false, "grouped by default");

  dom.chkGroup.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.ok(dom.grid.classList.contains("hide-folders"));
  assert.equal(localStorage.getItem("comfy_preset_gallery_grouped"), "false");

  dom.chkGroup.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.ok(!dom.grid.classList.contains("hide-folders"));
  assert.equal(localStorage.getItem("comfy_preset_gallery_grouped"), "true");
});

test("the show-hidden button persists its flag", () => {
  const { dom } = makeGrid();

  dom.btnHideHidden.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.ok(dom.btnHideHidden.classList.contains("active"));
  assert.equal(localStorage.getItem("comfy_preset_gallery_show_hidden"), "true");

  dom.btnHideHidden.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.equal(localStorage.getItem("comfy_preset_gallery_show_hidden"), "false");
});

// --- roll toggle and item click ---

test("the roll toggle excludes and re-includes a folder", () => {
  const { grid, context } = makeGrid();
  grid.compile(CACHE);

  const toggle = headerByGroup(grid, "scenery")!.querySelector(".j0n4t-pg-group-roll-toggle")!;
  toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.deepEqual(context.getExcludedRollFolders(), ["scenery"]);

  headerByGroup(grid, "scenery")!.querySelector(".j0n4t-pg-group-roll-toggle")!
    .dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.deepEqual(context.getExcludedRollFolders(), []);
});

test("renaming a grid group supports nested paths and updates qualified selections", async () => {
  const originalPrompt = ModalUtils.prompt;
  const originalRenameFolder = PresetGalleryAPI.renameFolder;
  const { grid, context, state } = makeGrid();
  const renameCalls: unknown[][] = [];
  context.session = {
    ownerOfFolder: () => "main",
    ownerOfKey: () => "main",
    isDuplicateKey: () => false,
    libraryName: (id: string) => id,
  } as unknown as GalleryContext["session"];
  context.loadGallery = async () => {};
  context.setCollapsedFolders = () => {};
  state.widgetValue = "faces/portrait, sample#faces/macro, scenery/hills";
  ModalUtils.prompt = async () => "People / Portraits";
  PresetGalleryAPI.renameFolder = async (...args) => {
    renameCalls.push(args);
    return { success: true };
  };

  try {
    grid.compile(CACHE);
    headerByGroup(grid, "faces")!
      .querySelector<HTMLElement>(".j0n4t-pg-group-edit")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(renameCalls, [["faces", "people/portraits", "main"]]);
    assert.equal(
      state.widgetValue,
      "people/portraits/portrait, sample#people/portraits/macro, scenery/hills"
    );
  } finally {
    ModalUtils.prompt = originalPrompt;
    PresetGalleryAPI.renameFolder = originalRenameFolder;
  }
});

test("clicking an item toggles it in the widget selection", () => {
  const { grid, state } = makeGrid();
  grid.compile(CACHE);

  const portrait = items(grid).find((el) => el.dataset.style === "faces/portrait")!;
  portrait.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.equal(state.widgetValue, "faces/portrait");

  portrait.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.equal(state.widgetValue, "");
});

// --- library merge ---

test("a name shared by two libraries is listed once per library, each tagged", () => {
  const { grid, context } = makeGrid();
  // The merge files the entry the winner displaced under `libraryId#key`.
  context.session = {
    isDuplicateKey: (key: string) => PresetDisplay.getPresetFolder(key) === "wear/sock",
    ownerOfKey: (key: string) => {
      if (key.startsWith("main#") || key === "Faces/Portrait") return "main";
      return "socks";
    },
    libraryName: (id: string) => id,
  } as unknown as GalleryContext["session"];

  grid.compile({
    "wear/sock/ankle": { preset: "socks ankle" },
    "main#wear/sock/ankle": { preset: "main ankle" },
    "Faces/Portrait": { preset: "portrait" },
  });

  const rows = items(grid);
  const winner = rows.find((el) => el.dataset.style === "wear/sock/ankle")!;
  const shadowed = rows.find((el) => el.dataset.style === "main#wear/sock/ankle")!;
  const plain = rows.find((el) => el.dataset.style === "Faces/Portrait")!;

  assert.equal(winner.querySelectorAll(".j0n4t-pg-lib-badge").length, 1, "the winner is tagged too");
  assert.equal(winner.querySelector(".j0n4t-pg-lib-badge")!.textContent, "socks");
  assert.equal(shadowed.querySelector(".j0n4t-pg-lib-badge")!.textContent, "main");
  assert.equal(plain.querySelectorAll(".j0n4t-pg-lib-badge").length, 0, "a unique name is not tagged");
});

test("grid items can hide library badges", () => {
  const { grid, context } = makeGrid();
  context.settings = { showGridLibraryBadges: false } as GalleryContext["settings"];
  context.session = {
    isDuplicateKey: () => true,
    ownerOfKey: () => "socks",
    libraryName: () => "Socks",
  } as unknown as GalleryContext["session"];

  grid.compile({ "wear/sock/ankle": { preset: "socks ankle" } });
  assert.equal(items(grid)[0].querySelector(".j0n4t-pg-lib-badge"), null);
});

test("grid items show badges for unique presets from non-main libraries", () => {
  const { grid, context } = makeGrid();
  context.session = {
    isDuplicateKey: () => false,
    ownerOfKey: (key: string) => key === "socks/wool" ? "socks" : "main",
    libraryName: () => "Socks",
  } as unknown as GalleryContext["session"];

  grid.compile({ "socks/wool": { preset: "wool" } });
  assert.equal(items(grid)[0].querySelector(".j0n4t-pg-lib-badge")?.textContent, "Socks");
});

test("clicking an item asks the context for the key it should store", () => {
  const { grid, context, state } = makeGrid();
  grid.compile(CACHE);
  // The context decides whether the chip keeps its library qualifier.
  context.selectionKey = (key: string) => `socks#${key}`;

  items(grid).find((el) => el.dataset.style === "faces/portrait")!
    .dispatchEvent(new MouseEvent("click", { bubbles: true }));

  assert.equal(state.widgetValue, "socks#faces/portrait");
});

test("hovered title shows library qualifier for non-default libraries and duplicates", () => {
  const { grid, context } = makeGrid();
  context.session = {
    isDuplicateKey: (key: string) => key === "wear/sock/ankle",
    ownerOfKey: (key: string) => {
      if (key.startsWith("b#") || key === "b/item") return "b";
      return "main";
    },
    libraryName: (id: string) => id,
  } as unknown as GalleryContext["session"];

  grid.compile({
    "Faces/Portrait": { preset: "portrait text" },
    "b/item": { preset: "b text" },
    "b#wear/sock/ankle": { preset: "sock text" },
  });

  const rows = items(grid);
  const mainRow = rows.find((el) => el.dataset.style === "Faces/Portrait")!;
  const bRow = rows.find((el) => el.dataset.style === "b/item")!;
  const qualifiedRow = rows.find((el) => el.dataset.style === "b#wear/sock/ankle")!;

  // Default main item tooltip uses plain key
  assert.ok(mainRow.getAttribute("title")?.includes("[Faces/Portrait]"));
  // Non-main library item tooltip includes library qualifier
  assert.ok(bRow.getAttribute("title")?.includes("[b#b/item]"));
  // Explicitly qualified item tooltip retains qualifier
  assert.ok(qualifiedRow.getAttribute("title")?.includes("[b#wear/sock/ankle]"));
});
