import { app } from "../../../scripts/app.js";

const MIN_NODE_HEIGHT = 640; 
const MIN_NODE_WIDTH = 400;

const styles = document.createElement("style");
styles.textContent = `
    .j0n4t-pg-wrap { display: flex; flex-direction: column; gap: 8px; padding: 10px; background: #222; border-radius: 4px; box-sizing: border-box; width: 100%; height: 100%; font-family: sans-serif; }
    
    /* Basket Styling */
    .j0n4t-pg-basket-container { display: flex; flex-direction: column; gap: 4px; background: #151515; border: 1px dashed #444; border-radius: 4px; padding: 6px; box-sizing: border-box; width: 100%; flex-shrink: 0; transition: border-color 0.2s, background-color 0.2s; }
    .j0n4t-pg-basket-container.drag-over { border-color: #007acc; background: #1a242d; }
    .j0n4t-pg-basket-title { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; margin-bottom: 2px; pointer-events: none; }
    .j0n4t-pg-basket-pool { display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; align-items: center; }
    .j0n4t-pg-basket-empty { font-size: 10px; color: #555; font-style: italic; pointer-events: none; }
    
    .j0n4t-pg-basket-chip { display: flex; align-items: center; gap: 4px; background: #2a2a2a; border: 1px solid #3d3d3d; border-radius: 3px; padding: 2px 4px; box-sizing: border-box; cursor: grab; user-select: none; transition: background 0.15s; }
    .j0n4t-pg-basket-chip:active { cursor: grabbing; }
    .j0n4t-pg-basket-chip.dragging { opacity: 0.4; border-color: #007acc; }
    .j0n4t-pg-basket-chip-thumb { width: 16px; height: 16px; border-radius: 2px; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 900; color: #fff; text-shadow: 0 1px 1px #000; flex-shrink: 0; }
    .j0n4t-pg-basket-chip-label { font-size: 10px; color: #ddd; white-space: nowrap; max-width: 80px; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
    .j0n4t-pg-basket-chip-del { display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; color: #888; border-radius: 2px; cursor: pointer; transition: 0.1s; margin-left: 2px; }
    .j0n4t-pg-basket-chip-del:hover { background: #b23b3b; color: #fff; }
    .j0n4t-pg-basket-chip-del svg { width: 10px; height: 10px; fill: currentColor; }

    .j0n4t-pg-top-bar { display: flex; gap: 6px; align-items: center; width: 100%; flex-shrink: 0; }
    .j0n4t-pg-search { flex-grow: 1; padding: 6px; background: #1a1a1a; border: 1px solid #444; border-radius: 4px; color: #fff; font-size: 11px; box-sizing: border-box; min-width: 0; }
    .j0n4t-pg-views { display: flex; gap: 2px; flex-shrink: 0; background: #1a1a1a; padding: 2px; border-radius: 4px; border: 1px solid #444; }
    .j0n4t-pg-view-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 3px; cursor: pointer; color: #aaa; background: transparent; transition: 0.15s; }
    .j0n4t-pg-view-btn:hover { background: #333; color: #fff; }
    .j0n4t-pg-view-btn.active { background: #007acc; color: #fff; }
    .j0n4t-pg-view-btn svg, .j0n4t-pg-btn svg { width: 14px; height: 14px; fill: currentColor; }
    
    .j0n4t-pg-grid { display: grid; gap: 6px; flex-grow: 1; overflow-y: auto; min-height: 60px; align-content: start; margin-top: 2px; }
    .j0n4t-pg-grid.view-small { grid-template-columns: repeat(auto-fill, minmax(55px, 1fr)); }
    .j0n4t-pg-grid.view-big { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
    .j0n4t-pg-grid.view-list { grid-template-columns: 1fr; gap: 4px; }
    
    .j0n4t-pg-group-header { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; margin: 8px 0 4px 0; color: #007acc; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; user-select: none; }
    .j0n4t-pg-group-header::after { content: ""; flex-grow: 1; height: 1px; background: #3d3d3d; }
    .j0n4t-pg-grid.hide-folders .j0n4t-pg-group-header { display: none !important; }
    
    .j0n4t-pg-item { cursor: grab; text-align: center; border: 2px solid transparent; border-radius: 4px; padding: 4px; background: #1a1a1a; transition: 0.1s; height: fit-content; box-sizing: border-box; user-select: none; position: relative; }
    .j0n4t-pg-item:active { cursor: grabbing; }
    .j0n4t-pg-item:hover { background: #2a2a2a; border-color: #444; }
    .j0n4t-pg-item.selected { border-color: #007acc; background: #252525; }
    .j0n4t-pg-item.dragging { opacity: 0.4; }
    .j0n4t-pg-hidden { display: none !important; }
    
    .j0n4t-pg-thumb-box { width: 100%; height: 100px; border-radius: 2px; display: flex; align-items: center; justify-content: center; background: #111; color: #666; position: relative; overflow: hidden; pointer-events: none; }
    .j0n4t-pg-grid.view-small .j0n4t-pg-thumb-box { height: 50px; }
    .j0n4t-pg-img { width: 100%; height: 100%; object-fit: cover; }
    .j0n4t-pg-icon { width: 20px; height: 20px; fill: currentColor; }
    .j0n4t-pg-initials { position: absolute; font-size: 10px; font-weight: 900; color: #fff; text-shadow: 0px 1px 2px rgba(0,0,0,0.9), 0px 0px 4px rgba(0,0,0,0.7); text-transform: uppercase; bottom: 4px; z-index: 2; pointer-events: none; letter-spacing: 0.5px; }
    .j0n4t-pg-label { font-size: 10px; color: #ccc; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
    .j0n4t-pg-tag-badge { position: absolute; top: 6px; right: 6px; background: rgba(0,122,204,0.85); color: #fff; font-size: 7.5px; font-weight: bold; padding: 1px 4px; border-radius: 2px; text-transform: uppercase; pointer-events: none; max-width: 50px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; z-index: 3; }
    
    .view-list .j0n4t-pg-item { display: flex; align-items: center; gap: 8px; text-align: left; padding: 4px 6px; }
    .view-list .j0n4t-pg-thumb-box { width: 32px; height: 32px; flex-shrink: 0; }
    .view-list .j0n4t-pg-icon { width: 14px; height: 14px; }
    .view-list .j0n4t-pg-initials { display: none; }
    .view-list .j0n4t-pg-label { margin-top: 0; font-size: 11px; flex-grow: 1; }
    .view-list .j0n4t-pg-tag-badge { position: relative; top: auto; right: auto; background: #444; color: #bbb; max-width: none; font-size: 9px; }
    .j0n4t-pg-grid.hide-folders .j0n4t-pg-tag-badge { display: block !important; }
    
    .j0n4t-pg-control-bar { display: flex; gap: 6px; align-items: center; margin-top: 2px; flex-shrink: 0; width: 100%; }
    .j0n4t-pg-toggle { flex-grow: 1; background: #333; border: 1px solid #444; color: #bbb; padding: 4px; border-radius: 3px; cursor: pointer; font-size: 10px; text-align: center; user-select: none; white-space: nowrap; }
    .j0n4t-pg-toggle:hover { background: #444; color: #fff; }
    .j0n4t-pg-checkbox-wrap { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #aaa; user-select: none; cursor: pointer; padding: 3px 2px; height: 20px; box-sizing: border-box; white-space: nowrap; }
    .j0n4t-pg-checkbox-wrap input { width: auto; margin: 0; cursor: pointer; }
    
    .j0n4t-pg-editor { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid #3d3d3d; padding-top: 8px; margin-top: 2px; box-sizing: border-box; flex-shrink: 0; }
    .j0n4t-pg-editor.collapsed { display: none !important; }
    .j0n4t-pg-editor input, .j0n4t-pg-editor textarea { background: #1a1a1a; border: 1px solid #444; color: #fff; font-size: 11px; padding: 5px; border-radius: 3px; box-sizing: border-box; width: 100%; }
    .j0n4t-pg-editor textarea { resize: vertical; min-height: 65px; }
    .j0n4t-pg-row { display: flex; gap: 6px; align-items: center; }
    
    .j0n4t-pg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: #007acc; border: none; color: #fff; padding: 6px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold; width: 100%; text-align: center; box-sizing: border-box; height: 28px; }
    .j0n4t-pg-btn:hover { background: #0062a3; }
    
    .j0n4t-pg-mode-toggle { display: flex; width: 100%; background: #1a1a1a; border: 1px solid #444; border-radius: 4px; overflow: hidden; padding: 2px; box-sizing: border-box; }
    .j0n4t-pg-mode-btn { flex: 1; border: none; background: transparent; color: #888; font-size: 10px; font-weight: bold; padding: 4px 0; cursor: pointer; text-transform: uppercase; text-align: center; border-radius: 3px; transition: 0.15s; }
    .j0n4t-pg-mode-btn.active { background: #007acc; color: #fff; }
    .j0n4t-pg-mode-btn.mode-new.active { background: #228b22; }

    .has-image .no-img-state, .no-image .has-img-state { display: none !important; }
`;
document.head.appendChild(styles);

app.registerExtension({
    name: "Comfy.PresetGallery",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "PresetGalleryNode") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);

            const widget = this.widgets.find(w => w.name === "preset_selection");
            if (!widget) return;

            const MAX_HEIGHT = 60;
            widget.computeSize = function (width) {
                return [width || 220, MAX_HEIGHT];
            };

            let cache = {};
            let fetchedBlobImage = null;
            let lastSelectedKey = "";
            let currentMode = "edit";
            const node = this;
            const wrap = Object.assign(document.createElement("div"), { className: "j0n4t-pg-wrap" });

            wrap.innerHTML = `
                <div class="j0n4t-pg-basket-container">
                    <div class="j0n4t-pg-basket-title">🧺 Presets Basket (Drag to reorder)</div>
                    <div class="j0n4t-pg-basket-pool">
                        <span class="j0n4t-pg-basket-empty">No presets selected</span>
                    </div>
                </div>

                <div class="j0n4t-pg-top-bar">
                    <input type="text" class="j0n4t-pg-search" placeholder="Filter presets or folders..." />
                    <div class="j0n4t-pg-views">
                        <div class="j0n4t-pg-view-btn" data-view="small" title="Small Grid"><svg viewBox="0 0 16 16"><rect x="1" y="1" width="3" height="3"/><rect x="6" y="1" width="3" height="3"/><rect x="11" y="1" width="3" height="3"/><rect x="1" y="6" width="3" height="3"/><rect x="6" y="6" width="3" height="3"/><rect x="11" y="6" width="3" height="3"/><rect x="1" y="11" width="3" height="3"/><rect x="6" y="11" width="3" height="3"/><rect x="11" y="11" width="3" height="3"/></svg></div>
                        <div class="j0n4t-pg-view-btn" data-view="big" title="Big Grid"><svg viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6"/><rect x="9" y="1" width="6" height="6"/><rect x="1" y="9" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/></svg></div>
                        <div class="j0n4t-pg-view-btn" data-view="list" title="List View"><svg viewBox="0 0 16 16"><rect x="1" y="2" width="3" height="2"/><rect x="6" y="2" width="9" height="2"/><rect x="1" y="7" width="3" height="2"/><rect x="6" y="7" width="9" height="2"/><rect x="1" y="12" width="3" height="2"/><rect x="6" y="12" width="9" height="2"/></svg></div>
                    </div>
                </div>
                <div class="j0n4t-pg-grid"></div>
                <div class="j0n4t-pg-control-bar">
                    <div class="j0n4t-pg-toggle" id="j0n4t-pg-toggle">⚙️ Management Panel</div>
                    <label class="j0n4t-pg-checkbox-wrap"><input type="checkbox" id="j0n4t-pg-group-toggle" />Group Folders</label>
                </div>
                <div class="j0n4t-pg-editor no-image">
                    <div class="j0n4t-pg-row">
                        <div class="j0n4t-pg-mode-toggle">
                            <button type="button" class="j0n4t-pg-mode-btn mode-new" data-mode="new">✨ Create New</button>
                            <button type="button" class="j0n4t-pg-mode-btn mode-edit active" data-mode="edit">📝 Edit Preset</button>
                        </div>
                    </div>
                    <div class="j0n4t-pg-row">
                        <input type="text" id="j0n4t-pg-name" placeholder="Preset Name" style="flex:1;" />
                        <input type="text" id="j0n4t-pg-folder" placeholder="Sub-folder (Optional)" style="flex:1;" />
                    </div>
                    <textarea id="j0n4t-pg-preset" placeholder="Preset Keywords..."></textarea>
                    <div class="j0n4t-pg-row">
                        <input type="file" id="j0n4t-pg-file" accept="image/*" style="display:none;" />
                        
                        <button type="button" id="j0n4t-pg-pick-btn" class="j0n4t-pg-btn no-img-state" style="background:#444;" title="Pick Image">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg> Pick Image
                        </button>
                        <button type="button" id="j0n4t-pg-change-btn" class="j0n4t-pg-btn has-img-state" style="background:#2b5e3b;" title="Change Image">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 8l-4 4h3c0 3.31-2.69 6-6 6c-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6c1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4c-4.42 0-8 3.58-8 8H1l4 4l4-4H6z"/></svg> Change Img
                        </button>
                        <button type="button" id="j0n4t-pg-rm-img-btn" class="j0n4t-pg-btn has-img-state" style="background:#b23b3b;" title="Delete Image Asset Only">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.59l2.12-2.12l1.41 1.41L13.41 14l2.12 2.12l-1.41 1.41L12 15.41l-2.12 2.12l-1.41-1.41L10.59 14l-2.13-2.12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"/></svg> Clear Img
                        </button>

                        <button type="button" id="j0n4t-pg-save-btn" class="j0n4t-pg-btn" title="Save Preset Profile">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm2 16H5V5h11.17L19 7.83V19zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3s3-1.34 3-3s-1.34-3-3-3zM6 6h9v4H6V6z"/></svg> Save
                        </button>
                        <button type="button" id="j0n4t-pg-del-btn" class="j0n4t-pg-btn" style="background:#a32a2a;" title="Permanently Delete Preset Entirely">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg> Delete
                        </button>
                    </div>
                    <div class="j0n4t-pg-row" style="border-top: 1px dashed #444; padding-top: 6px; margin-top: 2px;">
                        <input type="file" id="j0n4t-pg-zip-file" accept=".zip" style="display:none;" />
                        <button type="button" id="j0n4t-pg-import-btn" class="j0n4t-pg-btn" style="background:#555;" title="Import ZIP Pool Package">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg> Import
                        </button>
                        <button type="button" id="j0n4t-pg-export-btn" class="j0n4t-pg-btn" style="background:#555;" title="Export Current Pool Package to ZIP Archive">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg> Export
                        </button>
                    </div>
                </div>
            `;

            const basketContainer = wrap.querySelector(".j0n4t-pg-basket-container");
            const basketPool = wrap.querySelector(".j0n4t-pg-basket-pool");
            const grid = wrap.querySelector(".j0n4t-pg-grid");
            const search = wrap.querySelector(".j0n4t-pg-search");
            const editor = wrap.querySelector(".j0n4t-pg-editor");
            const toggle = wrap.querySelector("#j0n4t-pg-toggle");
            const viewsContainer = wrap.querySelector(".j0n4t-pg-views");
            const chkGroup = wrap.querySelector("#j0n4t-pg-group-toggle");
            const modeToggleContainer = wrap.querySelector(".j0n4t-pg-mode-toggle");
            const inpName = wrap.querySelector("#j0n4t-pg-name");
            const inpFolder = wrap.querySelector("#j0n4t-pg-folder");
            const inpPreset = wrap.querySelector("#j0n4t-pg-preset");
            const inpFile = wrap.querySelector("#j0n4t-pg-file");
            const btnPick = wrap.querySelector("#j0n4t-pg-pick-btn");
            const btnChange = wrap.querySelector("#j0n4t-pg-change-btn");
            const btnRmImg = wrap.querySelector("#j0n4t-pg-rm-img-btn");
            const btnSave = wrap.querySelector("#j0n4t-pg-save-btn");
            const btnDel = wrap.querySelector("#j0n4t-pg-del-btn");
            const inpZipFile = wrap.querySelector("#j0n4t-pg-zip-file");
            const btnImport = wrap.querySelector("#j0n4t-pg-import-btn");
            const btnExport = wrap.querySelector("#j0n4t-pg-export-btn");

            chkGroup.checked = localStorage.getItem("comfy_preset_gallery_grouped") !== "false";
            if (!chkGroup.checked) grid.classList.add("hide-folders");

            const getHashColor = (str) => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    hash = Math.imul(hash ^ str.charCodeAt(i), 15485863);
                }
                hash = (hash ^ (hash >>> 16)) * 0x85ebca6b;
                hash = (hash ^ (hash >>> 13)) * 0xc2b2ae35;
                hash = hash ^ (hash >>> 16);
                const hue = Math.abs(hash) % 360;
                return `hsl(${hue}, 65%, 35%)`;
            };

            const switchView = (viewName) => {
                ['small', 'big', 'list'].forEach(v => grid.classList.remove(`view-${v}`));
                viewsContainer.querySelectorAll(".j0n4t-pg-view-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewName));
                grid.classList.add(`view-${viewName}`);
                localStorage.setItem("comfy_preset_gallery_view", viewName);
            };

            const setPanelCollapseState = (shouldCollapse) => {
                editor.classList.toggle("collapsed", shouldCollapse);
                toggle.innerText = shouldCollapse ? "⚙️ Management Panel" : "🔼 Hide Panel";
                localStorage.setItem("comfy_preset_gallery_collapsed", String(shouldCollapse));
            };

            const getSelectedArray = () => widget.value ? widget.value.split(",").map(v => v.trim()).filter(Boolean) : [];
            const toTitleCase = (str) => str.replace(/_/g, " ").replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());

            const getInitials = (uniqueKey) => {
                const rawLabel = uniqueKey.includes("/") ? uniqueKey.split("/").pop() : uniqueKey;
                return toTitleCase(rawLabel).split(/\s+/)
                    .map(w => w.slice(0, 2))
                    .join('')
                    .substring(0, 6);
            };

            const clearEditorFields = () => {
                fetchedBlobImage = null;
                inpName.value = "";
                inpFolder.value = "";
                inpPreset.value = "";
                inpFile.value = "";
                editor.classList.replace("has-image", "no-image");
            };

            const setMode = (mode) => {
                currentMode = mode;
                modeToggleContainer.querySelectorAll(".j0n4t-pg-mode-btn").forEach(btn => {
                    btn.classList.toggle("active", btn.dataset.mode === mode);
                });

                if (mode === "new") {
                    clearEditorFields();
                } else {
                    syncUI(widget.value);
                }
            };

            const openEditorForPreset = async (styleKey) => {
                setPanelCollapseState(false);
                setMode("edit");
                
                lastSelectedKey = styleKey;
                if (styleKey && cache[styleKey]) {
                    const parts = styleKey.split("/");
                    inpName.value = parts.pop() || "";
                    inpFolder.value = parts.join("/");
                    inpPreset.value = cache[styleKey].preset || "";

                    if (cache[styleKey].filename) {
                        editor.classList.replace("no-image", "has-image");
                        try {
                            const imgUrl = `/custom_node/get_preset_image?filename=${encodeURIComponent(cache[styleKey].filename)}`;
                            const res = await fetch(imgUrl);
                            if (res.ok) fetchedBlobImage = await res.blob();
                        } catch (err) {
                            console.error("Failed to sync asset image stream", err);
                        }
                    } else {
                        editor.classList.replace("has-image", "no-image");
                    }
                    inpFile.value = "";
                }
            };

            const executeFilterPipeline = () => {
                const query = search.value.toLowerCase().trim();
                const items = grid.querySelectorAll(".j0n4t-pg-item");
                const queryWords = query ? query.split(/\s+/) : [];

                items.forEach(el => {
                    const matchBlob = el.dataset.searchBlob;
                    const isVisible = queryWords.length === 0 || queryWords.every(word => matchBlob.includes(word));
                    el.classList.toggle("j0n4t-pg-hidden", !isVisible);
                });

                grid.querySelectorAll(".j0n4t-pg-group-header").forEach(header => {
                    let next = header.nextElementSibling;
                    let hasVisibleChildren = false;
                    while (next && !next.classList.contains("j0n4t-pg-group-header")) {
                        if (!next.classList.contains("j0n4t-pg-hidden")) {
                            hasVisibleChildren = true;
                            break;
                        }
                        next = next.nextElementSibling;
                    }
                    header.classList.toggle("j0n4t-pg-hidden", !hasVisibleChildren);
                });
            };

            const renderBasket = (activeList) => {
                if (activeList.length === 0) {
                    basketPool.innerHTML = `<span class="j0n4t-pg-basket-empty">No presets selected</span>`;
                    return;
                }

                basketPool.innerHTML = "";
                activeList.forEach((styleKey) => {
                    const item = cache[styleKey];
                    const initials = getInitials(styleKey);
                    const cleanLabel = toTitleCase(styleKey.includes("/") ? styleKey.split("/").pop() : styleKey);

                    const chip = Object.assign(document.createElement("div"), {
                        className: "j0n4t-pg-basket-chip",
                        draggable: true,
                        title: `${cleanLabel}`
                    });
                    chip.dataset.id = styleKey;

                    let thumbStyle = `background-color: ${getHashColor(styleKey)};`;
                    if (item?.filename) {
                        thumbStyle = `background-image: url('/custom_node/get_preset_image?filename=${encodeURIComponent(item.filename)}');`;
                    }

                    chip.innerHTML = `
                        <div class="j0n4t-pg-basket-chip-thumb" style="${thumbStyle}">${item?.filename ? '' : initials.slice(0, 4)}</div>
                        <div class="j0n4t-pg-basket-chip-label" title="${styleKey}">${cleanLabel}</div>
                        <div class="j0n4t-pg-basket-chip-del" title="Deselect Preset">
                            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </div>
                    `;

                    chip.querySelector(".j0n4t-pg-basket-chip-del").addEventListener("click", (e) => {
                        e.stopPropagation();
                        let currentSelections = getSelectedArray().filter(v => v !== styleKey);
                        widget.value = currentSelections.join(", ");
                        if (widget.callback) widget.callback(widget.value);
                        if (node.graph) node.graph._version++;
                    });

                    chip.addEventListener("dragstart", (e) => {
                        chip.classList.add("dragging");
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", styleKey);
                        e.dataTransfer.setData("source/basket", "true");
                    });

                    chip.addEventListener("dragend", () => {
                        chip.classList.remove("dragging");
                        reorderSelectionsFromDOM();
                    });

                    chip.addEventListener("dblclick", (e) => {
                        e.stopPropagation();
                        openEditorForPreset(styleKey);
                    });

                    basketPool.appendChild(chip);
                });
            };

            const getDropNextSibling = (container, clientX) => {
                const siblings = [...container.querySelectorAll(".j0n4t-pg-basket-chip:not(.dragging)")];
                return siblings.find(sibling => {
                    const box = sibling.getBoundingClientRect();
                    return clientX <= box.left + box.width / 2;
                });
            };

            basketContainer.addEventListener("dragenter", (e) => {
                e.preventDefault();
                basketContainer.classList.add("drag-over");
            });

            basketContainer.addEventListener("dragover", (e) => {
                e.preventDefault();
                
                const draggingChip = basketPool.querySelector(".j0n4t-pg-basket-chip.dragging");
                if (draggingChip) {
                    const nextSibling = getDropNextSibling(basketPool, e.clientX);
                    basketPool.insertBefore(draggingChip, nextSibling);
                }
            });

            basketContainer.addEventListener("dragleave", (e) => {
                if (e.relatedTarget && basketContainer.contains(e.relatedTarget)) return;
                basketContainer.classList.remove("drag-over");
            });

            basketContainer.addEventListener("drop", (e) => {
                e.preventDefault();
                basketContainer.classList.remove("drag-over");
                
                const styleKey = e.dataTransfer.getData("text/plain");
                if (!styleKey) return;

                const isFromBasket = e.dataTransfer.getData("source/basket");
                if (isFromBasket) {
                    reorderSelectionsFromDOM();
                } else {
                    let currentSelections = getSelectedArray().filter(v => v !== styleKey);
                    const nextSibling = getDropNextSibling(basketPool, e.clientX);
                    if (nextSibling) {
                        const targetId = nextSibling.dataset.id;
                        const insertionIndex = currentSelections.indexOf(targetId);
                        if (insertionIndex !== -1) {
                            currentSelections.splice(insertionIndex, 0, styleKey);
                        } else {
                            currentSelections.push(styleKey);
                        }
                    } else {
                        currentSelections.push(styleKey);
                    }

                    widget.value = currentSelections.join(", ");
                    if (widget.callback) widget.callback(widget.value);
                    if (node.graph) node.graph._version++;
                }
            });

            const reorderSelectionsFromDOM = () => {
                const currentOrder = [...basketPool.querySelectorAll(".j0n4t-pg-basket-chip")].map(chip => chip.dataset.id);
                const uniqueOrder = [...new Set(currentOrder)];
                
                widget.value = uniqueOrder.join(", ");
                grid.querySelectorAll(".j0n4t-pg-item").forEach(el => {
                    el.classList.toggle("selected", uniqueOrder.includes(el.dataset.style));
                });
                if (node.graph) node.graph._version++;
            };

            const compileStaticDOMStructure = () => {
                let htmlBuffer = "";
                let lastGroup = null;

                const sortedKeys = Object.keys(cache).sort((a, b) => {
                    const groupA = cache[a].tags?.length ? cache[a].tags.join(" > ") : "root_presets";
                    const groupB = cache[b].tags?.length ? cache[b].tags.join(" > ") : "root_presets";
                    if (groupA === "root_presets" && groupB !== "root_presets") return -1;
                    if (groupB === "root_presets" && groupA !== "root_presets") return 1;
                    return groupA !== groupB ? groupA.localeCompare(groupB) : a.localeCompare(b);
                });

                sortedKeys.forEach(uniqueKey => {
                    const item = cache[uniqueKey];
                    const rawLabel = uniqueKey.includes("/") ? uniqueKey.split("/").pop() : uniqueKey;
                    const cleanLabel = toTitleCase(rawLabel);
                    const initials = getInitials(uniqueKey);

                    const searchBlob = `${uniqueKey} ${initials} ${item.preset} ${(item.tags || []).join(' ')}`.toLowerCase();
                    const uiGroupTitle = item.tags?.length ? item.tags.map(toTitleCase).join(" › ") : "Root Presets";

                    if (uiGroupTitle !== lastGroup) {
                        lastGroup = uiGroupTitle;
                        htmlBuffer += `<div class="j0n4t-pg-group-header" data-group="${uiGroupTitle}">${uiGroupTitle}</div>`;
                    }

                    let thumbnailHtml = "";
                    if (item.filename) {
                        thumbnailHtml = `
                            <div class="j0n4t-pg-thumb-box">
                                <img class="j0n4t-pg-img" src="/custom_node/get_preset_image?filename=${encodeURIComponent(item.filename)}" alt="${uniqueKey}" loading="lazy">
                                <div class="j0n4t-pg-initials">${initials}</div>
                            </div>`;
                    } else {
                        thumbnailHtml = `
                            <div class="j0n4t-pg-thumb-box" style="background-color: ${getHashColor(uniqueKey)}; color: #fff;">
                                <svg class="j0n4t-pg-icon" viewBox="0 0 24 24" style="opacity: 0.25; color: #fff;"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                                <div class="j0n4t-pg-initials">${initials}</div>
                            </div>`;
                    }

                    const badge = item.tags?.length
                        ? `<div class="j0n4t-pg-tag-badge" title="${item.tags.map(toTitleCase).join(' > ')}">${toTitleCase(item.tags[item.tags.length - 1])}</div>`
                        : '';

                    htmlBuffer += `
                        <div class="j0n4t-pg-item" data-style="${uniqueKey}" data-search-blob="${searchBlob}" draggable="true" title="${cleanLabel}">
                            ${badge}
                            ${thumbnailHtml}
                            <div class="j0n4t-pg-label">${cleanLabel}</div>
                        </div>
                    `;
                });

                grid.innerHTML = htmlBuffer || `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#666; font-size:11px;">No presets found</div>`;
                
                grid.querySelectorAll(".j0n4t-pg-item").forEach(item => {
                    item.addEventListener("dragstart", (e) => {
                        item.classList.add("dragging");
                        e.dataTransfer.effectAllowed = "copyMove";
                        e.dataTransfer.setData("text/plain", item.dataset.style);
                        e.dataTransfer.setData("source/grid", "true");
                    });
                    item.addEventListener("dragend", () => {
                        item.classList.remove("dragging");
                    });
                });

                switchView(localStorage.getItem("comfy_preset_gallery_view") || "big");
                executeFilterPipeline();
            };

            const loadGallery = async () => {
                const response = await fetch('/custom_node/live_preset_gallery');
                cache = await response.json();
                compileStaticDOMStructure();
            };

            const syncUI = async (delimitedValue) => {
                const activeList = delimitedValue ? delimitedValue.split(",").map(v => v.trim()).filter(Boolean) : [];
                
                grid.querySelectorAll(".j0n4t-pg-item").forEach(el => {
                    el.classList.toggle("selected", activeList.includes(el.dataset.style));
                });

                renderBasket(activeList);

                const primaryKey = activeList[activeList.length - 1];
                fetchedBlobImage = null;
                lastSelectedKey = primaryKey || "";

                if (currentMode === "new") return;

                if (primaryKey && cache[primaryKey]) {
                    const parts = primaryKey.split("/");
                    inpName.value = parts.pop() || "";
                    inpFolder.value = parts.join("/");
                    inpPreset.value = cache[primaryKey].preset || "";

                    if (cache[primaryKey].filename) {
                        editor.classList.replace("no-image", "has-image");
                        try {
                            const imgUrl = `/custom_node/get_preset_image?filename=${encodeURIComponent(cache[primaryKey].filename)}`;
                            const res = await fetch(imgUrl);
                            if (res.ok) fetchedBlobImage = await res.blob();
                        } catch (err) {
                            console.error("Failed to sync asset image stream", err);
                        }
                    } else {
                        editor.classList.replace("has-image", "no-image");
                    }
                    inpFile.value = "";
                } else {
                    inpName.value = ""; inpFolder.value = ""; inpPreset.value = "";
                    editor.classList.replace("has-image", "no-image");
                }
            };

            toggle.addEventListener("click", () => setPanelCollapseState(!editor.classList.contains("collapsed")));
            viewsContainer.addEventListener("click", (e) => {
                const btn = e.target.closest(".j0n4t-pg-view-btn");
                if (btn) switchView(btn.dataset.view);
            });

            chkGroup.addEventListener("change", () => {
                localStorage.setItem("comfy_preset_gallery_grouped", String(chkGroup.checked));
                grid.classList.toggle("hide-folders", !chkGroup.checked);
                executeFilterPipeline();
            });

            search.addEventListener("input", executeFilterPipeline);

            modeToggleContainer.addEventListener("click", (e) => {
                const btn = e.target.closest(".j0n4t-pg-mode-btn");
                if (btn) setMode(btn.dataset.mode);
            });

            const baseCallback = widget.callback;
            widget.callback = function (value) { syncUI(value); baseCallback?.apply(this, arguments); };

            grid.addEventListener("click", (e) => {
                const item = e.target.closest(".j0n4t-pg-item");
                if (!item || !widget.callback) return;

                const styleKey = item.dataset.style;
                let selections = getSelectedArray();

                selections = selections.includes(styleKey) ? selections.filter(v => v !== styleKey) : [...selections, styleKey];

                widget.value = selections.join(", ");
                widget.callback(widget.value);

                if (currentMode === "new") {
                    setMode("edit");
                }
                if (node.graph) node.graph._version++;
            });

            grid.addEventListener("dblclick", (e) => {
                const item = e.target.closest(".j0n4t-pg-item");
                if (!item) return;
                
                e.stopPropagation();
                openEditorForPreset(item.dataset.style);
            });

            btnPick.addEventListener("click", () => inpFile.click());
            btnChange.addEventListener("click", () => inpFile.click());

            inpFile.addEventListener("change", () => {
                if (inpFile.files[0]) {
                    fetchedBlobImage = null;
                    editor.classList.replace("no-image", "has-image");
                }
            });

            btnRmImg.addEventListener("click", () => {
                if (!confirm("Clear this image attachment placeholder? Image will be deleted instantly on next save commit.")) return;
                fetchedBlobImage = null;
                inpFile.value = "";
                editor.classList.replace("has-image", "no-image");
            });

            const handleEnterKeySave = (e) => {
                if (e.key === "Enter") {
                    if (e.target.tagName === "TEXTAREA" && e.shiftKey) {
                        return; 
                    }
                    e.preventDefault();
                    btnSave.click();
                }
            };

            inpName.addEventListener("keydown", handleEnterKeySave);
            inpFolder.addEventListener("keydown", handleEnterKeySave);
            inpPreset.addEventListener("keydown", handleEnterKeySave);

            btnSave.addEventListener("click", async () => {
                const name = inpName.value.trim().toLowerCase().replace(/ /g, "_");
                if (!name) return alert("Preset Name required.");

                const folder = inpFolder.value.trim().toLowerCase().replace(/ /g, "_");
                const uniqueKey = folder ? `${folder}/${name}` : name;

                let shouldDeleteOriginal = false;
                let currentSelections = getSelectedArray();

                if (currentMode === "edit") {
                    if (lastSelectedKey && lastSelectedKey !== uniqueKey) {
                        shouldDeleteOriginal = true;
                    }
                } else if (cache[uniqueKey] && !confirm(`"${uniqueKey}" already exists. Overwrite?`)) {
                    return;
                }

                const fd = new FormData();
                fd.append("preset_name", name);
                fd.append("subfolder", folder);
                fd.append("preset_text", inpPreset.value.trim());
                fd.append("overwrite", "true");

                if (inpFile.files[0]) {
                    fd.append("image_file", inpFile.files[0]);
                } else if (fetchedBlobImage) {
                    fd.append("image_file", fetchedBlobImage, "image.jpg");
                } else {
                    fd.append("clear_image", "true");
                }

                const res = await (await fetch('/custom_node/save_preset_item', { method: 'POST', body: fd })).json();

                if (res.success && shouldDeleteOriginal) {
                    await fetch('/custom_node/delete_preset_item', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ unique_key: lastSelectedKey })
                    });
                    
                    currentSelections = currentSelections.map(item => item === lastSelectedKey ? uniqueKey : item);
                } else if (res.success && currentMode === "new") {
                    if (!currentSelections.includes(uniqueKey)) {
                        currentSelections.push(uniqueKey);
                    }
                }

                if (!res.success) return alert(`Save failed: ${res.error}`);

                await loadGallery();

                if (currentMode === "new") {
                    setMode("edit");
                }

                widget.value = currentSelections.join(", ");
                if (widget.callback) widget.callback(widget.value);
            });

            btnDel.addEventListener("click", async () => {
                const selections = getSelectedArray();
                const uniqueKey = selections[selections.length - 1];
                if (!uniqueKey || !cache[uniqueKey]) return alert("Select an item to delete.");
                if (!confirm(`Permanently delete "${uniqueKey}"?`)) return;

                await fetch('/custom_node/delete_preset_item', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ unique_key: uniqueKey })
                });

                await loadGallery();
                
                const nextSelections = selections.filter(v => v !== uniqueKey);
                widget.value = nextSelections.join(", ");
                if (widget.callback) widget.callback(nextSelections.join(", "));
            });

            btnExport.addEventListener("click", () => window.open('/custom_node/export_presets_zip', '_blank'));
            btnImport.addEventListener("click", () => inpZipFile.click());
            inpZipFile.addEventListener("change", async () => {
                if (!inpZipFile.files[0]) return;
                const fd = new FormData();
                fd.append("zip_file", inpZipFile.files[0]);

                const res = await (await fetch('/custom_node/import_presets_zip', { method: 'POST', body: fd })).json();
                inpZipFile.value = "";

                if (res.success) {
                    await loadGallery();
                    widget.value = "";
                    if (widget.callback) widget.callback("");
                    alert("Presets tree imported successfully!");
                }
            });

            (async () => {
                await loadGallery();
                if (widget.value) {
                    await syncUI(widget.value);
                }
                setPanelCollapseState(localStorage.getItem("comfy_preset_gallery_collapsed") === "true");
                node.setSize([node.size[0] || MIN_NODE_WIDTH, node.size[1] || MIN_NODE_HEIGHT]);
            })();

            this.addDOMWidget("preset_gallery_ui", "HTML", wrap);
        };
    },

    async nodeCreated(node) {
        if (node.comfyClass === "PresetGalleryNode") {
            node.size = [MIN_NODE_WIDTH, MIN_NODE_HEIGHT];
            node.properties = node.properties || {};
            node.min_size = [MIN_NODE_WIDTH, MIN_NODE_HEIGHT];
        }
    }
});