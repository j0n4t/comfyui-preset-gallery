import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import RawTextareaManager from "../../web/RawTextareaManager.js";

// RawTextareaManager overlays syntax highlights on a textarea. Token
// rendering, the ignorePreset rule and the char-position math are unit
// testable; the mousemove tooltip works at the origin because jsdom reports
// a zero-size box (any other point falls outside and clears the title).

const CACHE: PresetCache = {
  "Faces/Portrait": { preset: "portrait" },
};

function makeManager(value = "", ignorePreset: string | null = null) {
  const container = document.createElement("div");
  const textarea = document.createElement("textarea");
  textarea.value = value;
  container.appendChild(textarea);
  document.body.appendChild(container);

  let synced: string | null = null;
  const manager = new RawTextareaManager(
    textarea,
    { cache: CACHE } as unknown as GalleryContext,
    ignorePreset,
    (val: string) => { synced = val; }
  );
  return { manager, textarea, synced: () => synced };
}

function highlightSpans(manager: RawTextareaManager): HTMLElement[] {
  return Array.from(manager.highlightsEl?.querySelectorAll(".j0n4t-pg-raw-token") ?? []);
}

// --- wrapper ---

test("the constructor wraps the textarea in a highlights layer", () => {
  const { manager, textarea } = makeManager();
  const wrapper = textarea.parentElement;
  assert.equal(wrapper?.className, "j0n4t-pg-raw-wrapper");
  assert.equal(wrapper?.firstElementChild, manager.highlightsEl);
  assert.equal(wrapper?.lastElementChild, textarea);
  assert.equal(textarea.className, "j0n4t-pg-raw-textarea");
});

// --- updateHighlights: token rendering ---

test("an empty value clears the highlights layer", () => {
  const { manager } = makeManager("");
  assert.equal(manager.highlightsEl?.innerHTML, "");
});

test("plain text renders as an escaped plain-text span", () => {
  const { manager } = makeManager("a & b");
  const spans = highlightSpans(manager);
  assert.equal(spans.length, 1);
  assert.ok(spans[0].classList.contains("plain-text"));
  assert.equal(spans[0].textContent, "a & b", "textContent is unescaped for display");
  assert.ok(manager.highlightsEl?.innerHTML.includes("a &amp; b"), "innerHTML is escaped");
});

test("tags render in the tag colour", () => {
  const { manager } = makeManager("<lora:xyz:0.5>");
  const span = highlightSpans(manager)[0];
  assert.equal(span.style.color, "rgb(79, 193, 255)");
  assert.equal(span.textContent, "<lora:xyz:0.5>");
});

test("variant tokens render in the group colour and bold", () => {
  const { manager } = makeManager("{Faces:y}");
  const span = highlightSpans(manager)[0];
  assert.match(span.style.color, /^rgb\(\d+, \d+, \d+\)$/);
  assert.ok(span.style.fontWeight === "bold" || Number(span.style.fontWeight) > 400);
});

test("known presets render in the preset colour with a tooltip", () => {
  const { manager } = makeManager("Faces/Portrait");
  const span = highlightSpans(manager)[0];
  assert.match(span.style.color, /^rgb\(\d+, \d+, \d+\)$/);
  assert.ok(span.title.includes("Portrait [Faces/Portrait]"));
  assert.ok(span.title.includes("portrait"));
});

test("ignorePreset renders the ignored preset as plain text", () => {
  const { manager } = makeManager("Faces/Portrait", "Faces/Portrait");
  const span = highlightSpans(manager)[0];
  assert.ok(span.classList.contains("plain-text"), "the ignored preset loses its token styling");
  assert.equal(span.title, "", "and carries no tooltip");
});

test("a mixed prompt renders one span per token in order", () => {
  const { manager } = makeManager("plain <lora:x:0.5> {Faces:y} Faces/Portrait");
  const spans = highlightSpans(manager);
  assert.equal(spans.length, 5, "the spaces around the variant are their own plain tokens");
  assert.ok(spans[0].classList.contains("plain-text"));
  assert.match(spans[1].style.color, /^rgb/);
  assert.ok(spans[2].classList.contains("plain-text"));
  assert.match(spans[3].style.color, /^rgb/, "{Faces:y} renders through the var regex");
  // a preset glued directly after a variant token fails parseTokens'
  // boundary check (the scan hits "}") and stays plain text
  assert.ok(spans[4].classList.contains("plain-text"));
  assert.equal(spans[4].title, "");
});

// --- events ---

test("input updates highlights; change additionally runs onSync", () => {
  const { manager, textarea, synced } = makeManager("Faces/Portrait");
  assert.equal(synced(), null, "input alone does not sync");

  textarea.dispatchEvent(new Event("change"));
  assert.equal(synced(), "Faces/Portrait");
  assert.equal(highlightSpans(manager).length, 1, "highlights are re-rendered");
});

// --- char-position math ---

test("_normalizeTokenPosition clamps out-of-range positions", () => {
  const { manager, textarea } = makeManager("aa, bb");
  textarea.value = "aa, bb";
  assert.equal(manager._normalizeTokenPosition(10), 6, "past the end clamps to the length");
  assert.equal(manager._normalizeTokenPosition(-1), 0, "negative clamps to 0");
});

test("_normalizeTokenPosition resolves a separator position to the nearest token", () => {
  const { manager, textarea } = makeManager("");
  textarea.value = "aa, bb";
  // probed behaviour: the comma resolves to itself, the following space
  // resolves to the comma's position (the left run is nearer)
  assert.equal(manager._normalizeTokenPosition(2), 2);
  assert.equal(manager._normalizeTokenPosition(3), 2);
  assert.equal(manager._normalizeTokenPosition(4), 4, "mid-token positions are unchanged");
});

test("getTokenAtPosition finds the token under the position", () => {
  const { manager, textarea } = makeManager("");
  textarea.value = "Faces/Portrait, plain";
  const preset = manager.getTokenAtPosition(5);
  assert.equal(preset?.key, "Faces/Portrait");
  assert.deepEqual(preset?.item, { preset: "portrait" });

  assert.equal(manager.getTokenAtPosition(13)?.key, "Faces/Portrait", "the comma belongs to the preset token");
  assert.equal(manager.getTokenAtPosition(15)?.isPlainText, true);
  assert.equal(manager.getTokenAtPosition(99), null, "past the end finds nothing");
});

// --- mousemove tooltip (jsdom has a zero-size box) ---

test("mousemove at the origin resolves a tooltip; elsewhere clears it", () => {
  const { textarea } = makeManager("Faces/Portrait");
  // jsdom reports font-size "medium" and empty padding; inline values give the
  // position math a deterministic metric instead of NaNs
  textarea.style.fontSize = "16px";
  textarea.style.lineHeight = "19.2px";
  textarea.style.padding = "0px";
  textarea.style.border = "0px";
  textarea.dispatchEvent(new MouseEvent("mousemove", { clientX: 0, clientY: 0 }));
  assert.ok(textarea.title.includes("Portrait [Faces/Portrait]"));

  textarea.dispatchEvent(new MouseEvent("mousemove", { clientX: 10, clientY: 10 }));
  assert.equal(textarea.title, "", "a point outside the zero-size box clears the tooltip");

  textarea.dispatchEvent(new Event("mouseleave"));
  assert.equal(textarea.title, "");
});
