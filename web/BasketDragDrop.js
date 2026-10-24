/**
 * Chip drag/drop and image-drop handling for the Basket.
 *
 * Two things arrive by drag: chips (from the gallery, or moved inside the
 * basket) and images carrying preset metadata. This owns the drop indicator and
 * its geometry, the insertion rules for both cases, and the image-drop modal.
 * The Basket keeps the keyboard's spatial navigation and forwards the rest.
 *
 * Like the selection controller it is constructed with the Basket, because a
 * drop ends in the basket's own DOM and in the app's `updateWidgetValue`.
 */
import ModalUtils from "./ModalUtils.js";
import PngMetadata from "./PngMetadata.js";
import PresetDOM from "./PresetDOM.js";
import PresetLogic from "./PresetLogic.js";
import ChipProjection from "./ChipProjection.js";

export default class BasketDragDrop {
  /**
   * @param {GalleryContext} context
   * @param {import("./PresetBasket.js").default} basket
   */
  constructor(context, basket) {
    this.context = context;
    this.basket = basket;
    /** @type {HTMLElement | null} */
    this.dropIndicator = null;
  }

  /**
   * Bind the drop handlers on the chip pool. In raw mode the textarea owns the
   * input, so every handler bails out there.
   */
  init() {
    const pool = this.basket.basket;
    const container = this.basket.container;

    pool.addEventListener("dragenter", (e) => {
      if (!container.classList.contains("raw-mode")) {
        e.stopPropagation();
        e.preventDefault();
        pool.classList.add("drag-over");
      }
    });
    pool.addEventListener("dragleave", (e) => {
      if (e.relatedTarget && pool.contains( /** @type {HTMLElement} */(e.relatedTarget))) return;
      pool.classList.remove("drag-over");
      this.removeDropIndicator();
    });
    pool.addEventListener("dragover", (e) => {
      if (container.classList.contains("raw-mode")) return;
      e.stopPropagation();
      e.preventDefault();

      if (!this.dropIndicator) {
        pool.insertAdjacentHTML('beforeend', '<div class="j0n4t-pg-basket-drop-indicator"></div>');
        this.dropIndicator = /** @type {HTMLElement} */ (pool.lastElementChild);
      }

      const closest = this.getClosestChip(e.clientX, e.clientY);
      if (closest.element && closest.box && this.dropIndicator) {
        this.dropIndicator.style.height = `${closest.box.height}px`;
        if (e.clientX > closest.box.left + closest.box.width / 2) {
          closest.element.after(this.dropIndicator);
        } else {
          closest.element.before(this.dropIndicator);
        }
      } else {
        pool.appendChild(this.dropIndicator);
        this.dropIndicator.style.height = "12px";
      }
    });
    pool.addEventListener("drop", (e) => {
      if (container.classList.contains("raw-mode")) return;
      e.stopPropagation();
      e.preventDefault();
      pool.classList.remove("drag-over");
      this.removeDropIndicator();

      // Check for image file drop
      const imageFile = this.getImageFileFromDrop(e);
      if (imageFile) {
        void this.handleImageDrop(imageFile);
        return;
      }

      const styleKey = e.dataTransfer?.getData("text/plain");
      if (!styleKey) return;

      const closest = this.getClosestChip(e.clientX, e.clientY);
      const isBasketMove = e.dataTransfer?.getData("source/basket") === "true";
      let draggedIndexes = [];
      if (isBasketMove) {
        try {
          draggedIndexes = JSON.parse(e.dataTransfer?.getData("source/basket_indexes") || "[]");
        } catch (error) {
          console.warn("Could not read dragged basket chip selection", error);
        }
      }
      if (isBasketMove && Array.isArray(draggedIndexes) && draggedIndexes.length) {
        this.moveDraggedChips(e, closest, draggedIndexes);
        return;
      }

      let selections = this.context.getSelectedArray();
      const sourceStartStr = e.dataTransfer?.getData("source/basket_start");
      const sourceEndStr = e.dataTransfer?.getData("source/basket_end");
      let movedItems = [styleKey];
      if (isBasketMove && sourceStartStr !== "" && sourceEndStr !== "") {
        const start = Number(sourceStartStr);
        const end = Number(sourceEndStr);
        if (!isNaN(start) && !isNaN(end) && start < end) {
          movedItems = selections.splice(start, end - start);
        }
      }

      if (closest.element && closest.box) {
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

  /**
   * Move the chips a basket drag carried to the drop position.
   * @param {DragEvent} e
   * @param {{ element: HTMLElement | null; box: DOMRect | null }} closest
   * @param {number[]} draggedIndexes
   */
  moveDraggedChips(e, closest, draggedIndexes) {
    const chips = ChipProjection.getGroupedChips(this.context.getSelectedArray(), this.context.cache);
    const selectedIndexes = new Set(
      draggedIndexes.filter(index => Number.isInteger(index) && index >= 0 && index < chips.length)
    );
    const moved = chips.filter((_, index) => selectedIndexes.has(index));
    if (moved.length === 0) return;
    const remaining = chips.filter((_, index) => !selectedIndexes.has(index));
    const targetIndex = closest.element ? Number(closest.element.dataset.index) : -1;
    const target = chips[targetIndex];
    const insertionTarget = remaining.findIndex(chip => chip === target);
    const insertionIndex = insertionTarget < 0
      ? remaining.length
      : insertionTarget + (closest.box && e.clientX > closest.box.left + closest.box.width / 2 ? 1 : 0);
    remaining.splice(insertionIndex, 0, ...moved);
    const newSelections = remaining.flatMap(chip => chip.subArray);
    /** @type {Set<number>} */
    const newSelectedIndexes = new Set();
    remaining.forEach((chip, index) => {
      if (moved.includes(chip)) newSelectedIndexes.add(index);
    });
    this.basket.selection.selected = newSelectedIndexes;
    this.basket.selection.anchor = Math.min(...newSelectedIndexes);
    this.context.updateWidgetValue(newSelections);
    this.basket.selection.apply(Math.max(...newSelectedIndexes));
  }

  removeDropIndicator() {
    this.dropIndicator?.remove();
    this.dropIndicator = null;
  }

  /**
   * The chip nearest a point, ignoring the chip being dragged.
   * @param {number} clientX
   * @param {number} clientY
   */
  getClosestChip(clientX, clientY) {
    /** @type {{ distance: number, element: HTMLElement | null; box: DOMRect | null }} */
    const initialResult = { distance: Infinity, element: null, box: null };
    const chips = [...this.basket.basket.querySelectorAll(".j0n4t-pg-basket-chip:not(.dragging)")];
    const result = chips.reduce((closest, el) => {
      const box = el.getBoundingClientRect();
      const dist = Math.hypot(
        clientX - (box.left + box.width / 2),
        clientY - (box.top + box.height / 2)
      );
      return dist < closest.distance
        ? { distance: dist, element: /** @type {HTMLElement} */ (el), box }
        : closest;
    }, initialResult);
    return result;
  }

  /**
   * Extract an image file from a drop event, if present.
   * @param {DragEvent} e
   * @returns {File | null}
   */
  getImageFileFromDrop(e) {
    if (!e.dataTransfer) return null;
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return null;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith("image/")) return file;
    }
    return null;
  }

  /**
   * Handle an image file dropped onto the basket.
   * Parses PNG metadata and prompts the user to choose between evaluated and raw.
   * @param {File} file
   */
  async handleImageDrop(file) {
    try {
      const metadata = await PngMetadata.extractFromFile(file);
      const widgets = PngMetadata.getPresetGalleryWidgets(metadata);

      if (!widgets) {
        await ModalUtils.alert("No Preset Gallery widget data found in this image.");
        return;
      }

      const rawText = typeof widgets.preset_selection === "string" ? widgets.preset_selection : "";
      const evaluatedText = typeof widgets.evaluated_preset === "string" ? widgets.evaluated_preset : "";

      if (!rawText && !evaluatedText) {
        await ModalUtils.alert("No preset data found in this image.");
        return;
      }

      await ModalUtils.show({
        title: "Image Metadata",
        expand: true,
        content: `
          <div style="font-size: 11px; color: #aaa; margin-bottom: 12px;">Choose which widget value to add:</div>
          <div style="display: flex; flex-direction: column; gap: 12px; max-width: 60vw;">
            ${evaluatedText ? `
            <div style="background: #1a1a1a; border: 1px solid #444; border-radius: 6px; padding: 12px; cursor: pointer;" data-choice="evaluated">
              <div style="font-size: 11px; font-weight: bold; color: #fff; margin-bottom: 8px;">Evaluated — expanded presets</div>
              <div style="display: flex; flex-wrap: wrap; gap: 4px;">${this.renderChipPreview(evaluatedText)}</div>
            </div>` : ""}
            ${rawText ? `
            <div style="background: #1a1a1a; border: 1px solid #444; border-radius: 6px; padding: 12px; cursor: pointer;" data-choice="raw">
              <div style="font-size: 11px; font-weight: bold; color: #fff; margin-bottom: 8px;">Raw — preset_selection</div>
              <div style="display: flex; flex-wrap: wrap; gap: 4px;">${this.renderChipPreview(rawText)}</div>
            </div>` : ""}
          </div>
        `,
        buttons: [
          { text: "Cancel", closeOnFinish: true, callback: () => null },
        ],
        onOpen: (modal) => {
          const cancelBtn = /** @type {HTMLButtonElement | null} */ (modal.querySelector(".j0n4t-pg-modal-actions button"));
          modal.querySelectorAll("[data-choice]").forEach((btn) => {
            btn.addEventListener("click", () => {
              const choice = btn.getAttribute("data-choice");
              if (cancelBtn) cancelBtn.click();
              if (choice === "evaluated" && evaluatedText) {
                this.addPromptAsChips(evaluatedText);
              } else if (choice === "raw" && rawText) {
                this.addPromptAsChips(rawText);
              }
            });
          });
        },
      });
    } catch (err) {
      console.error("Failed to parse image metadata:", err);
      await ModalUtils.alert("Failed to read image metadata: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  /**
   * Render a mini chip preview HTML string for the modal.
   * Mimics the real basket chip appearance.
   * @param {string} text
   * @returns {string}
   */
  renderChipPreview(text) {
    const tokens = PresetLogic.parseTokens(text, this.context.cache);
    const selections = [];
    for (const token of tokens) {
      if (token.isDelimiter) continue;
      const trimmed = token.text.trim();
      if (!trimmed) continue;
      selections.push(token.key || trimmed);
    }
    if (selections.length === 0) return '<span style="font-size: 10px; color: #666;">(empty)</span>';

    const chipsData = ChipProjection.getGroupedChips(selections, this.context.cache);
    return chipsData.map((chipData) => {
      const chip = PresetDOM.renderBasketChip(chipData, this.context.cache, this.context.rollManager);
      const label = chip.processed.cleanLabel || chip.processed.joinedStr;
      return `<div class="j0n4t-pg-basket-chip" style='${chip.bgStyle}'><div class="j0n4t-pg-basket-chip-label">${PresetDOM.escapeHTML(label)}</div></div>`;
    }).join("");
  }

  /**
   * Add prompt text as individual chips to the basket.
   * @param {string} text
   */
  addPromptAsChips(text) {
    const tokens = PresetLogic.parseTokens(text, this.context.cache);
    const selections = this.context.getSelectedArray();
    for (const token of tokens) {
      if (token.isDelimiter) continue;
      const trimmed = token.text.trim();
      if (!trimmed) continue;
      // Use the key if it's a known preset, otherwise use the raw text
      const key = token.key || trimmed;
      selections.push(key);
    }
    if (selections.length > 0) {
      this.context.updateWidgetValue(selections);
    }
  }
}
