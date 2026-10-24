/**
 * Multi-selection and clipboard commands for the Basket.
 *
 * The Basket presents chips and forwards user actions; this owns the selection
 * set those actions work on (which chip indexes are selected, where the range
 * anchor is, whether Select mode is on) and the clipboard payload format the
 * copy/paste pair shares.
 *
 * It is constructed with the Basket because a command ends in DOM work that
 * belongs to it: repainting chip classes, focusing a chip, closing the chip
 * menu and snapshotting the tab. Selection changes themselves go through the
 * app (`updateWidgetValue`), like every other edit.
 */
import PresetLogic from "./PresetLogic.js";
import ChipProjection from "./ChipProjection.js";
import PresetDOM from "./PresetDOM.js";
import RollManager from "./RollManager.js";

const BASKET_CLIPBOARD_TYPE = "web application/x-comfy-preset-gallery-basket+json";

/**
 * @type {{ text: string; type?: string; version?: number; chips?: { items: string[]; styleKey: string; pinned: boolean; rolls: Record<string, Array<{ offset: number; value: string; }>>; }[]; } | null}
 */
let basketClipboard = null;

export default class BasketSelectionController {
  /**
   * @param {GalleryContext} context
   * @param {import("./PresetBasket.js").default} basket
   */
  constructor(context, basket) {
    this.context = context;
    this.basket = basket;
    /** @type {Set<number>} */
    this.selected = new Set();
    /** @type {number | null} */
    this.anchor = null;
    this.multiSelect = false;
  }

  /** @param {number} index */
  isSelected(index) {
    return this.selected.has(index);
  }

  clear() {
    this.selected.clear();
    this.anchor = null;
  }

  /**
   * Repaint the chips from the selection, focus one, and refresh the action
   * buttons.
   * @param {number} [index] chip to focus
   */
  apply(index) {
    const chips = Array.from(this.basket.basket.querySelectorAll(".j0n4t-pg-basket-chip"));
    chips.forEach((chip, chipIndex) => {
      const selected = this.selected.has(chipIndex);
      chip.classList.toggle("selected", selected);
      chip.setAttribute("aria-selected", String(selected));
    });
    if (index !== undefined && index >= 0) {
      /** @type {HTMLElement} */ (chips[index]).focus();
    }
    this.updateActionButtons();
  }

  updateActionButtons() {
    const selections = this.context.getSelectedArray();
    const selectedChips = ChipProjection.getGroupedChips(
      selections,
      this.context.cache
    ).filter((_, index) => this.selected.has(index));
    const hasSelection = selectedChips.length > 0;
    this.context.dom.btnCopyBasket.disabled = !hasSelection;
    this.context.dom.btnBasketPin.disabled = !hasSelection;
    this.context.dom.btnBasketDelete.disabled = !hasSelection;
    const allPinned = selectedChips.length > 0 && selectedChips.every(chip =>
      this.context.pinnedChips?.has(
        selections.slice(chip.startIndex, chip.endIndex).join(", ")
      )
    );
    this.context.dom.btnBasketPin.innerHTML = `${PresetDOM.icons.pin} <span>${allPinned ? "Unpin" : "Pin"}</span>`;
    this.context.dom.btnBasketPin.title = allPinned
      ? "Unpin selected chips"
      : "Pin selected chips";
    this.context.dom.btnBasketPin.setAttribute(
      "aria-label",
      this.context.dom.btnBasketPin.title
    );
  }

  /**
   * @param {number} start
   * @param {number} end
   */
  selectRange(start, end) {
    this.selected.clear();
    for (let index = Math.min(start, end); index <= Math.max(start, end); index++) {
      this.selected.add(index);
    }
    this.apply(end);
  }

  /**
   * @param {HTMLElement} chip
   * @param {MouseEvent | KeyboardEvent} event
   */
  handleChip(chip, event) {
    const index = Number(chip.dataset.index);
    const multiSelect = event.ctrlKey || event.metaKey;
    if (event.shiftKey) {
      this.selectRange(this.anchor ?? index, index);
    } else if (multiSelect || this.multiSelect) {
      if (this.selected.has(index)) {
        this.selected.delete(index);
      } else {
        this.selected.add(index);
      }
      this.anchor = index;
      this.apply(index);
    } else {
      this.selected.clear();
      this.selected.add(index);
      this.anchor = index;
      this.apply(index);
    }
  }

  deleteSelected() {
    const chips = ChipProjection.getGroupedChips(this.context.getSelectedArray(), this.context.cache);
    const selectedIndexes = [...this.selected].sort((a, b) => b - a);
    const selections = this.context.getSelectedArray();
    let focusStart = selections.length;
    for (const index of selectedIndexes) {
      const chip = chips[index];
      if (!chip) continue;
      focusStart = Math.min(focusStart, chip.startIndex);
      selections.splice(chip.startIndex, chip.endIndex - chip.startIndex);
    }
    this.clear();
    this.context.updateWidgetValue(selections);
    this.basket.chipMenuManager.close(false);
    this.basket.focusChip(focusStart);
  }

  togglePins() {
    const focusedChip = /** @type {HTMLElement | null} */ (
      document.activeElement?.closest?.(".j0n4t-pg-basket-chip")
    );
    const focusedIndex = focusedChip ? Number(focusedChip.dataset.index) : -1;
    const selections = this.context.getSelectedArray();
    const chips = ChipProjection.getGroupedChips(selections, this.context.cache);
    const selectedChips = [...this.selected]
      .sort((a, b) => a - b)
      .map(index => chips[index])
      .filter(Boolean);
    if (!selectedChips.length) return;

    const allPinned = selectedChips.every(chip =>
      this.context.pinnedChips?.has(selections.slice(chip.startIndex, chip.endIndex).join(", "))
    );
    for (const chip of selectedChips) {
      const key = selections.slice(chip.startIndex, chip.endIndex).join(", ");
      if (allPinned) this.context.pinnedChips?.delete(key);
      else this.context.pinnedChips?.add(key);
    }
    this.context.savePins();
    this.basket.saveCurrentState();
    this.context.syncUI(this.context.widget.value);
    this.apply(focusedIndex);
  }

  /**
   * Move the selected chips past the chip at `targetIndex`.
   * @param {number} targetIndex
   * @param {boolean} placeAfter
   * @param {Set<number>} [selection=this.selected]
   */
  moveSelected(targetIndex, placeAfter, selection = this.selected) {
    const chips = ChipProjection.getGroupedChips(this.context.getSelectedArray(), this.context.cache);
    const target = chips[targetIndex];
    const moved = chips.filter((_, index) => selection.has(index));
    if (!target || moved.length === 0 || selection.has(targetIndex)) return;

    const remaining = chips.filter((_, index) => !selection.has(index));
    const insertionTarget = remaining.findIndex(chip => chip === target);
    if (insertionTarget < 0) return;
    const insertionIndex = insertionTarget + (placeAfter ? 1 : 0);
    remaining.splice(insertionIndex, 0, ...moved);

    const newSelections = remaining.flatMap(chip => chip.subArray);
    /** @type {Set<number>} */
    const newSelectedIndexes = new Set();
    remaining.forEach((chip, index) => {
      if (moved.includes(chip)) newSelectedIndexes.add(index);
    });
    if (newSelectedIndexes.size === 0) return;
    const firstSelected = Math.min(...newSelectedIndexes);
    this.context.updateWidgetValue(newSelections);
    this.selected = newSelectedIndexes;
    this.anchor = firstSelected;
    this.apply(Math.max(...newSelectedIndexes));
  }

  /** @param {HTMLElement} [focusedChip] */
  async copySelected(focusedChip) {
    const activeList = this.context.getSelectedArray();
    const chipsData = ChipProjection.getGroupedChips(activeList, this.context.cache);
    let selectedIndexes = [...this.selected].sort((a, b) => a - b);
    if (selectedIndexes.length === 0 && focusedChip) {
      selectedIndexes = [Number(focusedChip.dataset.index)];
    }
    if (selectedIndexes.length === 0) return;

    const selected = new Set(selectedIndexes);
    const tracer = new RollManager(this.context.rollManager.rolls).resetCounts();
    /** @type {Array<{items: string[], styleKey: string, pinned: boolean, rolls: Record<string, Array<{offset: number, value: string}>>}>} */
    const copiedChips = [];

    chipsData.forEach((chipData, index) => {
      const beforeCounts = tracer.cloneCounts();
      PresetLogic.expandRecursively(chipData.styleKey, this.context.cache, new Set(), tracer);
      if (!selected.has(index)) return;

      const items = activeList.slice(chipData.startIndex, chipData.endIndex);
      const rawValue = items.join(", ");
      /** @type {Record<string, Array<{offset: number, value: string}>>} */
      const rolls = {};
      for (const [group, endCount] of Object.entries(tracer.counts)) {
        const startCount = beforeCounts[group] || 0;
        for (let rollIndex = startCount; rollIndex < endCount; rollIndex++) {
          const value = this.context.rollManager.peekRoll(group, rollIndex);
          if (value !== undefined) {
            (rolls[group] ||= []).push({ offset: rollIndex - startCount, value });
          }
        }
      }
      copiedChips.push({
        items,
        styleKey: chipData.styleKey,
        pinned: this.context.pinnedChips?.has(rawValue) || false,
        rolls
      });
    });

    const text = copiedChips.flatMap(chip => chip.items).join(", ");
    basketClipboard = { type: "comfy-preset-gallery-basket", version: 1, chips: copiedChips, text };

    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        const clipboardItem = new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          [BASKET_CLIPBOARD_TYPE]: new Blob([JSON.stringify(basketClipboard)], { type: "application/x-comfy-preset-gallery-basket+json" })
        });
        await navigator.clipboard.write([clipboardItem]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch (error) {
      console.warn("Could not write basket chips to the clipboard", error);
      try {
        await navigator.clipboard?.writeText(text);
      } catch (fallbackError) {
        console.warn("Could not write basket text to the clipboard", fallbackError);
      }
    }
  }

  /** @param {unknown} value */
  isClipboardPayload(value) {
    if (!value || typeof value !== "object") return false;
    const payload = /** @type {Record<string, unknown>} */ (value);
    return payload.type === "comfyui-preset-gallery-basket" &&
      payload.version === 1 &&
      Array.isArray(payload.chips) &&
      payload.chips.every(chip =>
        chip && typeof chip === "object" &&
        Array.isArray(chip.items) &&
        chip.items.length > 0 &&
        chip.items.every((/** @type {any} */ item) => typeof item === "string") &&
        typeof chip.styleKey === "string" &&
        typeof chip.pinned === "boolean" &&
        chip.rolls && typeof chip.rolls === "object" &&
        Object.values(chip.rolls).every(rolls =>
          Array.isArray(rolls) &&
          rolls.every(roll =>
            roll && Number.isInteger(roll.offset) && roll.offset >= 0 && typeof roll.value === "string"
          )
        )
      );
  }

  async readClipboard() {
    let plainText = "";
    try {
      if (navigator.clipboard?.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          if (item.types.includes(BASKET_CLIPBOARD_TYPE)) {
            const data = await (await item.getType(BASKET_CLIPBOARD_TYPE)).text();
            const parsed = JSON.parse(data);
            if (this.isClipboardPayload(parsed)) return parsed;
          }
          if (item.types.includes("text/plain")) {
            plainText = await (await item.getType("text/plain")).text();
          }
        }
      } else if (navigator.clipboard?.readText) {
        plainText = await navigator.clipboard.readText();
      }
    } catch (error) {
      console.warn("Could not read rich basket clipboard data", error);
    }
    if (!plainText && navigator.clipboard?.readText) {
      try {
        plainText = await navigator.clipboard.readText();
      } catch (error) {
        console.warn("Could not read plain basket clipboard text", error);
      }
    }

    if (basketClipboard && plainText === basketClipboard.text) return basketClipboard;
    if (!plainText && basketClipboard) return basketClipboard;
    const items = PresetLogic.splitPresets(plainText).filter(Boolean);
    return items.length
      ? { type: "comfyui-preset-gallery-basket", version: 1, chips: items.map(item => ({ items: [item], styleKey: item, pinned: false, rolls: {} })) }
      : null;
  }

  async paste() {
    const payload = await this.readClipboard();
    if (!payload || !Array.isArray(payload.chips) || payload.chips.length === 0) return;

    const activeList = this.context.getSelectedArray();
    const originalLength = activeList.length;
    const existingChips = ChipProjection.getGroupedChips(activeList, this.context.cache);
    const selections = [...activeList];
    for (const chip of payload.chips) selections.push(...chip.items);

    const tracer = new RollManager(this.context.rollManager.rolls).resetCounts();
    existingChips.forEach(chip =>
      PresetLogic.expandRecursively(chip.styleKey, this.context.cache, new Set(), tracer)
    );
    payload.chips.forEach((/** @type {{ styleKey: string; rolls: any; pinned: any; items: any[]; }} */ chip) => {
      const beforeCounts = tracer.cloneCounts();
      PresetLogic.expandRecursively(chip.styleKey, this.context.cache, new Set(), tracer);
      for (const [group, rolls] of Object.entries(chip.rolls || {})) {
        for (const roll of rolls) {
          tracer.rolls[`${group}_${(beforeCounts[group] || 0) + roll.offset}`] = roll.value;
        }
      }
      if (chip.pinned) this.context.pinnedChips?.add(chip.items.join(", "));
    });
    this.context.rollManager.rolls = tracer.rolls;
    this.context.updateWidgetValue(selections);
    this.context.savePins();

    const updatedChips = ChipProjection.getGroupedChips(selections, this.context.cache);
    const pastedIndexes = updatedChips
      .map((chip, index) => chip.startIndex >= originalLength ? index : -1)
      .filter(index => index >= 0);
    this.selected = new Set(pastedIndexes);
    this.anchor = pastedIndexes[0] ?? null;
    this.apply(pastedIndexes[pastedIndexes.length - 1]);
    this.basket.saveCurrentState();
  }
}
