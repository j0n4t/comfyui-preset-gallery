/**
 * PNG metadata parser — extracts tEXt/zTXt/iTXt chunks from PNG files.
 * ComfyUI embeds prompt and workflow JSON in PNG text chunks.
 */

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/**
 * @typedef {Object} PngTextChunk
 * @property {string} keyword
 * @property {string} text
 */

/**
 * @typedef {Object} PngMetadata
 * @property {Record<string, string>} textChunks
 * @property {string | null} promptRaw
 * @property {Record<string, any> | null} promptJson
 * @property {Record<string, any> | null} workflowJson
 */

const PngMetadata = {
  /**
   * Check if a byte array is a PNG file.
   * @param {Uint8Array} bytes
   * @returns {boolean}
   */
  isPng(bytes) {
    if (bytes.length < 8) return false;
    for (let i = 0; i < 8; i++) {
      if (bytes[i] !== PNG_SIGNATURE[i]) return false;
    }
    return true;
  },

  /**
   * Parse PNG text chunks from a Uint8Array.
   * @param {Uint8Array} bytes
   * @returns {PngTextChunk[]}
   */
  parseTextChunks(bytes) {
    /** @type {PngTextChunk[]} */
    const chunks = [];
    if (!PngMetadata.isPng(bytes)) return chunks;

    let offset = 8; // skip signature
    while (offset + 8 <= bytes.length) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
      const length = view.getUint32(0);
      const type = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      );

      if (type === "tEXt") {
        // tEXt: keyword\0text (Latin-1 encoded)
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        let nullIdx = -1;
        for (let i = dataStart; i < dataEnd; i++) {
          if (bytes[i] === 0) { nullIdx = i; break; }
        }
        if (nullIdx > dataStart) {
          const keyword = PngMetadata._latin1Decode(bytes.subarray(dataStart, nullIdx));
          const text = PngMetadata._latin1Decode(bytes.subarray(nullIdx + 1, dataEnd));
          chunks.push({ keyword, text });
        }
      } else if (type === "zTXt") {
        // zTXt: keyword\0compression_method\0compressed_text
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        let nullIdx = -1;
        for (let i = dataStart; i < dataEnd; i++) {
          if (bytes[i] === 0) { nullIdx = i; break; }
        }
        if (nullIdx > dataStart && nullIdx + 1 < dataEnd) {
          const keyword = PngMetadata._latin1Decode(bytes.subarray(dataStart, nullIdx));
          const compressionMethod = bytes[nullIdx + 1];
          if (compressionMethod === 0) {
            try {
              const compressed = bytes.subarray(nullIdx + 2, dataEnd);
              const text = PngMetadata._zlibInflate(compressed);
              chunks.push({ keyword, text });
            } catch {
              // skip malformed zTXt chunk
            }
          }
        }
      } else if (type === "iTXt") {
        // iTXt: keyword\0compression_flag\0compression_method\0language_tag\0translated_keyword\0text
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        let nullIdx = -1;
        for (let i = dataStart; i < dataEnd; i++) {
          if (bytes[i] === 0) { nullIdx = i; break; }
        }
        if (nullIdx > dataStart) {
          const keyword = PngMetadata._utf8Decode(bytes.subarray(dataStart, nullIdx));
          let pos = nullIdx + 1;
          if (pos + 1 < dataEnd) {
            const compressionFlag = bytes[pos];
            const compressionMethod = bytes[pos + 1];
            pos += 2;
            // skip language tag
            while (pos < dataEnd && bytes[pos] !== 0) pos++;
            pos++;
            // skip translated keyword
            while (pos < dataEnd && bytes[pos] !== 0) pos++;
            pos++;
            if (pos < dataEnd) {
              const textBytes = bytes.subarray(pos, dataEnd);
              let text;
              if (compressionFlag === 0) {
                text = PngMetadata._utf8Decode(textBytes);
              } else if (compressionFlag === 1 && compressionMethod === 0) {
                try {
                  text = PngMetadata._zlibInflate(textBytes);
                } catch {
                  text = null;
                }
              }
              if (text) chunks.push({ keyword, text });
            }
          }
        }
      }

      offset += 12 + length; // 4 (length) + 4 (type) + data + 4 (CRC)
    }

    return chunks;
  },

  /**
   * Decode Latin-1 bytes to string.
   * @param {Uint8Array} bytes
   * @returns {string}
   */
  _latin1Decode(bytes) {
    let result = "";
    for (let i = 0; i < bytes.length; i++) {
      result += String.fromCharCode(bytes[i]);
    }
    return result;
  },

  /**
   * Decode UTF-8 bytes to string.
   * @param {Uint8Array} bytes
   * @returns {string}
   */
  _utf8Decode(bytes) {
    try {
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      return PngMetadata._latin1Decode(bytes);
    }
  },

  /**
   * Decompress zlib/deflate data.
   * @param {Uint8Array} data
   * @returns {string}
   */
  _zlibInflate(data) {
    try {
      const ds = new DecompressionStream("deflate");
      const stream = new Blob([data]).stream().pipeThrough(ds);
      return new Response(stream).text();
    } catch {
      // Fallback: try raw deflate
      const ds = new DecompressionStream("deflate-raw");
      const stream = new Blob([data]).stream().pipeThrough(ds);
      return new Response(stream).text();
    }
  },

  /**
   * Extract all metadata from a PNG file.
   * @param {File|Blob} file
   * @returns {Promise<PngMetadata>}
   */
  async extractFromFile(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    return PngMetadata.extract(bytes);
  },

  /**
   * Extract all metadata from PNG bytes.
   * @param {Uint8Array} bytes
   * @returns {PngMetadata}
   */
  extract(bytes) {
    const chunks = PngMetadata.parseTextChunks(bytes);
    /** @type {Record<string, string>} */
    const textChunks = {};
    for (const chunk of chunks) {
      textChunks[chunk.keyword] = chunk.text;
    }

    let promptRaw = null;
    let promptJson = null;
    let workflowJson = null;

    // ComfyUI stores prompt in "prompt" key and workflow in "workflow" key
    if (textChunks.prompt) {
      promptRaw = textChunks.prompt;
      try {
        // ComfyUI sometimes embeds NaN which is not valid JSON
        const sanitized = textChunks.prompt.replace(/\bNaN\b/g, "null");
        promptJson = JSON.parse(sanitized);
      } catch {
        // not JSON, treat as plain text
      }
    }
    if (textChunks.workflow) {
      try {
        workflowJson = JSON.parse(textChunks.workflow);
      } catch {
        // not JSON
      }
    }

    return { textChunks, promptRaw, promptJson, workflowJson };
  },

  /**
   * Extract the Preset Gallery node's own widget values from the embedded workflow.
   * Searches the prompt JSON (flat map with class_type/inputs).
   * @param {PngMetadata} metadata
   * @returns {Record<string, string|number|boolean> | null}
   */
  getPresetGalleryWidgets(metadata) {
    if (metadata.promptJson && typeof metadata.promptJson === "object") {
      const json = metadata.promptJson;
      for (const nodeId of Object.keys(json)) {
        const node = json[nodeId];
        if (!node || typeof node !== "object") continue;
        if (node.class_type !== "PresetGalleryNode") continue;

        const inputs = node.inputs;
        if (!inputs || typeof inputs !== "object") continue;

        /** @type {Record<string, string|number|boolean>} */
        const widgetInputs = {};
        for (const [key, val] of Object.entries(inputs)) {
          if (Array.isArray(val)) continue;
          if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
            widgetInputs[key] = val;
          }
        }

        if (Object.keys(widgetInputs).length > 0) return widgetInputs;
      }
    }

    return null;
  },

  /**
   * Extract the prompt text from parsed PNG metadata.
   * ComfyUI prompt JSON is a map of node_id -> { inputs: { prompt: "...", ... }, ... }
   * or sometimes just a plain string.
   * @param {PngMetadata} metadata
   * @returns {string}
   */
  getPromptText(metadata) {
    if (!metadata.promptRaw) return "";

    // If it's plain text (not JSON), return as-is
    if (!metadata.promptJson) return metadata.promptRaw;

    // If it's a JSON object, try to extract prompt text from nodes
    const json = metadata.promptJson;
    if (typeof json === "string") return json;

    // ComfyUI prompt format: { "0": { "inputs": { "text": "..." }, ... }, ... }
    // or { "0": { "inputs": { "prompt": "..." }, ... }, ... }
    /** @type {string[]} */
    const texts = [];
    for (const nodeId of Object.keys(json)) {
      const node = json[nodeId];
      if (!node || typeof node !== "object") continue;
      const inputs = node.inputs;
      if (!inputs || typeof inputs !== "object") continue;

      // Try common prompt input names
      for (const key of ["prompt", "text", "positive", "negative"]) {
        const val = inputs[key];
        if (typeof val === "string" && val.trim()) {
          texts.push(val.trim());
          break;
        }
      }
    }

    if (texts.length > 0) return texts.join(", ");

    // Fallback: try to find any string value that looks like a prompt
    for (const nodeId of Object.keys(json)) {
      const node = json[nodeId];
      if (!node || typeof node !== "object") continue;
      const inputs = node.inputs;
      if (!inputs || typeof inputs !== "object") continue;
      for (const [, val] of Object.entries(inputs)) {
        if (typeof val === "string" && val.length > 10 && !val.startsWith("{") && !val.startsWith("[")) {
          texts.push(val.trim());
        }
      }
    }

    return texts.length > 0 ? texts.join(", ") : metadata.promptRaw;
  },
};

export default PngMetadata;
