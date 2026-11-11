import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import RawTextAutocomplete from "../../web/RawTextAutocomplete.js";
import PresetSession from "../../web/PresetSession.js";

// Minimal stand-in for GalleryContext; the autocomplete module carries the
// cache by reference into AutocompleteManager's getMatches.
const CACHE: PresetCache = {
  "Faces/Portrait": { preset: "portrait" },
};

function makeAuto(textareaValue = "", ignorePreset: string | null = null) {
  const textarea = document.createElement("textarea");
  textarea.value = textareaValue;
  const context = { cache: CACHE } as unknown as GalleryContext;
  const onSync = () => {};
  const manager = { updateHighlights: () => {} };
  return new RawTextAutocomplete(
    textarea,
    context,
    ignorePreset,
    onSync,
    manager,
  );
}

/** The meta labels of the popup a RawTextAutocomplete currently shows. */
function popupMetas(auto: RawTextAutocomplete): (string | null)[] {
  return Array.from(
    auto.autocompleteManager?.popupEl?.querySelectorAll(
      ".j0n4t-pg-autocomplete-meta",
    ) ?? [],
  ).map((el) => el.textContent);
}

test("ignorePreset is preserved from the constructor", () => {
  const auto = makeAuto("{Faces:y}", "Faces/Portrait");
  assert.equal(auto.ignorePreset, "Faces/Portrait");
});

test("init wires the textarea input and the manager", () => {
  const auto = makeAuto("hello");
  assert.equal(auto.textarea.value, "hello");
  assert.ok(
    auto.manager !== undefined,
    "the raw-text manager is forwarded to AutocompleteManager",
  );
});

test("a plain query offers a winning library's entry once, not under its hidden alias", () => {
  const session = new PresetSession({ storage: null });
  session.setLibraries(
    [
      { id: "main", name: "Main" },
      { id: "socks", name: "Socks" },
    ],
    {
      main: { "Faces/Portrait": { preset: "portrait" } },
      socks: { "Faces/Portrait": { preset: "socks portrait" } },
    },
  );

  const textarea = document.createElement("textarea");
  const context = { cache: session.cache } as unknown as GalleryContext;
  const auto = new RawTextAutocomplete(textarea, context, null, () => {}, {
    updateHighlights: () => {},
  });

  textarea.value = "portrait";
  textarea.dispatchEvent(new Event("input"));

  const metas = popupMetas(auto);
  assert.deepEqual(metas, ["Faces/Portrait", "socks#Faces/Portrait"]);
});

test("a query naming the qualifier can still ask for the alias spelling", () => {
  const session = new PresetSession({ storage: null });
  session.setLibraries(
    [
      { id: "main", name: "Main" },
      { id: "socks", name: "Socks" },
    ],
    {
      main: { "Faces/Portrait": { preset: "portrait" } },
      socks: { "Faces/Portrait": { preset: "socks portrait" } },
    },
  );

  const textarea = document.createElement("textarea");
  const context = { cache: session.cache } as unknown as GalleryContext;
  const auto = new RawTextAutocomplete(textarea, context, null, () => {}, {
    updateHighlights: () => {},
  });

  textarea.value = "main#";
  textarea.dispatchEvent(new Event("input"));

  assert.deepEqual(popupMetas(auto), ["main#Faces/Portrait"]);
});
