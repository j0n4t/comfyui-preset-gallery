import PresetDOM from "./PresetDOM.js";
import PresetLogic from "./PresetLogic.js";

export default class ChipMenuManager {
  constructor(context, delegateBasket) {
    this.context = context;
    this.basket = delegateBasket;
    this.activeChipMenuEl = null;
    this.popupEl = null;
    this.closeHandler = null;
  }

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

    const rawPreset = chipElement.dataset.preset || "";
    const source = coreKey.match(/\{[^{}]+\}/) ? coreKey : (rawPreset || item?.preset || "");
    const parsed = PresetLogic.parseChipDetails(source, this.context.cache);

    let varRowsHtml = "";
    const groupCounts = {};

    if (parsed.variants.length > 0) {
      parsed.variants.forEach(({ groupRaw, groupName, val: currentSelectedVal }) => {
        const gIndex = groupCounts[groupRaw] || 0;
        groupCounts[groupRaw] = gIndex + 1;

        let matches = PresetLogic.getGroupMatches(groupName, this.context.cache);

        if (matches.length > 0) {
          matches.sort((a, b) => a.localeCompare(b));

          const listId = `dl-${groupRaw.replace(/\W/g, '')}-${gIndex}-${Date.now()}`;
          const escapedGroup = PresetDOM.escapeHTML(groupName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const groupRegex = new RegExp(`(^|/)${escapedGroup}(/|$)`, 'i');

          const optionsHtml = matches
            .map((m) => {
              const displayVal = m.replace(groupRegex, '$1.$2');
              return `<option data-key="${m}" value="${PresetDOM.escapeHTML(displayVal)}"></option>`;
            })
            .join("");

          let displayValue = currentSelectedVal || "";
          const isNullSelected = currentSelectedVal && PresetLogic.isVirtualNull(currentSelectedVal);

          if (!currentSelectedVal) displayValue = "🎲 Random";
          else if (isNullSelected) displayValue = "🚫 None (Omit)";
          else {
            displayValue = currentSelectedVal.replace(groupRegex, '$1.$2');
          }

          varRowsHtml += `<div class="j0n4t-pg-var-popup-row">
            <label>${PresetDOM.escapeHTML(PresetLogic.toTitleCase(groupRaw))}</label>
            <input type="text" list="${listId}" class="j0n4t-pg-var-input" data-group="${PresetDOM.escapeHTML(groupRaw)}" data-gindex="${gIndex}" value="${PresetDOM.escapeHTML(displayValue)}" placeholder="🔍 Filter by folder/name..." tabindex="0" onclick="this.select()">
            <datalist id="${listId}">
              <option value="🎲 Random"></option>
              <option value="🚫 None (Omit)"></option>
              ${optionsHtml}
            </datalist>
            <button class="j0n4t-pg-var-edit-btn" data-group="${PresetDOM.escapeHTML(groupRaw)}" data-gindex="${gIndex}" title="Edit selected ${PresetDOM.escapeHTML(PresetLogic.toTitleCase(groupRaw))}" tabindex="0">${PresetDOM.icons.edit}</button>
            <button class="j0n4t-pg-var-reroll-btn" data-group="${PresetDOM.escapeHTML(groupRaw)}" data-gindex="${gIndex}" title="Re-roll ${PresetDOM.escapeHTML(PresetLogic.toTitleCase(groupRaw))}" tabindex="0">${PresetDOM.icons.dice}</button>
          </div>`;
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
    const popup = document.body.lastElementChild;
    this.popupEl = popup;

    popup.addEventListener("click", (e) => {
      const rerollBtn = e.target.closest(".j0n4t-pg-var-reroll-btn");
      if (rerollBtn) {
        e.stopPropagation();
        this.basket.reRollChipGroup(
          parseInt(chipElement.dataset.index),
          rerollBtn.dataset.group,
          rerollBtn.dataset.gindex
        );
        this.close();
        return;
      }

      const editVarBtn = e.target.closest(".j0n4t-pg-var-edit-btn");
      if (editVarBtn) {
        e.stopPropagation();
        const group = editVarBtn.dataset.group;
        const gIndex = parseInt(editVarBtn.dataset.gindex, 10);
        const inputEl = popup.querySelector(`input.j0n4t-pg-var-input[data-group="${group}"][data-gindex="${gIndex}"]`);

        let rawVal = inputEl?.value;
        if (rawVal === "🚫 None (Omit)") return;

        let variantKey = null;
        if (rawVal && rawVal !== "🎲 Random") {
          const datalistEl = popup.querySelector(`datalist#${inputEl.getAttribute('list')}`);
          const matchingOption = datalistEl ? Array.from(datalistEl.options).find(opt => opt.value === rawVal) : null;
          variantKey = matchingOption ? matchingOption.dataset.key : rawVal;
        }

        if (!variantKey) {
          const chipIndex = parseInt(chipElement.dataset.index, 10);
          if (!isNaN(chipIndex)) {
            const activeList = this.context.getSelectedArray();
            const chipsData = PresetLogic.getGroupedChips(activeList, this.context.cache);
            const tracer = new PresetLogic.RollManager(this.context.rollManager.rolls);
            const targetGroup = group.trim().toLowerCase().replace(/\s+/g, "_");

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

      const actionEl = e.target.closest("[data-action]");
      if (!actionEl) return;
      e.stopPropagation();

      const action = actionEl.dataset.action;

      if (action === "toggle-weight") {
        const wMod = popup.querySelector('.j0n4t-pg-weight-modifier');
        wMod.style.display = wMod.style.display === 'none' ? 'flex' : 'none';
        if (wMod.style.display === 'flex') {
          wMod.querySelector('input').focus();
        }
        return;
      }

      if (action === "weight-minus" || action === "weight-plus") {
        const input = popup.querySelector('.j0n4t-pg-weight-input');
        let val = parseFloat(input.value) || 1.0;
        val += (action === "weight-plus" ? 0.05 : -0.05);
        input.value = Number(val.toFixed(2));
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
        this.context.editor.dom.inpPreset.value = item ? item.preset : coreKey;
        this.context.editor.rawPresetManager?.updateHighlights();
        const cleanName = coreKey.replace(/^<(lora|lyco):/i, "").replace(/>$/, "").split(":")[0].split("/").pop().replace(/[^a-zA-Z0-9\s-_]/g, "").trim().replace(/\s+/g, "_");
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
      const weightInput = e.target.closest(".j0n4t-pg-weight-input");
      if (weightInput) {
        let val = parseFloat(weightInput.value);
        if (isNaN(val)) return;

        const currentStyleKey = chipElement.dataset.id;
        const currentWMatch = currentStyleKey.match(/^\((.+?):([-+]?[0-9]*\.?[0-9]+)\)$/);
        const activeCoreKey = currentWMatch ? currentWMatch[1] : currentStyleKey;

        let finalNewKey = val === 1.0 ? activeCoreKey : `(${activeCoreKey}:${Number(val.toFixed(2))})`;
        chipElement.dataset.id = finalNewKey;

        const selections = this.context.getSelectedArray();
        if (startIndex < selections.length) {
          selections.splice(startIndex, endIndex - startIndex, finalNewKey);
          this.context.updateWidgetValue(selections);
        }
        return;
      }

      const inputEl = e.target.closest("input.j0n4t-pg-var-input");
      if (!inputEl) return;

      const group = inputEl.dataset.group;
      const gIndex = parseInt(inputEl.dataset.gindex, 10);
      const rawVal = inputEl.value;

      let selectedVal = rawVal;
      if (rawVal === "🎲 Random" || !rawVal) {
        selectedVal = "";
      } else if (rawVal === "🚫 None (Omit)") {
        selectedVal = "none";
      } else {
        const datalistEl = popup.querySelector(`#${inputEl.getAttribute('list')}`);
        const matchingOption = datalistEl ? Array.from(datalistEl.options).find(opt => opt.value === rawVal) : null;
        selectedVal = matchingOption ? matchingOption.dataset.key : rawVal;
      }

      const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\{\\s*${escapeRegExp(group)}\\s*(?::[^{}]+)?\\}`, 'g');
      const replacement = selectedVal ? `{${group}:${selectedVal}}` : `{${group}}`;

      const currentKey = chipElement.dataset.id;
      const currentPreset = chipElement.dataset.preset || "";
      const replaceNth = (str) => {
        let matchCount = 0;
        return str.replace(regex, (match) => {
          if (matchCount === gIndex) {
            matchCount++;
            return replacement;
          }
          matchCount++;
          return match;
        });
      };

      let newStyleKey;
      if (currentKey.match(regex)) {
        newStyleKey = replaceNth(currentKey);
      } else if (currentPreset.match(regex)) {
        newStyleKey = replaceNth(currentPreset);
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
      const items = Array.from(popup.querySelectorAll("[data-action], button, input"));
      const currentIndex = items.indexOf(document.activeElement);

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        if (e.target.tagName !== 'INPUT') {
          e.stopPropagation();
          e.preventDefault();
          items[(currentIndex + 1) % items.length].focus();
        }
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        if (e.target.tagName !== 'INPUT') {
          e.stopPropagation();
          e.preventDefault();
          items[(currentIndex - 1 + items.length) % items.length].focus();
        }
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

    const closeHandler = (e) => {
      if (!popup.contains(e.target) && e.target !== chipElement) {
        this.close();
        document.removeEventListener("mousedown", closeHandler);
      }
    };
    this.closeHandler = closeHandler;
    setTimeout(() => {
      document.addEventListener("mousedown", closeHandler);
      if (focusWeight) {
        popup.querySelector('.j0n4t-pg-weight-input')?.focus();
      } else {
        popup.querySelector("[data-action]")?.focus();
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