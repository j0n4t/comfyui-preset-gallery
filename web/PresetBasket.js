import ChipMenuManager from "./ChipMenuManager.js";
import InlineEditorManager from "./InlineEditorManager.js";
import ModalUtils from "./ModalUtils.js";
import PresetDOM from "./PresetDOM.js";
import PresetLogic from "./PresetLogic.js";
import RawTextareaManager from "./RawTextareaManager.js";

export default class PresetBasket {
  static BASKET_CONTAINER_STYLES = /*css*/ `
    .j0n4t-pg-basket-container.drag-over { border-color: #007acc; background: #1a242db0; }
    .j0n4t-pg-basket-header { display: flex; justify-content: space-between; align-items: center; background: #222;  position: sticky; top: 0; padding: 4px; z-index: 1; }
    .j0n4t-pg-basket-title { font-size: 9px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; pointer-events: none; }
    .j0n4t-pg-basket-clear-btn:hover, .j0n4t-pg-basket-clear-btn:focus-visible { background: #912e2e; outline: 2px solid #fff; }
    .j0n4t-pg-basket-copy-btn { display: flex; background: none; border: none; outline: none; padding: 0; }
    .j0n4t-pg-basket-copy-btn:hover, .j0n4t-pg-basket-copy-btn:focus-visible { color: #007acc; transform: scale(1.1); }
    .j0n4t-pg-var-reroll-btn { display: flex; align-items: center; justify-content: center; background: transparent; border: none; color: #aaa; cursor: pointer; font-size: 13px; padding: 0 4px; outline: none; transition: 0.15s; }
    .j0n4t-pg-var-reroll-btn:hover, .j0n4t-pg-var-reroll-btn:focus-visible { color: #fff; transform: scale(1.1); }
    .j0n4t-pg-checkbox-wrap {height:auto; padding:0; margin-right:4px;}
    .j0n4t-pg-basket-reroll-btn:hover, .j0n4t-pg-basket-reroll-btn:focus-visible { filter: grayscale(0) brightness(1) !important; transform: scale(1.1); }
    .j0n4t-pg-basket-pool { display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; align-items: center; padding: 4px; }
    .j0n4t-pg-basket-container .j0n4t-pg-raw-wrapper { display: none; width: auto; }
    .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-raw-wrapper { display: block; margin: 4px; }
    .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-basket-pool-wrapper { display: none; }
  `;

  static BASKET_CHIP_ETC_STYLES = /*css*/ `
    .j0n4t-pg-basket-empty { font-size: 10px; color: #555; font-style: italic; pointer-events: none; }
    .j0n4t-pg-basket-drop-indicator { width: 2px; background-color: #007acc; box-shadow: 0 0 4px #007acc; border-radius: 1px; transition: transform 0.05s ease; pointer-events: none; }
    .j0n4t-pg-basket-chip { display: flex; align-items: center; background-size: cover; background-position: center; border: 1px solid #3d3d3d; border-radius: 3px; padding: 2px 4px; box-sizing: border-box; cursor: grab; user-select: none; transition: background 0.15s, border-color 0.15s; position: relative; overflow: hidden; min-height: 1.4em; outline: none; }
    .j0n4t-pg-basket-chip::before { content: ""; position: absolute; inset: 0; background: rgba(0, 0, 0, 0.2); z-index: 0; pointer-events: none; }
    .j0n4t-pg-basket-chip:active { cursor: grabbing; }
    .j0n4t-pg-basket-chip.dragging { opacity: 0.4; border-color: #007acc; }
    .j0n4t-pg-basket-chip:focus-visible { border-width: 2px; border-color: #007acc; }
    .j0n4t-pg-basket-chip-segments { display: flex; gap: 0.2em; width: 100%; align-items: center; }
    .j0n4t-pg-basket-chip-segment { flex: 1; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
    .j0n4t-pg-basket-chip-weight { font-size: 9px; font-weight: bold; font-family: monospace; background: rgba(0, 0, 0, 0.4); color: #fff;  border-radius: 999px; padding: 0 3px; margin-right: 4px; cursor: pointer; z-index: 1; pointer-events: auto; }
    .j0n4t-pg-basket-chip-weight:hover { background: #007acc; }

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
    .j0n4t-pg-chip-popup-actions { display: flex;  flex-direction: row; justify-content: space-around; padding: 0 2px; }
    .j0n4t-pg-chip-popup-item, .j0n4t-pg-var-edit-btn { padding: 4px; font-size: 11px; color: #ccc; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; outline: none; }
    .j0n4t-pg-chip-popup-item svg, .j0n4t-pg-var-edit-btn svg { width: 12px; height: 12px; fill: currentColor; }
    .j0n4t-pg-chip-popup-item:hover, .j0n4t-pg-chip-popup-item:focus-visible, .j0n4t-pg-var-edit-btn:hover, .j0n4t-pg-var-edit-btn:focus-visibles { background: #333; color: #fff; }
    .j0n4t-pg-var-edit-btn { background: transparent; border: 0; }
    .j0n4t-pg-chip-popup-item.danger:hover, .j0n4t-pg-chip-popup-item.danger:focus-visible { background: #912e2e; color: #fff; }
    .j0n4t-pg-var-more { display: flex; font-size: 11px; }

    .j0n4t-pg-weight-btn { background: #333; color: #fff; border: 1px solid #555; border-radius: 3px; cursor: pointer; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; outline: none; font-size: 14px; line-height: 1; }
    .j0n4t-pg-weight-btn:hover, .j0n4t-pg-weight-btn:focus-visible { background: #007acc; border-color: #007acc; }
    .j0n4t-pg-weight-input { width: 44px; height: 20px; text-align: center; background: #111; color: #fff; border: 1px solid #555; border-radius: 2px; font-size: 11px; outline: none; font-family: monospace; }
    .j0n4t-pg-weight-input:focus { border-color: #007acc; }

    .j0n4t-pg-var-popup-container {display: flex; flex-direction: column; max-height: 50vh; max-width: 80vw; overflow: scroll; }
    .j0n4t-pg-var-popup-row { display: flex; align-items: center; padding: 4px; }
    .j0n4t-pg-var-popup-row label { font-size: 10px; color: #d1a119; font-weight: 600; min-width: 40px; text-transform: capitalize; }
    .j0n4t-pg-var-popup-row select { flex: 1; height: 20px; background: #1a1a1a; border: 1px solid #444; color: #fff; font-size: 10px; border-radius: 2px; padding: 0 2px; font-weight: 600; font-family: inherit; outline: none; cursor: pointer; }
    .j0n4t-pg-var-popup-row select:focus { border-color: #007acc; }
    .j0n4t-pg-var-popup-row select option { background: #1a1a1a; color: #fff; }
  `;

  constructor(container, basket, textarea, context) {
    this.container = container;
    this.basket = basket;
    this.textarea = textarea;
    this.context = context;
    this.dropIndicator = null;
    this.currentMatches = [];
    this.activeIndex = 0;
    this._updatingTextarea = false;
    this.inlineEditorManager = new InlineEditorManager(this.context, this.basket);
    this.chipMenuManager = new ChipMenuManager(this.context, this);

    PresetDOM.injectStyles("j0n4t-pg-basket-container-styles", PresetBasket.BASKET_CONTAINER_STYLES);
    PresetDOM.injectStyles("j0n4t-pg-basket-chip-etc-styles", PresetBasket.BASKET_CHIP_ETC_STYLES);

    this.rawManager = new RawTextareaManager(this.textarea, this.context, null, (val) => {
      const tokens = PresetLogic.parseTokens(val, this.context.cache);
      const selections = tokens
        .filter((t) => !t.isDelimiter && t.text.trim())
        .map((t) => (t.key ? t.key : t.text.trim()));
      this.context.updateWidgetValue(selections);
    });

    this.initDragAndDrop();
    this.initBasketActions();
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

    const copyBtn = dom.btnCopyBasket || this.container.querySelector(".j0n4t-pg-basket-copy-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => this.showCopyModal());
    }

    dom.btnClearBasket.addEventListener("click", async () => {
      if (this.context.getSelectedArray().length && await ModalUtils.confirm("Empty basket?"))
        this.context.updateWidgetValue([]);
    });

    dom.chkBasketRaw.checked = localStorage.getItem("comfy_preset_gallery_raw_basket") === "true";
    dom.basketContainer.classList.toggle("raw-mode", dom.chkBasketRaw.checked);
    dom.chkBasketRaw.addEventListener("change", () => {
      localStorage.setItem("comfy_preset_gallery_raw_basket", String(dom.chkBasketRaw.checked));
      dom.basketContainer.classList.toggle("raw-mode", dom.chkBasketRaw.checked);
    });

    this.basket.addEventListener("dblclick", (e) => {
      const chip = e.target.closest('.j0n4t-pg-basket-chip');
      if (chip) {
        e.stopPropagation();
        this.chipMenuManager.close();

        const styleKey = chip.dataset.id;
        const wMatch = styleKey.match(/^\((.+?):([-+]?[0-9]*\.?[0-9]+)\)$/);
        let editVal = styleKey;

        const rawPreset = chip.dataset.preset;
        if (wMatch && rawPreset) {
          editVal = `(${rawPreset}:${wMatch[2]})`;
        } else if (rawPreset) {
          editVal = rawPreset;
        }

        this.inlineEditorManager.spawn(chip, editVal, parseInt(chip.dataset.start), parseInt(chip.dataset.end));
      } else {
        e.stopPropagation();
        this.inlineEditorManager.spawn(null, "");
      }
    });

    this.basket.addEventListener("click", (e) => {
      const addBtn = e.target.closest('.j0n4t-pg-basket-add-btn');
      if (addBtn) return this.inlineEditorManager.spawn(null, "");

      if (e.target.closest("input")) return;

      const weightBadge = e.target.closest('.j0n4t-pg-basket-chip-weight');
      const chip = e.target.closest('.j0n4t-pg-basket-chip');

      if (chip) {
        e.stopPropagation();
        const styleKey = chip.dataset.id;

        const wMatch = styleKey.match(/^\((.+?):([-+]?[0-9]*\.?[0-9]+)\)$/);
        const coreKey = wMatch ? wMatch[1] : styleKey;
        const cachedItem = this.context.cache?.[coreKey] || this.context.cache?.[styleKey];
        const evalId = chip.dataset.evalId || coreKey;

        this.chipMenuManager.show(chip, styleKey, cachedItem, parseInt(chip.dataset.start), parseInt(chip.dataset.end), !!weightBadge);

        if (weightBadge) return;

        let targetKey = styleKey;
        const presetVal = chip.dataset.preset;

        if (presetVal) {
          const match = PresetLogic.findPresetMatch(presetVal, this.context.cache);
          if (match) targetKey = match.key;
        } else if (this.context.cache?.[evalId]) {
          targetKey = evalId;
        } else if (this.context.cache?.[coreKey]) {
          targetKey = coreKey;
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
        const newStyleKey = PresetLogic.expandRecursively(styleKey, this.context.cache).replace(/([:;])[^:;]+(>)$/, `$1${newValue}$2`);
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

      // Handle Delete key to remove selected chip
      if (e.key === "Delete" && !e.target.closest("input")) {
        const chip = e.target.closest('.j0n4t-pg-basket-chip');
        if (chip) {
          e.stopPropagation();
          e.preventDefault();
          const startIndex = parseInt(chip.dataset.start);
          const endIndex = parseInt(chip.dataset.end);
          const selections = this.context.getSelectedArray();
          if (startIndex >= 0 && endIndex <= selections.length) {
            selections.splice(startIndex, endIndex - startIndex);
            this.context.updateWidgetValue(selections);
            // Focus the next chip or add button if available
            const focusableElements = Array.from(this.basket.querySelectorAll('.j0n4t-pg-basket-chip, .j0n4t-pg-basket-add-btn'));
            const newIndex = Math.min(startIndex, focusableElements.length - 1);
            if (newIndex >= 0) {
              focusableElements[newIndex]?.focus();
            }
          }
        }
        return; // Prevent further processing
      }

      if (!e.target.closest("input") && !e.altKey) {
        const focusableElements = Array.from(this.basket.querySelectorAll('.j0n4t-pg-basket-chip, .j0n4t-pg-basket-add-btn'));
        const currentElement = e.target.closest('.j0n4t-pg-basket-chip, .j0n4t-pg-basket-add-btn');
        const currentIndex = focusableElements.indexOf(currentElement);

        if (currentIndex !== -1) {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.stopPropagation();
            e.preventDefault();
            focusableElements[currentIndex + 1]?.focus();
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.stopPropagation();
            e.preventDefault();
            focusableElements[currentIndex - 1]?.focus();
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
          if (prevChip?.classList.contains('j0n4t-pg-basket-chip')) {
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

    this.basket.addEventListener("dragend", () => {
      this.basket.querySelectorAll(".j0n4t-pg-basket-chip").forEach(c => c.classList.remove("dragging"));
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

  reRollChipGroup(chipIndex, groupRaw, gIndex = null) {
    const activeList = this.context.getSelectedArray();
    const chipsData = PresetLogic.getGroupedChips(activeList, this.context.cache);
    const tracer = new PresetLogic.RollManager(this.context.rollManager.rolls);
    const targetGroup = groupRaw.trim().toLowerCase().replace(/\s+/g, "_");

    for (let i = 0; i < chipsData.length; i++) {
      const startCounts = tracer.cloneCounts();
      PresetLogic.expandRecursively(chipsData[i].styleKey, this.context.cache, new Set(), tracer);

      if (i === chipIndex) {
        const start = startCounts[targetGroup] || 0;
        const end = tracer.getCount(targetGroup);

        if (gIndex !== null && gIndex !== undefined) {
          const targetRollIndex = start + parseInt(gIndex, 10);
          if (targetRollIndex < end) {
            this.context.rollManager.deleteRoll(targetGroup, targetRollIndex);
          }
        } else {
          for (let k = start; k < end; k++) {
            this.context.rollManager.deleteRoll(targetGroup, k);
          }
        }
        break;
      }
    }
    this.context.syncUI(this.context.widget.value);
  }

  render(activeList) {
    if (!this._updatingTextarea) {
      this.context.rollManager.resetCounts(); // Clear counts before processing text
      const expandedList = activeList.map(itemStr => {
        const wMatch = itemStr.match(/^\((.+?):([-+]?[0-9]*\.?[0-9]+)\)$/);
        if (wMatch) {
          const coreExpanded = PresetLogic.expandRecursively(wMatch[1], this.context.cache, new Set(), this.context.rollManager);
          return `(${coreExpanded}:${wMatch[2]})`;
        }
        return PresetLogic.expandRecursively(itemStr, this.context.cache, new Set(), this.context.rollManager);
      });
      this.textarea.value = expandedList.join(", ");
    }
    this.rawManager.updateHighlights();

    let htmlBuffer = "";
    const chipsData = PresetLogic.getGroupedChips(activeList, this.context.cache);

    this.context.rollManager.resetCounts(); // Reset once more before UI paint

    chipsData.forEach((chipData, index) => {
      const chip = PresetDOM.renderBasketChip(
        chipData,
        this.context.cache,
        this.context.rollManager
      );

      let labelContent = PresetDOM.escapeHTML(chip.cleanLabel);
      if ((!chip.item || chipData.styleKey.startsWith("_/combo")) && chip.segmentedLabels) {
        labelContent = `<div class="j0n4t-pg-basket-chip-segments">` +
          chip.segmentedLabels.filter(Boolean).map(p => `<span class="j0n4t-pg-basket-chip-segment">${PresetDOM.escapeHTML(p)}</span>`).join('') +
          `</div>`;
      }

      htmlBuffer += `
        <div class="j0n4t-pg-basket-chip" tabindex="0" role="option" aria-selected="false" 
             draggable="true" 
             title="${PresetDOM.escapeHTML(chip.tooltipTitle)}"
             data-id="${PresetDOM.escapeHTML(chip.joinedStr)}"
             data-eval-id="${PresetDOM.escapeHTML(chip.evalId)}"
             data-preset="${PresetDOM.escapeHTML(chip.item?.preset || "")}"
             data-index="${index}"
             data-start="${chip.startIndex}"
             data-end="${chip.endIndex}"
             style='${chip.bgStyle}'>
            ${chip.weightIconHtml}
            <div class="j0n4t-pg-basket-chip-label" title="${PresetDOM.escapeHTML(chip.chipExpanded || chip.joinedStr)}">
                ${labelContent}
            </div>
            ${chip.inputHtml}
        </div>
      `;
    });

    htmlBuffer += `<div class="j0n4t-pg-basket-add-btn" tabindex="0" role="button" title="Add new preset or keyword" aria-label="Add new keyword">+ Add</div>`;
    this.basket.innerHTML = htmlBuffer;
  }

  getCopyContent() {
    if (this.container.classList.contains("raw-mode")) {
      return this.textarea.value;
    }
    const selections = this.context.getSelectedArray();
    if (!selections || selections.length === 0) return "";
    const cache = this.context.cache || {};

    const items = selections.map((key) => {
      const wMatch = key.match(/^\((.+?):([-+]?[0-9]*\.?[0-9]+)\)$/);
      const coreKey = wMatch ? wMatch[1] : key;
      const weightStr = wMatch ? wMatch[2] : null;

      const item = cache[coreKey];
      if (!item) return key;

      let res = coreKey;
      if (Array.isArray(item.variants) && item.variants.length > 1) {
        const variantOptions = item.variants.map((v) => `${coreKey}:${v}`).join("|");
        res = `{${variantOptions}}`;
      }
      return weightStr ? `(${res}:${weightStr})` : res;
    });

    return items.join(", ");
  }

  async showCopyModal() {
    const content = this.getCopyContent();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content).catch(() => { });
    }
    ModalUtils.show({
      title: "📋 Basket Contents",
      content: `<textarea readonly style="width: 100%; height: 120px; background: #1a1a1a; color: #fff; border: 1px solid #444; border-radius: 4px; padding: 6px; box-sizing: border-box; font-family: monospace; font-size: 11px; resize: vertical; margin: 8px 0;">${PresetDOM.escapeHTML(content)}</textarea>`,
      buttons: [
        {
          text: "Copy",
          className: "",
          isDefault: true,
          callback: () => {
            const textarea = document.querySelector(".j0n4t-pg-modal textarea");
            if (textarea) {
              textarea.select();
              navigator.clipboard.writeText(textarea.value);
              const copyBtn = document.querySelector(".j0n4t-pg-modal .j0n4t-pg-btn");
              if (copyBtn) {
                copyBtn.textContent = "Copied!";
                setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
              }
            }
          }
        },
        { text: "Close", closeOnFinish: true }
      ]
    });
  }

  locatePreset(styleKey) {
    const itemEl = this.context.dom.grid.querySelector(`.j0n4t-pg-item[data-style="${PresetDOM.escapeHTML(styleKey)}"]`);
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
}