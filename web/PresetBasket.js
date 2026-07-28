import AutocompleteManager from "./AutocompleteManager.js";
import PresetUtils from "./PresetUtils.js";

export default class PresetBasket {
  static BASKET_CONTAINER_STYLES = /*css*/ `
    .j0n4t-pg-basket-container { display: flex; flex-direction: column; gap: 4px; background: #15151580; border: 1px dashed #777; border-radius: 4px; padding: 0; box-sizing: border-box; width: 100%; flex-shrink: 0; transition: border-color 0.2s, background-color 0.2s; position: relative; resize: vertical; overflow-y: auto; overflow-x: hidden; min-height: 40px; }
    .j0n4t-pg-basket-container.drag-over { border-color: #007acc; background: #1a242db0; }
    .j0n4t-pg-basket-header { display: flex; justify-content: space-between; align-items: center; padding: 4px; background: #222;  position: sticky; top: 0; z-index: 1; }
    .j0n4t-pg-basket-title { font-size: 9px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; pointer-events: none; }
    .j0n4t-pg-basket-clear-btn:hover { background: #912e2e; }
    .j0n4t-pg-basket-pool { display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; align-items: center; padding: 4px; }
    .j0n4t-pg-raw-wrapper { position: relative; width: 100%; height: 100%; display: none; padding: 4px; box-sizing: border-box; }
    .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-raw-wrapper { display: block !important; }
    .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-basket-pool { display: none !important; }
    .j0n4t-pg-raw-highlights, .j0n4t-pg-basket-raw-textarea { width: 100%; height: 100%; min-height: 48px; font-family: monospace; font-size: 11px; padding: 4px; box-sizing: border-box; border-radius: 3px; margin: 0; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; line-height: 1.4; border: 1px solid transparent; letter-spacing: normal; word-spacing: normal; text-transform: none; text-indent: 0px; text-shadow: none; }
    .j0n4t-pg-raw-highlights { position: absolute; top: 4px; left: 4px; right: 4px; bottom: 4px; pointer-events: none; color: transparent; overflow: hidden; background: transparent; width: calc(100% - 8px); height: calc(100% - 8px); }
    .j0n4t-pg-basket-raw-textarea { display: block; background: transparent; border-color: #444; color: transparent; caret-color: #fff; resize: none; position: relative; }
    .j0n4t-pg-raw-token { color: #569cd6; font-weight: bold; }
    .j0n4t-pg-raw-token.plain-text { color: #cccccc; font-weight: normal; }
    .j0n4t-pg-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.75); display: flex; justify-content: center; align-items: center; z-index: 10000; backdrop-filter: blur(2px); }
    .j0n4t-pg-modal-content { background: #1e1e1e; border: 1px solid #444; border-radius: 6px; padding: 16px; width: 90%; max-width: 600px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.8); }
    .j0n4t-pg-modal-header { display: flex; justify-content: space-between; align-items: center; color: #fff; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .j0n4t-pg-modal-close { cursor: pointer; color: #aaa; background: none; border: none; font-size: 18px; transition: color 0.2s; display: flex; align-items: center; justify-content: center; }
    .j0n4t-pg-modal-close:hover { color: #ff4a4a; }
    .j0n4t-pg-modal-textarea { width: 100%; height: 200px; background: #111; color: #e0e0e0; border: 1px solid #333; border-radius: 4px; padding: 10px; font-family: monospace; font-size: 12px; resize: vertical; outline: none; box-sizing: border-box; }
    .j0n4t-pg-modal-textarea:focus { border-color: #007acc; }
    .j0n4t-pg-modal-copy-btn { display: flex; align-items: center; justify-content: center; padding: 8px; background: #2d2d2d; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; transition: background 0.2s; margin-top: 4px; }
    .j0n4t-pg-modal-copy-btn:hover { background: #3d3d3d; border-color: #777; }
  `;

  static BASKET_CHIP_ETC_STYLES = /*css*/ `
    .j0n4t-pg-basket-empty { font-size: 10px; color: #555; font-style: italic; pointer-events: none; }
    .j0n4t-pg-basket-drop-indicator { width: 2px; background-color: #007acc; box-shadow: 0 0 4px #007acc; border-radius: 1px; transition: transform 0.05s ease; pointer-events: none; }
    .j0n4t-pg-basket-chip { display: flex; align-items: center; background-size: cover; background-position: center; border: 1px solid #3d3d3d; border-radius: 3px; padding: 2px 4px; box-sizing: border-box; cursor: grab; user-select: none; transition: background 0.15s, border-color 0.15s; position: relative; overflow: hidden; min-height: 1.4em; }
    .j0n4t-pg-basket-chip::before { content: ""; position: absolute; inset: 0; background: rgba(0, 0, 0, 0.2); z-index: 0; pointer-events: none; }
    .j0n4t-pg-basket-chip:active { cursor: grabbing; }
    .j0n4t-pg-basket-chip.dragging { opacity: 0.4; border-color: #007acc; }
    .j0n4t-pg-basket-chip-label { font-size: 10px; color: #fff; white-space: nowrap; max-width: 90px; overflow: hidden; text-overflow: ellipsis; pointer-events: none; position: relative; text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.8); font-weight: 600; }
    .j0n4t-pg-basket-chip.inline-editing { border-color: #d1a119; cursor: text; padding: 2px 4px; background-image: none !important; }
    .j0n4t-pg-basket-chip.inline-editing::before { display: none; }
    .j0n4t-pg-inline-edit { background: transparent; border: none; color: #fff; font-family: monospace; font-size: 11px; outline: none; width: 100%; min-width: 50px; padding: 0; margin: 0; }
    .j0n4t-pg-basket-add-btn { display: flex; align-items: center; justify-content: center; background: transparent; border: 1px dashed #777; border-radius: 3px; padding: 2px 8px; cursor: pointer; color: #aaa; font-size: 10px; font-weight: bold; transition: 0.15s; height: 22px; user-select: none; }
    .j0n4t-pg-basket-add-btn:hover { border-color: #007acc; color: #fff; background: #1a242db0; }
    .j0n4t-pg-text-input, .j0n4t-pg-bool-input, .j0n4t-pg-num-input { width: 38px; height: 16px; background: #1a1a1a; border: 1px solid #444; color: #fff; font-size: 9px; border-radius: 2px; padding: 0 0 0 2px; text-align: center; margin: 0 2px; outline: none; }
    .j0n4t-pg-text-input:focus, .j0n4t-pg-bool-input:focus, .j0n4t-pg-num-input:focus { border-color: #007acc; }
    .j0n4t-pg-bool-input { width: auto; }
  `;

  constructor(container, pool, textarea, context) {
    this.container = container;
    this.pool = pool;
    this.textarea = textarea;
    this.context = context;
    this.dropIndicator = null;
    this.popupEl = null;
    this.currentMatches = [];
    this.activeIndex = 0;
    this._updatingTextarea = false;

    PresetUtils.injectStyles("j0n4t-pg-basket-container-styles", PresetBasket.BASKET_CONTAINER_STYLES);
    PresetUtils.injectStyles("j0n4t-pg-basket-chip-etc-styles", PresetBasket.BASKET_CHIP_ETC_STYLES);

    this.initDragAndDrop();
    this.initRawInputSync();
    this.initAutocomplete();
    this.initBasketActions();
    this.renderAddNewChipButton();
  }

  initDragAndDrop() {
    this.container.addEventListener("dragenter", (e) => {
      if (!this.container.classList.contains("raw-mode")) {
        e.preventDefault();
        this.container.classList.add("drag-over");
      }
    });
    this.container.addEventListener("dragleave", (e) => {
      if (e.relatedTarget && this.container.contains(e.relatedTarget)) return;
      this.container.classList.remove("drag-over");
      this.removeDropIndicator();
    });
    this.container.addEventListener("dragover", (e) => {
      if (this.container.classList.contains("raw-mode")) return;
      e.preventDefault();
      if (!this.dropIndicator)
        this.dropIndicator = Object.assign(document.createElement("div"), {
          className: "j0n4t-pg-basket-drop-indicator",
        });

      const closest = this.getClosestChip(e.clientX, e.clientY);
      if (closest.element) {
        this.dropIndicator.style.height = `${closest.box.height}px`;
        if (e.clientX > closest.box.left + closest.box.width / 2) {
          closest.element.after(this.dropIndicator);
        } else {
          closest.element.before(this.dropIndicator);
        }
      } else {
        this.pool.appendChild(this.dropIndicator);
        this.dropIndicator.style.height = "12px";
      }
    });
    this.container.addEventListener("drop", (e) => {
      if (this.container.classList.contains("raw-mode")) return;
      e.preventDefault();
      this.container.classList.remove("drag-over");
      this.removeDropIndicator();
      const styleKey = e.dataTransfer.getData("text/plain");
      if (!styleKey) return;

      let selections = this.context.getSelectedArray();
      if (e.dataTransfer.getData("source/basket"))
        selections = selections.filter((v) => v !== styleKey);

      const closest = this.getClosestChip(e.clientX, e.clientY);
      if (closest.element) {
        let insertionIndex = selections.indexOf(closest.element.dataset.id);
        if (e.clientX > closest.box.left + closest.box.width / 2)
          insertionIndex += 1;
        if (insertionIndex !== -1)
          selections.splice(insertionIndex, 0, styleKey);
        else selections.push(styleKey);
      } else if (!selections.includes(styleKey)) selections.push(styleKey);

      this.context.updateWidgetValue([...new Set(selections)]);
    });
  }

  initRawInputSync() {
    const sync = () => {
      this.updateRawHighlights();
      this.context.updateWidgetValue(
        this.textarea.value
          .split(",")
          .map((i) => i.trim())
          .filter(Boolean)
      );
    };

    this.textarea.addEventListener("input", () => this.updateRawHighlights());
    this.textarea.addEventListener("scroll", () => {
      if (this.context.dom.rawHighlights) {
        this.context.dom.rawHighlights.scrollTop = this.textarea.scrollTop;
        this.context.dom.rawHighlights.scrollLeft = this.textarea.scrollLeft;
      }
    });
    this.textarea.addEventListener("change", sync);
    this.textarea.addEventListener("mousedown", (e) => e.stopPropagation());

    // Add mousemove listener for tooltip functionality
    this.textarea.addEventListener("mousemove", (e) => this.handleTextareaMouseMove(e));
    this.textarea.addEventListener("mouseleave", () => this.textarea.title = "");
  }

  updateRawHighlights() {
    const highlightsEl = this.context.dom.rawHighlights;
    if (!highlightsEl) return;

    const val = this.textarea.value || "";
    if (!val) {
      highlightsEl.innerHTML = "";
      return;
    }

    const parts = val.split(/(\s*,\s*)/);
    let html = "";

    parts.forEach((part) => {
      if (/^\s*,\s*$/.test(part)) {
        html += `<span class="j0n4t-pg-raw-token plain-text">${PresetUtils.escapeHTML(part)}</span>`;
      } else {
        const trimmed = part.trim();
        if (!trimmed) {
          html += `<span class="j0n4t-pg-raw-token plain-text">${PresetUtils.escapeHTML(part)}</span>`;
          return;
        }

        const leadingSpace = part.slice(0, part.indexOf(trimmed));
        const trailingSpace = part.slice(part.indexOf(trimmed) + trimmed.length);

        const item = this.context.cache[trimmed];
        let textColor = "";
        let isPlainText = false;

        if (item) {
          textColor = PresetUtils.getPresetColor(trimmed, this.context.cache);
        } else if (/^<(lora|lyco):.+?>$/i.test(trimmed)) {
          textColor = "#4fc1ff";
        } else {
          isPlainText = true;
        }

        const spanClass = isPlainText
          ? "j0n4t-pg-raw-token plain-text"
          : "j0n4t-pg-raw-token";
        const styleAttr = textColor ? ` style="color: ${textColor};"` : "";
        const titleAttr = item && !isPlainText ? ` title="${PresetUtils.escapeHTML(`${PresetUtils.toTitleCase(PresetUtils.getPresetName(trimmed))} [${trimmed}]\n${PresetUtils.escapeHTML(item.preset || "")}`)}"` : "";

        html +=
          `<span class="j0n4t-pg-raw-token plain-text">${PresetUtils.escapeHTML(leadingSpace)}</span>` +
          `<span class="${spanClass}"${styleAttr}${titleAttr}>${PresetUtils.escapeHTML(trimmed)}</span>` +
          `<span class="j0n4t-pg-raw-token plain-text">${PresetUtils.escapeHTML(trailingSpace)}</span>`;
      }
    });

    highlightsEl.innerHTML = html + "\n";
    highlightsEl.scrollTop = this.textarea.scrollTop;
    highlightsEl.scrollLeft = this.textarea.scrollLeft;
  }

  /**
   * Handle mouse movement over the textarea to show tooltips for presets
   * @param {MouseEvent} e - Mouse event
   */
  handleTextareaMouseMove(e) {
    const rect = this.textarea.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Get character position at mouse coordinates
    const pos = this.getCharPositionAt(x, y);
    if (pos === -1) {
      this.textarea.title = "";
      return;
    }

    // Find which token contains this position
    const token = this.getTokenAtPosition(pos);
    if (token && token.item && !token.isPlainText) {
      // Set tooltip with preset info
      this.textarea.title = `${PresetUtils.toTitleCase(PresetUtils.getPresetName(token.key))} [${token.key}]\n${token.item.preset || ""}`;
    } else {
      this.textarea.title = "";
    }
  }

  /**
* Get character position at x,y coordinates within the textarea
* @param {number} x - X coordinate relative to textarea
* @param {number} y - Y coordinate relative to textarea
* @returns {number} Character index or -1 if not determinable
*/
  getCharPositionAt(x, y) {
    const rect = this.textarea.getBoundingClientRect();
    const clientX = rect.left + x;
    const clientY = rect.top + y;

    // Try to use the browser's caret position API for accuracy
    let pos = -1;
    if (document.caretPositionFromPoint) {
      const caretPos = document.caretPositionFromPoint(clientX, clientY);
      if (caretPos && caretPos.offsetNode === this.textarea) {
        pos = caretPos.offset;
      }
    } else if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(clientX, clientY);
      if (range && range.startContainer === this.textarea) {
        pos = range.startOffset;
      }
    }

    if (pos !== -1) {
      // Post‑process: ensure we are not inside a delimiter (comma/whitespace)
      // that could have changed due to a race.
      return this._normalizeTokenPosition(pos);
    }

    // Fallback: approximate based on metrics (should rarely be used)
    const style = window.getComputedStyle(this.textarea);
    const paddingLeft = parseFloat(style.paddingLeft);
    const paddingRight = parseFloat(style.paddingRight);
    const paddingTop = parseFloat(style.paddingTop);
    const paddingBottom = parseFloat(style.paddingBottom);
    const borderLeft = parseFloat(style.borderLeftWidth);
    const borderRight = parseFloat(style.borderRightWidth);
    const borderTop = parseFloat(style.borderTopWidth);
    const borderBottom = parseFloat(style.borderBottomWidth);

    // Adjust for padding and border
    const xPos = x - paddingLeft - borderLeft;
    const yPos = y - paddingTop - borderTop;

    const innerWidth = this.textarea.clientWidth - paddingLeft - paddingRight - borderLeft - borderRight;
    const innerHeight = this.textarea.clientHeight - paddingTop - paddingBottom - borderTop - borderBottom;

    if (xPos < 0 || yPos < 0 || xPos > innerWidth || yPos > innerHeight) return -1;

    // Get font metrics
    const fontSize = parseFloat(style.fontSize);
    const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.2;
    const charWidth = fontSize * 0.6; // Approximate average character width (monospace)

    // Calculate characters per line and visible lines
    const charsPerLine = Math.max(1, Math.floor(innerWidth / charWidth));
    const linesCount = Math.max(1, Math.floor(innerHeight / lineHeight));

    // Calculate column and row (zero-indexed)
    const col = Math.min(Math.round(xPos / charWidth), charsPerLine - 1);
    const row = Math.min(Math.floor(yPos / lineHeight), linesCount - 1);

    // Calculate position
    let calcPos = row * charsPerLine + col;

    // Get text content and clamp
    const text = this.textarea.value;
    if (!text) return -1;
    return this._normalizeTokenPosition(Math.min(calcPos, text.length));
  }

  /**
   * Adjusts a raw character index to the nearest position that lies inside a token
   * (i.e., not inside a comma or whitespace delimiter). This helps mitigate
   * race conditions where the textarea's value changed slightly after the
   * mouse event was processed.
   * @param {number} pos - Raw character index (0‑based)
   * @returns {number} Adjusted index, clamped to [0, text.length]
   */
  _normalizeTokenPosition(pos) {
    const value = this.textarea.value;
    if (!value) return 0;

    // Clamp to valid range
    if (pos < 0) return 0;
    if (pos > value.length) return value.length;

    // If the position is already inside a non‑delimiter, return it.
    const ch = value[pos];
    if (ch !== ',' && !/\s/.test(ch)) {
      return pos;
    }

    // Otherwise, scan left and right to find the nearest non‑delimiter.
    let left = pos - 1;
    while (left >= 0 && (value[left] === ',' || /\s/.test(value[left]))) {
      left--;
    }
    let right = pos + 1;
    while (right < value.length && (value[right] === ',' || /\s/.test(value[right]))) {
      right++;
    }

    // Choose the closer side; if tie, prefer left.
    const leftDist = pos - (left + 1); // distance to the character after left delimiter
    const rightDist = right - pos;     // distance to the character before right delimiter
    return leftDist <= rightDist ? left + 1 : right - 1;
  }

  /**
   * Get token information at a specific character position
   * @param {number} pos - Character position in textarea value
   * @returns {Object|null} Token info or null if not found
   */
  getTokenAtPosition(pos) {
    const value = this.textarea.value;
    if (!value || pos < 0 || pos > value.length) return null;

    // Split by commas and spaces to find tokens
    let currentPos = 0;
    const parts = value.split(/(\s*,\s*)/);

    for (const part of parts) {
      const partEnd = currentPos + part.length;

      // Check if position is within this part
      if (pos >= currentPos && pos <= partEnd) {
        const trimmed = part.trim();
        if (!trimmed) {
          currentPos = partEnd;
          continue;
        }

        // Check if it's a comma separator
        if (/^\s*,\s*$/.test(part)) {
          currentPos = partEnd;
          continue;
        }

        // Find where the trimmed text starts within this part
        const trimmedStart = part.indexOf(trimmed);
        const trimmedEnd = trimmedStart + trimmed.length;

        // Check if position is within the trimmed text
        const relativePos = pos - currentPos;
        if (relativePos >= trimmedStart && relativePos <= trimmedEnd) {
          // Found our token
          const item = this.context.cache[trimmed];
          let isPlainText = false;

          if (!item && !(/^<(lora|lyco):.+?>$/i.test(trimmed))) {
            isPlainText = true;
          }

          return {
            key: trimmed,
            item: item || null,
            isPlainText: isPlainText,
            start: currentPos + trimmedStart,
            end: currentPos + trimmedEnd
          };
        }
      }

      currentPos = partEnd;
    }

    return null;
  }

  initAutocomplete() {
    new AutocompleteManager({
      input: this.textarea,
      container: document.body,
      getMatches: (text, cursor) => {
        if (!this.container.classList.contains("raw-mode")) return [];
        const lastCommaIndex = text.slice(0, cursor).lastIndexOf(",");
        const currentToken = (
          lastCommaIndex === -1
            ? text.slice(0, cursor)
            : text.slice(lastCommaIndex + 1, cursor)
        ).trimStart();
        if (!currentToken) return [];

        return PresetUtils.getTopMatches(
          Object.keys(this.context.cache),
          currentToken,
          (k) => PresetUtils.getSearchBlob(k, this.context.cache[k]),
          this.context.cache
        );
      },
      renderItem: (match) =>
        `<span>${PresetUtils.escapeHTML(PresetUtils.toTitleCase(match.split("/").pop()))}</span><span class="j0n4t-pg-autocomplete-meta">${PresetUtils.escapeHTML(match)}</span>`,
      onSelect: (match) => {
        const cursor = this.textarea.selectionStart;
        const leftText = this.textarea.value.slice(0, cursor);
        const prefix =
          leftText.lastIndexOf(",") === -1
            ? ""
            : leftText.slice(0, leftText.lastIndexOf(",") + 1) + " ";

        this._updatingTextarea = true;
        try {
          this.textarea.value =
            prefix + match + ", " + this.textarea.value.slice(cursor);
          this.context.updateWidgetValue(
            this.textarea.value
              .split(",")
              .map((i) => i.trim())
              .filter(Boolean)
          );

          this.textarea.focus();
          this.textarea.selectionStart = this.textarea.selectionEnd =
            prefix.length + match.length + 2;
        } finally {
          this._updatingTextarea = false;
        }
      },
      onKeyDown: (e, activeMatch) => {
        if (
          e.key === "ArrowRight" &&
          this.textarea.selectionStart === this.textarea.value.length &&
          activeMatch
        ) {
          return false;
        }
      },
    });
  }

  initBasketActions() {
    const { dom } = this.context;
    dom.btnClearBasket.addEventListener("click", async () => {
      if (this.context.getSelectedArray().length && await PresetUtils.confirm("Empty basket?"))
        this.context.updateWidgetValue([]);
    });

    dom.chkBasketRaw.checked =
      localStorage.getItem("comfy_preset_gallery_raw_basket") === "true";
    dom.basketContainer.classList.toggle("raw-mode", dom.chkBasketRaw.checked);
    dom.chkBasketRaw.addEventListener("change", () => {
      localStorage.setItem("comfy_preset_gallery_raw_basket", String(dom.chkBasketRaw.checked));
      dom.basketContainer.classList.toggle(
        "raw-mode",
        dom.chkBasketRaw.checked
      );
    });

    dom.btnCopyBasket.addEventListener("click", () => {
      const text = this.context
        .getSelectedArray()
        .map((key) => this.context.cache[key]?.preset || key)
        .filter(Boolean)
        .join(", ");
      if (!text) return;
      const overlay = document.createElement("div");
      overlay.className = "j0n4t-pg-modal-overlay";
      overlay.innerHTML = `
        <div class="j0n4t-pg-modal-content">
          <div class="j0n4t-pg-modal-header">
            <span>Basket Output</span>
            <button class="j0n4t-pg-modal-close" title="Close Modal">&times;</button>
          </div>
          <textarea class="j0n4t-pg-modal-textarea" readonly></textarea>
          <button class="j0n4t-pg-modal-copy-btn">📋 Copy to Clipboard</button>
        </div>
      `;
      const textarea = overlay.querySelector("textarea");
      textarea.value = text;
      overlay.addEventListener("click", (e) => {
        if (e.target.matches(".j0n4t-pg-modal-close") || e.target === overlay) {
          overlay.remove();
        } else if (e.target.matches(".j0n4t-pg-modal-copy-btn")) {
          const copyBtn = e.target;
          navigator.clipboard.writeText(textarea.value).then(() => {
            const origBg = copyBtn.style.background;
            copyBtn.innerText = "✅ Copied!";
            copyBtn.style.background = "#228b22";
            copyBtn.style.borderColor = "#228b22";
            setTimeout(() => {
              copyBtn.innerText = "📋 Copy to Clipboard";
              copyBtn.style.background = origBg;
              copyBtn.style.borderColor = "";
            }, 1500);
          });
        }
      });
      document.body.appendChild(overlay);
      setTimeout(() => {
        textarea.focus();
        textarea.select();
      }, 10);
    });

    dom.basketContainer.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this.spawnInlineEditor(null, "");
    });
  }

  removeDropIndicator() {
    this.dropIndicator?.remove();
    this.dropIndicator = null;
  }

  explodeChip(targetKey, chip = null) {
    const currentSelections = this.context.widget.value.split(",");
    const targetPreset = this.context.cache[targetKey];
    if (targetPreset) {
      const rawPreset = targetPreset.preset || [targetKey];
      const updatedSelections = [];

      for (const key of currentSelections) {
        if (key.trim() === targetKey.trim()) {
          for (const token of rawPreset.split(",")) {
            updatedSelections.push(token.trim());
          }
        } else {
          updatedSelections.push(key.trim());
        }
      }

      const uniqueSelections = Array.from(new Set(updatedSelections));

      this.context.updateWidgetValue(uniqueSelections);
      this.context.syncUI(uniqueSelections.join(","));

      if (this.textarea && this.container.classList.contains("raw-mode")) {
        this.textarea.value = uniqueSelections.join(", ");
      }
    } else {
      this.spawnInlineEditor(chip, targetKey);
    }

  }

  getClosestChip(clientX, clientY) {
    return [
      ...this.pool.querySelectorAll(".j0n4t-pg-basket-chip:not(.dragging)"),
    ].reduce(
      (closest, el) => {
        const box = el.getBoundingClientRect();
        const dist = Math.hypot(
          clientX - (box.left + box.width / 2),
          clientY - (box.top + box.height / 2)
        );
        return dist < closest.distance
          ? { distance: dist, element: el, box }
          : closest;
      },
      { distance: Infinity, element: null, box: null }
    );
  }

  spawnInlineEditor(chipElement, initialValue) {
    const isNew = !chipElement;
    if (isNew) {
      chipElement = Object.assign(document.createElement("div"), {
        className: "j0n4t-pg-basket-chip inline-editing",
      });
      const addBtn = this.pool.querySelector(".j0n4t-pg-basket-add-btn");
      if (addBtn) {
        addBtn.before(chipElement);
      } else {
        this.pool.appendChild(chipElement);
      }
    } else {
      if (chipElement.classList.contains("inline-editing")) return;
      chipElement.classList.add("inline-editing");
      chipElement.draggable = false;
      const label = chipElement.querySelector(".j0n4t-pg-basket-chip-label");
      if (label) label.style.display = "none";
    }

    const input = Object.assign(document.createElement("input"), {
      type: "text",
      className: "j0n4t-pg-inline-edit",
      enterKeyHint: "enter",
      value: initialValue || "",
    });
    chipElement.prepend(input);
    input.focus();
    input.selectionStart = 0;
    input.selectionEnd = input.value.length;

    const finishEdit = (save) => {
      const newVal = input.value.trim();
      try {
        input.remove();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // do nothing, because dom is crazzy
      }

      if (isNew) chipElement.remove();
      else {
        chipElement.classList.remove("inline-editing");
        chipElement.draggable = true;
        const label = chipElement.querySelector(".j0n4t-pg-basket-chip-label");
        if (label) label.style.display = "";
      }

      if (save) {
        const selections = this.context.getSelectedArray();
        if (isNew && newVal && !selections.includes(newVal)) {
          selections.push(newVal);
          this.context.updateWidgetValue(selections);
        } else if (!isNew && newVal !== initialValue) {
          const idx = selections.indexOf(initialValue);
          if (idx !== -1) {
            if (newVal) selections[idx] = newVal;
            else selections.splice(idx, 1);
            this.context.updateWidgetValue(selections);
          }
        }
      }
    };

    const manager = new AutocompleteManager({
      input: input,
      container: document.body,
      getMatches: (query) => {
        query = query.trim().toLowerCase();
        if (!query) return [];
        return PresetUtils.getTopMatches(
          Object.keys(this.context.cache),
          query,
          (k) => PresetUtils.getSearchBlob(k, this.context.cache[k]),
          this.context.cache
        );
      },
      renderItem: (match) =>
        `<span>${PresetUtils.escapeHTML(PresetUtils.toTitleCase(match.split("/").pop()))}</span><span class="j0n4t-pg-autocomplete-meta">${PresetUtils.escapeHTML(match)}</span>`,
      onSelect: (match) => {
        input.value = match;
        finishEdit(true);
      },
      onKeyDown: (e) => {
        if (!manager.isOpen) {
          if (e.key === "Enter") {
            e.preventDefault();
            finishEdit(true);
            return true;
          } else if (e.key === "Escape") {
            e.preventDefault();
            finishEdit(false);
            return true;
          }
        }
      },
      onBlur: () => {
        finishEdit(false);
        return true;
      },
    });
  }

  renderAddNewChipButton() {
    const addBtn = Object.assign(document.createElement("div"), {
      className: "j0n4t-pg-basket-add-btn",
      innerText: "+ Add",
      title: "Add new preset or keyword",
    });
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.spawnInlineEditor(null, "");
    });
    this.pool.appendChild(addBtn);
  }

  render(activeList) {
    if (!this._updatingTextarea) {
      this.textarea.value = activeList.join(", ");
    }
    this.updateRawHighlights();
    this.pool.innerHTML = "";

    activeList.forEach((styleKey) => {
      const item = this.context.cache[styleKey];
      let cleanLabel = item
        ? PresetUtils.toTitleCase(PresetUtils.getPresetName(styleKey))
        : styleKey;

      const chip = Object.assign(document.createElement("div"), {
        className: "j0n4t-pg-basket-chip",
        draggable: true,
        title: item
          ? `${cleanLabel} [${styleKey}] (double-click to explode)\n${item.preset}`
          : styleKey,
      });
      chip.dataset.id = styleKey;

      if (item?.filename) {
        chip.style.backgroundImage = `url("${item.filename}")`;
      } else {
        chip.style.backgroundColor = PresetUtils.getPresetColor(styleKey, this.context.cache);
      }

      let inputHtml = "";
      const tagMatch = styleKey.match(/^<(.+?)>$/);

      if (tagMatch) {
        const innerContent = tagMatch[1];
        const parts = innerContent.split(/[:;]/);
        if (parts.length >= 2) {
          const value = parts.pop().trim();
          cleanLabel = parts.pop().trim();
          const isBoolean = /^(true|false)$/i.test(value);
          const isNumeric = !isNaN(Number(value)) && value !== '';
          if (isBoolean) {
            const isChecked = value.toLowerCase() === "true" ? "checked" : "";
            inputHtml = `<input type="checkbox" class="j0n4t-pg-bool-input bool-input" ${isChecked} title="${cleanLabel} toggle" />`;
          } else if (isNumeric) {
            inputHtml = `<input type="number" step="0.05" class="j0n4t-pg-num-input num-input" value="${value}" title="${cleanLabel} value" />`;
          } else {
            inputHtml = `<input type="text" class="j0n4t-pg-text-input text-input" value="${value}" title="${cleanLabel} text" />`;
          }
        }
      }

      chip.innerHTML = `
        <div class="j0n4t-pg-basket-chip-label" title="${PresetUtils.escapeHTML(styleKey)}">${PresetUtils.escapeHTML(cleanLabel)}</div>
        ${inputHtml}
      `;

      if (tagMatch) {
        const dynamicInput = chip.querySelector("input");
        if (dynamicInput) {
          dynamicInput.addEventListener("mousedown", (e) => e.stopPropagation());
          dynamicInput.addEventListener("dblclick", (e) => e.stopPropagation());
          dynamicInput.addEventListener("change", (e) => {
            let newValue;
            if (e.target.type === "checkbox") {
              newValue = e.target.checked.toString();
            } else if (e.target.type === "number") {
              newValue = parseFloat(e.target.value);
              if (isNaN(newValue)) return;
            } else {
              newValue = e.target.value.trim();
            }
            const newStyleKey = styleKey.replace(/([:;])[^:;]+(>)$/, `$1${newValue}$2`);
            const selections = this.context.getSelectedArray();
            const idx = selections.indexOf(styleKey);
            if (idx !== -1) {
              selections[idx] = newStyleKey;
              this.context.updateWidgetValue(selections);
              styleKey = newStyleKey;
            }
          });
        }
      }

      chip.addEventListener("click", (e) => {
        if (e.target.closest("input")) return;

        e.stopPropagation();
        this.showChipMenu(chip, styleKey, item);
      });
      chip.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        this.closeChipMenu();
        this.explodeChip(styleKey, chip);
      });
      chip.addEventListener("dragstart", (e) => {
        chip.classList.add("dragging");
        e.dataTransfer.setData("text/plain", styleKey);
        e.dataTransfer.setData("source/basket", "true");
      });
      chip.addEventListener("dragend", () => {
        chip.classList.remove("dragging");
        this.removeDropIndicator();
      });
      this.pool.appendChild(chip);
    });

    this.renderAddNewChipButton();
  }

  showChipMenu(chipElement, styleKey, item) {
    if (this.activeChipMenuEl) {
      this.activeChipMenuEl.classList.remove("active-menu");
    }
    this.popupEl?.remove();
    chipElement.classList.add("active-menu");
    this.activeChipMenuEl = chipElement;
    const popup = document.createElement("div");
    popup.className = "j0n4t-pg-chip-popup";
    const swapIcon = PresetUtils.icons.swap || `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`;
    popup.innerHTML = `
      <div class="j0n4t-pg-chip-popup-item" data-action="edit" title="Edit">${PresetUtils.icons.edit}</div>
      <div class="j0n4t-pg-chip-popup-item" data-action="swap" title="Swap Preset">${swapIcon}</div>
      ${item
        ? `<div class="j0n4t-pg-chip-popup-item" data-action="locate" title="Locate in Gallery">${PresetUtils.icons.eye}</div>`
        : `<div class="j0n4t-pg-chip-popup-item" data-action="create" title="Create Preset from Chip">${PresetUtils.icons.add}</div>`
      }
      <div class="j0n4t-pg-chip-popup-item danger" data-action="del" title="Remove">${PresetUtils.icons.close}</div>
    `;
    popup.addEventListener("click", (e) => {
      const actionEl = e.target.closest("[data-action]");
      if (!actionEl) return;
      e.stopPropagation();
      this.closeChipMenu();
      const action = actionEl.dataset.action;
      if (action === "edit") {
        if (item) this.context.openEditorForPreset(styleKey);
        else this.spawnInlineEditor(chipElement, styleKey);
      } else if (action === "swap") {
        this.spawnInlineEditor(chipElement, styleKey);
      } else if (action === "locate") {
        const itemEl = this.context.dom.grid.querySelector(`.j0n4t-pg-item[data-style="${PresetUtils.escapeHTML(styleKey)}"]`);
        if (itemEl) {
          this.context.dom.search.value = "";
          let prev = itemEl.previousElementSibling;
          while (prev && !prev.classList.contains("j0n4t-pg-group-header"))
            prev = prev.previousElementSibling;
          if (prev?.classList.contains("collapsed")) {
            prev.classList.remove("collapsed");
            this.context.setCollapsedFolders(this.context.getCollapsedFolders().filter((f) => f !== prev.dataset.groupRaw));
          }
          this.context.grid.executeFilterPipeline();
          itemEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
          itemEl.style.transition = "border-color 0.15s, box-shadow 0.15s";
          const origColor = itemEl.style.borderColor;
          itemEl.style.borderColor = "#007acc";
          itemEl.style.boxShadow = "0 0 8px rgba(0, 122, 204, 0.75)";
          setTimeout(() => {
            itemEl.style.borderColor = origColor;
            itemEl.style.boxShadow = "";
          }, 800);
        }
      } else if (action === "create") {
        this.context.setPanelCollapseState(false);
        this.context.editor.clearFields();
        this.context.editor.dom.inpPreset.value = item ? item.preset : styleKey;
        const cleanName = styleKey.replace(/^<(lora|lyco):/i, "").replace(/>$/, "").split(":")[0].split("/").pop().replace(/[^a-zA-Z0-9\s-_]/g, "").trim().replace(/\s+/g, "_");
        if (cleanName) this.context.editor.dom.inpName.value = cleanName;
        this.context.editor.dom.inpPreset.dispatchEvent(new Event("input"));
      } else if (action === "del") {
        this.context.updateWidgetValue(this.context.getSelectedArray().filter((v) => v !== styleKey));
      }
    });
    popup.addEventListener("mousedown", (e) => e.stopPropagation());
    document.body.appendChild(popup);
    this.popupEl = popup;
    const rect = chipElement.getBoundingClientRect();
    popup.style.top = `${window.scrollY + rect.bottom + 4}px`;
    popup.style.left = `${window.scrollX + rect.left}px`;
    const closeHandler = (e) => {
      if (!popup.contains(e.target) && e.target !== chipElement) {
        this.closeChipMenu();
        document.removeEventListener("mousedown", closeHandler);
      }
    };
    this.closeHandler = closeHandler;
    setTimeout(() => document.addEventListener("mousedown", closeHandler), 10);
  }

  closeChipMenu() {
    if (this.closeHandler) {
      document.removeEventListener("mousedown", this.closeHandler);
      this.closeHandler = null;
    }
    if (this.activeChipMenuEl) {
      this.activeChipMenuEl.classList.remove("active-menu");
      this.activeChipMenuEl = null;
    }
    this.popupEl?.remove();
    this.popupEl = null;
  }
}