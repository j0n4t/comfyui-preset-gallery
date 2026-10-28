import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import PngMetadata from "../../web/PngMetadata.js";

// PngMetadata parses the tEXt / zTXt / iTXt chunks ComfyUI embeds in PNG
// files. The parser only reads chunk headers (CRC is skipped), so fixtures
// can carry zero CRCs.

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function concatBytes(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Builds one PNG chunk: length + type + data + (zero) CRC. */
function chunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, data.length);
  return concatBytes([
    length,
    new TextEncoder().encode(type),
    data,
    new Uint8Array(4),
  ]);
}

function makePng(...chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  return concatBytes([PNG_SIGNATURE, ...chunks]);
}

function latin1Bytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function textChunk(keyword: string, text: string): Uint8Array {
  return chunk(
    "tEXt",
    concatBytes([latin1Bytes(keyword), new Uint8Array([0]), latin1Bytes(text)]),
  );
}

// --- isPng ---

test("isPng accepts the 8-byte PNG signature", () => {
  assert.equal(PngMetadata.isPng(PNG_SIGNATURE), true);
  assert.equal(PngMetadata.isPng(makePng(textChunk("prompt", "x"))), true);
});

test("isPng rejects short arrays and wrong signatures", () => {
  assert.equal(PngMetadata.isPng(new Uint8Array([137, 80, 78, 71])), false);
  const wrong = new Uint8Array(PNG_SIGNATURE);
  wrong[0] = 0;
  assert.equal(PngMetadata.isPng(wrong), false);
});

// --- parseTextChunks ---

test("parseTextChunks returns an empty array for a non-PNG", () => {
  const notPng = concatBytes([
    new Uint8Array([1, 2, 3]),
    textChunk("prompt", "x"),
  ]);
  return PngMetadata.parseTextChunks(notPng).then((chunks) => {
    assert.deepEqual(chunks, []);
  });
});

test("parseTextChunks extracts a tEXt chunk", async () => {
  const png = makePng(textChunk("prompt", "a simple prompt"));
  const chunks = await PngMetadata.parseTextChunks(png);
  assert.deepEqual(chunks, [{ keyword: "prompt", text: "a simple prompt" }]);
});

test("parseTextChunks decodes tEXt text as Latin-1", async () => {
  const png = makePng(textChunk("comment", " caf\u00e9 "));
  const chunks = await PngMetadata.parseTextChunks(png);
  assert.equal(chunks[0].text, " caf\u00e9 ");
});

test("parseTextChunks inflates a zTXt chunk", async () => {
  const compressed = deflateSync(Buffer.from("compressed prompt text", "utf8"));
  const data = concatBytes([
    latin1Bytes("prompt"),
    new Uint8Array([0, 0]),
    new Uint8Array(compressed),
  ]);
  const png = makePng(chunk("zTXt", data));
  const chunks = await PngMetadata.parseTextChunks(png);
  assert.deepEqual(chunks, [
    { keyword: "prompt", text: "compressed prompt text" },
  ]);
});

test("parseTextChunks reads an uncompressed iTXt chunk as UTF-8", async () => {
  const data = concatBytes([
    latin1Bytes("prompt"),
    new Uint8Array([0, 0, 0, 0, 0]),
    new TextEncoder().encode("unicode \u00e9\u00e8 prompt"),
  ]);
  const png = makePng(chunk("iTXt", data));
  const chunks = await PngMetadata.parseTextChunks(png);
  assert.deepEqual(chunks, [
    { keyword: "prompt", text: "unicode \u00e9\u00e8 prompt" },
  ]);
});

test("parseTextChunks inflates a compressed iTXt chunk", async () => {
  const compressed = deflateSync(Buffer.from("compressed itxt", "utf8"));
  // keyword \0, compression flag 1, method 0, empty language tag, empty
  // translated keyword, then the deflate payload
  const data = concatBytes([
    latin1Bytes("prompt"),
    new Uint8Array([0, 1, 0, 0, 0]),
    new Uint8Array(compressed),
  ]);
  const png = makePng(chunk("iTXt", data));
  const chunks = await PngMetadata.parseTextChunks(png);
  assert.deepEqual(chunks, [{ keyword: "prompt", text: "compressed itxt" }]);
});

test("parseTextChunks skips non-text chunks and keeps reading after them", async () => {
  const ihdr = chunk("IHDR", new Uint8Array(13));
  const png = makePng(ihdr, textChunk("prompt", "after ihdr"));
  const chunks = await PngMetadata.parseTextChunks(png);
  assert.deepEqual(chunks, [{ keyword: "prompt", text: "after ihdr" }]);
});

test("parseTextChunks stops at a truncated chunk instead of reading garbage", async () => {
  const full = textChunk("prompt", "kept");
  const stray = new Uint8Array([0, 0, 0, 0, 1, 2, 3]); // partial chunk header
  const png = concatBytes([PNG_SIGNATURE, full, stray]);
  const chunks = await PngMetadata.parseTextChunks(png);
  assert.deepEqual(chunks, [{ keyword: "prompt", text: "kept" }]);
});

test("parseTextChunks skips a zTXt chunk whose payload is not valid deflate", async () => {
  const data = concatBytes([
    latin1Bytes("prompt"),
    new Uint8Array([0, 0]),
    new Uint8Array([1, 2, 3, 4, 5]),
  ]);
  const png = makePng(chunk("zTXt", data), textChunk("other", "survives"));
  const chunks = await PngMetadata.parseTextChunks(png);
  assert.deepEqual(chunks, [{ keyword: "other", text: "survives" }]);
});

test("parseTextChunks skips a tEXt chunk with no null separator", async () => {
  const png = makePng(chunk("tEXt", new Uint8Array([1, 2, 3, 4])));
  const chunks = await PngMetadata.parseTextChunks(png);
  assert.deepEqual(chunks, []);
});

// --- extract ---

test("extract parses the prompt and workflow JSON from text chunks", async () => {
  const png = makePng(
    textChunk(
      "prompt",
      '{"1": {"class_type": "CLIPTextEncode", "inputs": {"text": "cat"}}}',
    ),
    textChunk("workflow", '{"nodes": []}'),
  );
  const metadata = await PngMetadata.extract(png);
  assert.deepEqual(metadata.textChunks, {
    prompt:
      '{"1": {"class_type": "CLIPTextEncode", "inputs": {"text": "cat"}}}',
    workflow: '{"nodes": []}',
  });
  assert.equal(
    metadata.promptRaw,
    '{"1": {"class_type": "CLIPTextEncode", "inputs": {"text": "cat"}}}',
  );
  assert.deepEqual(metadata.promptJson, {
    "1": { class_type: "CLIPTextEncode", inputs: { text: "cat" } },
  });
  assert.deepEqual(metadata.workflowJson, { nodes: [] });
});

test("extract sanitizes NaN in prompt JSON so it still parses", async () => {
  const png = makePng(textChunk("prompt", '{"0": {"inputs": {"seed": NaN}}}'));
  const metadata = await PngMetadata.extract(png);
  assert.deepEqual(metadata.promptJson, { "0": { inputs: { seed: null } } });
});

test("extract keeps non-JSON prompt text without a parsed object", async () => {
  const png = makePng(textChunk("prompt", "just words"));
  const metadata = await PngMetadata.extract(png);
  assert.equal(metadata.promptRaw, "just words");
  assert.equal(metadata.promptJson, null);
});

test("extract returns nulls and an empty record when the PNG has no text chunks", async () => {
  const png = makePng(chunk("IHDR", new Uint8Array(13)));
  const metadata = await PngMetadata.extract(png);
  assert.deepEqual(metadata, {
    textChunks: {},
    promptRaw: null,
    promptJson: null,
    workflowJson: null,
  });
});

test("extractFromFile reads a Blob the same way as extract", async () => {
  const png = makePng(textChunk("prompt", "from a file"));
  const metadata = await PngMetadata.extractFromFile(new Blob([png]));
  assert.equal(metadata.promptRaw, "from a file");
});

// --- getPresetGalleryWidgets ---

test("getPresetGalleryWidgets returns the node's scalar widget inputs", () => {
  const metadata = {
    textChunks: {},
    promptRaw: "",
    promptJson: {
      "3": {
        class_type: "PresetGalleryNode",
        inputs: { base_preset: "a, b", seed: 7, flag: true, link: [1, 2] },
      },
    },
    workflowJson: null,
  };
  assert.deepEqual(PngMetadata.getPresetGalleryWidgets(metadata), {
    base_preset: "a, b",
    seed: 7,
    flag: true,
  });
});

test("getPresetGalleryWidgets returns null when the node is absent", () => {
  const metadata = {
    textChunks: {},
    promptRaw: "",
    promptJson: { "3": { class_type: "OtherNode", inputs: { x: 1 } } },
    workflowJson: null,
  };
  assert.equal(PngMetadata.getPresetGalleryWidgets(metadata), null);
  assert.equal(
    PngMetadata.getPresetGalleryWidgets({
      textChunks: {},
      promptRaw: null,
      promptJson: null,
      workflowJson: null,
    }),
    null,
  );
});

// --- getPromptText ---

test("getPromptText returns plain prompt text as-is", () => {
  const metadata = {
    textChunks: {},
    promptRaw: "hello world",
    promptJson: null,
    workflowJson: null,
  };
  assert.equal(PngMetadata.getPromptText(metadata), "hello world");
});

test("getPromptText joins the prompt inputs of the parsed JSON nodes", () => {
  const metadata = {
    textChunks: {},
    promptRaw:
      '{"0": {"inputs": {"prompt": "cat"}}, "1": {"inputs": {"text": "dog"}}}',
    promptJson: {
      "0": { inputs: { prompt: "cat" } },
      "1": { inputs: { text: "dog" } },
    },
    workflowJson: null,
  };
  assert.equal(PngMetadata.getPromptText(metadata), "cat, dog");
});

test("getPromptText falls back to long string inputs when no prompt key exists", () => {
  const metadata = {
    textChunks: {},
    promptRaw: '{"0": {"inputs": {"cfg": "a very long descriptive string"}}}',
    promptJson: { "0": { inputs: { cfg: "a very long descriptive string" } } },
    workflowJson: null,
  };
  assert.equal(
    PngMetadata.getPromptText(metadata),
    "a very long descriptive string",
  );
});

test("getPromptText returns the raw prompt when nothing extractable is found", () => {
  const metadata = {
    textChunks: {},
    promptRaw: "raw fallback",
    promptJson: { "0": { inputs: { seed: 7 } } },
    workflowJson: null,
  };
  assert.equal(PngMetadata.getPromptText(metadata), "raw fallback");
});
