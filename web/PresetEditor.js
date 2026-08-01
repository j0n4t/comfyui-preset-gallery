import AutocompleteManager from "./AutocompleteManager.js";
import PresetGalleryAPI from "./PresetGalleryAPI.js";
import PresetUtils from "./PresetUtils.js";
import RawTextareaManager from "./RawTextareaManager.js";

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
    .j0n4t-pg-editor input { background: #1a1a1ab0; border: 1px solid #444; color: #fff; font-size: 11px; padding: 5px; border-radius: 3px; box-sizing: border-box; width: 100%; outline: none; }
    .j0n4t-pg-editor input:focus, .j0n4t-pg-editor textarea:focus { border-color: #007acc; }
    .j0n4t-pg-editor textarea { resize: vertical; min-height: 48px; outline: none; }
    .j0n4t-pg-row { display: flex; gap: 6px; align-items: center; }
    .j0n4t-pg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: #007acc; border: none; color: #fff; padding: 6px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold; text-align: center; box-sizing: border-box; height: 24px; outline: none; }
    .j0n4t-pg-btn:hover, .j0n4t-pg-btn:focus-visible { background: #0062a3; outline: 2px solid #fff; outline-offset: -2px; }
  `;

  static EDITOR_PREVIEW_STYLES = /*css*/ `
    .j0n4t-pg-editor-preview { position: relative; width: 84px; flex-shrink: 0; border-radius: 3px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #111; cursor: pointer; border: 1px dashed #444; transition: border-color 0.2s; min-height: 84px; outline: none; }
    .j0n4t-pg-editor-preview:hover, .j0n4t-pg-editor-preview:focus-visible { border-color: #007acc; }
    .j0n4t-pg-editor-preview .j0n4t-pg-corner-edit { top: 4px; right: 4px; background: #b23b3b; border-color: #b23b3b; z-index: 10; display: none; }
    .j0n4t-pg-editor-preview:hover .j0n4t-pg-corner-edit, .j0n4t-pg-editor-preview:focus-within .j0n4t-pg-corner-edit { display: flex; }
    .j0n4t-pg-editor-preview img { width: 100%; height: 100%; object-fit: cover; position: absolute; top:0; left:0; }
  `;

  constructor(dom, context) {
    this.dom = dom;
    this.context = context;
    this.editingKey = "";
    this.currentMode = "new";
    this.isSaved = true;

    PresetUtils.injectStyles("j0n4t-pg-editor-btn-styles", PresetEditor.EDITOR_BTN_STYLES);
    PresetUtils.injectStyles("j0n4t-pg-editor-preview-styles", PresetEditor.EDITOR_PREVIEW_STYLES);

    this.rawPresetManager = new RawTextareaManager(
      this.dom.inpPreset,
      this.context,
      this.editingKey,
      () => {
        if (this.currentMode === "edit" && this.isSaved) {
          this.isSaved = false;
          this.updateBanner();
        }
      });

    this.bindEvents();
    this.initFolderAutocomplete();
  }

  renderPreview() {
    const rmBtnHtml = `<div class="j0n4t-pg-corner-edit" id="j0n4t-pg-rm-img-btn" tabindex="0" role="button" title="Remove Image" aria-label="Remove Image">${PresetUtils.icons.close}</div>`;
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
        this.dom.editorPreview.innerHTML = `${rmBtnHtml}<img src="${imgSrc}" alt="Preset preview" />`;
        return;
      }
    }

    const uniqueKey =
      (this.dom.inpFolder.value.trim()
        ? `${this.dom.inpFolder.value.trim()}/`
        : "") + (this.dom.inpName.value.trim() || "New");
    this.dom.editorPreview.innerHTML = `<div style="background-color: ${PresetUtils.getPresetColor(uniqueKey, this.context.cache) || ""}; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#fff; position:absolute;" aria-hidden="true">${PresetUtils.icons.file}<div class="j0n4t-pg-initials" style="font-size:14px;">${PresetUtils.escapeHTML(PresetUtils.getPresetInitials(uniqueKey))}</div></div>`;
  }

  updateBanner() {
    const { banner, btnSave } = this.dom;
    if (this.currentMode === "new") {
      banner.innerText = "✨ Creating New Preset";
      banner.title = "✨ Creating New Preset";
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
      banner.innerText = "📝 Select an Item";
      banner.title = "📝 Select an Item";
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
    this.isSaved = true;
    this.dom.inpName.value = "";
    this.dom.inpFolder.value = "";
    this.dom.inpPreset.value = "";
    this.rawPresetManager.updateHighlights();
    this.resetImageState();
    this.updateBanner();
    this.context.syncEditorHighlight();
  }

  async openPreset(styleKey, focus = false) {
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
    this.rawPresetManager.updateHighlights(styleKey);

    if (this.context.cache[styleKey].filename) {
      this.dom.editor.classList.replace("no-image", "has-image");
    }
    this.renderPreview();

    this.updateBanner();
    this.context.syncEditorHighlight();
    if (focus) this.dom.inpPreset.focus();
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

    if (!selections.includes(uniqueKey) && !selections.includes(this.dom.inpPreset.value.trim())) selections.push(uniqueKey);

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
      if (this.isSaved) {
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

    this.dom.editorPreview.addEventListener("keydown", async (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (e.target.closest("#j0n4t-pg-rm-img-btn")) {
          e.stopPropagation();
          if (await PresetUtils.confirm("Clear image?")) {
            this.resetImageState();
            markDirty();
          }
        } else {
          this.dom.inpFile.click();
        }
      }
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