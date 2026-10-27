import PresetLogic from "./PresetLogic.js";
import ChipProjection from "./ChipProjection.js";
import RollManager from "./RollManager.js";

/**
 * Variant-editing and selection commands for the basket chip popup.
 *
 * This module owns everything the user can do to a chip's variant block through
 * the popup: pin/unpin, weight toggle/change, edit, swap, locate, create, delete,
 * variant-group selection and editing, re-roll, and the keyboard shortcuts that
 * trigger those actions.
 *
 * It does NOT render or position the popup (that stays in ChipMenuManager), and
 * it does not write the selection to the widget. Those pieces belong to the
 * popup container / basket mutation boundary so that a single edit still
 * produces exactly one Basket render (see docs/app-logic-refactor-plan.md).
 */
export default class ChipMenuCommands {
  /**
   * @param {import("./ChipMenuManager.js").default} manager
   * @param {GalleryContext} context
   * @param {import("./PresetBasket.js").default} delegateBasket
   */
  constructor(manager, context, delegateBasket) {
    this.manager = manager;
    this.context = context;
    this.basket = delegateBasket;
  }

  /**
   * @param {KeyboardEvent} e
   * @param {HTMLElement|null} activeChipMenuEl
   * @param {HTMLElement} popup
   */
  onKeyCommand(e, activeChipMenuEl, popup) {
    const target = /** @type {HTMLElement} */ (e.target);
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "c" &&
      target.tagName !== "INPUT" &&
      target.tagName !== "TEXTAREA"
    ) {
      e.preventDefault();
      e.stopPropagation();
      this.basket.copySelectedChips(activeChipMenuEl ?? undefined);
      return;
    }
    if (e.key === "Delete") {
      e.stopPropagation();
      e.preventDefault();
      const delEl = /** @type {HTMLElement} */ (popup.querySelector('[data-action="del"]'));
      if (delEl) delEl.click();
      return;
    }
    if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
      const keyMap = { p: "pin", s: "swap", e: "edit", l: "locate", c: "create", w: "toggle-weight" };
      const action = keyMap[/** @type {keyof typeof keyMap} */ (e.key.toLowerCase())];
      if (action) {
        e.stopPropagation();
        e.preventDefault();
        const actionEl = /** @type {HTMLElement} */ (popup.querySelector(`[data-action="${action}"]`));
        if (actionEl) actionEl.click();
      }
    }
  }

  /**
   * @param {Event} e
   * @param {HTMLElement} actionEl
   * @param {HTMLElement} chipElement
   * @param {number} startIndex
   * @param {number} endIndex
   * @param {HTMLElement} popup
   * @returns {boolean} true when the popup should close with restoreFocus=false
   */
  onAction(e, actionEl, chipElement, startIndex, endIndex, popup) {
    e.stopPropagation();
    const action = actionEl.dataset.action;

    if (action === "pin") {
      const currentList = this.context.getSelectedArray();
      const rawToken = currentList.slice(startIndex, endIndex).join(", ");
      if (this.context.pinnedChips?.has(rawToken)) {
        this.context.pinnedChips.delete(rawToken);
        chipElement.classList.remove("pinned");
        actionEl.classList.remove("active-pin");
        actionEl.querySelector('svg')?.setAttribute("fill", "none");
        actionEl.title = "Pin";
      } else {
        this.context.pinnedChips?.add(rawToken);
        chipElement.classList.add("pinned");
        actionEl.classList.add("active-pin");
        actionEl.querySelector('svg')?.setAttribute("fill", "currentColor");
        actionEl.title = "Unpin";
      }
      this.context.savePins();
      this.basket.saveCurrentState();
      return false;
    }

    if (action === "toggle-weight") {
      const wMod = /** @type {HTMLElement} */ (popup.querySelector(".j0n4t-pg-weight-modifier"));
      if (!wMod) return false;
      wMod.style.display = wMod.style.display === "none" ? "flex" : "none";
      if (wMod.style.display === "flex") {
        wMod.querySelector("input")?.focus();
      }
      return false;
    }

    if (action === "weight-minus" || action === "weight-plus") {
      const input = /** @type {HTMLInputElement} */ (popup.querySelector(".j0n4t-pg-weight-input"));
      if (!input) return false;
      let val = parseFloat(input.value) || 1.0;
      val += action === "weight-plus" ? 0.05 : -0.05;
      input.value = String(Number(val.toFixed(2)));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return false;
    }

    if (action === "edit") {
      this._editPreset(chipElement, startIndex, endIndex);
      return true;
    } else if (action === "swap") {
      this._swapPreset(chipElement, startIndex, endIndex);
      return true;
    } else if (action === "locate") {
      this._locatePreset(chipElement);
      return true;
    } else if (action === "create") {
      this._createPreset(chipElement);
      return true;
    } else if (action === "del") {
      this._deleteSelection(startIndex, endIndex);
      return true;
    }
    return true;
  }

  /**
   * @param {HTMLElement} chipElement
   * @param {HTMLElement} rerollBtn
   * @param {number} chipIndex
   * @param {string} group
   * @param {string} gIndex
   * @returns {boolean} true when the popup should close with restoreFocus=true
   */
  onReroll(chipElement, rerollBtn, chipIndex, group, gIndex) {
    this.basket.reRollChipGroup(chipIndex, group, gIndex);
    return true;
  }

  /**
   * @param {HTMLElement} chipElement
   * @param {number} startIndex
   * @param {number} endIndex
   */
  _editPreset(chipElement, startIndex, endIndex) {
    const styleKey = chipElement.dataset.id || "";
    const { core: coreKey, weight: currentWeight, isWeighted } = PresetLogic.parseWeight(styleKey);
    const item = this.context.cache[coreKey];
    if (item) {
      this.context.openEditorForPreset(coreKey, true);
      return;
    }
    const rawPreset = chipElement.dataset.preset;
    let editVal = styleKey;
    if (isWeighted && rawPreset) {
      editVal = `(${rawPreset}:${currentWeight})`;
    } else if (rawPreset) {
      editVal = rawPreset;
    }
    this.basket.inlineEditorManager.spawn(chipElement, editVal, startIndex, endIndex);
  }

  /**
   * @param {HTMLElement} chipElement
   * @param {number} startIndex
   * @param {number} endIndex
   */
  _swapPreset(chipElement, startIndex, endIndex) {
    const styleKey = chipElement.dataset.id || "";
    const { core: coreKey, weight: currentWeight, isWeighted } = PresetLogic.parseWeight(styleKey);
    const editVal = this.context.cache[coreKey]?.preset || coreKey;
    let val = editVal;
    if (isWeighted && val) {
      val = `(${val}:${currentWeight})`;
    }
    this.basket.inlineEditorManager.spawn(chipElement, val, startIndex, endIndex);
  }

  /** @param {HTMLElement} chipElement */
  _locatePreset(chipElement) {
    const styleKey = chipElement.dataset.id || "";
    const { core: coreKey } = PresetLogic.parseWeight(styleKey);
    let locateKey = coreKey;
    const presetVal = chipElement.dataset.preset;
    if (presetVal) {
      const presetMatch = PresetLogic.findPresetMatch(presetVal, this.context.cache);
      if (presetMatch) locateKey = presetMatch.key;
    }
    this.basket.locatePreset(locateKey);
  }

  /** @param {HTMLElement} chipElement */
  _createPreset(chipElement) {
    const styleKey = chipElement.dataset.id || "";
    const { core: coreKey } = PresetLogic.parseWeight(styleKey);
    const item = this.context.cache[coreKey];
    this.context.setPanelCollapseState(false);
    this.context.editor.clearFields();
    this.context.editor.dom.inpPreset.value = item && item.preset ? item.preset : coreKey;
    this.context.editor.rawPresetManager?.updateHighlights();
    const cleanName =
      coreKey
        .replace(/^<(lora|lyco):/i, "")
        .replace(/>$/, "")
        .split(":")[0]
        .split("/").pop()?.replace(/[^a-zA-Z0-9\s-_]/g, "").trim().replace(/\s+/g, "_");
    if (cleanName) this.context.editor.dom.inpName.value = cleanName;
    this.context.editor.dom.inpPreset.dispatchEvent(new Event("input"));
    this.context.editor.dom.inpPreset.focus();
  }

  /**
   * @param {number} startIndex
   * @param {number} endIndex
   */
  _deleteSelection(startIndex, endIndex) {
    const selections = this.context.getSelectedArray();
    if (startIndex !== undefined && endIndex !== undefined) {
      selections.splice(startIndex, endIndex - startIndex);
      this.context.updateWidgetValue(selections);
    }
  }

  /**
   * @param {HTMLElement} chipElement
   * @param {HTMLElement} editVarBtn
   * @param {HTMLElement} popup
   */
  onEditVar(chipElement, editVarBtn, popup) {
    const group = editVarBtn.dataset.group;
    const gIndex = Number(editVarBtn.dataset.gindex);
    const inputEl = /** @type {HTMLInputElement} */ (popup.querySelector(
      `input.j0n4t-pg-var-input[data-group="${group}"][data-gindex="${gIndex}"]`
    ));
    let rawVal = inputEl?.value;
    if (rawVal === "🚫 None (Omit)" || inputEl?.dataset.key === "none") return;
    let variantKey = this.manager._resolveInputValue(inputEl, rawVal);
    if (!variantKey) {
      const chipIndex = Number(chipElement.dataset.index);
      if (!isNaN(chipIndex)) {
        const activeList = this.context.getSelectedArray();
        const chipsData = ChipProjection.getGroupedChips(activeList, this.context.cache);
        const tracer = new RollManager(this.context.rollManager.rolls);
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
  }

  /**
   * @param {HTMLInputElement} inputEl  - the variant input (already on the popup)
   * @param {HTMLElement} chipElement
   * @returns {[string, boolean] | null} new style key + whether the core changed, or null if unchanged
   */
  onVariantChange(inputEl, chipElement) {
    const group = inputEl.dataset.group || "";
    const gIndex = Number(inputEl.dataset.gindex);
    const rootGroup = inputEl.dataset.rootGroup;
    const isSub = inputEl.dataset.issub === "true";
    const rawVal = inputEl.value;
    const selectedVal = this.manager._resolveInputValue(inputEl, rawVal);
    inputEl.dataset.key = selectedVal;

    const groupRegex = PresetLogic.createGroupRegex(group);
    const replacement = selectedVal ? `{${group}:${selectedVal}}` : `{${group}}`;

    const currentKey = chipElement.dataset.id || "";
    const currentPreset = chipElement.dataset.preset || "";
    const { core: activeCoreKey, isWeighted: isActiveWeighted, weightStr: activeWeight } =
      PresetLogic.parseWeight(currentKey);
    const unrolled = PresetLogic.getUnrolledTemplate(activeCoreKey, this.context.cache);

    /**
     * @param {string} str
     * @param {RegExp} regex
     * @param {string} replStr
     */
    const replaceNth = (str, regex, replStr) => {
      let matchCount = 0;
      return str.replace(regex, /** @param {string} match */ (match) => {
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
    if (newStyleKey === currentKey) return null;

    chipElement.dataset.id = newStyleKey;
    chipElement.dataset.preset = coreReplaced ? "" : newStyleKey;
    return [newStyleKey, coreReplaced];
  }

  /**
   * @param {HTMLElement} chipElement
   * @param {HTMLInputElement} inputEl  - the weight input (already on the popup)
   * @returns {string | undefined} the new style key, or undefined when the value is invalid
   */
  onWeightChange(chipElement, inputEl) {
    let val = parseFloat(inputEl.value);
    if (isNaN(val)) return;
    const currentKey = chipElement.dataset.id || "";
    const { core: activeCoreKey } = PresetLogic.parseWeight(currentKey);
    const finalNewKey = val === 1.0 ? activeCoreKey : `(${activeCoreKey}:${Number(val.toFixed(2))})`;
    chipElement.dataset.id = finalNewKey;
    return finalNewKey;
  }
}
