import AutocompleteManager from "./AutocompleteManager.js";
import PresetDOM from "./PresetDOM.js";
import PresetLogic from "./PresetLogic.js";
import PresetDisplay from "./PresetDisplay.js";

export default class RawTextAutocomplete {
  /**
   * @param {HTMLTextAreaElement | HTMLInputElement} textarea
   * @param {GalleryContext} context
   * @param {string|null} ignorePreset
   * @param {(textareaValue: string) => void} onSync
   * @param {any} manager - the RawTextareaManager instance (for updateHighlights)
   */
  constructor(textarea, context, ignorePreset, onSync, manager) {
    this.textarea = textarea;
    this.context = context;
    this.ignorePreset = ignorePreset || "";
    this.onSync = onSync;
    this.manager = manager;
    this.init();
  }

  init() {
    const manager = new AutocompleteManager({
      input: this.textarea,
      container: document.body,
      getMatches: (text, cursor) => {
        const textBeforeCursor = text.substring(0, cursor);
        const lastOpenBrace = textBeforeCursor.lastIndexOf("{");
        const lastCloseBrace = textBeforeCursor.lastIndexOf("}");
        const isInsideBrackets = lastOpenBrace !== -1 && lastOpenBrace > lastCloseBrace;

        if (isInsideBrackets) {
          const bracketContent = textBeforeCursor.substring(lastOpenBrace + 1);
          const colonIndex = bracketContent.indexOf(":");

          if (colonIndex === -1) {
            const groupQuery = bracketContent.trim().toLowerCase();
            const groupsSet = new Set();
            for (const k of Object.keys(this.context.cache)) {
              const folder = PresetDisplay.getPresetFolder ? PresetDisplay.getPresetFolder(k) : k.split("/")[0];
              if (folder) groupsSet.add(folder);
            }
            const groups = Array.from(groupsSet);
            /** @type {PresetCache} */
            const dummyCache = {};
            groups.forEach((g) => {
              dummyCache[g] = { preset: g };
            });
            return PresetDisplay.getTopMatches(
              groups,
              groupQuery,
              (g) => g,
              dummyCache
            );
          } else {
            const groupName = bracketContent.substring(0, colonIndex).trim().toLowerCase();
            const presetQuery = bracketContent.substring(colonIndex + 1).trim().toLowerCase();

            const presetMatches = Object.keys(this.context.cache).filter((k) => {
              if (!this.context.cache[k]?.preset) return false;
              const folder = PresetDisplay.getPresetFolder ? PresetDisplay.getPresetFolder(k) : k.split("/")[0];
              return (
                folder.toLowerCase() === groupName ||
                folder.toLowerCase().startsWith(groupName + "/") ||
                folder.toLowerCase().endsWith("/" + groupName)
              );
            });

            const virtualNulls = ["none", "null"].filter(
              (opt) => !presetMatches.some((k) => PresetDisplay.getPresetName(k).toLowerCase() === opt)
            );
            const candidateKeys = [...virtualNulls, ...presetMatches];

            return PresetDisplay.getTopMatches(
              candidateKeys,
              presetQuery,
              (k) => (PresetLogic.isVirtualNull(k) ? k : PresetDisplay.getSearchBlob(k, this.context.cache[k])),
              this.context.cache
            );
          }
        } else {
          const lastCommaIndex = text.slice(0, cursor).lastIndexOf(",");
          const currentToken = lastCommaIndex === -1 ? text.slice(0, cursor) : text.slice(lastCommaIndex + 1, cursor);
          if (!currentToken) return [];

          return PresetDisplay.getTopMatches(
            Object.getOwnPropertyNames(this.context.cache),
            currentToken,
            (k) => PresetDisplay.getSearchBlob(k, this.context.cache[k]),
            this.context.cache,
            this.ignorePreset
          );
        }
      },
      renderItem: (match) =>
        `<span>${PresetDOM.escapeHTML(PresetDisplay.toTitleCase(PresetDisplay.getPresetName(match)))}</span><span class="j0n4t-pg-autocomplete-meta">${PresetDOM.escapeHTML(match)}</span>`,
      onSelect: (match) => {
        const query = this.textarea.value;
        const cursor = this.textarea.selectionStart || 0;
        const textBeforeCursor = query.substring(0, cursor);
        const lastOpenBrace = textBeforeCursor.lastIndexOf("{");
        const lastCloseBrace = textBeforeCursor.lastIndexOf("}");
        const isInsideBrackets = lastOpenBrace !== -1 && lastOpenBrace > lastCloseBrace;
        const leftText = this.textarea.value.slice(0, cursor);
        const prefix =
          leftText.lastIndexOf(",") === -1 ? "" : leftText.slice(0, leftText.lastIndexOf(",") + 1) + " ";
        const insertedText = PresetLogic.expandRecursively(match, this.context.cache);
        if (isInsideBrackets) {
          const bracketContent = textBeforeCursor.substring(lastOpenBrace + 1);
          const colonIndex = bracketContent.indexOf(":");
          if (colonIndex === -1) {
            const before = query.substring(0, lastOpenBrace);
            const after = query.substring(cursor);
            this.textarea.value = `${before}{${match}:${after}`;
            const newCursor = before.length + match.length + 2;
            if (this.onSync) this.onSync(this.textarea.value);
            this.manager.updateHighlights(this.ignorePreset);
            this.textarea.setSelectionRange(newCursor, newCursor);
            this.textarea.focus();
            manager.evaluate();
            return true;
          } else {
            const groupName = bracketContent.substring(0, colonIndex).trim();
            const before = query.substring(0, lastOpenBrace);
            const after = query.substring(cursor);
            this.textarea.value = `${before}{${groupName}:${match}${after}`;
            if (this.onSync) this.onSync(this.textarea.value);
            this.manager.updateHighlights(this.ignorePreset);
            this.textarea.focus();
            this.textarea.selectionStart = this.textarea.selectionEnd =
              prefix.length + insertedText.length + 2;
            return false;
          }
        } else {
          this.textarea.value = prefix + insertedText + ", " + this.textarea.value.slice(cursor);

          if (this.onSync) this.onSync(this.textarea.value);
          this.manager.updateHighlights(this.ignorePreset);
          this.textarea.focus();
          this.textarea.selectionStart = this.textarea.selectionEnd =
            prefix.length + insertedText.length + 2;
        }
      },
      onKeyDown: (e, { activeMatch }) => {
        if (e.key === "ArrowRight" && this.textarea.selectionStart === this.textarea.value.length && activeMatch) {
          return false;
        }
      },
    });
    this.autocompleteManager = manager;
  }
}
