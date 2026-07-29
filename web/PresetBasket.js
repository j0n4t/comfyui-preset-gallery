import AutocompleteManager from "./AutocompleteManager.js";
import PresetUtils from "./PresetUtils.js";
import RawTextareaManager from "./RawTextareaManager.js";

export default class PresetBasket {
  static BASKET_CONTAINER_STYLES = /*css*/ `
    .j0n4t-pg-basket-container { display: flex; flex-direction: column; background: #15151580; border: 1px dashed #777; border-radius: 4px; box-sizing: border-box; width: 100%; flex-shrink: 0; transition: border-color 0.2s, background-color 0.2s; position: relative; resize: vertical; overflow-y: auto; overflow-x: hidden; min-height: 40px; }
    .j0n4t-pg-basket-container.drag-over { border-color: #007acc; background: #1a242db0; }
    .j0n4t-pg-basket-header { display: flex; justify-content: space-between; align-items: center; background: #222;  position: sticky; top: 0; padding: 4px; z-index: 1; }
    .j0n4t-pg-basket-title { font-size: 9px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; pointer-events: none; }
    .j0n4t-pg-basket-clear-btn:hover { background: #912e2e; }
    .j0n4t-pg-basket-pool-wrapper { position: relative; width: 100%; height: 100%; display: block; box-sizing: border-box; }
    .j0n4t-pg-basket-pool { display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; align-items: center; padding: 4px; }
    .j0n4t-pg-basket-container .j0n4t-pg-raw-wrapper { display: none; }
    .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-raw-wrapper { display: block !important; }
    .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-basket-pool-wrapper { display: none !important; }
    .j0n4t-pg-basket-raw-textarea { width: 100%; height: 100%; min-height: 48px; font-family: monospace; font-size: 11px; padding: 4px; box-sizing: border-box; margin: 0; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; line-height: 1.4; letter-spacing: normal; word-spacing: normal; text-transform: none; text-indent: 0px; text-shadow: none; }
    .j0n4t-pg-basket-container .j0n4t-pg-raw-highlights, .j0n4t-pg-basket-container .j0n4t-pg-raw-textarea { border: 0; }
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
    this.renderAddNewChipButton();
  }

  updateRawHighlights() {
    this.rawManager.updateHighlights();
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
        this.basket.appendChild(this.dropIndicator);
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
    dom.basketContainer.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this.spawnInlineEditor(null, "");
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

  spawnInlineEditor(chipElement, initialValue, startIndex = undefined, endIndex = undefined) {
    const isNew = !chipElement;
    if (isNew) {
      chipElement = Object.assign(document.createElement("div"), {
        className: "j0n4t-pg-basket-chip inline-editing",
      });
      const addBtn = this.basket.querySelector(".j0n4t-pg-basket-add-btn");
      if (addBtn) {
        addBtn.before(chipElement);
      } else {
        this.basket.appendChild(chipElement);
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
    this.basket.appendChild(addBtn);
  }

  getGroupedChips(activeList) {
    const chips = [];
    let i = 0;
    while (i < activeList.length) {
      let matched = null;
      let matchedLen = 0;

      for (let len = activeList.length - i; len >= 1; len--) {
        const subArray = activeList.slice(i, i + len);
        const joined = subArray.join(", ");

        let foundKey = null;
        let foundItem = null;

        if (this.context.cache) {
          for (const [key, item] of Object.entries(this.context.cache)) {
            if (item?.preset && item.preset.trim()) {
              const expanded = PresetUtils.expandRecursively(item.preset.trim(), this.context.cache);
              if (expanded === joined || item.preset.trim() === joined) {
                foundKey = key;
                foundItem = item;
                break;
              }
            }
            if (key === joined || key.trim() === joined) {
              foundKey = key;
              foundItem = this.context.cache[key];
              break;
            }
          }
        }
        if (!foundKey && joined.match(/^<[^<>]+>$/)) {
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
    if (!this._updatingTextarea) {
      this.textarea.value = PresetUtils.expandRecursively(
        activeList.join(", "),
        this.context.cache
      );
    }
    this.updateRawHighlights();
    this.basket.innerHTML = "";

    const chipsData = this.getGroupedChips(activeList);

    chipsData.forEach((chipData, index) => {
      const { styleKey, item, startIndex, endIndex } = chipData;
      let cleanLabel = item
        ? PresetUtils.toTitleCase(PresetUtils.getPresetName(styleKey))
        : styleKey;

      const chip = Object.assign(document.createElement("div"), {
        className: "j0n4t-pg-basket-chip",
        draggable: true,
        title: item
          ? `${cleanLabel} [${styleKey}]\n${item.preset}`
          : styleKey,
      });
      chip.dataset.id = styleKey;
      chip.dataset.index = index;
      chip.dataset.start = startIndex;
      chip.dataset.end = endIndex;

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
        if (parts[0].match(/lora|lyco/) || parts.length === 2) {
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
            if (startIndex < selections.length) {
              selections.splice(startIndex, endIndex - startIndex, newStyleKey);
              this.context.updateWidgetValue(selections);
            }
          });
        }
      }

      chip.addEventListener("click", (e) => {
        if (e.target.closest("input")) return;
        e.stopPropagation();
        this.showChipMenu(chip, styleKey, item, startIndex, endIndex);
      });
      chip.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        this.closeChipMenu();
        this.spawnInlineEditor(chip, item?.preset || styleKey, startIndex, endIndex);
      });
      chip.addEventListener("dragstart", (e) => {
        chip.classList.add("dragging");
        e.dataTransfer.setData("text/plain", styleKey);
        e.dataTransfer.setData("source/basket", "true");
        e.dataTransfer.setData("source/basket_start", String(startIndex));
        e.dataTransfer.setData("source/basket_end", String(endIndex));
      });
      chip.addEventListener("dragend", () => {
        chip.classList.remove("dragging");
        this.removeDropIndicator();
      });
      this.basket.appendChild(chip);
    });

    this.renderAddNewChipButton();
  }

  showChipMenu(chipElement, styleKey, item, startIndex, endIndex) {
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
        else this.spawnInlineEditor(chipElement, styleKey, startIndex, endIndex);
      } else if (action === "swap") {
        this.spawnInlineEditor(chipElement, this.context.cache[styleKey]?.preset || styleKey, startIndex, endIndex);
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
        this.context.editor.rawPresetManager?.updateHighlights();
        const cleanName = styleKey.replace(/^<(lora|lyco):/i, "").replace(/>$/, "").split(":")[0].split("/").pop().replace(/[^a-zA-Z0-9\s-_]/g, "").trim().replace(/\s+/g, "_");
        if (cleanName) this.context.editor.dom.inpName.value = cleanName;
        this.context.editor.dom.inpPreset.dispatchEvent(new Event("input"));
      } else if (action === "del") {
        const selections = this.context.getSelectedArray();
        if (startIndex !== undefined && endIndex !== undefined) {
          selections.splice(startIndex, endIndex - startIndex);
          this.context.updateWidgetValue(selections);
        }
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