import AutocompleteManager from "./AutocompleteManager.js";
import PresetUtils from "./PresetUtils.js";
import RawTextareaManager from "./RawTextareaManager.js";

export default class PresetBasket {
  static BASKET_CONTAINER_STYLES = /*css*/ `
    .j0n4t-pg-basket-container { display: flex; flex-direction: column; background: #15151580; border: 1px dashed #777; border-radius: 4px; box-sizing: border-box; width: 100%; flex-shrink: 0; transition: border-color 0.2s, background-color 0.2s; position: relative; resize: vertical; overflow-y: auto; overflow-x: hidden; min-height: 40px; }
    .j0n4t-pg-basket-container.drag-over { border-color: #007acc; background: #1a242db0; }
    .j0n4t-pg-basket-header { display: flex; justify-content: space-between; align-items: center; background: #222;  position: sticky; top: 0; padding: 4px; z-index: 1; }
    .j0n4t-pg-basket-title { font-size: 9px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; pointer-events: none; }
    .j0n4t-pg-basket-clear-btn:hover, .j0n4t-pg-basket-clear-btn:focus-visible { background: #912e2e; outline: 2px solid #fff; }
    .j0n4t-pg-basket-reroll-btn:hover, .j0n4t-pg-basket-reroll-btn:focus-visible { filter: grayscale(0) brightness(1) !important; transform: scale(1.1); }
    .j0n4t-pg-basket-pool-wrapper { position: relative; margin: 4px; display: block; box-sizing: border-box; }
    .j0n4t-pg-basket-pool { display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; align-items: center; padding: 4px; }
    .j0n4t-pg-basket-container .j0n4t-pg-raw-wrapper { display: none; width: auto; }
    .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-raw-wrapper { display: block; margin: 4px; }
    .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-basket-pool-wrapper { display: none; }
  `;

  static BASKET_CHIP_ETC_STYLES = /*css*/ `
    .j0n4t-pg-basket-empty { font-size: 10px; color: #555; font-style: italic; pointer-events: none; }
    .j0n4t-pg-basket-drop-indicator { width: 2px; background-color: #007acc; box-shadow: 0 0 4px #007acc; border-radius: 1px; transition: transform 0.05s ease; pointer-events: none; }
    .j0n4t-pg-basket-chip { display: flex; align-items: center; background-size: cover; background-position: center; border: 1px solid #3d3d3d; border-radius: 3px; padding: 2px 4px; box-sizing: border-box; cursor: grab; user-select: none; transition: background 0.15s, border-color 0.15s; position: relative; overflow: hidden; min-height: 1.4em; outline: none; max-width: 90px; }
    .j0n4t-pg-basket-chip::before { content: ""; position: absolute; inset: 0; background: rgba(0, 0, 0, 0.2); z-index: 0; pointer-events: none; }
    .j0n4t-pg-basket-chip:active { cursor: grabbing; }
    .j0n4t-pg-basket-chip.dragging { opacity: 0.4; border-color: #007acc; }
    .j0n4t-pg-basket-chip:focus-visible { border-width: 2px; border-color: #007acc; }
    .j0n4t-pg-basket-chip-label { font-size: 10px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; position: relative; text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.8); font-weight: 600; }
    .j0n4t-pg-basket-chip.inline-editing { border-color: #d1a119; cursor: text; padding: 2px 4px; background-image: none !important; }
    .j0n4t-pg-basket-chip.inline-editing::before { display: none; }
    .j0n4t-pg-inline-edit { background: transparent; border: none; color: #fff; font-family: monospace; font-size: 11px; outline: none; width: 100%; min-width: 50px; padding: 0; margin: 0; }
    .j0n4t-pg-basket-add-btn { display: flex; align-items: center; justify-content: center; background: transparent; border: 1px dashed #777; border-radius: 3px; padding: 2px 8px; cursor: pointer; color: #aaa; font-size: 10px; font-weight: bold; transition: 0.15s; height: 22px; user-select: none; outline: none; }
    .j0n4t-pg-basket-add-btn:hover, .j0n4t-pg-basket-add-btn:focus-visible { border-color: #007acc; color: #fff; background: #1a242db0; }
    .j0n4t-pg-text-input, .j0n4t-pg-bool-input, .j0n4t-pg-num-input, .j0n4t-pg-select-input { width: 38px; height: 16px; background: #1a1a1a; border: 1px solid #444; color: #fff; font-size: 9px; border-radius: 2px; padding: 0 2px; text-align: center; margin: 0 2px; outline: none; position: relative; cursor: pointer; }
    .j0n4t-pg-text-input:focus, .j0n4t-pg-bool-input:focus, .j0n4t-pg-num-input:focus, .j0n4t-pg-select-input:focus { border-color: #007acc; }
    .j0n4t-pg-bool-input { width: auto; }
    .j0n4t-pg-select-input { width: auto; max-width: 110px; font-weight: 600; font-family: inherit; }
    .j0n4t-pg-select-input option { background: #1a1a1a; color: #fff; }
    .j0n4t-pg-chip-popup { position: absolute; background: #1f1f1f; border: 1px solid #444; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.8); z-index: 1000; display: flex; flex-direction: column; padding: 2px 0; outline: none; }
    .j0n4t-pg-chip-popup-actions { display: flex;  flex-direction: row; justify-content: space-around; }
    .j0n4t-pg-chip-popup-item { padding: 4px; font-size: 11px; color: #ccc; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; outline: none; }
    .j0n4t-pg-chip-popup-item svg { width: 12px; height: 12px; fill: currentColor; }
    .j0n4t-pg-chip-popup-item:hover, .j0n4t-pg-chip-popup-item:focus-visible { background: #333; color: #fff; }
    .j0n4t-pg-chip-popup-item.danger:hover, .j0n4t-pg-chip-popup-item.danger:focus-visible { background: #912e2e; color: #fff; }
    .j0n4t-pg-var-more { font-size: 11px; }
    .j0n4t-pg-var-popup-row { display: flex; align-items: center; padding: 4px; }
    .j0n4t-pg-var-popup-row label { font-size: 10px; color: #d1a119; font-weight: 600; min-width: 40px; text-transform: capitalize; }
    .j0n4t-pg-var-popup-row select { flex: 1; height: 20px; background: #1a1a1a; border: 1px solid #444; color: #fff; font-size: 10px; border-radius: 2px; padding: 0 2px; font-weight: 600; font-family: inherit; outline: none; cursor: pointer; }
    .j0n4t-pg-var-popup-row select:focus { border-color: #007acc; }
    .j0n4t-pg-var-popup-row select option { background: #1a1a1a; color: #fff; }
    .j0n4t-pg-var-reroll-btn { display: flex; align-items: center; justify-content: center; background: transparent; border: none; color: #aaa; cursor: pointer; font-size: 13px; padding: 0 4px; outline: none; transition: 0.15s; }
    .j0n4t-pg-var-reroll-btn:hover, .j0n4t-pg-var-reroll-btn:focus-visible { color: #fff; transform: scale(1.1); }
  `;

  constructor(container, basket, textarea, context) {
    this.container = container;
    this.basket = basket;
    this.textarea = textarea;
    this.context = context;
    this.dropIndicator = null;
    this.popupEl = null;
    this.currentMatches = [];
    this.activeIndex = 0;
    this._updatingTextarea = false;

    PresetUtils.injectStyles("j0n4t-pg-basket-container-styles", PresetBasket.BASKET_CONTAINER_STYLES);
    PresetUtils.injectStyles("j0n4t-pg-basket-chip-etc-styles", PresetBasket.BASKET_CHIP_ETC_STYLES);

    this.rawManager = new RawTextareaManager(this.textarea, this.context, null, (val) => {
      const tokens = PresetUtils.parseTokens(val, this.context.cache);
      const selections = tokens
        .filter((t) => !t.isDelimiter && t.text.trim())
        .map((t) => (t.key ? t.key : t.text.trim()));
      this.context.updateWidgetValue(selections);
    });

    this.initDragAndDrop();
    this.initBasketActions();
  }

  findPresetMatch(text) {
    if (!text || !this.context.cache) return null;
    const trimmed = text.trim();
    if (!trimmed) return null;

    if (this.context.cache[trimmed]) {
      return { key: trimmed, item: this.context.cache[trimmed] };
    }

    for (const [key, item] of Object.entries(this.context.cache)) {
      if (!item) continue;
      if (key.trim() === trimmed) {
        return { key, item };
      }
      if (item.preset && item.preset.trim() === trimmed) {
        return { key, item };
      }
    }
    return null;
  }

  updateRawHighlights() {
    this.rawManager.updateHighlights();
  }

  initDragAndDrop() {
    this.container.addEventListener("dragenter", (e) => {
      if (!this.container.classList.contains("raw-mode")) {
        e.stopPropagation();
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
      e.stopPropagation();
      e.preventDefault();

      if (!this.dropIndicator) {
        this.basket.insertAdjacentHTML('beforeend', '<div class="j0n4t-pg-basket-drop-indicator"></div>');
        this.dropIndicator = this.basket.lastElementChild;
      }

      const closest = this.getClosestChip(e.clientX, e.clientY);
      if (closest.element) {
        this.dropIndicator.style.height = `${closest.box.height}px`;
        if (e.clientX > closest.box.left + closest.box.width / 2) {
          closest.element.after(this.dropIndicator);
        } else {
          closest.element.before(this.dropIndicator);
        }
      } else {
        this.basket.appendChild(this.dropIndicator);
        this.dropIndicator.style.height = "12px";
      }
    });
    this.container.addEventListener("drop", (e) => {
      if (this.container.classList.contains("raw-mode")) return;
      e.stopPropagation();
      e.preventDefault();
      this.container.classList.remove("drag-over");
      this.removeDropIndicator();
      const styleKey = e.dataTransfer.getData("text/plain");
      if (!styleKey) return;

      let selections = this.context.getSelectedArray();
      const sourceStartStr = e.dataTransfer.getData("source/basket_start");
      const sourceEndStr = e.dataTransfer.getData("source/basket_end");

      let movedItems = [styleKey];
      if (e.dataTransfer.getData("source/basket") && sourceStartStr !== "" && sourceEndStr !== "") {
        const start = parseInt(sourceStartStr, 10);
        const end = parseInt(sourceEndStr, 10);
        if (!isNaN(start) && !isNaN(end) && start < end) {
          movedItems = selections.splice(start, end - start);
        }
      }

      const closest = this.getClosestChip(e.clientX, e.clientY);
      if (closest.element) {
        const targetStartStr = closest.element.dataset.start;
        let insertionIndex = targetStartStr !== undefined ? parseInt(targetStartStr, 10) : selections.length;
        if (e.clientX > closest.box.left + closest.box.width / 2) {
          const targetEndStr = closest.element.dataset.end;
          insertionIndex = targetEndStr !== undefined ? parseInt(targetEndStr, 10) : insertionIndex;
        }
        selections.splice(insertionIndex, 0, ...movedItems);
      } else {
        selections.push(...movedItems);
      }

      this.context.updateWidgetValue(selections);
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

    this.basket.addEventListener("dblclick", (e) => {
      const chip = e.target.closest('.j0n4t-pg-basket-chip');
      if (chip) {
        e.stopPropagation();
        this.closeChipMenu();
        this.spawnInlineEditor(chip, this.context.cache[chip.dataset.id]?.preset || chip.dataset.id, parseInt(chip.dataset.start), parseInt(chip.dataset.end));
      } else {
        e.stopPropagation();
        this.spawnInlineEditor(null, "");
      }
    });

    this.basket.addEventListener("click", (e) => {
      const addBtn = e.target.closest('.j0n4t-pg-basket-add-btn');
      if (addBtn) return this.spawnInlineEditor(null, "");

      if (e.target.closest("input")) return;

      const chip = e.target.closest('.j0n4t-pg-basket-chip');
      if (chip) {
        e.stopPropagation();
        const styleKey = chip.dataset.id;
        const evalId = chip.dataset.evalId || styleKey;

        this.showChipMenu(chip, styleKey, this.context.cache[styleKey], parseInt(chip.dataset.start), parseInt(chip.dataset.end));

        const targetKey = (this.context.cache && this.context.cache[evalId]) ? evalId : styleKey;

        if (!this.context.dom.wrap.classList.contains("hide-gallery-mode")) {
          this.locatePreset(targetKey);
        }
        if (!this.context.dom.editor.classList.contains("collapsed") && this.context.editor.isSaved) {
          this.context.openEditorForPreset(targetKey);
        }
      }
    });

    this.basket.addEventListener("change", (e) => {
      const dynamicInput = e.target.closest('input.text-input, input.bool-input, input.num-input');
      if (dynamicInput) {
        const chip = dynamicInput.closest('.j0n4t-pg-basket-chip');
        if (!chip) return;
        const styleKey = chip.dataset.id;
        const startIndex = parseInt(chip.dataset.start);
        const endIndex = parseInt(chip.dataset.end);

        let newValue;
        if (dynamicInput.type === "checkbox") {
          newValue = dynamicInput.checked.toString();
        } else if (dynamicInput.type === "number") {
          newValue = parseFloat(dynamicInput.value);
          if (isNaN(newValue)) return;
        } else {
          newValue = dynamicInput.value.trim();
        }
        const newStyleKey = styleKey.replace(/([:;])[^:;]+(>)$/, `$1${newValue}$2`);
        const selections = this.context.getSelectedArray();
        if (startIndex < selections.length) {
          selections.splice(startIndex, endIndex - startIndex, newStyleKey);
          this.context.updateWidgetValue(selections);
        }
      }
    });

    this.basket.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const triggerable = e.target.closest(".j0n4t-pg-basket-add-btn, .j0n4t-pg-basket-chip");
        if (triggerable && !e.target.closest("input")) {
          e.stopPropagation();
          e.preventDefault();
          triggerable.click();
        }
      }

      if (!e.target.closest("input") && !e.altKey) {
        const focusableElements = Array.from(this.basket.querySelectorAll('.j0n4t-pg-basket-chip, .j0n4t-pg-basket-add-btn'));
        const currentElement = e.target.closest('.j0n4t-pg-basket-chip, .j0n4t-pg-basket-add-btn');
        const currentIndex = focusableElements.indexOf(currentElement);

        if (currentIndex !== -1) {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.stopPropagation();
            e.preventDefault();
            const nextEl = focusableElements[currentIndex + 1];
            if (nextEl) nextEl.focus();
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.stopPropagation();
            e.preventDefault();
            const prevEl = focusableElements[currentIndex - 1];
            if (prevEl) prevEl.focus();
          }
        }
      }

      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const chip = e.target.closest('.j0n4t-pg-basket-chip');
        if (!chip) return;
        e.stopPropagation();
        e.preventDefault();
        const startIndex = parseInt(chip.dataset.start);
        const endIndex = parseInt(chip.dataset.end);
        const selections = this.context.getSelectedArray();
        const itemsToMove = selections.slice(startIndex, endIndex);

        if (e.key === 'ArrowLeft') {
          const prevChip = chip.previousElementSibling;
          if (prevChip && prevChip.classList.contains('j0n4t-pg-basket-chip')) {
            const prevStart = parseInt(prevChip.dataset.start);
            const prevEnd = parseInt(prevChip.dataset.end);
            const prevItems = selections.slice(prevStart, prevEnd);
            selections.splice(prevStart, endIndex - prevStart, ...itemsToMove, ...prevItems);
            this.context.updateWidgetValue(selections);
            setTimeout(() => {
              const newChip = this.basket.querySelector(`[data-start="${prevStart}"]`);
              if (newChip) newChip.focus();
            }, 0);
          }
        } else if (e.key === 'ArrowRight') {
          const nextChip = chip.nextElementSibling;
          if (nextChip && nextChip.classList.contains('j0n4t-pg-basket-chip')) {
            const nextStart = parseInt(nextChip.dataset.start);
            const nextEnd = parseInt(nextChip.dataset.end);
            const nextItems = selections.slice(nextStart, nextEnd);
            selections.splice(startIndex, nextEnd - startIndex, ...nextItems, ...itemsToMove);
            this.context.updateWidgetValue(selections);
            const newStart = startIndex + (nextEnd - nextStart);
            setTimeout(() => {
              const newChip = this.basket.querySelector(`[data-start="${newStart}"]`);
              if (newChip) newChip.focus();
            }, 0);
          }
        }
      }
    });

    this.basket.addEventListener("dragstart", (e) => {
      const chip = e.target.closest(".j0n4t-pg-basket-chip");
      if (chip) {
        chip.classList.add("dragging");
        e.dataTransfer.setData("text/plain", chip.dataset.id);
        e.dataTransfer.setData("source/basket", "true");
        e.dataTransfer.setData("source/basket_start", chip.dataset.start);
        e.dataTransfer.setData("source/basket_end", chip.dataset.end);
      }
    });

    this.basket.addEventListener("dragend", (e) => {
      const chip = e.target.closest(".j0n4t-pg-basket-chip");
      if (chip) chip.classList.remove("dragging");
      this.removeDropIndicator();
    });
  }

  removeDropIndicator() {
    this.dropIndicator?.remove();
    this.dropIndicator = null;
  }

  getClosestChip(clientX, clientY) {
    return [
      ...this.basket.querySelectorAll(".j0n4t-pg-basket-chip:not(.dragging)"),
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

  reRollChipGroup(chipIndex, groupRaw) {
    const activeList = this.context.getSelectedArray();
    const chipsData = this.getGroupedChips(activeList);
    const chipState = { rolls: this.context.variantRolls, counts: {} };
    const targetGroup = groupRaw.trim().toLowerCase().replace(/\s+/g, "_");

    for (let i = 0; i < chipsData.length; i++) {
      const beforeCounts = { ...chipState.counts };
      PresetUtils.expandRecursively(chipsData[i].styleKey, this.context.cache, new Set(), chipState);
      if (i === chipIndex) {
        const start = beforeCounts[targetGroup] || 0;
        const end = chipState.counts[targetGroup] || 0;
        for (let k = start; k < end; k++) {
          delete this.context.variantRolls[`${targetGroup}_${k}`];
        }
        break;
      }
    }
    this.context.syncUI(this.context.widget.value);
  }

  spawnInlineEditor(chipElement, initialValue, startIndex = undefined, endIndex = undefined) {
    const isNew = !chipElement;
    const inputHtml = `<input type="text" class="j0n4t-pg-inline-edit" enterkeyhint="enter" value="${PresetUtils.escapeHTML(initialValue || '')}" tabindex="0" />`;
    let input;

    if (isNew) {
      const addBtn = this.basket.querySelector(".j0n4t-pg-basket-add-btn");
      const newChipHtml = `<div class="j0n4t-pg-basket-chip inline-editing">${inputHtml}</div>`;
      if (addBtn) {
        addBtn.insertAdjacentHTML("beforebegin", newChipHtml);
        chipElement = addBtn.previousElementSibling;
      } else {
        this.basket.insertAdjacentHTML("beforeend", newChipHtml);
        chipElement = this.basket.lastElementChild;
      }
      input = chipElement.querySelector("input");
    } else {
      if (chipElement.classList.contains("inline-editing")) return;
      chipElement.classList.add("inline-editing");
      chipElement.draggable = false;
      const label = chipElement.querySelector(".j0n4t-pg-basket-chip-label");
      if (label) label.style.display = "none";
      chipElement.insertAdjacentHTML("afterbegin", inputHtml);
      input = chipElement.querySelector("input");
    }

    input.focus();
    input.selectionStart = 0;
    input.selectionEnd = input.value.length;

    const finishEdit = (save) => {
      const newVal = input.value.trim();
      try {
        input.remove();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // dom is crazy!
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
        if (isNew && newVal) {
          selections.push(newVal);
          this.context.updateWidgetValue(selections);
        } else if (!isNew && newVal !== initialValue) {
          if (startIndex !== undefined && endIndex !== undefined) {
            const newValues = newVal.includes(",") ? newVal.split(/,(?![^<]*>)/).map(s => s.trim()).filter(Boolean) : [newVal];
            selections.splice(startIndex, endIndex - startIndex, ...newValues);
            this.context.updateWidgetValue(selections);
          } else {
            const idx = selections.indexOf(initialValue);
            if (idx !== -1) {
              if (newVal) selections[idx] = newVal;
              else selections.splice(idx, 1);
              this.context.updateWidgetValue(selections);
            }
          }
        }
      }
    };

    const manager = new AutocompleteManager({
      input: input,
      container: document.body,
      getMatches: (query, cursor) => {
        const textBeforeCursor = query.substring(0, cursor);
        const lastOpenBrace = textBeforeCursor.lastIndexOf('{');
        const lastCloseBrace = textBeforeCursor.lastIndexOf('}');
        const isInsideBrackets = lastOpenBrace !== -1 && lastOpenBrace > lastCloseBrace;

        if (isInsideBrackets) {
          const bracketContent = textBeforeCursor.substring(lastOpenBrace + 1);
          const colonIndex = bracketContent.indexOf(':');

          if (colonIndex === -1) {
            // Typing variant group name
            const groupQuery = bracketContent.trim().toLowerCase();
            const groupsSet = new Set();
            for (const k of Object.keys(this.context.cache)) {
              const folder = PresetUtils.getPresetFolder ? PresetUtils.getPresetFolder(k) : k.split('/')[0];
              if (folder) groupsSet.add(folder);
            }
            const groups = Array.from(groupsSet);
            const dummyCache = {};
            groups.forEach(g => { dummyCache[g] = { preset: g }; });
            return PresetUtils.getTopMatches(
              groups,
              groupQuery,
              (g) => g,
              dummyCache
            );
          } else {
            // Typing preset name inside a specific variant group
            const groupName = bracketContent.substring(0, colonIndex).trim().toLowerCase();
            const presetQuery = bracketContent.substring(colonIndex + 1).trim().toLowerCase();

            const presetMatches = Object.keys(this.context.cache).filter((k) => {
              if (!this.context.cache[k]?.preset) return false;
              const folder = PresetUtils.getPresetFolder ? PresetUtils.getPresetFolder(k) : k.split('/')[0];
              return folder.toLowerCase() === groupName || folder.toLowerCase().startsWith(groupName + "/") || folder.toLowerCase().endsWith("/" + groupName);
            });

            return PresetUtils.getTopMatches(
              presetMatches,
              presetQuery,
              (k) => PresetUtils.getSearchBlob(k, this.context.cache[k]),
              this.context.cache
            );
          }
        } else {
          // Standard autocomplete outside curly brackets
          query = query.trim().toLowerCase();
          if (!query) return [];
          return PresetUtils.getTopMatches(
            Object.keys(this.context.cache),
            query,
            (k) => PresetUtils.getSearchBlob(k, this.context.cache[k]),
            this.context.cache
          );
        }
      },
      renderItem: (match) => {
        const isPreset = this.context.cache && this.context.cache[match];
        if (isPreset) {
          return `<span>${PresetUtils.escapeHTML(PresetUtils.toTitleCase(match.split("/").pop()))}</span><span class="j0n4t-pg-autocomplete-meta">${PresetUtils.escapeHTML(match)}</span>`;
        } else {
          return `<span>📁 ${PresetUtils.escapeHTML(PresetUtils.toTitleCase(match))}</span><span class="j0n4t-pg-autocomplete-meta">Variant Group</span>`;
        }
      },
      onSelect: (match) => {
        const query = input.value;
        const cursor = input.selectionStart;
        const textBeforeCursor = query.substring(0, cursor);
        const lastOpenBrace = textBeforeCursor.lastIndexOf('{');
        const lastCloseBrace = textBeforeCursor.lastIndexOf('}');
        const isInsideBrackets = lastOpenBrace !== -1 && lastOpenBrace > lastCloseBrace;

        if (isInsideBrackets) {
          const bracketContent = textBeforeCursor.substring(lastOpenBrace + 1);
          const colonIndex = bracketContent.indexOf(':');

          if (colonIndex === -1) {
            // Group selected: insert group name with a trailing colon and keep popup open for preset suggestions
            const before = query.substring(0, lastOpenBrace);
            const after = query.substring(cursor);
            input.value = `${before}{${match}:${after}`;
            const newCursor = before.length + match.length + 2;
            input.setSelectionRange(newCursor, newCursor);
            input.focus();
            manager.evaluate();
            return true; // Keep popup open
          } else {
            // Preset selected inside group: complete the variant format and finish editing
            const groupName = bracketContent.substring(0, colonIndex).trim();
            const before = query.substring(0, lastOpenBrace);
            const after = query.substring(cursor);
            input.value = `${before}{${groupName}:${match}}${after}`;
            finishEdit(true);
            return false;
          }
        } else {
          input.value = match;
          finishEdit(true);
          return false;
        }
      },
      onKeyDown: (e) => {
        if (!manager.isOpen) {
          if (e.key === "Enter") {
            e.stopPropagation();
            e.preventDefault();
            finishEdit(true);
            return true;
          } else if (e.key === "Escape") {
            e.stopPropagation();
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

  getGroupedChips(activeList) {
    const chips = [];
    if (!activeList || activeList.length === 0) return chips;

    const lookupMap = new Map();
    if (this.context.cache) {
      for (const [key, item] of Object.entries(this.context.cache)) {
        if (item?.preset && item.preset.trim()) {
          const trimmed = item.preset.trim();
          const expanded = PresetUtils.expandRecursively(trimmed, this.context.cache);
          if (expanded && !lookupMap.has(expanded)) {
            lookupMap.set(expanded, { foundKey: key, foundItem: item });
          }
          if (trimmed && !lookupMap.has(trimmed)) {
            lookupMap.set(trimmed, { foundKey: key, foundItem: item });
          }
        }
        if (key && !lookupMap.has(key)) {
          lookupMap.set(key, { foundKey: key, foundItem: item });
        }
        const trimmedKey = key ? key.trim() : "";
        if (trimmedKey && !lookupMap.has(trimmedKey)) {
          lookupMap.set(trimmedKey, { foundKey: key, foundItem: item });
        }
      }
    }

    let i = 0;
    while (i < activeList.length) {
      let matched = null;
      let matchedLen = 0;

      for (let len = activeList.length - i; len >= 1; len--) {
        const subArray = activeList.slice(i, i + len);
        const joined = subArray.join(", ");

        let foundKey = null;
        let foundItem = null;

        const cachedMatch = lookupMap.get(joined);
        if (cachedMatch) {
          foundKey = cachedMatch.foundKey;
          foundItem = cachedMatch.foundItem;
        } else if (len === 1 && (joined.match(/^<[^<>]+>$/) || joined.match(/^\{[^{}]+(?::[^{}]+)?\}$/))) {
          foundKey = joined;
        }

        if (foundKey || len === 1) {
          matched = {
            styleKey: foundKey || subArray[0],
            item: foundItem || (foundKey ? this.context.cache[foundKey] : this.context.cache[subArray[0]]),
            startIndex: i,
            endIndex: i + len,
            subArray
          };
          matchedLen = len;
          break;
        }
      }

      if (matched) {
        chips.push(matched);
        i += matchedLen;
      } else {
        chips.push({
          styleKey: activeList[i],
          item: this.context.cache[activeList[i]] || null,
          startIndex: i,
          endIndex: i + 1,
          subArray: [activeList[i]]
        });
        i += 1;
      }
    }
    return chips;
  }

  render(activeList) {
    const rawModeRollState = { rolls: this.context.variantRolls, counts: {} };

    if (!this._updatingTextarea) {
      this.textarea.value = PresetUtils.expandRecursively(
        activeList.join(", "),
        this.context.cache,
        new Set(),
        rawModeRollState
      );
    }
    this.updateRawHighlights();

    let htmlBuffer = "";
    const chipsData = this.getGroupedChips(activeList);
    const chipRollState = { rolls: this.context.variantRolls, counts: {} };

    chipsData.forEach((chipData, index) => {
      const { styleKey, item, startIndex, endIndex } = chipData;

      const beforeCounts = { ...chipRollState.counts };
      const chipExpanded = PresetUtils.expandRecursively(styleKey, this.context.cache, new Set(), chipRollState);

      let rolledInfo = [];
      for (const group in chipRollState.counts) {
        const start = beforeCounts[group] || 0;
        const end = chipRollState.counts[group] || 0;
        for (let k = start; k < end; k++) {
          const rolledKey = this.context.variantRolls[`${group}_${k}`];
          if (rolledKey) rolledInfo.push(`🎲 ${PresetUtils.toTitleCase(group.split("_")[0])}: ${PresetUtils.getPresetName(rolledKey)}`);
        }
      }
      const rolledText = rolledInfo.length > 0 ? `\n\nRolled Variants:\n${rolledInfo.join("\n")}` : "";

      const presetMatch = this.findPresetMatch(chipExpanded);
      let cleanLabel, bgStyle, tooltipTitle, evalId;

      if (presetMatch) {
        evalId = presetMatch.key;
        const matchItem = presetMatch.item;
        cleanLabel = PresetUtils.toTitleCase(PresetUtils.getPresetName(evalId));
        bgStyle = matchItem?.filename
          ? `background-image: url("${matchItem.filename}")`
          : `background-color: ${PresetUtils.getPresetColor(evalId, this.context.cache)}`;
        tooltipTitle = `${cleanLabel} [${evalId}]\n${matchItem?.preset || evalId}`;
      } else {
        evalId = chipExpanded;
        cleanLabel = item ? PresetUtils.toTitleCase(PresetUtils.getPresetName(styleKey)) : styleKey;
        bgStyle = item?.filename
          ? `background-image: url("${item.filename}")`
          : `background-color: ${PresetUtils.getPresetColor(styleKey, this.context.cache)}`;

        if (item) {
          tooltipTitle = `${chipExpanded}\n\n${PresetUtils.toTitleCase(PresetUtils.getPresetName(styleKey))} [${styleKey}]\n${item.preset}`;
        } else {
          tooltipTitle = `${chipExpanded}\n\n[${styleKey}]`;
        }
      }

      let inputHtml = "";
      const tagMatch = styleKey.match(/^<(.+?)>$/);

      const varRegex = /\{([^{}:]+)(?::([^{}]+))?\}/g;
      let varMatches = Array.from(styleKey.matchAll(varRegex));
      if (varMatches.length === 0 && item && item.preset) {
        varMatches = Array.from(item.preset.matchAll(varRegex));
      }

      if (varMatches.length > 0) {
        inputHtml = `<span class="j0n4t-pg-var-more">${PresetUtils.icons.more}</span>`;
      } else if (tagMatch) {
        const innerContent = tagMatch[1];
        const parts = innerContent.split(/[:;]/);
        if (parts[0].match(/lora|lyco/) || parts.length === 2) {
          const value = parts.pop().trim();
          const tagLabel = parts.pop().trim();
          const isBoolean = /^(true|false)$/i.test(value);
          const isNumeric = !isNaN(Number(value)) && value !== '';
          if (isBoolean) {
            const isChecked = value.toLowerCase() === "true" ? "checked" : "";
            inputHtml = `<input type="checkbox" class="j0n4t-pg-bool-input bool-input" tabindex="0" ${isChecked} title="${PresetUtils.escapeHTML(tagLabel)} toggle" aria-label="${PresetUtils.escapeHTML(tagLabel)} toggle" />`;
          } else if (isNumeric) {
            inputHtml = `<input type="number" step="0.05" class="j0n4t-pg-num-input num-input" tabindex="0" value="${PresetUtils.escapeHTML(value)}" title="${PresetUtils.escapeHTML(tagLabel)} value" aria-label="${PresetUtils.escapeHTML(tagLabel)} value" />`;
          } else {
            inputHtml = `<input type="text" class="j0n4t-pg-text-input text-input" tabindex="0" value="${PresetUtils.escapeHTML(value)}" title="${PresetUtils.escapeHTML(tagLabel)} text" aria-label="${PresetUtils.escapeHTML(tagLabel)} text" />`;
          }
        }
      }

      htmlBuffer += `
        <div class="j0n4t-pg-basket-chip" tabindex="0" role="option" aria-selected="false" 
             draggable="true" 
             title="${PresetUtils.escapeHTML(tooltipTitle)}${PresetUtils.escapeHTML(rolledText)}"
             data-id="${PresetUtils.escapeHTML(styleKey)}"
             data-eval-id="${PresetUtils.escapeHTML(evalId)}"
             data-preset="${PresetUtils.escapeHTML(item && item.preset ? item.preset : "")}"
             data-index="${index}"
             data-start="${startIndex}"
             data-end="${endIndex}"
             style='${bgStyle}'>
            <div class="j0n4t-pg-basket-chip-label" title="${PresetUtils.escapeHTML(chipExpanded || styleKey)}">${PresetUtils.escapeHTML(cleanLabel)}</div>
            ${inputHtml}
        </div>
      `;
    });

    htmlBuffer += `<div class="j0n4t-pg-basket-add-btn" tabindex="0" role="button" title="Add new preset or keyword" aria-label="Add new keyword">+ Add</div>`;
    this.basket.innerHTML = htmlBuffer;
  }

  showChipMenu(chipElement, styleKey, item, startIndex, endIndex) {
    if (this.activeChipMenuEl) {
      this.activeChipMenuEl.classList.remove("active-menu");
    }
    this.popupEl?.remove();
    chipElement.classList.add("active-menu");
    this.activeChipMenuEl = chipElement;

    const rawPreset = chipElement.dataset.preset || "";
    const varRegex = /\{([^{}:]+)(?::([^{}]+))?\}/g;
    const source = styleKey.match(/\{[^{}]+\}/) ? styleKey : (rawPreset || (item && item.preset ? item.preset : ""));
    const varMatches = Array.from(source.matchAll(varRegex));

    let varRowsHtml = "";
    if (varMatches.length > 0) {
      varMatches.forEach(varMatch => {
        const groupRaw = varMatch[1].trim();
        const groupName = groupRaw.toLowerCase().replace(/\s+/g, "_");
        const currentSelectedVal = varMatch[2] ? varMatch[2].trim() : "";
        const matches = this.context.cache
          ? Object.keys(this.context.cache).filter((k) => {
            if (!this.context.cache[k]?.preset) return false;
            const folder = PresetUtils.getPresetFolder(k).toLowerCase();
            return folder === groupName || folder.startsWith(groupName + "/") || folder.endsWith("/" + groupName);
          })
          : [];

        if (matches.length > 0) {
          const optionsHtml = matches
            .map((m) => {
              const name = PresetUtils.getPresetName(m);
              const isSelected = currentSelectedVal && (m === currentSelectedVal || name.toLowerCase() === currentSelectedVal.toLowerCase());
              return `<option value="${PresetUtils.escapeHTML(name)}" ${isSelected ? "selected" : ""}>${PresetUtils.escapeHTML(PresetUtils.toTitleCase(name))}</option>`;
            })
            .join("");
          const randomSelected = !currentSelectedVal ? "selected" : "";
          varRowsHtml += `<div class="j0n4t-pg-var-popup-row">
            <label>${PresetUtils.escapeHTML(PresetUtils.toTitleCase(groupRaw))}</label>
            <select data-group="${PresetUtils.escapeHTML(groupRaw)}" tabindex="0"><option value="" ${randomSelected}>\ud83c\udfb2 Random</option>${optionsHtml}</select>
            <button class="j0n4t-pg-var-reroll-btn" data-group="${PresetUtils.escapeHTML(groupRaw)}" title="Re-roll ${PresetUtils.escapeHTML(PresetUtils.toTitleCase(groupRaw))}" tabindex="0">🎲</button>
          </div>`;
        }
      });
    }

    let varSectionHtml = "";
    if (varRowsHtml) {
      varSectionHtml = `
        <div>
          ${varRowsHtml}
        </div>
      `;
    }

    const swapIcon = PresetUtils.icons.swap || `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`;
    const popupHtml = `
      <div class="j0n4t-pg-chip-popup" tabindex="-1" role="menu">
        ${varSectionHtml}
        <div class="j0n4t-pg-chip-popup-actions">
          <div class="j0n4t-pg-chip-popup-item" data-action="swap" title="Swap Preset" tabindex="0" role="menuitem">${swapIcon}</div>
          <div class="j0n4t-pg-chip-popup-item" data-action="edit" title="Edit" tabindex="0" role="menuitem">${PresetUtils.icons.edit}</div>
      ${item
        ? `<div class="j0n4t-pg-chip-popup-item" data-action="locate" title="Locate in Gallery" tabindex="0" role="menuitem">${PresetUtils.icons.eye}</div>`
        : `<div class="j0n4t-pg-chip-popup-item" data-action="create" title="Create Preset from Chip" tabindex="0" role="menuitem">${PresetUtils.icons.add}</div>`
      }
          <div class="j0n4t-pg-chip-popup-item danger" data-action="del" title="Remove" tabindex="0" role="menuitem">${PresetUtils.icons.close}</div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', popupHtml);
    const popup = document.body.lastElementChild;
    this.popupEl = popup;

    popup.addEventListener("click", (e) => {
      const rerollBtn = e.target.closest(".j0n4t-pg-var-reroll-btn");
      if (rerollBtn) {
        e.stopPropagation();
        this.reRollChipGroup(parseInt(chipElement.dataset.index), rerollBtn.dataset.group);
        this.closeChipMenu();
        return;
      }

      const actionEl = e.target.closest("[data-action]");
      if (!actionEl) return;
      e.stopPropagation();
      this.closeChipMenu();
      const action = actionEl.dataset.action;
      if (action === "edit") {
        if (item) this.context.openEditorForPreset(styleKey, true);
        else this.spawnInlineEditor(chipElement, styleKey, startIndex, endIndex);
      } else if (action === "swap") {
        this.spawnInlineEditor(chipElement, this.context.cache[styleKey]?.preset || styleKey, startIndex, endIndex);
      } else if (action === "locate") {
        this.locatePreset(styleKey);
      } else if (action === "create") {
        this.context.setPanelCollapseState(false);
        this.context.editor.clearFields();
        this.context.editor.dom.inpPreset.value = item ? item.preset : styleKey;
        this.context.editor.rawPresetManager?.updateHighlights();
        const cleanName = styleKey.replace(/^<(lora|lyco):/i, "").replace(/>$/, "").split(":")[0].split("/").pop().replace(/[^a-zA-Z0-9\s-_]/g, "").trim().replace(/\s+/g, "_");
        if (cleanName) this.context.editor.dom.inpName.value = cleanName;
        this.context.editor.dom.inpPreset.dispatchEvent(new Event("input"));
        this.context.editor.dom.inpPreset.focus();
      } else if (action === "del") {
        const selections = this.context.getSelectedArray();
        if (startIndex !== undefined && endIndex !== undefined) {
          selections.splice(startIndex, endIndex - startIndex);
          this.context.updateWidgetValue(selections);
        }
      }
    });

    popup.addEventListener("change", (e) => {
      const selectEl = e.target.closest("select");
      if (!selectEl) return;
      const group = selectEl.dataset.group;
      const selectedVal = selectEl.value;

      const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\{\\s*${escapeRegExp(group)}\\s*(?::[^{}]+)?\\}`);
      const replacement = selectedVal ? `{${group}:${selectedVal}}` : `{${group}}`;

      let currentKey = chipElement.dataset.id;
      let currentPreset = chipElement.dataset.preset || "";

      let newStyleKey;
      if (currentKey.match(regex)) {
        newStyleKey = currentKey.replace(regex, replacement);
      } else if (currentPreset.match(regex)) {
        newStyleKey = currentPreset.replace(regex, replacement);
      } else {
        return;
      }

      chipElement.dataset.id = newStyleKey;
      chipElement.dataset.preset = newStyleKey;

      const selections = this.context.getSelectedArray();
      if (startIndex < selections.length) {
        selections.splice(startIndex, endIndex - startIndex, newStyleKey);
        this.context.updateWidgetValue(selections);
      }
    });

    popup.addEventListener("keydown", (e) => {
      const items = Array.from(popup.querySelectorAll("[data-action], select, button"));
      const currentIndex = items.indexOf(document.activeElement);

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.stopPropagation();
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % items.length;
        items[nextIndex].focus();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.stopPropagation();
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + items.length) % items.length;
        items[prevIndex].focus();
      } else if (e.key === "Enter" || e.key === " ") {
        const actionEl = e.target.closest("[data-action], button");
        if (actionEl) {
          e.stopPropagation();
          e.preventDefault();
          actionEl.click();
        }
      } else if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        const parentChip = this.activeChipMenuEl;
        this.closeChipMenu();
        if (parentChip) parentChip.focus();
      }
    });

    popup.addEventListener("mousedown", (e) => e.stopPropagation());

    const rect = chipElement.getBoundingClientRect();
    const topPos = window.scrollY + rect.top - popup.offsetHeight - 4;
    let leftPos = window.scrollX + rect.left;
    const popupWidth = popup.offsetWidth;
    if (rect.left + popupWidth > window.innerWidth) {
      leftPos = window.scrollX + rect.right - popupWidth;
      leftPos = Math.max(window.scrollX + 8, leftPos);
    }
    popup.style.top = `${topPos < window.scrollY ? window.scrollY + rect.bottom + 4 : topPos}px`;
    popup.style.left = `${leftPos}px`;

    const closeHandler = (e) => {
      if (!popup.contains(e.target) && e.target !== chipElement) {
        this.closeChipMenu();
        document.removeEventListener("mousedown", closeHandler);
      }
    };
    this.closeHandler = closeHandler;
    setTimeout(() => {
      document.addEventListener("mousedown", closeHandler);
      const firstItem = popup.querySelector("[data-action], select");
      if (firstItem) firstItem.focus();
    }, 10);
  }

  locatePreset(styleKey) {
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
      if (this.context.dom.wrap.classList.contains("hide-gallery-mode")) {
        this.context.dom.btnHideGallery.click();
      }
      setTimeout(() => {
        itemEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        itemEl.style.transition = "border-color 0.15s, box-shadow 0.15s";
        const origColor = itemEl.style.borderColor;
        itemEl.style.borderColor = "#007acc";
        itemEl.style.boxShadow = "0 0 8px rgba(0, 122, 204, 0.75)";

        setTimeout(() => {
          itemEl.style.borderColor = origColor;
          itemEl.style.boxShadow = "";
        }, 800);
      }, 10);
    }
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