import PresetDOM from "./PresetDOM.js";
import PresetLogic from "./PresetLogic.js";
import AutocompleteManager from "./AutocompleteManager.js";

/**
 * @typedef {Object} ChipVariantData
 * @property {string} groupRaw
 * @property {string} groupName
 * @property {string} val
 * @property {string} childVarsStr
 * @property {string} rootGroup
 * @property {boolean} isSub
 */

/**
 * @typedef {Object} AutocompleteConfig
 * @property {string} group
 * @property {number} gIndex
 * @property {string[]} matches
 * @property {RegExp} groupRegex
 */

export default class ChipMenuManager {
  /** 
   * @param {import("./PresetGalleryApp.js").default} context
   * @param {import("./PresetBasket.js").default} delegateBasket
   */
  constructor(context, delegateBasket) {
    this.context = context;
    this.basket = delegateBasket;
    this.activeChipMenuEl = null;
    this.popupEl = null;
    this.closeHandler = null;
  }

  /**
   * @param {HTMLElement} chipElement
   * @param {string} styleKey
   * @param {PresetCacheItem} item
   * @param {number} startIndex
   * @param {number} endIndex
   */
  show(chipElement, styleKey, item, startIndex, endIndex, focusWeight = false) {
    if (this.activeChipMenuEl) {
      this.activeChipMenuEl.classList.remove("active-menu");
    }
    this.popupEl?.remove();
    chipElement.classList.add("active-menu");
    this.activeChipMenuEl = chipElement;

    const wMatch = styleKey.match(/^\((.+?):([-+]?[0-9]*\.?[0-9]+)\)$/);
    let coreKey = wMatch ? wMatch[1] : styleKey;
    let currentWeight = wMatch ? parseFloat(wMatch[2]) : 1.0;

    const VAR_REGEX_SRC = `\\{([^{}:]+)(?::((?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*))?\\}`;

    const getAllVariants = (/** @type {string} */ text, /** @type {PresetCache | undefined} */ cache, rootGroup = "") => {
      /** @type {ChipVariantData[]}  */
      let results = [];
      let m;
      const localRegex = new RegExp(VAR_REGEX_SRC, 'g');
      while ((m = localRegex.exec(text)) !== null) {
        const groupRaw = m[1].trim();
        const groupName = groupRaw.toLowerCase().replace(/\s+/g, "_");
        const valStr = m[2] ? m[2].trim() : "";

        let baseVal = valStr;
        let childVarsStr = "";
        const bIdx = valStr.indexOf('{');
        if (bIdx !== -1) {
          baseVal = valStr.substring(0, bIdx).trim();
          childVarsStr = valStr.substring(bIdx).trim();
        }

        results.push({
          groupRaw,
          groupName,
          val: baseVal,
          childVarsStr,
          rootGroup: rootGroup || groupName,
          isSub: !!rootGroup
        });

        if (baseVal && !PresetLogic.isVirtualNull(baseVal)) {
          const resolvedKey = PresetLogic.resolveVariantKey(groupName, baseVal, cache) || baseVal;
          const item = cache?.[resolvedKey];
          if (item && item.preset) {
            let childTemplate = item.preset;
            if (childVarsStr) {
              const childRegex = new RegExp(VAR_REGEX_SRC, 'g');
              let cm;
              while ((cm = childRegex.exec(childVarsStr)) !== null) {
                const cName = cm[1].trim();
                const cVal = cm[2] || "";
                const escapeRegExp = (/** @type {string} */ s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const replaceRegex = new RegExp(`\\{\\s*${escapeRegExp(cName)}\\s*(?::(?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*)?\\}`, 'gi');
                childTemplate = childTemplate.replace(replaceRegex, `{${cName}${cVal ? ':' + cVal : ''}}`);
              }
            }
            const childResults = getAllVariants(childTemplate, cache, rootGroup || groupName);
            results = results.concat(childResults);
          }
        }
      }
      return results;
    };

    const source = PresetLogic.getUnrolledTemplate(coreKey, this.context.cache);
    const allVariants = getAllVariants(source, this.context.cache);

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
    const swapIcon = PresetDOM.icons.swap || `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`;

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

    const popupHtml = `
      <div class="j0n4t-pg-chip-popup" tabindex="-1" role="menu">
        ${weightSectionHtml}
        ${varSectionHtml}
        <div class="j0n4t-pg-chip-popup-actions">
          ${weightToggleBtn}
          <div class="j0n4t-pg-chip-popup-item" data-action="swap" title="Swap Preset" tabindex="0" role="menuitem">${swapIcon}</div>
          <div class="j0n4t-pg-chip-popup-item" data-action="edit" title="Edit" tabindex="0" role="menuitem">${PresetDOM.icons.edit}</div>
          ${item
        ? `<div class="j0n4t-pg-chip-popup-item" data-action="locate" title="Locate in Gallery" tabindex="0" role="menuitem">${PresetDOM.icons.eye}</div>`
        : `<div class="j0n4t-pg-chip-popup-item" data-action="create" title="Create Preset from Chip" tabindex="0" role="menuitem">${PresetDOM.icons.add}</div>`
      }
          <div class="j0n4t-pg-chip-popup-item danger" data-action="del" title="Remove" tabindex="0" role="menuitem">${PresetDOM.icons.close}</div>
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
            const q = query.toLowerCase();
            return options
              .filter(opt => opt.display.toLowerCase().includes(q) || opt.key.toLowerCase().includes(q))
              .map(opt => ({ item: opt, title: PresetDOM.escapeHTML(PresetLogic.getPresetTitle(opt.key, this.context.cache)) }));
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
        this.close();
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

        let variantKey = null;
        if (rawVal && rawVal !== "🎲 Random") {
          // @ts-ignore
          const matchingOpt = inputEl._options?.find((/** @type {{ display: any; key: any; }} */ opt) => opt.display === rawVal || opt.key === rawVal);
          variantKey = matchingOpt ? matchingOpt.key : rawVal;
        }

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

      this.close();
      if (action === "edit") {
        if (item) this.context.openEditorForPreset(coreKey, true);
        else {
          let editVal = styleKey;
          const rawPreset = chipElement.dataset.preset;
          if (wMatch && rawPreset) {
            editVal = `(${rawPreset}:${wMatch[2]})`;
          } else if (rawPreset) {
            editVal = rawPreset;
          }
          this.basket.inlineEditorManager.spawn(chipElement, editVal, startIndex, endIndex);
        }
      } else if (action === "swap") {
        let editVal = this.context.cache[coreKey]?.preset || coreKey;
        if (wMatch && editVal) {
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
        this.context.editor.dom.inpPreset.value = item.preset ? item.preset : coreKey;
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

        const currentStyleKey = chipElement.dataset.id || "";
        const currentWMatch = currentStyleKey?.match(/^\((.+?):([-+]?[0-9]*\.?[0-9]+)\)$/);
        const activeCoreKey = currentWMatch ? currentWMatch[1] : currentStyleKey;

        let finalNewKey = val === 1.0 ? activeCoreKey : `(${activeCoreKey}:${Number(val.toFixed(2))})`;
        chipElement.dataset.id = finalNewKey;

        const selections = this.context.getSelectedArray();
        if (startIndex < selections.length) {
          selections.splice(startIndex, endIndex - startIndex, finalNewKey);
          this.context.updateWidgetValue(selections);

          const newChips = Array.from(this.basket.basket.querySelectorAll(".j0n4t-pg-basket-chip"));
          const replacementChip = newChips.find(c => c.dataset.id === finalNewKey && parseInt(c.dataset.start) === startIndex);
          if (replacementChip) {
            this.activeChipMenuEl = replacementChip;
            replacementChip.classList.add("active-menu");
          } else {
            this.close();
          }
        }
        return;
      }

      /** @type {HTMLInputElement | null} */ const inputEl = /** @type {HTMLElement} */(e.target).closest("input.j0n4t-pg-var-input");
      if (!inputEl) return;

      const group = inputEl.dataset.group || "";
      const gIndex = Number(inputEl.dataset.gindex);
      const rootGroup = inputEl.dataset.rootGroup;
      const isSub = inputEl.dataset.issub === 'true';
      const rawVal = inputEl.value;

      let selectedVal = rawVal;
      if (rawVal === "🎲 Random" || !rawVal) {
        selectedVal = "";
      } else if (rawVal === "🚫 None (Omit)") {
        selectedVal = "none";
      } else {
        // @ts-ignore
        const matchingOpt = inputEl._options?.find((/** @type {{ display: any; key: any; }} */ opt) => opt.display === rawVal || opt.key === rawVal);
        selectedVal = matchingOpt ? matchingOpt.key : rawVal;
      }

      inputEl.dataset.key = selectedVal;

      const escapeRegExp = (/** @type {string} */ str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const groupRegex = new RegExp(`\\{\\s*${escapeRegExp(group)}\\s*(?::(?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*)?\\}`, 'gi');
      const replacement = selectedVal ? `{${group}:${selectedVal}}` : `{${group}}`;

      const currentKey = chipElement.dataset.id || "";
      const currentPreset = chipElement.dataset.preset || "";
      const currentWMatch = currentKey.match(/^\((.+?):([-+]?[0-9]*\.?[0-9]+)\)$/);
      const activeCoreKey = currentWMatch ? currentWMatch[1] : currentKey;

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
        const rootRegex = new RegExp(`\\{\\s*${escapeRegExp(rootGroup)}\\s*(?::((?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*))?\\}`, 'gi');
        if (currentKey.match(rootRegex)) {
          newStyleKey = currentKey.replace(rootRegex, (/** @type {string} */ match, /** @type {string} */ rootVal) => {
            if (!rootVal) rootVal = "";
            const childRegex = new RegExp(`\\{\\s*${escapeRegExp(group)}\\s*(?::(?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*)?\\}`, 'gi');
            if (rootVal.match(childRegex)) {
              rootVal = rootVal.replace(childRegex, replacement);
            } else {
              rootVal = rootVal + replacement;
            }
            return `{${rootGroup}:${rootVal}}`;
          });
        }
      }

      if (newStyleKey === currentKey && currentPreset.match(groupRegex)) {
        const attempt = replaceNth(currentPreset, groupRegex, replacement);
        if (attempt !== currentPreset) newStyleKey = attempt;
      }

      if (newStyleKey === currentKey && isSub && rootGroup) {
        const rootRegex = new RegExp(`\\{\\s*${escapeRegExp(rootGroup)}\\s*(?::((?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*))?\\}`, 'gi');
        if (currentPreset.match(rootRegex)) {
          const attempt = currentPreset.replace(rootRegex, (/** @type {string} */ match, /** @type {string} */ rootVal) => {
            if (!rootVal) rootVal = "";
            const childRegex = new RegExp(`\\{\\s*${escapeRegExp(group)}\\s*(?::(?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*)?\\}`, 'gi');
            if (rootVal.match(childRegex)) {
              rootVal = rootVal.replace(childRegex, replacement);
            } else {
              rootVal = rootVal + replacement;
            }
            return `{${rootGroup}:${rootVal}}`;
          });
          if (attempt !== currentPreset) newStyleKey = attempt;
        }
      }

      if (newStyleKey === currentKey && unrolled.match(groupRegex)) {
        const attempt = replaceNth(unrolled, groupRegex, replacement);
        if (attempt !== unrolled) {
          newStyleKey = currentWMatch ? `(${attempt}:${currentWMatch[2]})` : attempt;
          coreReplaced = true;
        }
      }

      if (newStyleKey === currentKey) return;

      chipElement.dataset.id = newStyleKey;
      chipElement.dataset.preset = coreReplaced ? "" : newStyleKey;

      const selections = this.context.getSelectedArray();
      if (startIndex < selections.length) {
        selections.splice(startIndex, endIndex - startIndex, newStyleKey);
        this.context.updateWidgetValue(selections);

        if (coreReplaced) {
          this.close();
        } else {
          const newChips = Array.from(this.basket.basket.querySelectorAll(".j0n4t-pg-basket-chip"));
          const replacementChip = newChips.find(c => c.dataset.id === newStyleKey && parseInt(c.dataset.start) === startIndex);
          if (replacementChip) {
            this.activeChipMenuEl = replacementChip;
            replacementChip.classList.add("active-menu");
          } else {
            this.close();
          }
        }
      }
    });

    popup.addEventListener("keydown", (/** @type {KeyboardEvent} */ e) => {
      /** @type {HTMLInputElement[]} */ const items = Array.from(popup.querySelectorAll("[data-action], button, input"));
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
      } else if (e.key === "Enter" || e.key === " ") {
        const actionEl = /** @type {HTMLButtonElement} */(target.closest("[data-action], button"));
        if (actionEl) {
          e.stopPropagation();
          e.preventDefault();
          actionEl.click();
        }
      } else if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        const parentChip = this.activeChipMenuEl;
        this.close();
        parentChip?.focus();
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
        this.close();
        document.removeEventListener("mousedown", closeHandler);
      }
    };
    this.closeHandler = closeHandler;
    setTimeout(() => {
      document.addEventListener("mousedown", closeHandler);
      if (focusWeight) {
        /** @type {HTMLElement} */ (popup.querySelector('.j0n4t-pg-weight-input')).focus();
      } else {
        /** @type {HTMLElement} */ (popup.querySelector("[data-action]")).focus();
      }
    }, 10);
  }

  close() {
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