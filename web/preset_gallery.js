import { app } from "../../../scripts/app.js";

const MIN_NODE_HEIGHT = 640;
const MIN_NODE_WIDTH = 400;

/**
 * Encapsulates the UI styling injection rules.
 */
class PresetGalleryStyles {
    static inject() {
        if (document.getElementById("j0n4t-pg-global-styles")) return;
        
        const styles = document.createElement("style");
        styles.id = "j0n4t-pg-global-styles";
        styles.textContent = `
            .j0n4t-pg-wrap { display: flex; flex-direction: column; gap: 4px; padding: 0; border-radius: 4px; box-sizing: border-box; width: 100%; height: 100%; font-family: sans-serif; }
            .j0n4t-pg-basket-container { display: flex; flex-direction: column; gap: 4px; background: #15151580 ; border: 1px dashed #777; border-radius: 4px; padding: 4px; box-sizing: border-box; width: 100%; flex-shrink: 0; transition: border-color 0.2s, background-color 0.2s; }
            .j0n4t-pg-basket-container.drag-over { border-color: #007acc; background: #1a242db0; }
            .j0n4t-pg-basket-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
            .j0n4t-pg-basket-title { font-size: 9px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; pointer-events: none; }
            .j0n4t-pg-basket-custom-btn { font-size: 9px; color: #fff; background: #228b22; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-weight: bold; transition: background 0.15s; }
            .j0n4t-pg-basket-custom-btn:hover { background: #1e7b1e; }
            .j0n4t-pg-basket-clear-btn:hover { background: #912e2e; }
            .j0n4t-pg-basket-pool { display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; align-items: center; }
            .j0n4t-pg-basket-empty { font-size: 10px; color: #555; font-style: italic; pointer-events: none; }
            .j0n4t-pg-basket-drop-indicator { width: 2px; background-color: #007acc; box-shadow: 0 0 4px #007acc; border-radius: 1px; transition: transform 0.05s ease; pointer-events: none; }
            .j0n4t-pg-basket-chip { display: flex; align-items: center; gap: 2px; background: #3a3a3a; border: 1px solid #3d3d3d; border-radius: 3px; padding: 2px 4px; box-sizing: border-box; cursor: grab; user-select: none; transition: background 0.15s; position: relative; }
            .j0n4t-pg-basket-chip:active { cursor: grabbing; }
            .j0n4t-pg-basket-chip.dragging { opacity: 0.4; border-color: #007acc; }
            .j0n4t-pg-basket-chip-thumb { width: 16px; height: 16px; border-radius: 2px; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 900; color: #fff; text-shadow: 0 1px 1px #000; flex-shrink: 0; }
            .j0n4t-pg-basket-chip-label { font-size: 10px; color: #ddd; white-space: nowrap; max-width: 80px; overflow: hidden; text-overflow: ellipsis; pointer-events: none; margin-left: 2px; }
            .j0n4t-pg-action-btn { display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; color: #aaa; border-radius: 2px; cursor: pointer; transition: 0.1s; margin-left: 1px; }
            .j0n4t-pg-action-btn:hover { background: #555; color: #fff; }
            .j0n4t-pg-action-btn.del-btn:hover { background: #b23b3b; color: #fff; }
            .j0n4t-pg-action-btn svg { width: 10px; height: 10px; fill: currentColor; }
            .j0n4t-pg-top-bar { display: flex; gap: 6px; align-items: center; width: 100%; flex-shrink: 0; }
            .j0n4t-pg-search-wrapper { position: relative; flex-grow: 1; display: flex; align-items: center; }
            .j0n4t-pg-search { width: 100%; padding: 6px 24px 6px 6px; background: #1a1a1ab0; border: 1px solid #444; border-radius: 4px; color: #fff; font-size: 11px; box-sizing: border-box; min-width: 0; }
            .j0n4t-pg-search-clear { position: absolute; right: 6px; width: 14px; height: 14px; color: #777; cursor: pointer; display: none; align-items: center; justify-content: center; border-radius: 2px; transition: color 0.1s, background-color 0.1s; }
            .j0n4t-pg-search-clear:hover { color: #fff; background: #b23b3b; }
            .j0n4t-pg-search-clear svg { width: 10px; height: 10px; fill: currentColor; }
            .j0n4t-pg-views { display: flex; gap: 2px; flex-shrink: 0; background: #1a1a1a80; padding: 2px; border-radius: 4px; border: 1px solid #444; }
            .j0n4t-pg-view-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 3px; cursor: pointer; color: #aaa; background: transparent; transition: 0.15s; }
            .j0n4t-pg-view-btn:hover { background: #333; color: #fff; }
            .j0n4t-pg-view-btn.active { background: #007acc; color: #fff; }
            .j0n4t-pg-view-btn svg, .j0n4t-pg-btn svg { width: 14px; height: 14px; fill: currentColor; }
            .j0n4t-pg-grid { display: grid; gap: 6px; flex-grow: 1; overflow-y: auto; min-height: 60px; align-content: start; margin-top: 2px; }
            .j0n4t-pg-grid.view-small { grid-template-columns: repeat(auto-fill, minmax(55px, 1fr)); }
            .j0n4t-pg-grid.view-big { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
            .j0n4t-pg-grid.view-list { grid-template-columns: 1fr; gap: 4px; }
            .j0n4t-pg-group-header { grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; color: #bdbdbd; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; user-select: none; }
            .j0n4t-pg-group-header::after { content: ""; flex-grow: 1; height: 1px; background: #bdbdbd80; }
            .j0n4t-pg-grid.hide-folders .j0n4t-pg-group-header { display: none !important; }
            .j0n4t-pg-item { cursor: pointer; text-align: center; border: 2px solid transparent; border-radius: 4px; padding: 4px; background: #1a1a1a80; transition: 0.1s; height: fit-content; box-sizing: border-box; user-select: none; position: relative; }
            .j0n4t-pg-item:hover { background: #2a2a2a; border-color: #444; }
            .j0n4t-pg-item.selected { border-color: #007acc; background: #252525; }
            .j0n4t-pg-item.editing { border-color: #d1a119 !important; background: #2b271d !important; }
            .j0n4t-pg-item.dragging { opacity: 0.4; }
            .j0n4t-pg-hidden { display: none !important; }
            .j0n4t-pg-thumb-box { width: 100%; height: 100px; border-radius: 2px; display: flex; align-items: center; justify-content: center; background: #111; color: #666; position: relative; overflow: hidden; pointer-events: none; }
            .j0n4t-pg-grid.view-small .j0n4t-pg-thumb-box { height: 50px; }
            .j0n4t-pg-img { width: 100%; height: 100%; object-fit: cover; }
            .j0n4t-pg-icon { width: 20px; height: 20px; fill: currentColor; }
            .j0n4t-pg-initials { position: absolute; font-size: 10px; font-weight: 900; color: #fff; text-shadow: 0px 1px 2px rgba(0,0,0,0.9), 0px 0px 4px rgba(0,0,0,0.7); text-transform: uppercase; bottom: 4px; z-index: 2; pointer-events: none; letter-spacing: 0.5px; }
            .j0n4t-pg-label { font-size: 10px; color: #ccc; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
            .j0n4t-pg-tag-badge { position: absolute; top: 6px; left: 6px; background: rgba(0,122,204,0.85); color: #fff; font-size: 7.5px; font-weight: bold; padding: 1px 4px; border-radius: 2px; text-transform: uppercase; pointer-events: none; max-width: 50px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; z-index: 3; }
            .j0n4t-pg-corner-edit { position: absolute; top: 6px; right: 6px; background: #2a2a2a; color: #bbb; border-radius: 3px; width: 18px; height: 18px; display: none; align-items: center; justify-content: center; z-index: 4; border: 1px solid #444; transition: 0.15s; cursor: pointer; }
            .j0n4t-pg-corner-edit:hover { background: #d1a119; color: #fff; border-color: #d1a119; }
            .j0n4t-pg-corner-edit svg { width: 11px; height: 11px; fill: currentColor; }
            .j0n4t-pg-item:hover .j0n4t-pg-corner-edit { display: flex; }
            .view-list .j0n4t-pg-item { display: flex; align-items: center; gap: 8px; text-align: left; padding: 4px 6px; }
            .view-list .j0n4t-pg-thumb-box { width: 32px; height: 32px; flex-shrink: 0; }
            .view-list .j0n4t-pg-icon { width: 14px; height: 14px; }
            .view-list .j0n4t-pg-initials { display: none; }
            .view-list .j0n4t-pg-label { margin-top: 0; font-size: 11px; flex-grow: 1; }
            .view-list .j0n4t-pg-tag-badge { position: relative; top: auto; left: auto; background: #444; color: #bbb; max-width: none; font-size: 9px; }
            .view-list .j0n4t-pg-corner-edit { position: relative; top: auto; right: auto; display: flex !important; margin-left: auto; flex-shrink: 0; }
            .j0n4t-pg-grid.hide-folders .j0n4t-pg-tag-badge { display: block !important; }
            .j0n4t-pg-control-bar { display: flex; gap: 6px; align-items: center; margin-top: 2px; flex-shrink: 0; width: 100%; }
            .j0n4t-pg-toggle { flex-grow: 1; background: #333; border: 1px solid #444; color: #bbb; padding: 4px; border-radius: 3px; cursor: pointer; font-size: 10px; text-align: center; user-select: none; white-space: nowrap; }
            .j0n4t-pg-toggle:hover { background: #444; color: #fff; }
            .j0n4t-pg-checkbox-wrap { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #aaa; user-select: none; cursor: pointer; padding: 3px 2px; height: 20px; box-sizing: border-box; white-space: nowrap; }
            .j0n4t-pg-checkbox-wrap input { width: auto; margin: 0; cursor: pointer; }
            .j0n4t-pg-editor { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid #3d3d3d; padding-top: 8px; margin-top: 2px; box-sizing: border-box; flex-shrink: 0; }
            .j0n4t-pg-editor.collapsed { display: none !important; }
            .j0n4t-pg-editor-banner { font-size: 10px; font-weight: bold; padding: 4px 6px; border-radius: 3px; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.5px; }
            .j0n4t-pg-editor input, .j0n4t-pg-editor textarea { background: #1a1a1ab0; border: 1px solid #444; color: #fff; font-size: 11px; padding: 5px; border-radius: 3px; box-sizing: border-box; width: 100%; }
            .j0n4t-pg-editor textarea { resize: vertical; min-height: 65px; }
            .j0n4t-pg-row { display: flex; gap: 6px; align-items: center; }
            .j0n4t-pg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: #007acc; border: none; color: #fff; padding: 6px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold; width: 100%; text-align: center; box-sizing: border-box; height: 28px; }
            .j0n4t-pg-btn:hover { background: #0062a3; }
            .has-image .no-img-state, .no-image .has-img-state { display: none !important; }
        `;
        document.head.appendChild(styles);
    }
}

/**
 * Handles communication with backend server endpoints.
 */
class PresetGalleryAPI {
    static async fetchGallery() {
        const response = await fetch('/custom_node/live_preset_gallery');
        return response.json();
    }

    static async fetchPresetImage(filename) {
        const url = `/custom_node/get_preset_image?filename=${encodeURIComponent(filename)}`;
        const res = await fetch(url);
        return res.ok ? res.blob() : null;
    }

    static async savePreset(formData) {
        const res = await fetch('/custom_node/save_preset_item', { method: 'POST', body: formData });
        return res.json();
    }

    static async deletePreset(uniqueKey) {
        return fetch('/custom_node/delete_preset_item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ unique_key: uniqueKey })
        });
    }

    static async importZip(formData) {
        const res = await fetch('/custom_node/import_presets_zip', { method: 'POST', body: formData });
        return res.json();
    }
}

/**
 * Manages calculations, behaviors, and layout ordering inside the Basket component.
 */
class PresetBasket {
    constructor(container, pool, viewContext) {
        this.container = container;
        this.pool = pool;
        this.context = viewContext;
        this.dropIndicator = null;
        this.initDragAndDrop();
    }

    initDragAndDrop() {
        this.container.addEventListener("dragenter", (e) => {
            e.preventDefault();
            this.container.classList.add("drag-over");
        });

        this.container.addEventListener("dragover", (e) => {
            e.preventDefault();
            if (!this.dropIndicator) {
                this.dropIndicator = document.createElement("div");
                this.dropIndicator.className = "j0n4t-pg-basket-drop-indicator";
            }

            const closest = this.getClosestChip(e.clientX, e.clientY);
            if (closest.element) {
                this.dropIndicator.style.height = `${closest.box.height}px`;
                const dropAfter = e.clientX > (closest.box.left + closest.box.width / 2);
                if (dropAfter) {
                    closest.element.after(this.dropIndicator);
                } else {
                    closest.element.before(this.dropIndicator);
                }
            } else {
                this.pool.appendChild(this.dropIndicator);
                this.dropIndicator.style.height = "12px";
            }
        });

        this.container.addEventListener("dragleave", (e) => {
            if (e.relatedTarget && this.container.contains(e.relatedTarget)) return;
            this.container.classList.remove("drag-over");
            this.removeDropIndicator();
        });

        this.container.addEventListener("drop", (e) => {
            e.preventDefault();
            this.container.classList.remove("drag-over");
            this.removeDropIndicator();

            const styleKey = e.dataTransfer.getData("text/plain");
            if (!styleKey) return;

            const isFromBasket = e.dataTransfer.getData("source/basket");
            let currentSelections = this.context.getSelectedArray();

            const closest = this.getClosestChip(e.clientX, e.clientY);

            if (isFromBasket) {
                currentSelections = currentSelections.filter(v => v !== styleKey);
            }

            if (closest.element) {
                const targetId = closest.element.dataset.id;
                let insertionIndex = currentSelections.indexOf(targetId);
                const dropAfter = e.clientX > (closest.box.left + closest.box.width / 2);
                if (dropAfter) insertionIndex += 1;

                if (insertionIndex !== -1) {
                    currentSelections.splice(insertionIndex, 0, styleKey);
                } else {
                    currentSelections.push(styleKey);
                }
            } else if (!currentSelections.includes(styleKey)) {
                currentSelections.push(styleKey);
            }

            this.context.updateWidgetValue([...new Set(currentSelections)]);
        });
    }

    getClosestChip(clientX, clientY) {
        const siblings = [...this.pool.querySelectorAll(".j0n4t-pg-basket-chip:not(.dragging)")];
        return siblings.reduce((closest, sibling) => {
            const box = sibling.getBoundingClientRect();
            const centerX = box.left + box.width / 2;
            const centerY = box.top + box.height / 2;
            const distance = Math.hypot(clientX - centerX, clientY - centerY);

            if (distance < closest.distance) {
                return { distance, element: sibling, box };
            }
            return closest;
        }, { distance: Infinity, element: null, box: null });
    }

    removeDropIndicator() {
        if (this.dropIndicator && this.dropIndicator.parentNode) {
            this.dropIndicator.remove();
        }
        this.dropIndicator = null;
    }

    render(activeList, cache, helpers) {
        if (activeList.length === 0) {
            this.pool.innerHTML = `<span class="j0n4t-pg-basket-empty">No presets selected</span>`;
            return;
        }

        this.pool.innerHTML = "";
        activeList.forEach((styleKey) => {
            const item = cache[styleKey];
            const initials = helpers.getInitials(styleKey);
            const cleanLabel = item ? helpers.toTitleCase(styleKey.includes("/") ? styleKey.split("/").pop() : styleKey) : styleKey;

            const chip = Object.assign(document.createElement("div"), {
                className: "j0n4t-pg-basket-chip",
                draggable: true,
                title: cleanLabel
            });
            chip.dataset.id = styleKey;

            let thumbStyle = `background-color: ${helpers.getHashColor(styleKey)};`;
            if (item?.filename) {
                thumbStyle = `background-image: url('/custom_node/get_preset_image?filename=${encodeURIComponent(item.filename)}');`;
            }

            chip.innerHTML = `
                <div class="j0n4t-pg-basket-chip-thumb" style="${thumbStyle}">${item?.filename ? '' : initials.slice(0, 4)}</div>
                <div class="j0n4t-pg-basket-chip-label" title="${styleKey}">${cleanLabel}</div>
                ${cache[styleKey] ? `
                <div class="j0n4t-pg-action-btn edit-btn" title="Edit Profile Configuration">
                    <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                </div>` : ''}
                <div class="j0n4t-pg-action-btn del-btn" title="Deselect Preset from Queue">
                    <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </div>
            `;

            chip.querySelector(".del-btn").addEventListener("click", (e) => {
                e.stopPropagation();
                const filtered = this.context.getSelectedArray().filter(v => v !== styleKey);
                this.context.updateWidgetValue(filtered);
            });

            if (cache[styleKey]) {
                chip.querySelector(".edit-btn").addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.context.openEditorForPreset(styleKey);
                });
            }

            chip.addEventListener("dragstart", (e) => {
                chip.classList.add("dragging");
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", styleKey);
                e.dataTransfer.setData("source/basket", "true");
            });

            chip.addEventListener("dragend", () => chip.classList.remove("dragging"));

            this.pool.appendChild(chip);
        });
    }
}

/**
 * Main Controller orchestrating view mutations and managing UI events.
 */
class PresetGalleryView {
    constructor(node, widget) {
        this.node = node;
        this.widget = widget;
        this.cache = {};
        this.fetchedBlobImage = null;
        this.lastSelectedKey = "";
        this.currentMode = "edit"; 

        this.helpers = {
            getHashColor: (str) => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    hash = Math.imul(hash ^ str.charCodeAt(i), 15485863);
                }
                hash = (hash ^ (hash >>> 16)) * 0x85ebca6b;
                hash = (hash ^ (hash >>> 13)) * 0xc2b2ae35;
                hash = hash ^ (hash >>> 16);
                return `hsl(${Math.abs(hash) % 360}, 65%, 35%)`;
            },
            toTitleCase: (str) => str.replace(/_/g, " ").replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
            getInitials: (key) => {
                const raw = key.includes("/") ? key.split("/").pop() : key;
                return this.helpers.toTitleCase(raw).split(/\s+/).map(w => w.slice(0, 2)).join('').substring(0, 6);
            }
        };

        this.dom = this.buildDOMStructure();
        this.basket = new PresetBasket(
            this.dom.wrap.querySelector(".j0n4t-pg-basket-container"),
            this.dom.wrap.querySelector(".j0n4t-pg-basket-pool"),
            this
        );

        this.bindEvents();
    }

    buildDOMStructure() {
        const wrap = document.createElement("div");
        wrap.className = "j0n4t-pg-wrap";
        wrap.innerHTML = `
            <div class="j0n4t-pg-basket-container">
                <div class="j0n4t-pg-basket-header">
                    <div class="j0n4t-pg-basket-title">🧺 Presets Basket (Drag to reorder)</div>
                    <div style="display: flex; gap: 4px;">
                        <button type="button" class="j0n4t-pg-basket-custom-btn" title="Add temporary prompt chip">+ Custom</button>
                        <button type="button" class="j0n4t-pg-basket-clear-btn" title="Clear all presets from basket" style="font-size: 9px; color: #fff; background: #b23b3b; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-weight: bold; transition: background 0.15s;">🗑️ Clear</button>
                    </div>
                </div>
                <div class="j0n4t-pg-basket-pool">
                    <span class="j0n4t-pg-basket-empty">No presets selected</span>
                </div>
            </div>
            <div class="j0n4t-pg-top-bar">
                <div class="j0n4t-pg-search-wrapper">
                    <input type="text" class="j0n4t-pg-search" placeholder="Filter presets or folders..." />
                    <div class="j0n4t-pg-search-clear" title="Clear Filter">
                        <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </div>
                </div>
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
                <div id="j0n4t-pg-banner" class="j0n4t-pg-editor-banner">📝 Edit Panel (Select Edit ✏️ on an Item)</div>
                <div class="j0n4t-pg-row">
                    <input type="text" id="j0n4t-pg-name" placeholder="Preset Name" style="flex:1;" />
                    <input type="text" id="j0n4t-pg-folder" placeholder="Sub-folder (Optional)" style="flex:1;" />
                </div>
                <textarea id="j0n4t-pg-preset" placeholder="Preset Keywords..."></textarea>
                <div class="j0n4t-pg-row">
                    <input type="file" id="j0n4t-pg-file" accept="image/*" style="display:none;" />
                    <button type="button" id="j0n4t-pg-pick-btn" class="j0n4t-pg-btn no-img-state" style="background:#444;" title="Pick Image">Pick Image</button>
                    <button type="button" id="j0n4t-pg-change-btn" class="j0n4t-pg-btn has-img-state" style="background:#2b5e3b;" title="Change Image">Change Img</button>
                    <button type="button" id="j0n4t-pg-rm-img-btn" class="j0n4t-pg-btn has-img-state" style="background:#b23b3b;" title="Delete Image Asset Only">Clear Img</button>
                </div>
                <div class="j0n4t-pg-row">
                    <button type="button" id="j0n4t-pg-clear-fields-btn" class="j0n4t-pg-btn" style="background:#555;" title="Clear form to write a completely blank new preset">Clear / New</button>
                    <button type="button" id="j0n4t-pg-save-new-btn" class="j0n4t-pg-btn" style="background:#228b22;" title="Save current parameters as a new separate preset file">Save as New</button>
                    <button type="button" id="j0n4t-pg-save-btn" class="j0n4t-pg-btn" style="background:#007acc;" title="Save changes or overwrite current active file">Save Changes</button>
                    <button type="button" id="j0n4t-pg-del-btn" class="j0n4t-pg-btn" style="background:#a32a2a;" title="Permanently Delete Preset Entirely">Delete</button>
                </div>
                <div class="j0n4t-pg-row" style="border-top: 1px dashed #444; padding-top: 6px; margin-top: 2px;">
                    <input type="file" id="j0n4t-pg-zip-file" accept=".zip" style="display:none;" />
                    <button type="button" id="j0n4t-pg-import-btn" class="j0n4t-pg-btn" style="background:#454545;" title="Import ZIP Pool Package">Import ZIP</button>
                    <button type="button" id="j0n4t-pg-export-btn" class="j0n4t-pg-btn" style="background:#454545;" title="Export Current Pool Package to ZIP Archive">Export ZIP</button>
                </div>
            </div>
        `;

        return {
            wrap,
            grid: wrap.querySelector(".j0n4t-pg-grid"),
            search: wrap.querySelector(".j0n4t-pg-search"),
            searchClear: wrap.querySelector(".j0n4t-pg-search-clear"),
            editor: wrap.querySelector(".j0n4t-pg-editor"),
            banner: wrap.querySelector("#j0n4t-pg-banner"),
            toggle: wrap.querySelector("#j0n4t-pg-toggle"),
            viewsContainer: wrap.querySelector(".j0n4t-pg-views"),
            chkGroup: wrap.querySelector("#j0n4t-pg-group-toggle"),
            inpName: wrap.querySelector("#j0n4t-pg-name"),
            inpFolder: wrap.querySelector("#j0n4t-pg-folder"),
            inpPreset: wrap.querySelector("#j0n4t-pg-preset"),
            inpFile: wrap.querySelector("#j0n4t-pg-file"),
            btnPick: wrap.querySelector("#j0n4t-pg-pick-btn"),
            btnChange: wrap.querySelector("#j0n4t-pg-change-btn"),
            btnRmImg: wrap.querySelector("#j0n4t-pg-rm-img-btn"),
            btnClearFields: wrap.querySelector("#j0n4t-pg-clear-fields-btn"),
            btnSaveNew: wrap.querySelector("#j0n4t-pg-save-new-btn"),
            btnSave: wrap.querySelector("#j0n4t-pg-save-btn"),
            btnDel: wrap.querySelector("#j0n4t-pg-del-btn"),
            inpZipFile: wrap.querySelector("#j0n4t-pg-zip-file"),
            btnImport: wrap.querySelector("#j0n4t-pg-import-btn"),
            btnExport: wrap.querySelector("#j0n4t-pg-export-btn"),
            btnCustomChip: wrap.querySelector(".j0n4t-pg-basket-custom-btn"),
            btnClearBasket: wrap.querySelector(".j0n4t-pg-basket-clear-btn")
        };
    }

    getSelectedArray() {
        return this.widget.value ? this.widget.value.split(",").map(v => v.trim()).filter(Boolean) : [];
    }

    updateWidgetValue(arrayValue) {
        this.widget.value = arrayValue.join(", ");
        if (this.widget.callback) this.widget.callback(this.widget.value);
        this.syncUI(this.widget.value);
        this.markGraphDirty();
    }

    markGraphDirty() {
        if (this.node.graph) this.node.graph._version++;
    }

    setPanelCollapseState(shouldCollapse) {
        this.dom.editor.classList.toggle("collapsed", shouldCollapse);
        this.dom.toggle.innerText = shouldCollapse ? "⚙️ Management Panel" : "🔼 Hide Panel";
        localStorage.setItem("comfy_preset_gallery_collapsed", String(shouldCollapse));
    }

    switchView(viewName) {
        ['small', 'big', 'list'].forEach(v => this.dom.grid.classList.remove(`view-${v}`));
        this.dom.viewsContainer.querySelectorAll(".j0n4t-pg-view-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.view === viewName);
        });
        this.dom.grid.classList.add(`view-${viewName}`);
        localStorage.setItem("comfy_preset_gallery_view", viewName);
    }

    updateBannerText() {
        if (this.currentMode === "new") {
            this.dom.banner.innerText = "✨ Creating New Preset File";
            this.dom.banner.style.color = "#228b22";
            this.dom.banner.style.background = "#228b2220";
        } else if (this.lastSelectedKey) {
            this.dom.banner.innerText = `📝 Editing Target: ${this.lastSelectedKey}`;
            this.dom.banner.style.color = "#d1a119";
            this.dom.banner.style.background = "#d1a11920";
        } else {
            this.dom.banner.innerText = "📝 Edit Panel (Select Edit ✏️ on an Item)";
            this.dom.banner.style.color = "#888";
            this.dom.banner.style.background = "#33333330";
        }
    }

    clearEditorFields() {
        this.currentMode = "new";
        this.lastSelectedKey = "";
        this.fetchedBlobImage = null;
        this.dom.inpName.value = "";
        this.dom.inpFolder.value = "";
        this.dom.inpPreset.value = "";
        this.dom.inpFile.value = "";
        this.dom.editor.classList.replace("has-image", "no-image");
        this.updateBannerText();
        this.syncEditorHighlight();
    }

    syncEditorHighlight() {
        this.dom.grid.querySelectorAll(".j0n4t-pg-item").forEach(el => {
            const isEditingTarget = (this.currentMode === "edit" && el.dataset.style === this.lastSelectedKey);
            el.classList.toggle("editing", isEditingTarget);
        });
    }

    async openEditorForPreset(styleKey) {
        if (!this.cache[styleKey]) return;
        this.setPanelCollapseState(false);
        
        // Wipe historical memory references before mounting the new selected profile context
        this.fetchedBlobImage = null;
        this.dom.inpFile.value = "";

        this.lastSelectedKey = styleKey;
        this.currentMode = "edit";

        const parts = styleKey.split("/");
        this.dom.inpName.value = parts.pop() || "";
        this.dom.inpFolder.value = parts.join("/");
        this.dom.inpPreset.value = this.cache[styleKey].preset || "";

        if (this.cache[styleKey].filename) {
            this.dom.editor.classList.replace("no-image", "has-image");
            try {
                this.fetchedBlobImage = await PresetGalleryAPI.fetchPresetImage(this.cache[styleKey].filename);
            } catch (err) {
                console.error("Failed to sync asset image stream", err);
                this.fetchedBlobImage = null;
                this.dom.editor.classList.replace("has-image", "no-image");
            }
        } else {
            this.dom.editor.classList.replace("has-image", "no-image");
        }
        
        this.updateBannerText();
        this.syncEditorHighlight();
    }

    executeFilterPipeline() {
        const query = this.dom.search.value.toLowerCase().trim();
        const items = this.dom.grid.querySelectorAll(".j0n4t-pg-item");
        const queryWords = query ? query.split(/\s+/) : [];

        this.dom.searchClear.style.display = query ? "flex" : "none";

        items.forEach(el => {
            const matchBlob = el.dataset.searchBlob;
            const isVisible = queryWords.length === 0 || queryWords.every(word => matchBlob.includes(word));
            el.classList.toggle("j0n4t-pg-hidden", !isVisible);
        });

        this.dom.grid.querySelectorAll(".j0n4t-pg-group-header").forEach(header => {
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
    }

    compileStaticDOMStructure() {
        let htmlBuffer = "";
        let lastGroup = null;

        const sortedKeys = Object.keys(this.cache).sort((a, b) => {
            const groupA = this.cache[a].tags?.length ? this.cache[a].tags.join(" > ") : "root_presets";
            const groupB = this.cache[b].tags?.length ? this.cache[b].tags.join(" > ") : "root_presets";
            if (groupA === "root_presets" && groupB !== "root_presets") return -1;
            if (groupB === "root_presets" && groupA !== "root_presets") return 1;
            return groupA !== groupB ? groupA.localeCompare(groupB) : a.localeCompare(b);
        });

        sortedKeys.forEach(uniqueKey => {
            const item = this.cache[uniqueKey];
            const rawLabel = uniqueKey.includes("/") ? uniqueKey.split("/").pop() : uniqueKey;
            const cleanLabel = this.helpers.toTitleCase(rawLabel);
            const initials = this.helpers.getInitials(uniqueKey);

            const searchBlob = `${uniqueKey} ${initials} ${item.preset} ${(item.tags || []).join(' ')}`.toLowerCase();
            const uiGroupTitle = item.tags?.length ? item.tags.map(this.helpers.toTitleCase).join(" › ") : "Root Presets";

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
                    <div class="j0n4t-pg-thumb-box" style="background-color: ${this.helpers.getHashColor(uniqueKey)}; color: #fff;">
                        <svg class="j0n4t-pg-icon" viewBox="0 0 24 24" style="opacity: 0.25; color: #fff;"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                        <div class="j0n4t-pg-initials">${initials}</div>
                    </div>`;
            }

            const badge = item.tags?.length
                ? `<div class="j0n4t-pg-tag-badge" title="${item.tags.map(this.helpers.toTitleCase).join(' > ')}">${this.helpers.toTitleCase(item.tags[item.tags.length - 1])}</div>`
                : '';

            htmlBuffer += `
                <div class="j0n4t-pg-item" data-style="${uniqueKey}" data-search-blob="${searchBlob}" draggable="true" title="${cleanLabel} (Click to toggle assembly basket)">
                    ${badge}
                    <div class="j0n4t-pg-corner-edit" title="Configure Profile">
                        <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </div>
                    ${thumbnailHtml}
                    <div class="j0n4t-pg-label">${cleanLabel}</div>
                </div>
            `;
        });

        this.dom.grid.innerHTML = htmlBuffer || `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#666; font-size:11px;">No presets found</div>`;

        this.dom.grid.querySelectorAll(".j0n4t-pg-item").forEach(item => {
            item.addEventListener("dragstart", (e) => {
                item.classList.add("dragging");
                e.dataTransfer.effectAllowed = "copyMove";
                e.dataTransfer.setData("text/plain", item.dataset.style);
                e.dataTransfer.setData("source/grid", "true");
            });
            item.addEventListener("dragend", () => item.classList.remove("dragging"));
            
            item.querySelector(".j0n4t-pg-corner-edit").addEventListener("click", (e) => {
                e.stopPropagation();
                this.openEditorForPreset(item.dataset.style);
            });
        });

        this.switchView(localStorage.getItem("comfy_preset_gallery_view") || "big");
        this.executeFilterPipeline();
        this.syncEditorHighlight();
    }

    async loadGallery() {
        this.cache = await PresetGalleryAPI.fetchGallery();
        this.compileStaticDOMStructure();
    }

    async syncUI(delimitedValue) {
        const activeList = delimitedValue ? delimitedValue.split(",").map(v => v.trim()).filter(Boolean) : [];

        this.dom.grid.querySelectorAll(".j0n4t-pg-item").forEach(el => {
            el.classList.toggle("selected", activeList.includes(el.dataset.style));
        });

        this.basket.render(activeList, this.cache, this.helpers);
        this.syncEditorHighlight();
    }

    bindEvents() {
        this.dom.toggle.addEventListener("click", () => this.setPanelCollapseState(!this.dom.editor.classList.contains("collapsed")));
        
        this.dom.viewsContainer.addEventListener("click", (e) => {
            const btn = e.target.closest(".j0n4t-pg-view-btn");
            if (btn) this.switchView(btn.dataset.view);
        });

        this.dom.chkGroup.checked = localStorage.getItem("comfy_preset_gallery_grouped") !== "false";
        if (!this.dom.chkGroup.checked) this.dom.grid.classList.add("hide-folders");

        this.dom.chkGroup.addEventListener("change", () => {
            localStorage.setItem("comfy_preset_gallery_grouped", String(this.dom.chkGroup.checked));
            this.dom.grid.classList.toggle("hide-folders", !this.dom.chkGroup.checked);
            this.executeFilterPipeline();
        });

        this.dom.search.addEventListener("input", () => this.executeFilterPipeline());
        this.dom.searchClear.addEventListener("click", () => {
            this.dom.search.value = "";
            this.executeFilterPipeline();
            this.dom.search.focus();
        });

        this.dom.grid.addEventListener("click", (e) => {
            if (e.target.closest(".j0n4t-pg-corner-edit")) return;
            
            const item = e.target.closest(".j0n4t-pg-item");
            if (!item || !this.widget.callback) return;

            const styleKey = item.dataset.style;
            let selections = this.getSelectedArray();
            selections = selections.includes(styleKey) ? selections.filter(v => v !== styleKey) : [...selections, styleKey];

            this.updateWidgetValue(selections);
        });

        this.dom.btnPick.addEventListener("click", () => this.dom.inpFile.click());
        this.dom.btnChange.addEventListener("click", () => this.dom.inpFile.click());
        this.dom.inpFile.addEventListener("change", () => {
            if (this.dom.inpFile.files[0]) {
                // Instantly break link to historical cached baseline images if a brand new file stream is uploaded manually
                this.fetchedBlobImage = null;
                this.dom.editor.classList.replace("no-image", "has-image");
            }
        });

        this.dom.btnRmImg.addEventListener("click", () => {
            if (!confirm("Clear this image attachment placeholder? Image will be deleted instantly on next save commit.")) return;
            this.fetchedBlobImage = null;
            this.dom.inpFile.value = "";
            this.dom.editor.classList.replace("has-image", "no-image");
        });

        const handleEnterKeySave = (e) => {
            if (e.key === "Enter") {
                if (e.target.tagName === "TEXTAREA" && e.shiftKey) return;
                e.preventDefault();
                this.dom.btnSave.click();
            }
        };
        this.dom.inpName.addEventListener("keydown", handleEnterKeySave);
        this.dom.inpFolder.addEventListener("keydown", handleEnterKeySave);
        this.dom.inpPreset.addEventListener("keydown", handleEnterKeySave);

        // Workflow Trigger Actions
        this.dom.btnClearFields.addEventListener("click", () => this.clearEditorFields());
        this.dom.btnSaveNew.addEventListener("click", () => this.handleSave(true));
        this.dom.btnSave.addEventListener("click", () => this.handleSave(false));
        this.dom.btnDel.addEventListener("click", () => this.handleDelete());
        
        this.dom.btnExport.addEventListener("click", () => window.open('/custom_node/export_presets_zip', '_blank'));
        this.dom.btnImport.addEventListener("click", () => this.dom.inpZipFile.click());
        
        this.dom.inpZipFile.addEventListener("change", async () => {
            if (!this.dom.inpZipFile.files[0]) return;
            const fd = new FormData();
            fd.append("zip_file", this.dom.inpZipFile.files[0]);

            const res = await PresetGalleryAPI.importZip(fd);
            this.dom.inpZipFile.value = "";
            if (res.success) {
                await this.loadGallery();
                this.updateWidgetValue([]);
                alert("Presets tree imported successfully!");
            }
        });

        this.dom.btnCustomChip.addEventListener("click", () => {
            const promptVal = prompt("Enter one-time custom prompt terms/keywords:");
            if (!promptVal || !promptVal.trim()) return;
            const selections = this.getSelectedArray();
            selections.push(promptVal.trim());
            this.updateWidgetValue(selections);
        });

        this.dom.btnClearBasket.addEventListener("click", () => {
            if (this.getSelectedArray().length === 0) return;
            if (confirm("Are you sure you want to empty the basket?")) {
                this.updateWidgetValue([]);
            }
        });
    }

    async handleSave(forceAsNew = false) {
        const name = this.dom.inpName.value.trim().toLowerCase().replace(/ /g, "_");
        if (!name) return alert("Preset Name required.");

        const folder = this.dom.inpFolder.value.trim().toLowerCase().replace(/ /g, "_");
        const uniqueKey = folder ? `${folder}/${name}` : name;

        let shouldDeleteOriginal = false;
        let currentSelections = this.getSelectedArray();

        // If explicitly hitting 'Save As New' or working from a wiped state
        if (forceAsNew || this.currentMode === "new") {
            if (this.cache[uniqueKey] && !confirm(`"${uniqueKey}" already exists. Overwrite?`)) {
                return;
            }
            
            // CRITICAL FIX: If saving an existing template as a brand new preset file, 
            // drop the historical image pointer unless the template's image was kept explicitly.
            // If the UI DOM state currently shows 'no-image', force clear internal variables.
            if (this.dom.editor.classList.contains("no-image")) {
                this.fetchedBlobImage = null;
                this.dom.inpFile.value = "";
            }
        } else {
            // Regular inline update modifications
            if (this.lastSelectedKey && this.lastSelectedKey !== uniqueKey) {
                if (!confirm(`Rename preset location from "${this.lastSelectedKey}" to "${uniqueKey}"?`)) return;
                shouldDeleteOriginal = true;
            }
        }

        const fd = new FormData();
        fd.append("preset_name", name);
        fd.append("subfolder", folder);
        fd.append("preset_text", this.dom.inpPreset.value.trim());
        fd.append("overwrite", "true");

        if (this.dom.inpFile.files[0]) {
            fd.append("image_file", this.dom.inpFile.files[0]);
        } else if (this.fetchedBlobImage) {
            fd.append("image_file", this.fetchedBlobImage, "image.jpg");
        } else {
            fd.append("clear_image", "true");
        }

        const res = await PresetGalleryAPI.savePreset(fd);
        if (!res.success) return alert(`Save failed: ${res.error}`);

        if (shouldDeleteOriginal && this.cache[this.lastSelectedKey]) {
            await PresetGalleryAPI.deletePreset(this.lastSelectedKey);
            currentSelections = currentSelections.map(item => item === this.lastSelectedKey ? uniqueKey : item);
        }

        this.lastSelectedKey = uniqueKey;
        this.currentMode = "edit";

        await this.loadGallery();
        this.updateWidgetValue(currentSelections);
        this.updateBannerText();
    }

    async handleDelete() {
        if (!this.lastSelectedKey) return alert("No active target loaded into edit panel.");
        if (!this.cache[this.lastSelectedKey]) return alert("Cannot remote delete a non-saved item.");

        if (!confirm(`Permanently delete "${this.lastSelectedKey}" from disk?`)) return;
        
        await PresetGalleryAPI.deletePreset(this.lastSelectedKey);
        
        const selections = this.getSelectedArray().filter(v => v !== this.lastSelectedKey);
        
        await this.loadGallery();
        this.clearEditorFields();
        this.updateWidgetValue(selections);
    }

    async init() {
        await this.loadGallery();
        if (this.widget.value) {
            await this.syncUI(this.widget.value);
        }
        this.setPanelCollapseState(localStorage.getItem("comfy_preset_gallery_collapsed") === "true");
        this.node.setSize([this.node.size[0] || MIN_NODE_WIDTH, this.node.size[1] || MIN_NODE_HEIGHT]);
    }
}

PresetGalleryStyles.inject();

app.registerExtension({
    name: "Comfy.PresetGallery",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "PresetGalleryNode") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);

            const widget = this.widgets.find(w => w.name === "preset_selection");
            if (!widget) return;

            widget.hidden = true;

            const galleryView = new PresetGalleryView(this, widget);
            
            const baseCallback = widget.callback;
            widget.callback = function (value) {
                galleryView.syncUI(value);
                baseCallback?.apply(this, arguments);
            };

            galleryView.init();
            this.addDOMWidget("preset_gallery_ui", "HTML", galleryView.dom.wrap);
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