import PresetDOM from "./PresetDOM.js";
import PresetLogic from "./PresetLogic.js";
import AutocompleteManager from "./AutocompleteManager.js";

export default class ChipMenuManager {
  /** 
   * @param {import("./PresetGalleryApp.js").default} context
   * @param {import("./PresetBasket.js").default} delegateBasket
   */
  constructor(context, delegateBasket) {
    this.context = context;
    this.basket = delegateBasket;
    /** @type {HTMLElement | null} */
    this.activeChipMenuEl = null;
    this.popupEl = null;
    this.closeHandler = null;
  }
  /**
    * @param {HTMLInputElement} inputEl
    * @param {string} rawVal
    */
  _resolveInputValue(inputEl, rawVal) {
    if (!rawVal || rawVal === "🎲 Random") return "";
    if (rawVal === "🚫 None (Omit)") return "none";
    // @ts-ignore
    const matchingOpt = inputEl._options?.find(opt => opt.display === rawVal || opt.key === rawVal);
    return matchingOpt ? matchingOpt.key : rawVal;
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
  show(chipElement, focusWeight = false) {
    const styleKey = chipElement.dataset.id || "";
    const startIndex = Number(chipElement.dataset.start);
    const endIndex = Number(chipElement.dataset.end);
    const { core: coreKey, weight: currentWeight, isWeighted } = PresetLogic.parseWeight(styleKey);
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

          let displayValue = PresetLogic.getPresetName(currentSelectedVal) || "";
          let dataKey = "";
          const isNullSelected = currentSelectedVal && PresetLogic.isVirtualNull(currentSelectedVal);

          if (!currentSelectedVal) {
            displayValue = "🎲 Random";
            dataKey = "";
          } else if (isNullSelected) {
            displayValue = "🚫 None (Omit)";
            dataKey = "none";
          } else {
            displayValue = PresetLogic.toTitleCase(displayValue);
            dataKey = currentSelectedVal;
          }

          varRowsHtml += `<div class="j0n4t-pg-var-popup-row">
            <label>${PresetDOM.escapeHTML(PresetLogic.toTitleCase(groupRaw))}</label>
            <input type="text" class="j0n4t-pg-var-input" data-group="${PresetDOM.escapeHTML(groupRaw)}" data-gindex="${gIndex}" data-root-group="${PresetDOM.escapeHTML(rootGroup)}" data-issub="${isSub}" data-key="${PresetDOM.escapeHTML(dataKey)}" value="${PresetDOM.escapeHTML(displayValue)}" placeholder="🔍 Filter by folder/name..." tabindex="0" onclick="this.select()">
            <button class="j0n4t-pg-var-edit-btn" data-group="${PresetDOM.escapeHTML(groupRaw)}" data-gindex="${gIndex}" title="Edit selected ${PresetDOM.escapeHTML(PresetLogic.toTitleCase(groupRaw))}" tabindex="0">${PresetDOM.icons.edit}</button>
            <button class="j0n4t-pg-var-reroll-btn" data-group="${PresetDOM.escapeHTML(groupRaw)}" data-gindex="${gIndex}" title="Re-roll ${PresetDOM.escapeHTML(PresetLogic.toTitleCase(groupRaw))}" tabindex="0">${PresetDOM.icons.dice}</button>
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
          <div class="j0n4t-pg-chip-popup-item" data-action="close" title="Close" tabindex="0" role="menuitem">${PresetDOM.icons.close}</div>
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
            display: PresetLogic.toTitleCase(PresetLogic.getPresetName(m))
          }))
        ];

        // @ts-ignore
        inputEl._options = options;

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
                  ? PresetLogic.getPresetTitle(opt.key, this.context.cache)
                  : opt.display
              }));
            }
            const specialMatches = options.slice(0, 2)
              .filter(opt => opt.display.toLowerCase().includes(q) || opt.key.toLowerCase().includes(q))
              .map(opt => ({ item: opt, title: opt.display }));
            const topMatches = PresetLogic.getTopMatches(
              cfg.matches,
              q,
              (k) => PresetLogic.getSearchBlob(k, this.context.cache[k]),
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
        this.basket.reRollChipGroup(
          Number(chipElement.dataset.index),
          rerollBtn.dataset.group,
          rerollBtn.dataset.gindex
        );
        this.close(true);
        return;
      }

      /** @type {HTMLElement |null} */ const editVarBtn = /** @type {HTMLElement} */(e.target).closest(".j0n4t-pg-var-edit-btn");
      if (editVarBtn) {
        e.stopPropagation();
        const group = editVarBtn.dataset.group;
        const gIndex = Number(editVarBtn.dataset.gindex);
        const inputEl = /** @type {HTMLInputElement} */(popup.querySelector(`input.j0n4t-pg-var-input[data-group="${group}"][data-gindex="${gIndex}"]`));

        let rawVal = inputEl?.value;
        if (rawVal === "🚫 None (Omit)" || inputEl?.dataset.key === "none") return;
        let variantKey = this._resolveInputValue(inputEl, rawVal);

        if (!variantKey) {
          const chipIndex = Number(chipElement.dataset.index);
          if (!isNaN(chipIndex)) {
            const activeList = this.context.getSelectedArray();
            const chipsData = PresetLogic.getGroupedChips(activeList, this.context.cache);
            const tracer = new PresetLogic.RollManager(this.context.rollManager.rolls);
            const targetGroup = group?.trim().toLowerCase().replace(/\s+/g, "_") || "";

            for (let i = 0; i < chipsData.length; i++) {
              const startCounts = tracer.cloneCounts();
              PresetLogic.expandRecursively(chipsData[i].styleKey, this.context.cache, new Set(), tracer);

              if (i === chipIndex) {
                const targetRollIndex = (startCounts[targetGroup] || 0) + gIndex;
                variantKey = tracer.peekRoll(targetGroup, targetRollIndex);
                break;
              }
            }
          }
        }

        if (variantKey) {
          const presetMatch = PresetLogic.findPresetMatch(variantKey, this.context.cache);
          if (presetMatch) variantKey = presetMatch.key;
          this.context.openEditorForPreset(variantKey, true);
        }
        return;
      }

      /** @type {HTMLElement | null} */ const actionEl = /** @type {HTMLElement} */(e.target).closest("[data-action]");
      if (!actionEl) return;
      e.stopPropagation();

      const action = actionEl.dataset.action;

      if (action === "close") {
        this.close(true);
        return;
      }

      if (action === "pin") {
        const currentList = this.context.getSelectedArray();
        const rawToken = currentList.slice(startIndex, endIndex).join(', ');
        if (this.context.pinnedChips?.has(rawToken)) {
          this.context.pinnedChips.delete(rawToken);
          chipElement.classList.remove("pinned");
          actionEl.classList.remove("active-pin");
          actionEl.querySelector('svg')?.setAttribute('fill', 'none');
          actionEl.title = "Pin";
        } else {
          this.context.pinnedChips?.add(rawToken);
          chipElement.classList.add("pinned");
          actionEl.classList.add("active-pin");
          actionEl.querySelector('svg')?.setAttribute('fill', 'currentColor');
          actionEl.title = "Unpin";
        }
        this.context.savePins();
        return;
      }

      if (action === "toggle-weight") {
        const wMod = /** @type {HTMLElement} */(popup.querySelector('.j0n4t-pg-weight-modifier'));
        wMod.style.display = wMod.style.display === 'none' ? 'flex' : 'none';
        if (wMod.style.display === 'flex') {
          wMod.querySelector('input')?.focus();
        }
        return;
      }

      if (action === "weight-minus" || action === "weight-plus") {
        const input = /** @type {HTMLInputElement} */(popup.querySelector('.j0n4t-pg-weight-input'));
        let val = parseFloat(input.value) || 1.0;
        val += (action === "weight-plus" ? 0.05 : -0.05);
        input.value = String(Number(val.toFixed(2)));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }

      this.close(false);

      if (action === "edit") {
        if (item) this.context.openEditorForPreset(coreKey, true);
        else {
          let editVal = styleKey;
          const rawPreset = chipElement.dataset.preset;
          if (isWeighted && rawPreset) {
            editVal = `(${rawPreset}:${currentWeight})`;
          } else if (rawPreset) {
            editVal = rawPreset;
          }
          this.basket.inlineEditorManager.spawn(chipElement, editVal, startIndex, endIndex);
        }
      } else if (action === "swap") {
        let editVal = this.context.cache[coreKey]?.preset || coreKey;
        if (isWeighted && editVal) {
          editVal = `(${editVal}:${currentWeight})`;
        }
        this.basket.inlineEditorManager.spawn(chipElement, editVal, startIndex, endIndex);
      } else if (action === "locate") {
        let locateKey = coreKey;
        const presetVal = chipElement.dataset.preset;
        if (presetVal) {
          const presetMatch = PresetLogic.findPresetMatch(presetVal, this.context.cache);
          if (presetMatch) locateKey = presetMatch.key;
        }
        this.basket.locatePreset(locateKey);
      } else if (action === "create") {
        this.context.setPanelCollapseState(false);
        this.context.editor.clearFields();
        this.context.editor.dom.inpPreset.value = item && item.preset ? item.preset : coreKey;
        this.context.editor.rawPresetManager?.updateHighlights();
        const cleanName = coreKey.replace(/^<(lora|lyco):/i, "").replace(/>$/, "").split(":")[0].split("/").pop()?.replace(/[^a-zA-Z0-9\s-_]/g, "").trim().replace(/\s+/g, "_");
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
      /** @type {HTMLInputElement | null} */ const weightInput = /** @type {HTMLElement} */(e.target).closest(".j0n4t-pg-weight-input");
      if (weightInput) {
        let val = parseFloat(weightInput.value);
        if (isNaN(val)) return;

        const { core: activeCoreKey } = PresetLogic.parseWeight(chipElement.dataset.id || "");
        let finalNewKey = val === 1.0 ? activeCoreKey : `(${activeCoreKey}:${Number(val.toFixed(2))})`;
        chipElement.dataset.id = finalNewKey;

        this._updateChipSelection(startIndex, endIndex, finalNewKey, false);
        return;
      }

      /** @type {HTMLInputElement | null} */ const inputEl = /** @type {HTMLElement} */(e.target).closest("input.j0n4t-pg-var-input");
      if (!inputEl) return;

      const group = inputEl.dataset.group || "";
      const gIndex = Number(inputEl.dataset.gindex);
      const rootGroup = inputEl.dataset.rootGroup;
      const isSub = inputEl.dataset.issub === 'true';
      const rawVal = inputEl.value;

      const selectedVal = this._resolveInputValue(inputEl, rawVal);
      inputEl.dataset.key = selectedVal;

      const groupRegex = PresetLogic.createGroupRegex(group);
      const replacement = selectedVal ? `{${group}:${selectedVal}}` : `{${group}}`;

      const currentKey = chipElement.dataset.id || "";
      const currentPreset = chipElement.dataset.preset || "";
      const { core: activeCoreKey, isWeighted: isActiveWeighted, weightStr: activeWeight } = PresetLogic.parseWeight(currentKey);

      const unrolled = PresetLogic.getUnrolledTemplate(activeCoreKey, this.context.cache);

      const replaceNth = (/** @type {string} */ str, /** @type {RegExp} */ regex, /** @type {string} */ replStr) => {
        let matchCount = 0;
        return str.replace(regex, (/** @type {string} */ match) => {
          if (matchCount === gIndex) {
            matchCount++;
            return replStr;
          }
          matchCount++;
          return match;
        });
      };

      let newStyleKey = currentKey;
      let coreReplaced = false;

      if (currentKey.match(groupRegex)) {
        const attempt = replaceNth(currentKey, groupRegex, replacement);
        if (attempt !== currentKey) newStyleKey = attempt;
      }

      if (newStyleKey === currentKey && isSub && rootGroup) {
        newStyleKey = PresetLogic.replaceNestedRoot(currentKey, rootGroup, group, replacement);
      }

      if (newStyleKey === currentKey && currentPreset.match(groupRegex)) {
        const attempt = replaceNth(currentPreset, groupRegex, replacement);
        if (attempt !== currentPreset) newStyleKey = attempt;
      }

      if (newStyleKey === currentKey && isSub && rootGroup) {
        const attempt = PresetLogic.replaceNestedRoot(currentPreset, rootGroup, group, replacement);
        if (attempt !== currentPreset) newStyleKey = attempt;
      }

      if (newStyleKey === currentKey && unrolled.match(groupRegex)) {
        const attempt = replaceNth(unrolled, groupRegex, replacement);
        if (attempt !== unrolled) {
          newStyleKey = isActiveWeighted ? `(${attempt}:${activeWeight})` : attempt;
          coreReplaced = true;
        }
      }

      if (newStyleKey === currentKey) return;

      chipElement.dataset.id = newStyleKey;
      chipElement.dataset.preset = coreReplaced ? "" : newStyleKey;

      this._updateChipSelection(startIndex, endIndex, newStyleKey, coreReplaced);
    });

    popup.addEventListener("keydown", (/** @type {KeyboardEvent} */ e) => {
      const items = /** @type {HTMLElement[]} */ (Array.from(popup.querySelectorAll("[data-action], button, input"))
        .filter(el => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })));
      const currentIndex = document.activeElement ? items.indexOf(/** @type {HTMLInputElement} */(document.activeElement)) : 0;
      const target = /** @type {HTMLInputElement} */(e.target);

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
    });

    popup.addEventListener("mousedown", (e) => e.stopPropagation());

    const rect = chipElement.getBoundingClientRect();
    const popupWidth = popup.offsetWidth;
    const topPos = window.scrollY + rect.top - popup.offsetHeight - 4;

    const spaceLeft = rect.right;
    const spaceRight = window.innerWidth - rect.left;

    let leftPos;
    if (spaceLeft > spaceRight && rect.right >= popupWidth) {
      leftPos = Math.max(window.scrollX + 8, window.scrollX + rect.right - popupWidth);
    } else if (rect.left + popupWidth <= window.innerWidth) {
      leftPos = window.scrollX + rect.left;
    } else {
      leftPos = Math.max(window.scrollX + 8, window.scrollX + rect.right - popupWidth);
    }

    popup.style.top = `${topPos < window.scrollY ? window.scrollY + rect.bottom + 4 : topPos}px`;
    popup.style.left = `${leftPos}px`;

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
        const target = /** @type {HTMLElement} */ (Array.from(popup.querySelectorAll("[data-action], button, input"))
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
}