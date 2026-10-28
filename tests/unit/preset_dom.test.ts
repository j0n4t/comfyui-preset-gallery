import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import PresetDOM from "../../web/PresetDOM.js";

// PresetDOM is the HTML-assembly layer: escaping, icon registry, thumbnail
// validation, style injection and basket-chip rendering. The canvas resize in
// createThumbnail needs a real browser — jsdom fires neither onload nor
// onerror for data URLs, so that path stays e2e; everything up to it is testable.

const CACHE: PresetCache = {
  "Faces/Portrait": { preset: "pro" },
  Faces: { __color__: "#ff0000" },
};

function chip(
  styleKey: string,
  subArray: string[],
  item: PresetCacheItem | null = null,
) {
  return { styleKey, item, subArray, startIndex: 0, endIndex: subArray.length };
}

// --- escapeHTML ---

test("escapeHTML escapes all five HTML-significant characters", () => {
  assert.equal(
    PresetDOM.escapeHTML('<a href="x">&\''),
    "&lt;a href=&quot;x&quot;&gt;&amp;&#039;",
  );
});

test("escapeHTML returns an empty string for null and undefined", () => {
  assert.equal(PresetDOM.escapeHTML(null), "");
  assert.equal(PresetDOM.escapeHTML(undefined), "");
});

test("escapeHTML coerces non-strings and leaves plain text alone", () => {
  assert.equal(PresetDOM.escapeHTML(123), "123");
  assert.equal(PresetDOM.escapeHTML("plain text"), "plain text");
});

// --- icons ---

test("icons registry holds the full SVG set", () => {
  assert.deepEqual(Object.keys(PresetDOM.icons), [
    "add",
    "close",
    "edit",
    "file",
    "list",
    "small",
    "big",
    "eye",
    "export",
    "import",
    "group",
    "collapse",
    "preset",
    "more",
    "hidden",
    "copy",
    "dice",
    "config",
    "folder",
    "pin",
    "trash",
    "swap",
    "select",
    "paste",
    "disable",
  ]);
  for (const svg of Object.values(PresetDOM.icons)) {
    assert.ok(svg.includes("<svg"), `icon is not SVG: ${svg.slice(0, 40)}`);
  }
});

// --- createThumbnail ---

test("createThumbnail passes through empty and non-image input", async () => {
  assert.equal(await PresetDOM.createThumbnail(""), "");
  assert.equal(
    await PresetDOM.createThumbnail("not-a-data-url"),
    "not-a-data-url",
  );
  assert.equal(
    await PresetDOM.createThumbnail("data:text/plain;base64,SGk="),
    "data:text/plain;base64,SGk=",
  );
});

// --- injectStyles ---

test("injectStyles appends a stylesheet and never duplicates it", () => {
  PresetDOM.injectStyles("test-style-a", ".x { color: red; }");
  PresetDOM.injectStyles("test-style-a", ".x { color: blue; }");
  const styles = document.querySelectorAll("style#test-style-a");
  assert.equal(styles.length, 1);
  assert.equal(styles[0].textContent, ".x { color: red; }");
  assert.equal(document.head.contains(styles[0]), true);
});

// --- renderBasketChip: input rendering ---

test("renderBasketChip renders a checked checkbox for a boolean tag", () => {
  const rendered = PresetDOM.renderBasketChip(
    chip("<flag:true>", ["<flag:true>"]),
    CACHE,
  );
  assert.ok(rendered.inputHtml.includes('type="checkbox"'));
  assert.ok(rendered.inputHtml.includes("checked"), "true renders as checked");
  assert.ok(rendered.inputHtml.includes('title="flag toggle"'));
});

test("renderBasketChip renders an unchecked checkbox for false", () => {
  const rendered = PresetDOM.renderBasketChip(
    chip("<flag:false>", ["<flag:false>"]),
    CACHE,
  );
  assert.ok(rendered.inputHtml.includes('type="checkbox"'));
  assert.ok(!rendered.inputHtml.includes("checked"));
});

test("renderBasketChip renders a number input for a numeric tag", () => {
  const rendered = PresetDOM.renderBasketChip(
    chip("<width:2>", ["<width:2>"]),
    CACHE,
  );
  assert.ok(rendered.inputHtml.includes('type="number"'));
  assert.ok(rendered.inputHtml.includes('value="2"'));
});

test("renderBasketChip renders a text input for a plain tag", () => {
  const rendered = PresetDOM.renderBasketChip(
    chip("<label:hello>", ["<label:hello>"]),
    CACHE,
  );
  assert.ok(rendered.inputHtml.includes('type="text"'));
  assert.ok(rendered.inputHtml.includes('value="hello"'));
});

test("renderBasketChip renders no input for a plain preset chip", () => {
  const rendered = PresetDOM.renderBasketChip(
    chip("Faces/Portrait", ["Faces/Portrait"], { preset: "pro" }),
    CACHE,
  );
  assert.equal(rendered.inputHtml, "");
  assert.ok(
    rendered.bgStyle.includes("#ff0000"),
    "folder colour reaches the chip style",
  );
  assert.ok(rendered.processed.tooltipTitle.includes("[Faces/Portrait]"));
  assert.ok(rendered.processed.tooltipTitle.includes("\npro"));
});

test("renderBasketChip renders the more icon for chips that still hide a variant", () => {
  const rendered = PresetDOM.renderBasketChip(
    chip("{Faces:Portrait}", ["{Faces:Portrait}"]),
    CACHE,
  );
  assert.ok(rendered.inputHtml.includes("j0n4t-pg-var-more"));
});

// --- renderBasketChip: weights and backgrounds ---

test("renderBasketChip shows the weight badge only when the weight is not 1", () => {
  const weighted = PresetDOM.renderBasketChip(
    chip("(boost:1.5)", ["(boost:1.5)"]),
    CACHE,
  );
  assert.ok(weighted.weightIconHtml.includes("j0n4t-pg-basket-chip-weight"));
  assert.ok(weighted.weightIconHtml.includes("Adjust Weight (Current: 1.5)"));
  assert.ok(weighted.weightIconHtml.includes("1.5"));

  const unweighted = PresetDOM.renderBasketChip(
    chip("(flat:1)", ["(flat:1)"]),
    CACHE,
  );
  assert.equal(unweighted.weightIconHtml, "");

  const plain = PresetDOM.renderBasketChip(
    chip("Faces/Portrait", ["Faces/Portrait"]),
    CACHE,
  );
  assert.equal(plain.weightIconHtml, "");
});

test("renderBasketChip uses background-image only when the item has a filename", () => {
  // the filename is read from the matched cache item, not from the chip input
  const imageCache: PresetCache = {
    "Faces/Portrait": { preset: "pro", filename: "data:image/png;base64,xxx" },
  };
  const withImage = PresetDOM.renderBasketChip(
    chip("Faces/Portrait", ["Faces/Portrait"], {
      preset: "pro",
      filename: "data:image/png;base64,xxx",
    }),
    imageCache,
  );
  assert.equal(
    withImage.bgStyle,
    'background-image: url("data:image/png;base64,xxx")',
  );

  const withoutImage = PresetDOM.renderBasketChip(
    chip("Faces/Portrait", ["Faces/Portrait"], { preset: "pro" }),
    CACHE,
  );
  assert.match(
    withoutImage.bgStyle,
    /^background-color: /,
    "no background-image without a filename",
  );
});
