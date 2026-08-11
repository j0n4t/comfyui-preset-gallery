import AutocompleteManager from "./AutocompleteManager.js";
import PresetDOM from "./PresetDOM.js";
import PresetLogic from "./PresetLogic.js";

export default class InlineEditorManager {
  constructor(context, basketElement) {
    this.context = context;
    this.basket = basketElement;
  }

  spawn(chipElement, initialValue, startIndex = undefined, endIndex = undefined) {
    const isNew = !chipElement;
    const inputHtml = `<input type="text" class="j0n4t-pg-inline-edit" enterkeyhint="enter" value="${PresetDOM.escapeHTML(initialValue || '')}" tabindex="0" />`;
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
      const weight = chipElement.querySelector(".j0n4t-pg-basket-chip-weight");
      if (label) label.style.display = "none";
      if (weight) weight.style.display = "none";
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
        // DOM element might already be detached
      }

      if (isNew) chipElement.remove();
      else {
        chipElement.classList.remove("inline-editing");
        chipElement.draggable = true;
        const label = chipElement.querySelector(".j0n4t-pg-basket-chip-label");
        const weight = chipElement.querySelector(".j0n4t-pg-basket-chip-weight");
        if (label) label.style.display = "";
        if (weight) weight.style.display = "";
      }

      if (save) {
        const selections = this.context.getSelectedArray();
        if (isNew && newVal) {
          selections.push(newVal);
          this.context.updateWidgetValue(selections);
        } else if (!isNew && newVal !== initialValue) {
          if (startIndex !== undefined && endIndex !== undefined) {
            const newValues = newVal.includes(",") ? PresetLogic.splitPresets(newVal) : [newVal];
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

    new AutocompleteManager({
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
            const groupQuery = bracketContent.trim().toLowerCase();
            const groupsSet = new Set();
            for (const k of Object.keys(this.context.cache)) {
              const folder = PresetLogic.getPresetFolder ? PresetLogic.getPresetFolder(k) : k.split('/')[0];
              if (folder) groupsSet.add(folder);
            }
            const groups = Array.from(groupsSet);
            const dummyCache = {};
            groups.forEach(g => { dummyCache[g] = { preset: g }; });
            return PresetLogic.getTopMatches(groups, groupQuery, (g) => g, dummyCache);
          } else {
            const groupName = bracketContent.substring(0, colonIndex).trim().toLowerCase();
            const presetQuery = bracketContent.substring(colonIndex + 1).trim().toLowerCase();

            const presetMatches = Object.keys(this.context.cache).filter((k) => {
              if (!this.context.cache[k]?.preset) return false;
              const folder = PresetLogic.getPresetFolder ? PresetLogic.getPresetFolder(k) : k.split('/')[0];
              return folder.toLowerCase() === groupName || folder.toLowerCase().startsWith(groupName + "/") || folder.toLowerCase().endsWith("/" + groupName);
            });

            return PresetLogic.getTopMatches(presetMatches, presetQuery, (k) => PresetLogic.getSearchBlob(k, this.context.cache[k]), this.context.cache);
          }
        } else {
          query = query.trim().toLowerCase();
          if (!query) return [];
          return PresetLogic.getTopMatches(Object.keys(this.context.cache), query, (k) => PresetLogic.getSearchBlob(k, this.context.cache[k]), this.context.cache);
        }
      },
      renderItem: (match) => {
        const isPreset = this.context.cache && this.context.cache[match];
        if (isPreset) {
          return `<span>${PresetDOM.escapeHTML(PresetLogic.toTitleCase(match.split("/").pop()))}</span><span class="j0n4t-pg-autocomplete-meta">${PresetDOM.escapeHTML(match)}</span>`;
        } else {
          return `<span>${PresetDOM.icons.folder} ${PresetDOM.escapeHTML(PresetLogic.toTitleCase(match))}</span><span class="j0n4t-pg-autocomplete-meta">Variant Group</span>`;
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
            const before = query.substring(0, lastOpenBrace);
            const after = query.substring(cursor);
            input.value = `${before}{${match}:${after}`;
            const newCursor = before.length + match.length + 2;
            input.setSelectionRange(newCursor, newCursor);
            input.focus();
            return true;
          } else {
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
      onKeyDown: (e, { manager }) => {
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
}