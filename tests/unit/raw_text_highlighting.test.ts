import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import RawTextHighlighting from "../../web/RawTextHighlighting.js";

// Minimal stand-in for GalleryContext; the highlighting module only reads
// context.cache inside updateHighlights.
const CACHE: PresetCache = {
  "Faces/Portrait": { preset: "portrait" },
};

function makeHighlighting(value = "", ignorePreset: string | null = null) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  const context = { cache: CACHE } as unknown as GalleryContext;
  const onSync = () => {};
  return new RawTextHighlighting(textarea, context, ignorePreset, onSync);
}

function highlightSpan(h: RawTextHighlighting) {
  return h.highlightsEl!.querySelector(".j0n4t-pg-raw-token") as HTMLElement;
}

test("empty value clears the highlights layer", () => {
  const h = makeHighlighting("");
  const el = document.createElement("div");
  h.attach(el);
  h.updateHighlights();
  assert.equal(h.highlightsEl!.innerHTML, "");
});

test("plain text renders escaped plain-text spans", () => {
  const h = makeHighlighting("a & b");
  const el = document.createElement("div");
  h.attach(el);
  h.updateHighlights();
  assert.equal(h.highlightsEl!.querySelectorAll(".j0n4t-pg-raw-token").length, 1);
  assert.ok(h.highlightsEl!.innerHTML.includes("a &amp; b"));
  assert.equal(h.highlightsEl!.querySelectorAll(".j0n4t-pg-raw-token")[0].textContent, "a & b");
});

test("tags render in the tag colour", () => {
  const h = makeHighlighting("<lora:xyz:0.5>");
  const el = document.createElement("div");
  h.attach(el);
  h.updateHighlights();
  const span = h.highlightsEl!.querySelector(".j0n4t-pg-raw-token") as HTMLElement;
  assert.equal(span.style.color, "rgb(79, 193, 255)");
});

test("variant tokens render bold in the group colour", () => {
  const h = makeHighlighting("{Faces:y}");
  const el = document.createElement("div");
  h.attach(el);
  h.updateHighlights();
  const span = h.highlightsEl!.querySelector(".j0n4t-pg-raw-token") as HTMLElement;
  assert.equal(span.style.fontWeight, "bold");
});

test("known presets render in the preset colour with a tooltip", () => {
  const h = makeHighlighting("Faces/Portrait");
  const el = document.createElement("div");
  h.attach(el);
  h.updateHighlights();
  const span = h.highlightsEl!.querySelector(".j0n4t-pg-raw-token") as HTMLElement;
  assert.match(span.style.color, /^rgb\(\d+, \d+, \d+\)$/);
  assert.ok(span.title.includes("Portrait [Faces/Portrait]"));
});

test("ignorePreset renders the ignored preset as plain text", () => {
  const h = makeHighlighting("Faces/Portrait");
  const el = document.createElement("div");
  h.attach(el);
  h.updateHighlights("Faces/Portrait");
  const span = highlightSpan(h);
  console.error("DEBUG span:", span.innerHTML, "classList:", Array.from(span.classList));
  assert.ok(span.classList.contains("plain-text"));
  assert.equal(span.title, "");
});

test("extractGroupName splits the group name from a variant", () => {
  assert.equal(RawTextHighlighting.extractGroupName("{Faces:Portrait}"), "Faces");
  assert.equal(RawTextHighlighting.extractGroupName("{Faces}"), "Faces");
  assert.equal(
    RawTextHighlighting.extractGroupName("{Faces:Portrait,Scenery:Landscape}"),
    "Faces"
  );
  assert.equal(RawTextHighlighting.extractGroupName("{}"), "");
});
