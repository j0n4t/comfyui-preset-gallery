import { test } from "node:test";
import assert from "node:assert/strict";
import PresetBasketTabs from "../../web/PresetBasketTabs.js";
import RollManager from "../../web/RollManager.js";

// The tab state that used to live inside PresetBasket: which tabs exist, which
// one is active, the snapshot each holds and the one storage key they live
// under. No DOM, so these are plain state assertions.

function fakeStorage(
  initial: Record<string, string> = {},
): Storage & { _map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
    _map: map,
  };
}

function makeEnv({
  storage = fakeStorage(),
  selection = [] as string[],
  pins = [] as string[],
}: {
  storage?: ReturnType<typeof fakeStorage>;
  selection?: string[];
  pins?: string[];
} = {}) {
  const pinned = new Set<string>(pins);
  const rollManager = new RollManager();
  const calls = {
    restoreTabSelection: [] as BasketTab[],
    updateWidgetValue: [] as string[][],
  };
  let widgetValue = selection.join(", ");

  const context = {
    getSelectedArray: () =>
      widgetValue
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    pinnedChips: pinned,
    rollManager,
    restoreTabSelection: (tab: BasketTab) => {
      calls.restoreTabSelection.push(tab);
      widgetValue = (tab.basket || []).join(", ");
      pinned.clear();
      for (const pin of tab.pins || []) pinned.add(pin);
      rollManager.rolls = { ...(tab.rolls || {}) };
    },
    updateWidgetValue: (arr: string[]) => {
      calls.updateWidgetValue.push(arr);
      widgetValue = arr.join(", ");
    },
  };

  const tabs = new PresetBasketTabs(context as unknown as GalleryContext, {
    storage,
  });
  return {
    tabs,
    storage,
    calls,
    pinned,
    rollManager,
    widgetValue: () => widgetValue,
    setSelection: (arr: string[]) => {
      widgetValue = arr.join(", ");
    },
  };
}

const savedPayload = (tabs: BasketTab[], activeTabId: string) =>
  JSON.stringify({ tabs, activeTabId });

const tab = (
  id: string,
  basket: string[] = [],
  pins: string[] = [],
): BasketTab => ({
  id,
  title: id,
  basket,
  pins,
  rolls: {},
});

// --- load ---

test("load starts one tab from the live selection and persists it", () => {
  const env = makeEnv({
    selection: ["faces/portrait"],
    pins: ["faces/portrait"],
  });

  const restored = env.tabs.load();

  assert.equal(restored, false, "nothing came from storage");
  assert.equal(env.tabs.tabs.length, 1);
  assert.equal(env.tabs.tabs[0].title, "Basket");
  assert.deepEqual(env.tabs.tabs[0].basket, ["faces/portrait"]);
  assert.deepEqual(env.tabs.tabs[0].pins, ["faces/portrait"]);
  assert.equal(env.tabs.activeTabId, env.tabs.tabs[0].id);

  const saved = JSON.parse(
    env.storage._map.get("comfy_preset_gallery_basket_tabs")!,
  );
  assert.equal(saved.activeTabId, env.tabs.activeTabId);
  assert.equal(saved.tabs.length, 1);
});

test("load restores the saved tabs and installs only the saved active one", () => {
  const env = makeEnv({
    storage: fakeStorage({
      comfy_preset_gallery_basket_tabs: savedPayload(
        [
          tab("t1", ["faces/portrait"], ["faces/portrait"]),
          tab("t2", ["faces/macro"]),
        ],
        "t2",
      ),
    }),
  });

  assert.equal(env.tabs.load(), true);
  assert.deepEqual(
    env.tabs.tabs.map((t) => t.id),
    ["t1", "t2"],
  );
  assert.equal(env.tabs.activeTabId, "t2");
  assert.equal(
    env.widgetValue(),
    "faces/macro",
    "the active tab's basket is installed",
  );
  assert.deepEqual(
    env.calls.restoreTabSelection.map((t) => t.id),
    ["t2"],
  );
});

test("load falls back to the first tab when the saved active id is gone", () => {
  const env = makeEnv({
    storage: fakeStorage({
      comfy_preset_gallery_basket_tabs: savedPayload(
        [tab("t1", ["faces/portrait"])],
        "missing",
      ),
    }),
  });

  env.tabs.load();

  assert.equal(env.tabs.activeTabId, "t1");
});

test("load survives a malformed payload by starting a default tab", () => {
  const env = makeEnv({
    storage: fakeStorage({ comfy_preset_gallery_basket_tabs: "{not json" }),
  });

  assert.equal(env.tabs.load(), false);
  assert.equal(env.tabs.tabs.length, 1);
  assert.equal(env.tabs.active()?.title, "Basket");
});

test("load with no storage still works", () => {
  const env = makeEnv();
  env.tabs.storage = null;

  assert.equal(env.tabs.load(), false);
  assert.equal(env.tabs.tabs.length, 1);
});

// --- switching ---

test("switchTo snapshots the outgoing tab, installs the incoming one and persists once", () => {
  const env = makeEnv({
    storage: fakeStorage({
      comfy_preset_gallery_basket_tabs: savedPayload(
        [tab("t1"), tab("t2", ["faces/macro"])],
        "t1",
      ),
    }),
  });
  env.tabs.load();
  env.setSelection(["faces/portrait"]);
  env.pinned.add("faces/portrait");
  let writes = 0;
  const setItem = env.storage.setItem;
  env.storage.setItem = (k: string, v: string) => {
    writes++;
    setItem(k, v);
  };

  assert.equal(env.tabs.switchTo("t2"), true);

  assert.equal(env.tabs.activeTabId, "t2");
  assert.deepEqual(
    env.tabs.tabs[0].basket,
    ["faces/portrait"],
    "the outgoing tab kept its selection",
  );
  assert.deepEqual(env.tabs.tabs[0].pins, ["faces/portrait"]);
  assert.equal(env.widgetValue(), "faces/macro");
  assert.equal(writes, 1, "one storage write for the whole switch");
});

test("switchTo refuses the active tab and unknown ids", () => {
  const env = makeEnv({
    storage: fakeStorage({
      comfy_preset_gallery_basket_tabs: savedPayload([tab("t1")], "t1"),
    }),
  });
  env.tabs.load();

  assert.equal(env.tabs.switchTo("t1"), false);
  assert.equal(env.tabs.switchTo("nope"), false);
  assert.equal(
    env.calls.restoreTabSelection.length,
    1,
    "only the load restored anything",
  );
});

test("isActive and find read the current tab list", () => {
  const env = makeEnv({
    storage: fakeStorage({
      comfy_preset_gallery_basket_tabs: savedPayload(
        [tab("t1"), tab("t2")],
        "t1",
      ),
    }),
  });
  env.tabs.load();

  assert.equal(env.tabs.isActive("t1"), true);
  assert.equal(env.tabs.isActive("t2"), false);
  assert.equal(env.tabs.isActive(null), false);
  assert.equal(env.tabs.find("t2")?.id, "t2");
  assert.equal(env.tabs.find("nope"), null);
  assert.equal(env.tabs.active()?.id, "t1");
});

// --- create / duplicate / remove ---

test("create appends an empty tab, makes it active and restores it", () => {
  const env = makeEnv({ selection: ["faces/portrait"] });
  env.tabs.load();

  const created = env.tabs.create();

  assert.equal(env.tabs.tabs.length, 2);
  assert.equal(created.title, "Basket 2");
  assert.deepEqual(created.basket, []);
  assert.equal(env.tabs.activeTabId, created.id);
  assert.deepEqual(
    env.tabs.tabs[0].basket,
    ["faces/portrait"],
    "the previous tab was snapshotted",
  );
  assert.equal(env.widgetValue(), "");
});

test("create can start a tab from chips with a title", () => {
  const env = makeEnv();
  env.tabs.load();

  const created = env.tabs.create({
    chips: ["faces/portrait", "faces/macro"],
    title: "Portrait",
  });

  assert.equal(created.title, "Portrait");
  assert.deepEqual(created.basket, ["faces/portrait", "faces/macro"]);
  assert.equal(env.widgetValue(), "faces/portrait, faces/macro");
});

test("duplicate copies the source tab's selection, pins and rolls", () => {
  const env = makeEnv({
    selection: ["faces/portrait"],
    pins: ["faces/portrait"],
  });
  env.tabs.load();
  env.rollManager.rolls = { scenery_0: "Scenery/Sky" };

  const source = env.tabs.tabs[0];
  const copy = env.tabs.duplicate(source.id);

  assert.ok(copy);
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.title, "Basket Copy");
  assert.deepEqual(copy.basket, ["faces/portrait"]);
  assert.deepEqual(copy.pins, ["faces/portrait"]);
  assert.deepEqual(copy.rolls, { scenery_0: "Scenery/Sky" });
  assert.equal(env.tabs.activeTabId, copy.id);
  assert.equal(env.tabs.tabs.length, 2);
});

test("duplicate of an unknown tab does nothing", () => {
  const env = makeEnv();
  env.tabs.load();

  assert.equal(env.tabs.duplicate("nope"), null);
  assert.equal(env.tabs.tabs.length, 1);
});

test("remove refuses the last tab and unknown ids", () => {
  const env = makeEnv();
  env.tabs.load();

  assert.equal(env.tabs.remove(env.tabs.tabs[0].id), false);
  assert.equal(env.tabs.remove("nope"), false);
  assert.equal(env.tabs.tabs.length, 1);
});

test("removing the active tab falls back to its neighbour and restores it", () => {
  const env = makeEnv({
    storage: fakeStorage({
      comfy_preset_gallery_basket_tabs: savedPayload(
        [
          tab("t1", ["faces/portrait"]),
          tab("t2", ["faces/macro"]),
          tab("t3", ["scenery/hills"]),
        ],
        "t2",
      ),
    }),
  });
  env.tabs.load();

  assert.equal(env.tabs.remove("t2"), true);

  assert.deepEqual(
    env.tabs.tabs.map((t) => t.id),
    ["t1", "t3"],
  );
  assert.equal(env.tabs.activeTabId, "t1", "the previous tab takes over");
  assert.equal(env.widgetValue(), "faces/portrait");
});

test("removing an inactive tab leaves the active one alone", () => {
  const env = makeEnv({
    storage: fakeStorage({
      comfy_preset_gallery_basket_tabs: savedPayload(
        [tab("t1", ["faces/portrait"]), tab("t2")],
        "t1",
      ),
    }),
  });
  env.tabs.load();
  const restores = env.calls.restoreTabSelection.length;

  assert.equal(env.tabs.remove("t2"), true);

  assert.equal(env.tabs.activeTabId, "t1");
  assert.equal(env.widgetValue(), "faces/portrait");
  assert.equal(
    env.calls.restoreTabSelection.length,
    restores,
    "no restore for an inactive removal",
  );
});

// --- append / rename / import ---

test("appendChips writes the active tab's selection through the app", () => {
  const env = makeEnv({ selection: ["faces/portrait"] });
  env.tabs.load();

  assert.equal(
    env.tabs.appendChips(env.tabs.activeTabId!, ["faces/macro"]),
    true,
  );

  assert.deepEqual(env.tabs.tabs[0].basket, ["faces/portrait", "faces/macro"]);
  assert.deepEqual(env.calls.updateWidgetValue.at(-1), [
    "faces/portrait",
    "faces/macro",
  ]);
  assert.equal(env.widgetValue(), "faces/portrait, faces/macro");
});

test("appendChips to an inactive tab only touches its snapshot", () => {
  const env = makeEnv({
    storage: fakeStorage({
      comfy_preset_gallery_basket_tabs: savedPayload(
        [tab("t1", ["faces/portrait"]), tab("t2")],
        "t1",
      ),
    }),
  });
  env.tabs.load();

  assert.equal(env.tabs.appendChips("t2", ["faces/macro"]), true);

  assert.deepEqual(env.tabs.tabs[1].basket, ["faces/macro"]);
  assert.equal(env.widgetValue(), "faces/portrait", "the widget is untouched");
  assert.equal(env.calls.updateWidgetValue.length, 0);
});

test("appendChips ignores an empty list and unknown tabs", () => {
  const env = makeEnv();
  env.tabs.load();

  assert.equal(env.tabs.appendChips(env.tabs.activeTabId!, []), false);
  assert.equal(env.tabs.appendChips("nope", ["faces/macro"]), false);
});

test("rename renames the active tab and persists it", () => {
  const env = makeEnv();
  env.tabs.load();

  assert.equal(env.tabs.rename("Moodboard"), true);
  assert.equal(env.tabs.active()?.title, "Moodboard");

  const saved = JSON.parse(
    env.storage._map.get("comfy_preset_gallery_basket_tabs")!,
  );
  assert.equal(saved.tabs[0].title, "Moodboard");
});

test("insertMany accepts arrays and comma separated strings without switching", () => {
  const env = makeEnv({ selection: ["faces/portrait"] });
  env.tabs.load();

  const added = env.tabs.insertMany([
    {
      title: "Imported",
      basket: "faces/macro, scenery/hills",
      pins: "faces/macro",
    },
    { basket: ["faces/variants"] },
  ]);

  assert.equal(added, 2);
  assert.equal(env.tabs.tabs.length, 3);
  assert.deepEqual(env.tabs.tabs[1].basket, ["faces/macro", "scenery/hills"]);
  assert.deepEqual(env.tabs.tabs[1].pins, ["faces/macro"]);
  assert.equal(env.tabs.tabs[2].title, "Imported Tab");
  assert.equal(
    env.tabs.activeTabId,
    env.tabs.tabs[0].id,
    "the active tab is unchanged",
  );
});

// --- snapshots ---

test("snapshot records the live selection, pins and rolls, and can skip the write", () => {
  const env = makeEnv({
    selection: ["faces/portrait"],
    pins: ["faces/portrait"],
  });
  env.tabs.load();
  env.rollManager.rolls = { scenery_0: "Scenery/Sky" };
  let writes = 0;
  const setItem = env.storage.setItem;
  env.storage.setItem = (k: string, v: string) => {
    writes++;
    setItem(k, v);
  };

  env.tabs.snapshot(true);
  assert.equal(writes, 0, "skipPersist leaves storage alone");

  env.tabs.snapshot();
  assert.equal(writes, 1);
  assert.deepEqual(env.tabs.tabs[0].basket, ["faces/portrait"]);
  assert.deepEqual(env.tabs.tabs[0].rolls, { scenery_0: "Scenery/Sky" });
});

test("snapshotList records the selection the basket rendered and persists", () => {
  const env = makeEnv();
  env.tabs.load();
  env.setSelection(["faces/portrait"]);

  env.tabs.snapshotList(["faces/macro"]);

  assert.deepEqual(env.tabs.tabs[0].basket, ["faces/macro"]);
  const saved = JSON.parse(
    env.storage._map.get("comfy_preset_gallery_basket_tabs")!,
  );
  assert.deepEqual(saved.tabs[0].basket, ["faces/macro"]);
});

test("newId never collides with an existing tab", () => {
  const env = makeEnv();
  env.tabs.load();
  const existing = env.tabs.tabs[0].id;

  for (let i = 0; i < 20; i++) {
    assert.notEqual(env.tabs.newId(), existing);
  }
});
