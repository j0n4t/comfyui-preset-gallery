import { app } from "../../../scripts/app.js";

const MIN_NODE_HEIGHT = 580;
const MIN_NODE_WIDTH = 400;

const styles = document.createElement("style");
styles.textContent = `
    .pg-wrap { display: flex; flex-direction: column; gap: 8px; padding: 10px; background: #222; border-radius: 4px; box-sizing: border-box; width: 100%; height: 100%; font-family: sans-serif; }
    .pg-top-bar { display: flex; gap: 6px; align-items: center; width: 100%; flex-shrink: 0; }
    .pg-search { flex-grow: 1; padding: 6px; background: #1a1a1a; border: 1px solid #444; border-radius: 4px; color: #fff; font-size: 11px; box-sizing: border-box; min-width: 0; }
    .pg-views { display: flex; gap: 2px; flex-shrink: 0; background: #1a1a1a; padding: 2px; border-radius: 4px; border: 1px solid #444; }
    .pg-view-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 3px; cursor: pointer; color: #aaa; background: transparent; transition: 0.15s; }
    .pg-view-btn:hover { background: #333; color: #fff; }
    .pg-view-btn.active { background: #007acc; color: #fff; }
    .pg-view-btn svg, .pg-btn svg { width: 14px; height: 14px; fill: currentColor; }
    
    .pg-grid { display: grid; gap: 6px; flex-grow: 1; overflow-y: auto; min-height: 60px; align-content: start; margin-top: 2px; }
    .pg-grid.view-small { grid-template-columns: repeat(auto-fill, minmax(55px, 1fr)); }
    .pg-grid.view-big { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
    .pg-grid.view-list { grid-template-columns: 1fr; gap: 4px; }
    
    .pg-group-header { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; margin: 8px 0 4px 0; color: #007acc; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; user-select: none; }
    .pg-group-header::after { content: ""; flex-grow: 1; height: 1px; background: #3d3d3d; }
    .pg-grid.hide-folders .pg-group-header { display: none !important; }
    
    .pg-item { cursor: pointer; text-align: center; border: 2px solid transparent; border-radius: 4px; padding: 4px; background: #1a1a1a; transition: 0.1s; height: fit-content; box-sizing: border-box; user-select: none; position: relative; }
    .pg-item:hover { background: #2a2a2a; border-color: #444; }
    .pg-item.selected { border-color: #007acc; background: #252525; }
    .pg-hidden { display: none !important; }
    
    .pg-thumb-box { width: 100%; height: 100px; border-radius: 2px; display: flex; align-items: center; justify-content: center; background: #111; color: #666; position: relative; overflow: hidden; }
    .pg-grid.view-small .pg-thumb-box { height: 50px; }
    .pg-img { width: 100%; height: 100%; object-fit: cover; }
    .pg-icon { width: 20px; height: 20px; fill: currentColor; }
    .pg-initials { position: absolute; font-size: 10px; font-weight: 900; color: #fff; text-shadow: 0px 1px 2px rgba(0,0,0,0.9), 0px 0px 4px rgba(0,0,0,0.7); text-transform: uppercase; bottom: 4px; z-index: 2; pointer-events: none; letter-spacing: 0.5px; }
    .pg-label { font-size: 10px; color: #ccc; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pg-tag-badge { position: absolute; top: 6px; right: 6px; background: rgba(0,122,204,0.85); color: #fff; font-size: 7.5px; font-weight: bold; padding: 1px 4px; border-radius: 2px; text-transform: uppercase; pointer-events: none; max-width: 50px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; z-index: 3; }
    
    .view-list .pg-item { display: flex; align-items: center; gap: 8px; text-align: left; padding: 4px 6px; }
    .view-list .pg-thumb-box { width: 32px; height: 32px; flex-shrink: 0; }
    .view-list .pg-icon { width: 14px; height: 14px; }
    .view-list .pg-initials { display: none; }
    .view-list .pg-label { margin-top: 0; font-size: 11px; flex-grow: 1; }
    .view-list .pg-tag-badge { position: relative; top: auto; right: auto; background: #444; color: #bbb; max-width: none; font-size: 9px; }
    .pg-grid.hide-folders .pg-tag-badge { display: block !important; }
    
    .pg-control-bar { display: flex; gap: 6px; align-items: center; margin-top: 2px; flex-shrink: 0; width: 100%; }
    .pg-toggle { flex-grow: 1; background: #333; border: 1px solid #444; color: #bbb; padding: 4px; border-radius: 3px; cursor: pointer; font-size: 10px; text-align: center; user-select: none; white-space: nowrap; }
    .pg-toggle:hover { background: #444; color: #fff; }
    .pg-checkbox-wrap { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #aaa; user-select: none; cursor: pointer; padding: 3px 2px; height: 20px; box-sizing: border-box; white-space: nowrap; }
    .pg-checkbox-wrap input { width: auto; margin: 0; cursor: pointer; }
    
    .pg-editor { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid #3d3d3d; padding-top: 8px; margin-top: 2px; box-sizing: border-box; flex-shrink: 0; }
    .pg-editor.collapsed { display: none !important; }
    .pg-editor input, .pg-editor textarea { background: #1a1a1a; border: 1px solid #444; color: #fff; font-size: 11px; padding: 5px; border-radius: 3px; box-sizing: border-box; width: 100%; }
    .pg-editor textarea { resize: vertical; min-height: 65px; }
    .pg-row { display: flex; gap: 6px; align-items: center; }
    
    .pg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: #007acc; border: none; color: #fff; padding: 6px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold; width: 100%; text-align: center; box-sizing: border-box; height: 28px; }
    .pg-btn:hover { background: #0062a3; }
    
    .pg-mode-toggle { display: flex; width: 100%; background: #1a1a1a; border: 1px solid #444; border-radius: 4px; overflow: hidden; padding: 2px; box-sizing: border-box; }
    .pg-mode-btn { flex: 1; border: none; background: transparent; color: #888; font-size: 10px; font-weight: bold; padding: 4px 0; cursor: pointer; text-transform: uppercase; text-align: center; border-radius: 3px; transition: 0.15s; }
    .pg-mode-btn.active { background: #007acc; color: #fff; }
    .pg-mode-btn.mode-new.active { background: #228b22; }

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
            const wrap = Object.assign(document.createElement("div"), { className: "pg-wrap" });

            wrap.innerHTML = `
                <div class="pg-top-bar">
                    <input type="text" class="pg-search" placeholder="Filter presets or folders... (Ctrl+Click to multi-select)" />
                    <div class="pg-views">
                        <div class="pg-view-btn" data-view="small" title="Small Grid"><svg viewBox="0 0 16 16"><rect x="1" y="1" width="3" height="3"/><rect x="6" y="1" width="3" height="3"/><rect x="11" y="1" width="3" height="3"/><rect x="1" y="6" width="3" height="3"/><rect x="6" y="6" width="3" height="3"/><rect x="11" y="6" width="3" height="3"/><rect x="1" y="11" width="3" height="3"/><rect x="6" y="11" width="3" height="3"/><rect x="11" y="11" width="3" height="3"/></svg></div>
                        <div class="pg-view-btn" data-view="big" title="Big Grid"><svg viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6"/><rect x="9" y="1" width="6" height="6"/><rect x="1" y="9" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/></svg></div>
                        <div class="pg-view-btn" data-view="list" title="List View"><svg viewBox="0 0 16 16"><rect x="1" y="2" width="3" height="2"/><rect x="6" y="2" width="9" height="2"/><rect x="1" y="7" width="3" height="2"/><rect x="6" y="7" width="9" height="2"/><rect x="1" y="12" width="3" height="2"/><rect x="6" y="12" width="9" height="2"/></svg></div>
                    </div>
                </div>
                <div class="pg-grid"></div>
                <div class="pg-control-bar">
                    <div class="pg-toggle" id="pg-toggle">⚙️ Management Panel</div>
                    <label class="pg-checkbox-wrap"><input type="checkbox" id="pg-group-toggle" />Group Folders</label>
                </div>
                <div class="pg-editor no-image">
                    <div class="pg-row">
                        <div class="pg-mode-toggle">
                            <button type="button" class="pg-mode-btn mode-new" data-mode="new">✨ Create New</button>
                            <button type="button" class="pg-mode-btn mode-edit active" data-mode="edit">📝 Edit Preset</button>
                        </div>
                    </div>
                    <div class="pg-row">
                        <input type="text" id="pg-name" placeholder="Preset Name" style="flex:1;" />
                        <input type="text" id="pg-folder" placeholder="Sub-folder (Optional)" style="flex:1;" />
                    </div>
                    <textarea id="pg-preset" placeholder="Preset Keywords..."></textarea>
                    <div class="pg-row">
                        <input type="file" id="pg-file" accept="image/*" style="display:none;" />
                        
                        <button type="button" id="pg-pick-btn" class="pg-btn no-img-state" style="background:#444;" title="Pick Image">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg> Pick Image
                        </button>
                        <button type="button" id="pg-change-btn" class="pg-btn has-img-state" style="background:#2b5e3b;" title="Change Image">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 8l-4 4h3c0 3.31-2.69 6-6 6c-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6c1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4c-4.42 0-8 3.58-8 8H1l4 4l4-4H6z"/></svg> Change Img
                        </button>
                        <button type="button" id="pg-rm-img-btn" class="pg-btn has-img-state" style="background:#b23b3b;" title="Delete Image Asset Only">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.59l2.12-2.12l1.41 1.41L13.41 14l2.12 2.12l-1.41 1.41L12 15.41l-2.12 2.12l-1.41-1.41L10.59 14l-2.13-2.12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"/></svg> Clear Img
                        </button>

                        <button type="button" id="pg-save-btn" class="pg-btn" title="Save Preset Profile">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm2 16H5V5h11.17L19 7.83V19zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3s3-1.34 3-3s-1.34-3-3-3zM6 6h9v4H6V6z"/></svg> Save
                        </button>
                        <button type="button" id="pg-del-btn" class="pg-btn" style="background:#a32a2a;" title="Permanently Delete Preset Entirely">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg> Delete
                        </button>
                    </div>
                    <div class="pg-row" style="border-top: 1px dashed #444; padding-top: 6px; margin-top: 2px;">
                        <input type="file" id="pg-zip-file" accept=".zip" style="display:none;" />
                        <button type="button" id="pg-import-btn" class="pg-btn" style="background:#555;" title="Import ZIP Pool Package">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg> Import
                        </button>
                        <button type="button" id="pg-export-btn" class="pg-btn" style="background:#555;" title="Export Current Pool Package to ZIP Archive">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg> Export
                        </button>
                    </div>
                </div>
            `;

            const grid = wrap.querySelector(".pg-grid");
            const search = wrap.querySelector(".pg-search");
            const editor = wrap.querySelector(".pg-editor");
            const toggle = wrap.querySelector("#pg-toggle");
            const viewsContainer = wrap.querySelector(".pg-views");
            const chkGroup = wrap.querySelector("#pg-group-toggle");
            const modeToggleContainer = wrap.querySelector(".pg-mode-toggle");
            const inpName = wrap.querySelector("#pg-name");
            const inpFolder = wrap.querySelector("#pg-folder");
            const inpPreset = wrap.querySelector("#pg-preset");
            const inpFile = wrap.querySelector("#pg-file");
            const btnPick = wrap.querySelector("#pg-pick-btn");
            const btnChange = wrap.querySelector("#pg-change-btn");
            const btnRmImg = wrap.querySelector("#pg-rm-img-btn");
            const btnSave = wrap.querySelector("#pg-save-btn");
            const btnDel = wrap.querySelector("#pg-del-btn");
            const inpZipFile = wrap.querySelector("#pg-zip-file");
            const btnImport = wrap.querySelector("#pg-import-btn");
            const btnExport = wrap.querySelector("#pg-export-btn");

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
                viewsContainer.querySelectorAll(".pg-view-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewName));
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
                modeToggleContainer.querySelectorAll(".pg-mode-btn").forEach(btn => {
                    btn.classList.toggle("active", btn.dataset.mode === mode);
                });

                if (mode === "new") {
                    clearEditorFields();
                } else {
                    syncUI(widget.value);
                }
            };

            const executeFilterPipeline = () => {
                const query = search.value.toLowerCase().trim();
                const items = grid.querySelectorAll(".pg-item");
                const queryWords = query ? query.split(/\s+/) : [];

                items.forEach(el => {
                    const matchBlob = el.dataset.searchBlob;
                    const isVisible = queryWords.length === 0 || queryWords.every(word => matchBlob.includes(word));
                    el.classList.toggle("pg-hidden", !isVisible);
                });

                grid.querySelectorAll(".pg-group-header").forEach(header => {
                    let next = header.nextElementSibling;
                    let hasVisibleChildren = false;
                    while (next && !next.classList.contains("pg-group-header")) {
                        if (!next.classList.contains("pg-hidden")) {
                            hasVisibleChildren = true;
                            break;
                        }
                        next = next.nextElementSibling;
                    }
                    header.classList.toggle("pg-hidden", !hasVisibleChildren);
                });
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

                    const initials = cleanLabel.split(/\s+/)
                        .map(w => w.slice(0, 2))
                        .join('')
                        .substring(0, 6);

                    const searchBlob = `${uniqueKey} ${initials} ${item.preset} ${(item.tags || []).join(' ')}`.toLowerCase();
                    const uiGroupTitle = item.tags?.length ? item.tags.map(toTitleCase).join(" › ") : "Root Presets";

                    if (uiGroupTitle !== lastGroup) {
                        lastGroup = uiGroupTitle;
                        htmlBuffer += `<div class="pg-group-header" data-group="${uiGroupTitle}">${uiGroupTitle}</div>`;
                    }

                    let thumbnailHtml = "";
                    if (item.filename) {
                        thumbnailHtml = `
                            <div class="pg-thumb-box">
                                <img class="pg-img" src="/custom_node/get_preset_image?filename=${encodeURIComponent(item.filename)}" alt="${uniqueKey}" loading="lazy">
                                <div class="pg-initials">${initials}</div>
                            </div>`;
                    } else {
                        thumbnailHtml = `
                            <div class="pg-thumb-box" style="background-color: ${getHashColor(uniqueKey)}; color: #fff;">
                                <svg class="pg-icon" viewBox="0 0 24 24" style="opacity: 0.25; color: #fff;"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                                <div class="pg-initials">${initials}</div>
                            </div>`;
                    }

                    const badge = item.tags?.length
                        ? `<div class="pg-tag-badge" title="${item.tags.map(toTitleCase).join(' > ')}">${toTitleCase(item.tags[item.tags.length - 1])}</div>`
                        : '';

                    htmlBuffer += `
                        <div class="pg-item" data-style="${uniqueKey}" data-search-blob="${searchBlob}">
                            ${badge}
                            ${thumbnailHtml}
                            <div class="pg-label">${cleanLabel}</div>
                        </div>
                    `;
                });

                grid.innerHTML = htmlBuffer || `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#666; font-size:11px;">No presets found</div>`;
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
                grid.querySelectorAll(".pg-item").forEach(el => {
                    el.classList.toggle("selected", activeList.includes(el.dataset.style));
                });

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
                const btn = e.target.closest(".pg-view-btn");
                if (btn) switchView(btn.dataset.view);
            });

            chkGroup.addEventListener("change", () => {
                localStorage.setItem("comfy_preset_gallery_grouped", String(chkGroup.checked));
                grid.classList.toggle("hide-folders", !chkGroup.checked);
                executeFilterPipeline();
            });

            search.addEventListener("input", executeFilterPipeline);

            modeToggleContainer.addEventListener("click", (e) => {
                const btn = e.target.closest(".pg-mode-btn");
                if (btn) setMode(btn.dataset.mode);
            });

            const baseCallback = widget.callback;
            widget.callback = function (value) { syncUI(value); baseCallback?.apply(this, arguments); };

            grid.addEventListener("click", (e) => {
                const item = e.target.closest(".pg-item");
                if (!item || !widget.callback) return;

                const styleKey = item.dataset.style;
                let selections = getSelectedArray();

                if (e.ctrlKey) {
                    selections = selections.includes(styleKey) ? selections.filter(v => v !== styleKey) : [...selections, styleKey];
                } else {
                    selections = [styleKey];
                }

                widget.value = selections.join(", ");
                widget.callback(widget.value);

                if (currentMode === "new") {
                    setMode("edit");
                }
                if (node.graph) node.graph._version++;
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

            btnSave.addEventListener("click", async () => {
                const name = inpName.value.trim().toLowerCase().replace(/ /g, "_");
                if (!name) return alert("Preset Name required.");

                const folder = inpFolder.value.trim().toLowerCase().replace(/ /g, "_");
                const uniqueKey = folder ? `${folder}/${name}` : name;

                let shouldDeleteOriginal = false;

                if (currentMode === "edit" && lastSelectedKey && lastSelectedKey !== uniqueKey) {
                    if (confirm(`You modified the preset path from:\n"${lastSelectedKey}" ➡️ "${uniqueKey}"\nDo you want to overwrite/delete the original file?`)) {
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
                }

                if (!res.success) return alert(`Save failed: ${res.error}`);

                await loadGallery();

                if (currentMode === "new") {
                    setMode("edit");
                }

                widget.value = uniqueKey;
                if (widget.callback) widget.callback(uniqueKey);
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
                widget.value = "";
                if (widget.callback) widget.callback("");
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