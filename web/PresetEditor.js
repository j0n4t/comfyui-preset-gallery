import AutocompleteManager from "./AutocompleteManager.js";
import PresetGalleryAPI from "./PresetGalleryAPI.js";
import PresetUtils from "./PresetUtils.js";

const fileToDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default class PresetEditor {
  static EDITOR_BTN_STYLES = /*css*/ `
    .j0n4t-pg-editor { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid #3d3d3d; padding-top: 8px; margin-top: 2px; box-sizing: border-box; flex-shrink: 0; }
    .j0n4t-pg-editor.collapsed { display: none !important; }
    .j0n4t-pg-editor-banner { font-size: 10px; font-weight: bold; padding: 4px 6px; border-radius: 3px; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.5px; flex: 1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
    .j0n4t-pg-editor input, .j0n4t-pg-editor textarea { background: #1a1a1ab0; border: 1px solid #444; color: #fff; font-size: 11px; padding: 5px; border-radius: 3px; box-sizing: border-box; width: 100%; }
    .j0n4t-pg-editor textarea { resize: vertical; min-height: 48px; }
    .j0n4t-pg-row { display: flex; gap: 6px; align-items: center; }
    .j0n4t-pg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: #007acc; border: none; color: #fff; padding: 6px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold; text-align: center; box-sizing: border-box; height: 24px; }
    .j0n4t-pg-btn:hover { background: #0062a3; }
  `;

  static EDITOR_PREVIEW_STYLES = /*css*/ `
    .j0n4t-pg-editor-preview { position: relative; width: 84px; flex-shrink: 0; border-radius: 3px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #111; cursor: pointer; border: 1px dashed #444; transition: border-color 0.2s; min-height: 84px; }
    .j0n4t-pg-editor-preview:hover { border-color: #007acc; }
    .j0n4t-pg-editor-preview .j0n4t-pg-corner-edit { top: 4px; right: 4px; background: #b23b3b; border-color: #b23b3b; z-index: 10; display: none; }
    .j0n4t-pg-editor-preview:hover .j0n4t-pg-corner-edit { display: flex; }
    .j0n4t-pg-editor-preview img { width: 100%; height: 100%; object-fit: cover; position: absolute; top:0; left:0; }
  `;

  static MODAL_STYLES = /*css*/ `
    .j0n4t-pg-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(3px); z-index: 20000; display: flex; align-items: center; justify-content: center; }
    .j0n4t-pg-modal { background: #1f1f1f; border: 1px solid #007acc; border-radius: 8px; min-width: 200px; padding: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); font-family: sans-serif; display: flex; flex-direction: column; gap: 12px; color: #eee; }
    .j0n4t-pg-modal.j0n4t-pg-modal-large { width: 420px; max-width: 90vw; }
    .j0n4t-pg-modal h3 { margin: 0; font-size: 13px; font-weight: bold; color: #fff; display: flex; align-items: center; gap: 6px; }
    .j0n4t-pg-modal-row { display: flex; gap: 10px; width: 100%; }
    .j0n4t-pg-modal-field { display: flex; flex-direction: column; gap: 4px; font-size: 11px; }
    .j0n4t-pg-modal-field label { color: #aaa; font-weight: bold; }
    .j0n4t-pg-modal-field select { background: #111; border: 1px solid #444; color: #fff; padding: 6px; border-radius: 4px; font-size: 11px; outline: none; }
    .j0n4t-pg-modal-field select:focus { border-color: #007acc; }
    .j0n4t-pg-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
  `;

  static PRESET_TREE_SELECTOR_STYLES = /*css*/ `
    .j0n4t-pg-selector-container { border: 1px solid #333; background: #141414; border-radius: 4px; padding: 6px; display: flex; flex-direction: column; gap: 6px; }
    .j0n4t-pg-selector-controls { border-bottom: 1px solid #222; padding-bottom: 4px; }
    .j0n4t-pg-selector-tree { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 4px; }
    .j0n4t-pg-tree-group { display: flex; flex-direction: column; gap: 2px; }
    .j0n4t-pg-tree-group-header { background: #1e1e1e; padding: 2px 6px; border-radius: 3px; }
    .j0n4t-pg-tree-group-items { padding-left: 16px; display: flex; flex-direction: column; gap: 1px; }
    .j0n4t-pg-tree-item { padding: 1px 0; }
  `;

  constructor(dom, context) {
    this.dom = dom;
    this.context = context;
    this.editingKey = "";
    this.currentMode = "new";
    this.isSaved = false;

    PresetUtils.injectStyles("j0n4t-pg-editor-btn-styles", PresetEditor.EDITOR_BTN_STYLES);
    PresetUtils.injectStyles("j0n4t-pg-editor-preview-styles", PresetEditor.EDITOR_PREVIEW_STYLES);
    PresetUtils.injectStyles("j0n4t-pg-modal-styles", PresetEditor.MODAL_STYLES);
    PresetUtils.injectStyles("j0n4t-pg-preset-tree-selector-styles", PresetEditor.PRESET_TREE_SELECTOR_STYLES);

    this.bindEvents();
    this.initFolderAutocomplete();
  }

  renderPreview() {
    const rmBtnHtml = `<div class="j0n4t-pg-corner-edit" id="j0n4t-pg-rm-img-btn" title="Remove Image">${PresetUtils.icons.close}</div>`;
    if (this.dom.editor.classList.contains("has-image")) {
      let imgSrc = "";
      if (this.dom.inpFile.files?.[0]) {
        if (this.localPreviewUrl) URL.revokeObjectURL(this.localPreviewUrl);
        imgSrc = this.localPreviewUrl = URL.createObjectURL(
          this.dom.inpFile.files[0]
        );
      } else if (
        this.editingKey &&
        this.context.cache[this.editingKey]?.filename
      ) {
        imgSrc = this.context.cache[this.editingKey].filename;
      }
      if (imgSrc) {
        this.dom.editorPreview.innerHTML = `${rmBtnHtml}<img src="${imgSrc}" />`;
        return;
      }
    }

    const uniqueKey =
      (this.dom.inpFolder.value.trim()
        ? `${this.dom.inpFolder.value.trim()}/`
        : "") + (this.dom.inpName.value.trim() || "New");
    this.dom.editorPreview.innerHTML = `<div style="background-color: ${PresetUtils.getGroupColor(uniqueKey) || ""}; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#fff; position:absolute;">${PresetUtils.icons.file}<div class="j0n4t-pg-initials" style="font-size:14px;">${PresetUtils.escapeHTML(PresetUtils.getPresetInitials(uniqueKey))}</div></div>`;
  }

  updateBanner() {
    const { banner, btnSave } = this.dom;
    if (this.currentMode === "new") {
      banner.innerText = "✨ Creating New Preset";
      banner.style.color = "#32d332";
      banner.style.background = "#228b2220";
      btnSave.innerText = "Save";
      btnSave.style.background = "#007acc";
    } else if (this.editingKey) {
      banner.innerText = `${this.isSaved ? "✅" : "📝"} ${this.editingKey}`;
      banner.title = banner.innerText;
      banner.style.color = this.isSaved ? "#fff" : "#f0bc2f";
      banner.style.background = "#d1a11920";
      btnSave.innerText = this.isSaved ? "Saved!" : "Save";
      btnSave.style.background = this.isSaved ? "#27b427" : "#007acc";
    } else {
      banner.innerText = "📝 Select Edit ✏️ on an Preset";
      banner.style.color = "#888";
      banner.style.background = "#33333330";
    }
  }

  resetImageState() {
    this.dom.inpFile.value = "";
    this.dom.editor.classList.remove("has-image");
    this.dom.editor.classList.add("no-image");
    if (this.localPreviewUrl) {
      URL.revokeObjectURL(this.localPreviewUrl);
      this.localPreviewUrl = null;
    }
    this.renderPreview();
  }

  clearFields() {
    this.currentMode = "new";
    this.editingKey = "";
    this.isSaved = false;
    this.dom.inpName.value = "";
    this.dom.inpFolder.value = "";
    this.dom.inpPreset.value = "";
    this.resetImageState();
    this.updateBanner();
    this.context.syncEditorHighlight();
  }

  async openPreset(styleKey) {
    if (!this.context.cache[styleKey]) return;
    this.context.setPanelCollapseState(false);
    this.resetImageState();
    this.editingKey = styleKey;
    this.currentMode = "edit";
    this.isSaved = true;

    const parts = styleKey.split("/");
    this.dom.inpName.value = parts.pop() || "";
    this.dom.inpFolder.value = parts.join("/");
    this.dom.inpPreset.value = this.context.cache[styleKey].preset || "";

    if (this.context.cache[styleKey].filename) {
      this.dom.editor.classList.replace("no-image", "has-image");
    }
    this.renderPreview();

    this.updateBanner();
    this.context.syncEditorHighlight();
  }

  async handleSave() {
    let name = this.dom.inpName.value.trim().toLowerCase().replace(/ /g, "_");
    if (!name) {
      const pt = this.dom.inpPreset.value.trim();
      if (!pt) {
        await PresetUtils.alert("Keywords or Name required to save.");
        return;
      }
      name =
        pt
          .split(/\s+/)
          .slice(0, 3)
          .map((w) => w.replace(/[^a-zA-Z0-9]/g, "").toLowerCase())
          .filter(Boolean)
          .join("_") || `unnamed_preset_${Date.now().toString().slice(-4)}`;
      this.dom.inpName.value = name;
    }

    const uniqueKey =
      (this.dom.inpFolder.value.trim()
        ? `${this.dom.inpFolder.value.trim().toLowerCase().replace(/ /g, "_")}/`
        : "") + name;
    let selections = this.context.getSelectedArray();

    if (this.currentMode === "new") {
      if (
        this.context.cache[uniqueKey] &&
        !(await PresetUtils.confirm(`Overwrite "${uniqueKey}"?`))
      )
        return;
    }

    let imageData = null;
    let clearImage = false;

    if (this.dom.inpFile.files[0]) {
      imageData = await fileToDataURL(this.dom.inpFile.files[0]);
    } else if (this.dom.editor.classList.contains("no-image")) {
      clearImage = true;
    } else if (
      this.editingKey &&
      this.context.cache[this.editingKey]?.filename
    ) {
      imageData = this.context.cache[this.editingKey].filename;
    }

    const res = await PresetGalleryAPI.savePreset({
      name,
      folder: this.dom.inpFolder.value.trim(),
      presetText: this.dom.inpPreset.value.trim(),
      imageData,
      clearImage,
      editingKey: this.editingKey,
      mode: this.currentMode,
    });

    if (!res.success) {
      await PresetUtils.alert("Save failed.");
      return;
    }

    if (
      this.currentMode === "edit" &&
      this.editingKey !== uniqueKey &&
      this.context.cache[this.editingKey]
    ) {
      selections = selections.map((item) =>
        item === this.editingKey ? uniqueKey : item
      );
    }

    if (!selections.includes(uniqueKey)) selections.push(uniqueKey);

    this.editingKey = uniqueKey;
    this.currentMode = "edit";
    this.isSaved = true;
    await this.context.loadGallery();
    this.context.updateWidgetValue(selections);
    this.updateBanner();
  }

  async handleDelete() {
    if (!this.editingKey || !this.context.cache[this.editingKey]) {
      await PresetUtils.alert("No valid target.");
      return;
    }
    if (!(await PresetUtils.confirm(`Delete "${this.editingKey}"?`))) return;

    await PresetGalleryAPI.deletePreset(this.editingKey);
    await this.context.loadGallery();
    this.context.updateWidgetValue(
      this.context.getSelectedArray().filter((v) => v !== this.editingKey)
    );
    this.clearFields();
  }

  bindEvents() {
    const markDirty = () => {
      if (this.currentMode === "edit" && this.isSaved) {
        this.isSaved = false;
        this.updateBanner();
      }
      if (this.dom.editor.classList.contains("no-image")) this.renderPreview();
    };

    ["inpName", "inpFolder", "inpPreset"].forEach((id) =>
      this.dom[id].addEventListener("input", markDirty)
    );
    this.dom.editorPreview.addEventListener("click", async (e) => {
      if (e.target.closest("#j0n4t-pg-rm-img-btn")) {
        e.stopPropagation();
        if (await PresetUtils.confirm("Clear image?")) {
          this.resetImageState();
          markDirty();
        }
      } else this.dom.inpFile.click();
    });
    this.dom.inpFile.addEventListener("change", () => {
      if (this.dom.inpFile.files[0]) {
        this.dom.editor.classList.replace("no-image", "has-image");
        this.renderPreview();
        markDirty();
      }
    });

    const handleQuickSave = (e) => {
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        this.dom.btnSave.click();
      }
    };
    ["inpName", "inpFolder", "inpPreset"].forEach((id) =>
      this.dom[id].addEventListener("keydown", handleQuickSave)
    );

    this.dom.inpPreset.addEventListener("paste", (e) => {
      if (!this.dom.inpName.value.trim() || this.currentMode === "new") {
        const text = (e.clipboardData || window.clipboardData).getData("text");
        if (text) {
          const suggested = text
            .split(/[,\n]/)[0]
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9\s-_]/g, "")
            .trim()
            .replace(/\s+/g, "_")
            .split("_")
            .slice(0, 4)
            .join("_");
          if (suggested) {
            this.dom.inpName.value = suggested;
            markDirty();
          }
        }
      }
    });

    this.dom.btnClearFields.addEventListener("click", () => this.clearFields());
    this.dom.btnSave.addEventListener("click", () => this.handleSave());
    this.dom.btnDel.addEventListener("click", () => this.handleDelete());
  }

  initFolderAutocomplete() {
    new AutocompleteManager({
      input: this.dom.inpFolder,
      container: document.body,
      popupClass: "j0n4t-pg-folder-autocomplete-popup",
      itemClass: "j0n4t-pg-folder-autocomplete-item",
      getMatches: (query) => {
        query = query.trim().toLowerCase().replace(/ /g, "_");
        if (!query) return [];
        const allFolders = Array.from(
          new Set(
            Object.values(this.context.cache).flatMap((i) =>
              i.tags?.length ? [i.tags.join("/")] : []
            )
          )
        );
        return PresetUtils.getTopMatches(allFolders, query, (f) =>
          f.replace(/_/g, " ")
        );
      },
      renderItem: (match) => match.replace(/_/g, " "),
      onSelect: (match) => {
        this.dom.inpFolder.value = match;
        this.dom.inpFolder.focus();
        this.dom.inpFolder.dispatchEvent(new Event('input', { bubbles: true }));
      },
    });
  }
}