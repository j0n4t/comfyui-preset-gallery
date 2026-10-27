import PresetDOM from "./PresetDOM.js";
import PresetLogic from "./PresetLogic.js";
import ChipMenuCommands from "./ChipMenuCommands.js";
import AutocompleteManager from "./AutocompleteManager.js";
import PresetDisplay from "./PresetDisplay.js";

/** @typedef {HTMLInputElement & {_options?: {key: string, display: string}[]}} CustomInputElement */

export default class ChipMenuManager {
  /** @param {GalleryContext} context @param {import("./PresetBasket.js").default} delegateBasket */
  constructor(context, delegateBasket) {
    this.context = context;
    this.basket = delegateBasket;
    /** @type {HTMLElement | null} */
    this.activeChipMenuEl = null;
    this.popupEl = null;
    this.closeHandler = null;
    /** @param {GalleryContext} context */
    this.commands = new ChipMenuCommands(this, this.context, this.basket);
  }

  /**
   * @param {number} startIndex
   * @param {number} endIndex
   * @param {string} newStyleKey
   * @param {boolean} coreReplaced
   */
  _updateChipSelection(startIndex, endIndex, newStyleKey, coreReplaced) {
    if (!this.basket.updateChipSelection(startIndex, endIndex, newStyleKey)) return;

    if (coreReplaced) {
      this.close(true);
    } else {
      const newChips = /** @type {HTMLElement[]} */ (Array.from(this.basket.basket.querySelectorAll(".j0n4t-pg-basket-chip")));
      const replacementChip = newChips.find(c => c.dataset.id === newStyleKey && Number(c.dataset.start) === startIndex);
      if (replacementChip) {
        this.activeChipMenuEl = replacementChip;
        replacementChip.classList.add("active-menu");
      } else {
        this.close(true);
      }
    }
  }

  /**
  * @param {HTMLElement} chipElement
  * @param {boolean} [focusWeight]
  */
  toggle(chipElement, focusWeight = false) {
    if (this.activeChipMenuEl && chipElement === this.activeChipMenuEl) {
      this.close(true);
    } else {
      this.show(chipElement, focusWeight);
    }
  }

  /**
   * @param {HTMLElement} chipElement
   * @param {boolean} [focusWeight]
   */
  show(chipElement, focusWeight = false) {
    const styleKey = chipElement.dataset.id || "";
    const startIndex = Number(chipElement.dataset.start);
    const endIndex = Number(chipElement.dataset.end);
    const { core: coreKey, weight: currentWeight } = PresetLogic.parseWeight(styleKey);
    const item = this.context.cache[coreKey];

    if (this.activeChipMenuEl) {
      this.activeChipMenuEl.classList.remove("active-menu");
    }
    this.popupEl?.remove();
    chipElement.classList.add("active-menu");
    this.activeChipMenuEl = chipElement;

    const source = PresetLogic.getUnrolledTemplate(coreKey, this.context.cache);
    const allVariants = PresetLogic.getAllVariants(source, this.context.cache);

    let varRowsHtml = "";
    /** @type {Record<string, number>} */
    const groupCounts = {};
    /** @type {AutocompleteConfig[]} */
    const autocompleteConfigs = [];

    if (allVariants.length > 0) {
      allVariants.forEach(({ groupRaw, groupName, val: currentSelectedVal, rootGroup, isSub }) => {
        const gIndex = groupCounts[groupRaw] || 0;
        groupCounts[groupRaw] = gIndex + 1;

        let matches = PresetLogic.getGroupMatches(groupName, this.context.cache);

        if (matches.length > 0) {
          matches.sort((a, b) => a.localeCompare(b));

          const escapedGroup = PresetDOM.escapeHTML(groupName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const groupRegex = new RegExp(`(^|/)${escapedGroup}(/|$)`, 'i');

          const isNullSelected = currentSelectedVal && PresetLogic.isVirtualNull(currentSelectedVal);
          const displayValue = !currentSelectedVal
            ? "🎲 Random"
            : isNullSelected
              ? "🚫 None (Omit)"
              : PresetDisplay.toTitleCase(PresetDisplay.getPresetName(currentSelectedVal) || "");
          const dataKey = !currentSelectedVal ? "" : isNullSelected ? "none" : currentSelectedVal;

          varRowsHtml += `<div class="j0n4t-pg-var-popup-row">
            <label>${PresetDOM.escapeHTML(PresetDisplay.toTitleCase(groupRaw))}</label>
            <input type="text" class="j0n4t-pg-var-input" data-group="${PresetDOM.escapeHTML(groupRaw)}" data-gindex="${gIndex}" data-root-group="${PresetDOM.escapeHTML(rootGroup)}" data-issub="${isSub}" data-key="${PresetDOM.escapeHTML(dataKey)}" value="${PresetDOM.escapeHTML(displayValue)}" placeholder="🔍 Filter by folder/name..." tabindex="0" onclick="this.select()">
            <button class="j0n4t-pg-var-edit-btn" data-group="${PresetDOM.escapeHTML(groupRaw)}" data-gindex="${gIndex}" title="Edit selected ${PresetDOM.escapeHTML(PresetDisplay.toTitleCase(groupRaw))}" tabindex="0">${PresetDOM.icons.edit}</button>
            <button class="j0n4t-pg-var-reroll-btn" data-group="${PresetDOM.escapeHTML(groupRaw)}" data-gindex="${gIndex}" title="Re-roll ${PresetDOM.escapeHTML(PresetDisplay.toTitleCase(groupRaw))}" tabindex="0">${PresetDOM.icons.dice}</button>
          </div>`;

          autocompleteConfigs.push({
            group: groupRaw,
            gIndex: gIndex,
            matches: matches,
            groupRegex: groupRegex
          });
        }
      });
    }

    let varSectionHtml = varRowsHtml ? `<div class="j0n4t-pg-var-popup-container">${varRowsHtml}</div>` : "";
    const swapIcon = PresetDOM.icons.swap;

    const weightSectionHtml = `
      <div class="j0n4t-pg-weight-modifier" style="display: ${focusWeight ? 'flex' : 'none'}; justify-content: center; align-items: center; gap: 6px; padding: 4px; background: #222; border-bottom: 1px solid #444;">
          <button class="j0n4t-pg-weight-btn" data-action="weight-minus" tabindex="0" title="Decrease weight">-</button>
          <input type="number" step="0.05" class="j0n4t-pg-weight-input" value="${currentWeight}" tabindex="0" title="Set weight">
          <button class="j0n4t-pg-weight-btn" data-action="weight-plus" tabindex="0" title="Increase weight">+</button>
      </div>
    `;

    const weightToggleBtn = `
      <div class="j0n4t-pg-chip-popup-item" data-action="toggle-weight" title="Adjust Weight" tabindex="0" role="menuitem">
        <span style="font-family:monospace; font-weight:bold; line-height:1; font-size:12px;">+/-</span>
      </div>
    `;

    const rawVal = this.context.getSelectedArray().slice(startIndex, endIndex).join(', ');
    const isPinned = this.context.pinnedChips?.has(rawVal);
    const pinBtn = `
      <div class="j0n4t-pg-chip-popup-item ${isPinned ? 'active-pin' : ''}" data-action="pin" title="${isPinned ? 'Unpin' : 'Pin'}" tabindex="0" role="menuitem">${PresetDOM.icons.pin}</div>
    `;

    const popupHtml = `
      <div class="j0n4t-pg-chip-popup" tabindex="-1" role="menu">
        ${weightSectionHtml}
        ${varSectionHtml}
        <div class="j0n4t-pg-chip-popup-actions">
          <div class="j0n4t-pg-chip-popup-item" data-action="swap" title="Swap Preset" tabindex="0" role="menuitem">${swapIcon}</div>
          ${pinBtn}
          ${weightToggleBtn}
          <div class="j0n4t-pg-chip-popup-item" data-action="edit" title="Edit" tabindex="0" role="menuitem">${PresetDOM.icons.edit}</div>
          ${item
        ? `<div class="j0n4t-pg-chip-popup-item" data-action="locate" title="Locate in Gallery" tabindex="0" role="menuitem">${PresetDOM.icons.eye}</div>`
        : `<div class="j0n4t-pg-chip-popup-item" data-action="create" title="Create Preset from Chip" tabindex="0" role="menuitem">${PresetDOM.icons.add}</div>`
      }
          <div class="j0n4t-pg-chip-popup-item danger" data-action="del" title="Remove" tabindex="0" role="menuitem">${PresetDOM.icons.trash}</div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', popupHtml);
    const popup = /** @type {HTMLElement} */ (document.body.lastElementChild);
    this.popupEl = popup;
    if (!popup) return;

    autocompleteConfigs.forEach(cfg => {
      const inputEl = /** @type {HTMLInputElement} */(popup?.querySelector(`input.j0n4t-pg-var-input[data-group="${cfg.group}"][data-gindex="${cfg.gIndex}"]`));
      if (inputEl) {
        const options = [
          { key: "", display: "🎲 Random" },
          { key: "none", display: "🚫 None (Omit)" },
          ...cfg.matches.map((/** @type {string} */ m) => ({
            key: m,
            display: PresetDisplay.toTitleCase(PresetDisplay.getPresetName(m))
          }))
        ];

        const inputWithOptions = /** @type {HTMLInputElement & {_options?: {key: string, display: string}[]}} */ (inputEl);
        inputWithOptions._options = options;

        new AutocompleteManager({
          input: inputEl,
          container: document.body,
          popupClass: "j0n4t-pg-filter-autocomplete-popup",
          itemClass: "j0n4t-pg-filter-autocomplete-item",
          getMatches: (query) => {
            const q = query.trim().toLowerCase();
            if (!q) {
              return options.map(opt => ({
                item: opt,
                title: opt.key && opt.key !== 'none'
                  ? PresetDisplay.getPresetTitle(opt.key, this.context.cache)
                  : opt.display
              }));
            }
            const specialMatches = options.slice(0, 2)
              .filter(opt => opt.display.toLowerCase().includes(q) || opt.key.toLowerCase().includes(q))
              .map(opt => ({ item: opt, title: opt.display }));
            const topMatches = PresetDisplay.getTopMatches(
              cfg.matches,
              q,
              (k) => PresetDisplay.getSearchBlob(k, this.context.cache[k]),
              this.context.cache
            );
            const presetMatches = topMatches.map(match => ({
              item: options.find(o => o.key === match.item),
              title: match.title
            })).filter(m => m.item);
            return [...specialMatches, ...presetMatches];
          },
          renderItem: (opt) => `
            <span>${PresetDOM.escapeHTML(opt.display)}</span>
            ${opt.key && opt.key !== 'none' ? `<span class="j0n4t-pg-filter-autocomplete-meta">${PresetDOM.escapeHTML(opt.key)}</span>` : ''}
          `,
          onSelect: (selectedItem) => {
            inputEl.value = selectedItem.display;
            inputEl.dataset.key = selectedItem.key;
            inputEl.dispatchEvent(new Event("change", { bubbles: true }));
            return false;
          }
        });
      }
    });

    popup.addEventListener("click", (e) => {
      /** @type {HTMLElement |null} */ const rerollBtn = /** @type {HTMLElement} */(e.target).closest(".j0n4t-pg-var-reroll-btn");
      if (rerollBtn) {
        e.stopPropagation();
        if (this.commands.onReroll(chipElement, rerollBtn, Number(chipElement.dataset.index), /** @type {string} */ (rerollBtn.dataset.group), /** @type {string} */ (rerollBtn.dataset.gindex))) {
          this.close(true);
        }
        return;
      }

      /** @type {HTMLElement |null} */ const editVarBtn = /** @type {HTMLElement} */(e.target).closest(".j0n4t-pg-var-edit-btn");
      if (editVarBtn) {
        e.stopPropagation();
        this.commands.onEditVar(chipElement, editVarBtn, popup);
        return;
      }

      /** @type {HTMLElement | null} */ const actionEl = /** @type {HTMLElement} */(e.target).closest("[data-action]");
      if (!actionEl) return;
      e.stopPropagation();


      if (this.commands.onAction(e, actionEl, chipElement, startIndex, endIndex, popup)) {
        this.close(false);
      }
    });

    popup.addEventListener("change", (e) => {
      /** @type {HTMLInputElement | null} */ const weightInput = /** @type {HTMLElement} */(e.target).closest(".j0n4t-pg-weight-input");
      if (weightInput) {
        const finalNewKey = this.commands.onWeightChange(chipElement, weightInput);
        if (finalNewKey !== undefined) {
          this._updateChipSelection(startIndex, endIndex, finalNewKey, false);
        }
        return;
      }

      /** @type {HTMLInputElement | null} */ const inputEl = /** @type {HTMLElement} */(e.target).closest("input.j0n4t-pg-var-input");
      if (!inputEl) return;

      const result = this.commands.onVariantChange(inputEl, chipElement);
      if (result) {
        const [newStyleKey, coreReplaced] = result;
        this._updateChipSelection(startIndex, endIndex, newStyleKey, coreReplaced);
      }
    });

    popup.addEventListener("keydown", (/** @type {KeyboardEvent} */ e) => {
      const items = /** @type {HTMLElement[]} */ (Array.from(popup.querySelectorAll("[data-action], button, input"))
        .filter(el => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })));
      const currentIndex = document.activeElement ? items.indexOf(/** @type {HTMLInputElement} */(document.activeElement)) : 0;
      const target = /** @type {HTMLElement} */ (e.target);

      this.commands.onKeyCommand(e, this.activeChipMenuEl, popup);

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        if (target.tagName !== 'INPUT') {
          e.stopPropagation();
          e.preventDefault();
          items[(currentIndex + 1) % items.length].focus();
        }
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        if (target.tagName !== 'INPUT') {
          e.stopPropagation();
          e.preventDefault();
          items[(currentIndex - 1 + items.length) % items.length].focus();
        }
      } else if (e.key === "Enter" && !e.ctrlKey || e.key === " ") {
        const actionEl = /** @type {HTMLButtonElement} */(target.closest("[data-action], button"));
        if (actionEl) {
          e.stopPropagation();
          e.preventDefault();
          actionEl.click();
        }
      } else if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        this.close(true);
      }
    })

    popup.addEventListener("mousedown", (e) => e.stopPropagation());

    const poolRect = this.context.dom.basketPool.getBoundingClientRect();
    const chipRect = chipElement.getBoundingClientRect();
    const inset = 4;

    // 1. Calculate space strictly inside basket pool bounds (viewport coordinates)
    const spaceAbove = Math.max(0, chipRect.top - poolRect.top - inset);
    const spaceBelow = Math.max(0, poolRect.bottom - chipRect.bottom - inset);

    // 2. Render above only if there is strictly more space above than below
    const renderAbove = spaceAbove > spaceBelow;

    // 3. Apply fixed positioning and bound popup dimensions inside the basket pool
    popup.style.position = "fixed";
    popup.style.zIndex = "10000";
    popup.style.boxSizing = "border-box";
    popup.style.maxWidth = `${Math.max(0, poolRect.width - inset * 2)}px`;
    popup.style.maxHeight = `${renderAbove ? spaceAbove : spaceBelow}px`;
    popup.style.overflowY = "auto";

    const popupWidth = popup.offsetWidth;
    const popupHeight = popup.offsetHeight;

    // 4. Align horizontally with chip, clamped strictly within pool boundaries
    const idealLeft = chipRect.left;
    const minLeft = poolRect.left + inset;
    const maxLeft = poolRect.right - popupWidth - inset;
    const left = Math.max(minLeft, Math.min(idealLeft, maxLeft));

    // 5. Place strictly right below or right above the clicked chip
    const top = renderAbove
      ? (chipRect.top - popupHeight - inset)
      : (chipRect.bottom + inset);

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;

    const closeHandler = (/** @type {Event} */e) => {
      if (!popup.contains(/** @type {HTMLElement} */(e.target)) && e.target !== chipElement) {
        this.close(false);
        document.removeEventListener("mousedown", closeHandler);
      }
    };
    this.closeHandler = closeHandler;

    setTimeout(() => {
      document.addEventListener("mousedown", closeHandler);
      if (focusWeight) {
        /** @type {HTMLElement} */ (popup.querySelector('.j0n4t-pg-weight-input')).focus();
      } else {
        const target = /** @type {HTMLElement} */ (Array.from(popup.querySelectorAll("[data-action]"))
          .find(el => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })));
        target.focus();
        if (target instanceof HTMLInputElement) {
          target.selectionStart = 0;
          target.selectionEnd = target.value.length;
        }
      }
    }, 10);
  }

  close(restoreFocus = false) {
    if (this.closeHandler) {
      document.removeEventListener("mousedown", this.closeHandler);
      this.closeHandler = null;
    }
    if (this.activeChipMenuEl) {
      this.activeChipMenuEl.classList.remove("active-menu");
      if (restoreFocus) {
        this.basket.focusChip(this.activeChipMenuEl.dataset.start);
      }
      this.activeChipMenuEl = null;
    }
    this.popupEl?.remove();
    this.popupEl = null;
  }

  /** @param {CustomInputElement|null} inputEl
   * @param {string} rawVal
   */
  _resolveInputValue(inputEl, rawVal) {
    if (!rawVal || rawVal === "🎲 Random") return "";
    if (rawVal === "🚫 None (Omit)") return "none";
    const matchingOpt = inputEl?._options?.find(
      (opt) => opt.display === rawVal || opt.key === rawVal
    );
    return matchingOpt ? matchingOpt.key : rawVal;
  }
}