import { app } from "../../../scripts/app.js";

const MIN_NODE_HEIGHT = 640;
const MIN_NODE_WIDTH = 400;

// --- 1. Utilities & Helpers --- //
const PresetUtils = {
    escapeHTML: (str) => {
        if (str == null) return "";
        return String(str)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    },
    getTopMatches: (list, query) => {
        const cleanQuery = query.toLowerCase();
        const buckets = list.reduce((acc, item) => {
            const idx = item.toLowerCase().indexOf(cleanQuery);
            if (idx === -1) return acc;
            if (idx === 0) {
                if (acc.startsWith.length < 3) acc.startsWith.push({ item, idx });
            } else {
                if (acc.fuzzy.length < 3) acc.fuzzy.push({ item, idx });
            }
            return acc;
        }, { startsWith: [], fuzzy: [] });

        const sortBucket = (arr) => arr
            .sort((a, b) => a.idx !== b.idx ? a.idx - b.idx : a.item.localeCompare(b.item))
            .map(entry => entry.item);
            
        return Array.from(new Set([...sortBucket(buckets.startsWith), ...sortBucket(buckets.fuzzy)]));
    },
    getHashColor: (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash = Math.imul(hash ^ str.charCodeAt(i), 15485863);
        hash = (hash ^ (hash >>> 16)) * 0x85ebca6b;
        hash = (hash ^ (hash >>> 13)) * 0xc2b2ae35;
        return `hsl(${Math.abs(hash ^ (hash >>> 16)) % 360}, 65%, 35%)`;
    },
    toTitleCase: (str) => str.replace(/_/g, " ").replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
    getInitials: (key) => {
        const raw = key.includes("/") ? key.split("/").pop() : key;
        return PresetUtils.toTitleCase(raw).split(/\s+/).map(w => w.slice(0, 2)).join('').substring(0, 6);
    },
    getBaseFolder: (key) => key.includes("/") ? key.split("/")[0] : key,
    getPresetColor: (key) => PresetUtils.getHashColor(PresetUtils.getBaseFolder(key)),
    icons: {
        close: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
        edit: `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
        file: `<svg class="j0n4t-pg-icon" viewBox="0 0 24 24" style="opacity: 0.25; color: #fff; width: 32px; height: 32px;"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
        list: `<svg viewBox="0 0 16 16"><rect x="1" y="2" width="3" height="2"/><rect x="6" y="2" width="9" height="2"/><rect x="1" y="7" width="3" height="2"/><rect x="6" y="7" width="9" height="2"/><rect x="1" y="12" width="3" height="2"/><rect x="6" y="12" width="9" height="2"/></svg>`,
        small: `<svg viewBox="0 0 16 16"><rect x="1" y="1" width="3" height="3"/><rect x="6" y="1" width="3" height="3"/><rect x="11" y="1" width="3" height="3"/><rect x="1" y="6" width="3" height="3"/><rect x="6" y="6" width="3" height="3"/><rect x="11" y="6" width="3" height="3"/><rect x="1" y="11" width="3" height="3"/><rect x="6" y="11" width="3" height="3"/><rect x="11" y="11" width="3" height="3"/></svg>`,
        big: `<svg viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6"/><rect x="9" y="1" width="6" height="6"/><rect x="1" y="9" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/></svg>`,
        eye: `<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
        export: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6 20q-.825 0-1.412-.587T4 18v-2q0-.425.288-.712T5 15t.713.288T6 16v2h12v-2q0-.425.288-.712T19 15t.713.288T20 16v2q0 .825-.587 1.413T18 20zm5-12.15L9.125 9.725q-.3.3-.712.288T7.7 9.7q-.275-.3-.288-.7t.288-.7l3.6-3.6q.15-.15.325-.212T12 4.425t.375.063t.325.212l3.6 3.6q.3.3.288.7t-.288.7q-.3.3-.712.313t-.713-.288L13 7.85V15q0 .425-.288.713T12 16t-.712-.288T11 15z" /></svg>`,
        import: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M11.625 15.513q-.175-.063-.325-.213l-3.6-3.6q-.3-.3-.288-.7t.288-.7q.3-.3.713-.312t.712.287L11 12.15V5q0-.425.288-.712T12 4t.713.288T13 5v7.15l1.875-1.875q.3-.3.713-.288t.712.313q.275.3.288.7t-.288.7l-3.6 3.6q-.15.15-.325.213t-.375.062t-.375-.062M6 20q-.825 0-1.412-.587T4 18v-2q0-.425.288-.712T5 15t.713.288T6 16v2h12v-2q0-.425.288-.712T19 15t.713.288T20 16v2q0 .825-.587 1.413T18 20z" /></svg>`
    }
};

// --- 2. Styles --- //
class PresetGalleryStyles {
    static inject() {
        if (document.getElementById("j0n4t-pg-global-styles")) return;
        const styles = document.createElement("style");
        styles.id = "j0n4t-pg-global-styles";
        styles.textContent = /*css*/ `
            .j0n4t-pg-wrap { display: flex; flex-direction: column; gap: 4px; padding: 0; border-radius: 4px; box-sizing: border-box; width: 100%; height: 100%; font-family: sans-serif; position: relative; }
            .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-grid, .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-views, .j0n4t-pg-wrap.hide-gallery-mode #j0n4t-pg-global-collapse, .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-checkbox-wrap:has(#j0n4t-pg-group-toggle) { display: none !important; }
            .j0n4t-pg-basket-container { display: flex; flex-direction: column; gap: 4px; background: #15151580; border: 1px dashed #777; border-radius: 4px; padding: 4px; box-sizing: border-box; width: 100%; flex-shrink: 0; transition: border-color 0.2s, background-color 0.2s; position: relative; }
            .j0n4t-pg-basket-container.drag-over { border-color: #007acc; background: #1a242db0; }
            .j0n4t-pg-basket-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
            .j0n4t-pg-basket-title { font-size: 9px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; pointer-events: none; }
            .j0n4t-pg-basket-clear-btn:hover { background: #912e2e; }
            .j0n4t-pg-basket-pool { display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; align-items: center; }
            .j0n4t-pg-raw-wrapper { position: relative; width: 100%; min-height: 36px; display: none; }
            .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-raw-wrapper { display: block !important; }
            .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-basket-pool { display: none !important; }
            .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-basket-raw-textarea { display: block !important; }
            .j0n4t-pg-basket-raw-textarea { width: 100%; height: 100%; min-height: 48px; background: transparent; border: 1px solid #444; color: #fff; font-family: monospace; font-size: 11px; padding: 4px; box-sizing: border-box; border-radius: 3px; resize: vertical; position: relative; z-index: 2; caret-color: #fff; }
            .j0n4t-pg-autocomplete-popup, .j0n4t-pg-filter-autocomplete-popup { position: absolute; background: #1f1f1fe8; border: 1px solid #007acc; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; font-family: sans-serif; box-sizing: border-box; max-height: 250px; width: max-content; }
            .j0n4t-pg-autocomplete-popup { z-index: 9999; max-width: 280px; }
            .j0n4t-pg-filter-autocomplete-popup { z-index: 10001; }
            .j0n4t-pg-autocomplete-item, .j0n4t-pg-filter-autocomplete-item { padding: 6px 10px; font-size: 11px; color: #ddd; cursor: pointer; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
            .j0n4t-pg-autocomplete-item:last-child, .j0n4t-pg-filter-autocomplete-item:last-child { border-bottom: none; }
            .j0n4t-pg-autocomplete-item.active, .j0n4t-pg-filter-autocomplete-item.active { background: #007acc; color: #fff; }
            .j0n4t-pg-autocomplete-meta, .j0n4t-pg-filter-autocomplete-meta { font-size: 9px; color: #888; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; }
            .j0n4t-pg-autocomplete-item.active .j0n4t-pg-autocomplete-meta, .j0n4t-pg-filter-autocomplete-item.active .j0n4t-pg-filter-autocomplete-meta { color: #bee3ff; }

            .j0n4t-pg-basket-empty { font-size: 10px; color: #555; font-style: italic; pointer-events: none; }
            .j0n4t-pg-basket-drop-indicator { width: 2px; background-color: #007acc; box-shadow: 0 0 4px #007acc; border-radius: 1px; transition: transform 0.05s ease; pointer-events: none; }
            .j0n4t-pg-basket-chip { display: flex; align-items: center; gap: 2px; background: #3a3a3a; border: 1px solid #3d3d3d; border-radius: 3px; padding: 2px 4px; box-sizing: border-box; cursor: grab; user-select: none; transition: background 0.15s; position: relative; }
            .j0n4t-pg-basket-chip:active { cursor: grabbing; }
            .j0n4t-pg-basket-chip.dragging { opacity: 0.4; border-color: #007acc; }
            .j0n4t-pg-basket-chip-thumb { width: 16px; height: 16px; border-radius: 2px; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 900; color: #fff; text-shadow: 0 1px 1px #000; flex-shrink: 0; }
            .j0n4t-pg-basket-chip-label { font-size: 10px; color: #ddd; white-space: nowrap; max-width: 80px; overflow: hidden; text-overflow: ellipsis; pointer-events: none; margin-left: 2px; }
            .j0n4t-pg-basket-chip.inline-editing { border-color: #d1a119; cursor: text; padding: 2px 4px; }
            .j0n4t-pg-basket-chip.inline-editing .j0n4t-pg-basket-chip-thumb, .j0n4t-pg-basket-chip.inline-editing .j0n4t-pg-action-btn { display: none; }
            .j0n4t-pg-inline-edit { background: transparent; border: none; color: #fff; font-family: monospace; font-size: 11px; outline: none; width: 100%; min-width: 50px; padding: 0; margin: 0; }
            .j0n4t-pg-basket-add-btn { display: flex; align-items: center; justify-content: center; background: transparent; border: 1px dashed #777; border-radius: 3px; padding: 2px 8px; cursor: pointer; color: #aaa; font-size: 10px; font-weight: bold; transition: 0.15s; height: 22px; user-select: none; }
            .j0n4t-pg-basket-add-btn:hover { border-color: #007acc; color: #fff; background: #1a242db0; }
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
            .j0n4t-pg-views, .j0n4t-pg-toggle-gallery-wrap { display: flex; gap: 2px; flex-shrink: 0; background: #1a1a1a80; padding: 2px; border-radius: 4px; border: 1px solid #444; }
            .j0n4t-pg-view-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 3px; cursor: pointer; color: #aaa; background: transparent; transition: 0.15s; }
            .j0n4t-pg-view-btn:hover { background: #333; color: #fff; }
            .j0n4t-pg-view-btn.active { background: #007acc; color: #fff; }
            .j0n4t-pg-view-btn svg, .j0n4t-pg-btn svg { width: 14px; height: 14px; fill: currentColor; }
            .j0n4t-pg-grid { display: grid; gap: 6px; flex-grow: 1; overflow-y: auto; min-height: 60px; align-content: start; margin-top: 2px; }
            .j0n4t-pg-grid.view-small { grid-template-columns: repeat(auto-fill, minmax(55px, 1fr)); }
            .j0n4t-pg-grid.view-big { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
            .j0n4t-pg-grid.view-list { grid-template-columns: 1fr; gap: 4px; }
            .j0n4t-pg-group-header { grid-column: 1 / -1; display: flex; align-items: center; gap: 4px; color: #bdbdbd; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; user-select: none; cursor: pointer; padding: 4px 0; position: relative; }
            .j0n4t-pg-group-header::before { content: "▼"; font-size: 8px; color: #888; transition: transform 0.15s ease; }
            .j0n4t-pg-group-header.collapsed::before { transform: rotate(-90deg); }
            .j0n4t-pg-group-line { flex-grow: 1; height: 1px; background: #bdbdbd40; margin-right: 8px; }
            .j0n4t-pg-group-header .j0n4t-pg-group-rename-tip { display:none }
            .j0n4t-pg-group-header:hover .j0n4t-pg-group-rename-tip { display:block; font-size: 8px; color: #666; font-weight: normal; text-transform: none; opacity: 0; transition: opacity 0.2s ease; pointer-events: none; padding-right: 4px; opacity: 1; }
            .j0n4t-pg-group-header[data-group-raw="root_presets"]:hover .j0n4t-pg-group-rename-tip { display: none; }
            .j0n4t-pg-grid.hide-folders .j0n4t-pg-group-header, .j0n4t-pg-grid.hide-folders .j0n4t-pg-global-collapse-btn { display: none !important; }
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
            .j0n4t-pg-editor-banner { font-size: 10px; font-weight: bold; padding: 4px 6px; border-radius: 3px; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.5px; flex: 1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
            .j0n4t-pg-editor input, .j0n4t-pg-editor textarea { background: #1a1a1ab0; border: 1px solid #444; color: #fff; font-size: 11px; padding: 5px; border-radius: 3px; box-sizing: border-box; width: 100%; }
            .j0n4t-pg-editor textarea { resize: vertical; min-height: 48px; }
            .j0n4t-pg-row { display: flex; gap: 6px; align-items: center; }
            .j0n4t-pg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: #007acc; border: none; color: #fff; padding: 6px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold; text-align: center; box-sizing: border-box; height: 24px; }
            .j0n4t-pg-btn:hover { background: #0062a3; }
            .j0n4t-pg-folder-autocomplete-popup { position: absolute; background: #1f1f1fe8; border: 1px solid #007acc; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 10000; display: flex; flex-direction: column; width: max-content; overflow: hidden; font-family: sans-serif; box-sizing: border-box; }
            .j0n4t-pg-folder-autocomplete-item { padding: 6px 10px; font-size: 11px; color: #ddd; cursor: pointer; border-bottom: 1px solid #333; }
            .j0n4t-pg-folder-autocomplete-item:last-child { border-bottom: none; }
            .j0n4t-pg-folder-autocomplete-item.active { background: #007acc; color: #fff; }
            .j0n4t-pg-editor-preview { position: relative; width: 84px; flex-shrink: 0; border-radius: 3px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #111; cursor: pointer; border: 1px dashed #444; transition: border-color 0.2s; min-height: 84px; }
            .j0n4t-pg-editor-preview:hover { border-color: #007acc; }
            .j0n4t-pg-editor-preview .j0n4t-pg-corner-edit { top: 4px; right: 4px; background: #b23b3b; border-color: #b23b3b; z-index: 10; display: none; }
            .j0n4t-pg-editor-preview:hover .j0n4t-pg-corner-edit { display: flex; }
            .j0n4t-pg-editor-preview img { width: 100%; height: 100%; object-fit: cover; position: absolute; top:0; left:0; }
        `;
        document.head.appendChild(styles);
    }
}

// --- 3. API Actions --- //
class PresetGalleryAPI {
    static async fetchGallery() {
        return (await fetch('/custom_node/live_preset_gallery')).json();
    }
    static async fetchPresetImage(filename) {
        const res = await fetch(`/custom_node/get_preset_image?filename=${encodeURIComponent(filename)}`);
        return res.ok ? res.blob() : null;
    }
    static async savePreset(formData) {
        return (await fetch('/custom_node/save_preset_item', { method: 'POST', body: formData })).json();
    }
    static async deletePreset(uniqueKey) {
        return fetch('/custom_node/delete_preset_item', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unique_key: uniqueKey })
        });
    }
    static async renameFolder(oldFolder, newFolder) {
        return (await fetch('/custom_node/rename_preset_folder', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ old_folder: oldFolder, new_folder: newFolder })
        })).json();
    }
    static async importZip(formData) {
        return (await fetch('/custom_node/import_presets_zip', { method: 'POST', body: formData })).json();
    }
}

// --- 4. Sub-Components --- //
class PresetBasket {
    constructor(container, pool, textarea, context) {
        this.container = container; this.pool = pool; this.textarea = textarea; this.context = context;
        this.dropIndicator = null; this.popupEl = null; this.currentMatches = []; this.activeIndex = 0;
        this.initDragAndDrop(); this.initRawInputSync(); this.initAutocomplete(); this.initBasketActions();
    }

    initDragAndDrop() {
        this.container.addEventListener("dragenter", (e) => { if (!this.container.classList.contains("raw-mode")) { e.preventDefault(); this.container.classList.add("drag-over"); } });
        this.container.addEventListener("dragleave", (e) => { if (e.relatedTarget && this.container.contains(e.relatedTarget)) return; this.container.classList.remove("drag-over"); this.removeDropIndicator(); });
        this.container.addEventListener("dragover", (e) => {
            if (this.container.classList.contains("raw-mode")) return;
            e.preventDefault();
            if (!this.dropIndicator) this.dropIndicator = Object.assign(document.createElement("div"), { className: "j0n4t-pg-basket-drop-indicator" });

            const closest = this.getClosestChip(e.clientX, e.clientY);
            if (closest.element) {
                this.dropIndicator.style.height = `${closest.box.height}px`;
                (e.clientX > (closest.box.left + closest.box.width / 2)) ? closest.element.after(this.dropIndicator) : closest.element.before(this.dropIndicator);
            } else {
                this.pool.appendChild(this.dropIndicator);
                this.dropIndicator.style.height = "12px";
            }
        });
        this.container.addEventListener("drop", (e) => {
            if (this.container.classList.contains("raw-mode")) return;
            e.preventDefault(); this.container.classList.remove("drag-over"); this.removeDropIndicator();
            const styleKey = e.dataTransfer.getData("text/plain");
            if (!styleKey) return;

            let selections = this.context.getSelectedArray();
            if (e.dataTransfer.getData("source/basket")) selections = selections.filter(v => v !== styleKey);

            const closest = this.getClosestChip(e.clientX, e.clientY);
            if (closest.element) {
                let insertionIndex = selections.indexOf(closest.element.dataset.id);
                if (e.clientX > (closest.box.left + closest.box.width / 2)) insertionIndex += 1;
                if (insertionIndex !== -1) selections.splice(insertionIndex, 0, styleKey);
                else selections.push(styleKey);
            } else if (!selections.includes(styleKey)) selections.push(styleKey);

            this.context.updateWidgetValue([...new Set(selections)]);
        });
    }

    initRawInputSync() {
        this.textarea.addEventListener("change", () => this.context.updateWidgetValue(this.textarea.value.split(",").map(i => i.trim()).filter(Boolean)));
        this.textarea.addEventListener("mousedown", (e) => e.stopPropagation());
    }

    initAutocomplete() {
        this.textarea.addEventListener("click", () => this.closePopup());
        this.textarea.addEventListener("input", () => { if (this.container.classList.contains("raw-mode")) this.evaluateAutocomplete(); });
        this.textarea.addEventListener("keydown", (e) => {
            if (e.key === "ArrowRight" && this.textarea.selectionStart === this.textarea.value.length) return this.selectMatch(this.currentMatches[this.activeIndex], e);
            if (!this.popupEl || !this.currentMatches.length) return;

            if (["Tab", "Enter"].includes(e.key) && !e.ctrlKey) this.selectMatch(this.currentMatches[this.activeIndex], e);
            else if (e.key === "ArrowDown") { e.preventDefault(); this.activeIndex = (this.activeIndex + 1) % this.currentMatches.length; this.renderActiveItemHighlight(); }
            else if (e.key === "ArrowUp") { e.preventDefault(); this.activeIndex = (this.activeIndex - 1 + this.currentMatches.length) % this.currentMatches.length; this.renderActiveItemHighlight(); }
            else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.closePopup(); }
        });
        this.textarea.addEventListener("blur", () => setTimeout(() => this.closePopup(), 180));
    }

    initBasketActions() {
        const { dom } = this.context;
        dom.btnClearBasket.addEventListener("click", () => { if (this.context.getSelectedArray().length && confirm("Empty basket?")) this.context.updateWidgetValue([]); });

        dom.chkBasketRaw.checked = localStorage.getItem("comfy_preset_gallery_raw_basket") === "true";
        dom.basketContainer.classList.toggle("raw-mode", dom.chkBasketRaw.checked);
        dom.chkBasketRaw.addEventListener("change", () => {
            localStorage.setItem("comfy_preset_gallery_raw_basket", String(dom.chkBasketRaw.checked));
            dom.basketContainer.classList.toggle("raw-mode", dom.chkBasketRaw.checked);
        });

        dom.btnCopyBasket.addEventListener("click", () => {
            const text = this.context.getSelectedArray().map(key => this.context.cache[key]?.preset || key).filter(Boolean).join(", ");
            if (!text) return;
            navigator.clipboard.writeText(text).then(() => {
                const origBg = dom.btnCopyBasket.style.background;
                dom.btnCopyBasket.innerText = "✅ Copied!"; dom.btnCopyBasket.style.background = "#228b22";
                setTimeout(() => { dom.btnCopyBasket.innerText = "📋 Copy"; dom.btnCopyBasket.style.background = origBg; }, 1500);
            });
        });
    }

    evaluateAutocomplete() {
        const text = this.textarea.value;
        const caretPos = this.textarea.selectionStart;
        const lastCommaIndex = text.slice(0, caretPos).lastIndexOf(",");
        const currentToken = (lastCommaIndex === -1 ? text.slice(0, caretPos) : text.slice(lastCommaIndex + 1, caretPos)).trimStart();

        if (!currentToken) return this.closePopup();

        this.currentMatches = PresetUtils.getTopMatches(Object.keys(this.context.cache), currentToken);
        if (!this.currentMatches.length) return this.closePopup();

        this.activeIndex = 0;
        this.showPopup(lastCommaIndex + 1, currentToken);
    }

    showPopup(tokenStartIndex, currentToken) {
        if (!this.popupEl) {
            this.popupEl = Object.assign(document.createElement("div"), { className: "j0n4t-pg-autocomplete-popup" });
            this.popupEl.addEventListener("mousedown", (e) => e.stopPropagation());
            this.container.appendChild(this.popupEl);
        }

        const rect = this.textarea.getBoundingClientRect(), cRect = this.container.getBoundingClientRect(), zoom = cRect.width / this.container.offsetWidth || 1;
        this.popupEl.style.top = `${(rect.bottom - cRect.top) / zoom + 2}px`;
        this.popupEl.style.left = `${(rect.left - cRect.left) / zoom}px`;
        this.popupEl.style.width = `${Math.max(200, rect.width / zoom)}px`; // Ensure it's wide enough for the split content
        this.popupEl.innerHTML = "";

        this.currentMatches.forEach((match, idx) => {
            const row = document.createElement("div");
            row.className = `j0n4t-pg-autocomplete-item${idx === this.activeIndex ? ' active' : ''}`;
            row.innerHTML = `<span>${PresetUtils.escapeHTML(PresetUtils.toTitleCase(match.split("/").pop()))}</span><span class="j0n4t-pg-autocomplete-meta">${PresetUtils.escapeHTML(match)}</span>`;
            row.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); this.selectMatch(match); });
            this.popupEl.appendChild(row);
        });
    }

    renderActiveItemHighlight() {
        this.popupEl?.querySelectorAll(".j0n4t-pg-autocomplete-item").forEach((item, i) => item.classList.toggle("active", i === this.activeIndex));
    }

    selectMatch(matchedKey, event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        const leftText = this.textarea.value.slice(0, this.textarea.selectionStart);
        const prefix = leftText.lastIndexOf(",") === -1 ? "" : leftText.slice(0, leftText.lastIndexOf(",") + 1) + " ";
        
        this.textarea.value = prefix + matchedKey + "," + this.textarea.value.slice(this.textarea.selectionStart);
        this.closePopup();
        this.context.updateWidgetValue(this.textarea.value.split(",").map(i => i.trim()).filter(Boolean));
        
        this.textarea.focus();
        this.textarea.selectionStart = this.textarea.selectionEnd = prefix.length + matchedKey.length + 2;
    }

    closePopup() { this.popupEl?.remove(); this.popupEl = null; this.currentMatches = []; }
    removeDropIndicator() { this.dropIndicator?.remove(); this.dropIndicator = null; }

    getClosestChip(clientX, clientY) {
        return [...this.pool.querySelectorAll(".j0n4t-pg-basket-chip:not(.dragging)")].reduce((closest, el) => {
            const box = el.getBoundingClientRect();
            const dist = Math.hypot(clientX - (box.left + box.width / 2), clientY - (box.top + box.height / 2));
            return dist < closest.distance ? { distance: dist, element: el, box } : closest;
        }, { distance: Infinity, element: null, box: null });
    }

    spawnInlineEditor(chipElement, initialValue) {
        const isNew = !chipElement;
        if (isNew) {
            chipElement = Object.assign(document.createElement("div"), { className: "j0n4t-pg-basket-chip inline-editing" });
            const addBtn = this.pool.querySelector(".j0n4t-pg-basket-add-btn");
            addBtn ? addBtn.before(chipElement) : this.pool.appendChild(chipElement);
        } else {
            if (chipElement.classList.contains("inline-editing")) return;
            chipElement.classList.add("inline-editing"); chipElement.draggable = false;
            const label = chipElement.querySelector(".j0n4t-pg-basket-chip-label");
            if (label) label.style.display = "none";
        }

        const input = Object.assign(document.createElement("input"), { type: "text", className: "j0n4t-pg-inline-edit", value: initialValue || "" });
        chipElement.prepend(input); input.focus(); input.selectionStart = input.selectionEnd = input.value.length;

        let popup = null, matches = [], activeIdx = 0;
        const closeInlinePopup = () => { popup?.remove(); popup = null; matches = []; };
        const highlight = () => popup?.querySelectorAll(".j0n4t-pg-autocomplete-item").forEach((item, i) => item.classList.toggle("active", i === activeIdx));

        const finishEdit = (save) => {
            const newVal = input.value.trim();
            closeInlinePopup();
            try { input.remove(); } catch (e) {}

            if (isNew) chipElement.remove();
            else {
                chipElement.classList.remove("inline-editing"); chipElement.draggable = true;
                const label = chipElement.querySelector(".j0n4t-pg-basket-chip-label");
                if (label) label.style.display = "";
            }

            if (save) {
                const selections = this.context.getSelectedArray();
                if (isNew && newVal && !selections.includes(newVal)) { selections.push(newVal); this.context.updateWidgetValue(selections); }
                else if (!isNew && newVal !== initialValue) {
                    const idx = selections.indexOf(initialValue);
                    if (idx !== -1) { newVal ? selections[idx] = newVal : selections.splice(idx, 1); this.context.updateWidgetValue(selections); }
                }
            }
        };

        input.addEventListener("input", () => {
            closeInlinePopup();
            const query = input.value.trim().toLowerCase();
            if (!query) return;
            matches = PresetUtils.getTopMatches(Object.keys(this.context.cache), query);
            if (!matches.length) return;

            activeIdx = 0;
            popup = Object.assign(document.createElement("div"), { className: "j0n4t-pg-autocomplete-popup" });
            const rect = input.getBoundingClientRect(), cRect = this.container.getBoundingClientRect(), zoom = cRect.width / this.container.offsetWidth || 1;
            popup.style.top = `${(rect.bottom - cRect.top) / zoom + 2}px`; popup.style.left = `${(rect.left - cRect.left) / zoom}px`; popup.style.minWidth = `${Math.max(200, rect.width / zoom)}px`;

            this.container.appendChild(popup);
            matches.forEach((match, idx) => {
                const row = document.createElement("div");
                row.className = `j0n4t-pg-autocomplete-item${idx === activeIdx ? ' active' : ''}`;
                row.innerHTML = `<span>${PresetUtils.escapeHTML(PresetUtils.toTitleCase(match.split("/").pop()))}</span><span class="j0n4t-pg-autocomplete-meta">${PresetUtils.escapeHTML(match)}</span>`;
                row.addEventListener("mousedown", (e) => { e.preventDefault(); input.value = match; finishEdit(true); });
                popup.appendChild(row);
            });
        });

        input.addEventListener("blur", () => finishEdit(true));
        input.addEventListener("keydown", (ev) => {
            if (popup && matches.length) {
                if (["Tab", "Enter"].includes(ev.key) && !ev.ctrlKey) { ev.preventDefault(); input.value = matches[activeIdx]; finishEdit(true); }
                else if (ev.key === "ArrowDown") { ev.preventDefault(); activeIdx = (activeIdx + 1) % matches.length; highlight(); }
                else if (ev.key === "ArrowUp") { ev.preventDefault(); activeIdx = (activeIdx - 1 + matches.length) % matches.length; highlight(); }
            } else if (ev.key === "Enter") { ev.preventDefault(); finishEdit(true); }
            else if (ev.key === "Escape") { ev.preventDefault(); finishEdit(false); }
        });
    }

    render(activeList) {
        this.textarea.value = activeList.join(", ");
        this.pool.innerHTML = "";

        activeList.forEach((styleKey) => {
            const item = this.context.cache[styleKey];
            const cleanLabel = item ? PresetUtils.toTitleCase(styleKey.split("/").pop()) : styleKey;
            
            const chip = Object.assign(document.createElement("div"), { className: "j0n4t-pg-basket-chip", draggable: true, title: item ? `${cleanLabel} [${styleKey}]\n${item.preset}` : styleKey });
            chip.dataset.id = styleKey;

            const thumbStyle = item?.filename ? `background-image: url('/custom_node/get_preset_image?filename=${encodeURIComponent(item.filename)}');` : `background-color: ${PresetUtils.getPresetColor(styleKey)};`;
            chip.innerHTML = `
                <div class="j0n4t-pg-basket-chip-thumb" style="${thumbStyle}">${item?.filename ? '' : PresetUtils.escapeHTML(PresetUtils.getInitials(styleKey).slice(0, 4))}</div>
                <div class="j0n4t-pg-basket-chip-label" title="${PresetUtils.escapeHTML(styleKey)}">${PresetUtils.escapeHTML(cleanLabel)}</div>
                <div class="j0n4t-pg-action-btn edit-btn" title="Edit Preset">${PresetUtils.icons.edit}</div>
                <div class="j0n4t-pg-action-btn del-btn" title="Remove">${PresetUtils.icons.close}</div>
            `;

            chip.addEventListener("click", (e) => {
                if (e.target.closest(".j0n4t-pg-action-btn")) return;
                const itemEl = this.context.dom.grid.querySelector(`.j0n4t-pg-item[data-style="${styleKey}"]`);
                if (itemEl) {
                    this.context.dom.search.value = "";
                    let prev = itemEl.previousElementSibling;
                    while (prev && !prev.classList.contains("j0n4t-pg-group-header")) prev = prev.previousElementSibling;
                    if (prev?.classList.contains("collapsed")) {
                        prev.classList.remove("collapsed");
                        this.context.setCollapsedFolders(this.context.getCollapsedFolders().filter(f => f !== prev.dataset.groupRaw));
                    }
                    this.context.grid.executeFilterPipeline();
                    itemEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    
                    itemEl.style.transition = "border-color 0.15s, box-shadow 0.15s";
                    const origColor = itemEl.style.borderColor;
                    itemEl.style.borderColor = "#007acc"; itemEl.style.boxShadow = "0 0 8px rgba(0, 122, 204, 0.75)";
                    setTimeout(() => { itemEl.style.borderColor = origColor; itemEl.style.boxShadow = ""; }, 800);
                }
            });

            chip.querySelector(".edit-btn").addEventListener("click", (e) => { e.stopPropagation(); item ? this.context.openEditorForPreset(styleKey) : this.spawnInlineEditor(chip, styleKey); });
            chip.querySelector(".del-btn").addEventListener("click", (e) => { e.stopPropagation(); this.context.updateWidgetValue(this.context.getSelectedArray().filter(v => v !== styleKey)); });
            chip.addEventListener("dblclick", (e) => { e.stopPropagation(); this.spawnInlineEditor(chip, styleKey); });
            chip.addEventListener("dragstart", (e) => { chip.classList.add("dragging"); e.dataTransfer.setData("text/plain", styleKey); e.dataTransfer.setData("source/basket", "true"); });
            chip.addEventListener("dragend", () => { chip.classList.remove("dragging"); this.removeDropIndicator(); });
            this.pool.appendChild(chip);
        });

        const addBtn = Object.assign(document.createElement("div"), { className: "j0n4t-pg-basket-add-btn", innerText: "+ Add", title: "Add new preset or keyword" });
        addBtn.addEventListener("click", (e) => { e.stopPropagation(); this.spawnInlineEditor(null, ""); });
        this.pool.appendChild(addBtn);
    }
}

class PresetGrid {
    constructor(dom, context) { this.dom = dom; this.context = context; this.bindEvents(); }

    switchView(viewName) {
        ['small', 'big', 'list'].forEach(v => this.dom.grid.classList.remove(`view-${v}`));
        this.dom.viewsContainer.querySelectorAll(".j0n4t-pg-view-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewName));
        this.dom.grid.classList.add(`view-${viewName}`);
        localStorage.setItem("comfy_preset_gallery_view", viewName);
    }

    executeFilterPipeline(query = "") {
        const queryWords = query.toLowerCase().trim() ? query.toLowerCase().trim().split(/\s+/) : [];
        this.dom.searchClear.style.display = query ? "flex" : "none";

        this.dom.grid.querySelectorAll(".j0n4t-pg-item").forEach(el => {
            el.classList.toggle("j0n4t-pg-hidden", queryWords.length && !queryWords.every(word => el.dataset.searchBlob.includes(word)));
        });

        this.dom.grid.querySelectorAll(".j0n4t-pg-group-header").forEach(header => {
            let next = header.nextElementSibling, hasVisibleChildren = false;
            while (next && !next.classList.contains("j0n4t-pg-group-header")) {
                const matches = !queryWords.length || queryWords.every(word => (next.dataset.searchBlob || "").includes(word));
                if (matches) { hasVisibleChildren = true; next.classList.toggle("j0n4t-pg-hidden", header.classList.contains("collapsed")); } 
                else next.classList.add("j0n4t-pg-hidden");
                next = next.nextElementSibling;
            }
            header.classList.toggle("j0n4t-pg-hidden", !hasVisibleChildren);
        });
    }

    compile(cache) {
        let htmlBuffer = "", lastGroup = null;
        const collapsedList = this.context.getCollapsedFolders();
        
        const sortedKeys = Object.keys(cache).sort((a, b) => {
            const groupA = cache[a].tags?.length ? cache[a].tags.join(" > ") : "root_presets";
            const groupB = cache[b].tags?.length ? cache[b].tags.join(" > ") : "root_presets";
            if (groupA === "root_presets" && groupB !== "root_presets") return -1;
            if (groupB === "root_presets" && groupA !== "root_presets") return 1;
            return groupA !== groupB ? groupA.localeCompare(groupB) : a.localeCompare(b);
        });

        sortedKeys.forEach(key => {
            const item = cache[key];
            const cleanLabel = PresetUtils.toTitleCase(key.split("/").pop()), initials = PresetUtils.getInitials(key);
            const searchBlob = `${key} ${initials} ${item.preset} ${(item.tags || []).join(' ')}`.toLowerCase();
            const uiGroup = item.tags?.length ? item.tags.map(PresetUtils.toTitleCase).join(" › ") : "Root Presets";
            const rawGroup = item.tags?.length ? item.tags.join("/") : "root_presets";

            if (uiGroup !== lastGroup) {
                lastGroup = uiGroup;
                htmlBuffer += `<div class="j0n4t-pg-group-header${collapsedList.includes(rawGroup) ? " collapsed" : ""}" data-group="${PresetUtils.escapeHTML(uiGroup)}" data-group-raw="${PresetUtils.escapeHTML(rawGroup)}">
                    <span>${PresetUtils.escapeHTML(uiGroup)}</span><div class="j0n4t-pg-group-line"></div><span class="j0n4t-pg-group-rename-tip">Right-click to rename</span></div>`;
            }

            const thumb = item.filename 
                ? `<img class="j0n4t-pg-img" src="/custom_node/get_preset_image?filename=${encodeURIComponent(item.filename)}" loading="lazy">`
                : `<div style="background-color: ${PresetUtils.getPresetColor(key)}; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#fff;">${PresetUtils.icons.file}</div>`;
            const badge = item.tags?.length ? `<div class="j0n4t-pg-tag-badge">${PresetUtils.escapeHTML(PresetUtils.toTitleCase(item.tags[item.tags.length - 1]))}</div>` : '';

            htmlBuffer += `<div class="j0n4t-pg-item" data-style="${PresetUtils.escapeHTML(key)}" data-search-blob="${PresetUtils.escapeHTML(searchBlob)}" draggable="true" title="${PresetUtils.escapeHTML(cleanLabel)} [${PresetUtils.escapeHTML(key)}]\n${PresetUtils.escapeHTML(item.preset || '')}">
                ${badge}<div class="j0n4t-pg-corner-edit" title="Edit">${PresetUtils.icons.edit}</div><div class="j0n4t-pg-thumb-box">${thumb}<div class="j0n4t-pg-initials">${PresetUtils.escapeHTML(initials)}</div></div><div class="j0n4t-pg-label">${PresetUtils.escapeHTML(cleanLabel)}</div></div>`;
        });

        this.dom.grid.innerHTML = htmlBuffer || `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#666; font-size:11px;">No presets found</div>`;
        this.dom.btnGlobalCollapse.innerText = collapsedList.length > (this.dom.grid.querySelectorAll(".j0n4t-pg-group-header").length / 2) ? "↕️ Expand All" : "↕️ Collapse All";
        this.attachGridItemEvents();
        this.switchView(localStorage.getItem("comfy_preset_gallery_view") || "big");
        this.executeFilterPipeline(this.dom.search.value);
        this.context.syncEditorHighlight();
    }

    attachGridItemEvents() {
        this.dom.grid.querySelectorAll(".j0n4t-pg-group-header").forEach(header => {
            const rawFolder = header.dataset.groupRaw;
            header.addEventListener("click", () => {
                const isCollapsed = header.classList.toggle("collapsed");
                let list = this.context.getCollapsedFolders();
                isCollapsed ? (!list.includes(rawFolder) && list.push(rawFolder)) : (list = list.filter(i => i !== rawFolder));
                this.context.setCollapsedFolders(list);
                this.dom.btnGlobalCollapse.innerText = list.length > (this.dom.grid.querySelectorAll(".j0n4t-pg-group-header").length / 2) ? "↕️ Expand All" : "↕️ Collapse All";
                this.executeFilterPipeline(this.dom.search.value);
            });
            header.addEventListener("contextmenu", async (e) => {
                if (rawFolder === "root_presets") return;
                e.preventDefault(); e.stopPropagation();
                const newName = prompt(`Rename folder "${rawFolder.replace(/_/g, " ")}" to:`, rawFolder.replace(/_/g, " "))?.trim().toLowerCase().replace(/ /g, "_");
                if (!newName || newName === rawFolder) return;
                const res = await PresetGalleryAPI.renameFolder(rawFolder, newName);
                if (res.success) {
                    this.context.setCollapsedFolders(this.context.getCollapsedFolders().filter(i => i !== rawFolder));
                    await this.context.loadGallery();
                    this.context.updateWidgetValue(this.context.getSelectedArray().map(i => i.startsWith(`${rawFolder}/`) ? i.replace(`${rawFolder}/`, `${newName}/`) : i));
                } else alert(`Rename failed: ${res.error}`);
            });
        });

        this.dom.grid.querySelectorAll(".j0n4t-pg-item").forEach(item => {
            item.addEventListener("dragstart", (e) => { item.classList.add("dragging"); e.dataTransfer.effectAllowed = "copyMove"; e.dataTransfer.setData("text/plain", item.dataset.style); e.dataTransfer.setData("source/grid", "true"); });
            item.addEventListener("dragend", () => item.classList.remove("dragging"));
            item.querySelector(".j0n4t-pg-corner-edit").addEventListener("click", (e) => { e.stopPropagation(); this.context.openEditorForPreset(item.dataset.style); });
        });
    }

    syncSelection(activeList) {
        this.dom.grid.querySelectorAll(".j0n4t-pg-item").forEach(el => el.classList.toggle("selected", activeList.includes(el.dataset.style)));
    }

    bindEvents() {
        this.dom.viewsContainer.addEventListener("click", (e) => { const btn = e.target.closest(".j0n4t-pg-view-btn"); if (btn) this.switchView(btn.dataset.view); });
        
        this.dom.chkGroup.checked = localStorage.getItem("comfy_preset_gallery_grouped") !== "false";
        this.dom.grid.classList.toggle("hide-folders", !this.dom.chkGroup.checked);
        this.dom.btnGlobalCollapse.style.display = this.dom.chkGroup.checked ? "block" : "none";
        
        this.dom.chkGroup.addEventListener("change", () => {
            localStorage.setItem("comfy_preset_gallery_grouped", String(this.dom.chkGroup.checked));
            this.dom.grid.classList.toggle("hide-folders", !this.dom.chkGroup.checked);
            this.dom.btnGlobalCollapse.style.display = this.dom.chkGroup.checked ? "block" : "none";
            this.executeFilterPipeline(this.dom.search.value);
        });

        this.dom.btnGlobalCollapse.addEventListener("click", () => {
            const headers = this.dom.grid.querySelectorAll(".j0n4t-pg-group-header");
            const collapseAll = !this.dom.btnGlobalCollapse.innerText.includes("Expand");
            this.context.setCollapsedFolders(collapseAll ? [...headers].map(h => h.dataset.groupRaw) : []);
            this.dom.btnGlobalCollapse.innerText = collapseAll ? "↕️ Expand All" : "↕️ Collapse All";
            headers.forEach(h => h.classList.toggle("collapsed", collapseAll));
            this.executeFilterPipeline(this.dom.search.value);
        });

        this.dom.grid.addEventListener("click", (e) => {
            if (e.target.closest(".j0n4t-pg-corner-edit") || e.target.closest(".j0n4t-pg-group-header")) return;
            const item = e.target.closest(".j0n4t-pg-item");
            if (!item || !this.context.widget.callback) return;
            const key = item.dataset.style;
            let sel = this.context.getSelectedArray();
            this.context.updateWidgetValue(sel.includes(key) ? sel.filter(v => v !== key) : [...sel, key]);
        });
    }
}

class PresetEditor {
    constructor(dom, context) {
        this.dom = dom; this.context = context;
        this.fetchedBlobImage = null; this.localPreviewUrl = null;
        this.editingKey = ""; this.currentMode = "new"; this.isSaved = false;
        this.bindEvents(); this.initFolderAutocomplete();
    }

    renderPreview() {
        const rmBtnHtml = `<div class="j0n4t-pg-corner-edit" id="j0n4t-pg-rm-img-btn" title="Remove Image">${PresetUtils.icons.close}</div>`;
        if (this.dom.editor.classList.contains("has-image")) {
            let imgSrc = "";
            if (this.dom.inpFile.files?.[0]) {
                if (this.localPreviewUrl) URL.revokeObjectURL(this.localPreviewUrl);
                imgSrc = this.localPreviewUrl = URL.createObjectURL(this.dom.inpFile.files[0]);
            } else if (this.editingKey && this.context.cache[this.editingKey]?.filename) {
                imgSrc = `/custom_node/get_preset_image?filename=${encodeURIComponent(this.context.cache[this.editingKey].filename)}&t=${Date.now()}`;
            }
            if (imgSrc) { this.dom.editorPreview.innerHTML = `${rmBtnHtml}<img src="${imgSrc}" />`; return; }
        }

        const uniqueKey = (this.dom.inpFolder.value.trim() ? `${this.dom.inpFolder.value.trim()}/` : "") + (this.dom.inpName.value.trim() || "New");
        this.dom.editorPreview.innerHTML = `<div style="background-color: ${PresetUtils.getPresetColor(uniqueKey)}; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#fff; position:absolute;">${PresetUtils.icons.file}<div class="j0n4t-pg-initials" style="font-size:14px;">${PresetUtils.escapeHTML(PresetUtils.getInitials(uniqueKey))}</div></div>`;
    }

    updateBanner() {
        const { banner, btnSave } = this.dom;
        if (this.currentMode === "new") {
            banner.innerText = "✨ Creating New Preset"; banner.style.color = "#32d332"; banner.style.background = "#228b2220";
            btnSave.innerText = "Save"; btnSave.style.background = "#007acc";
        } else if (this.editingKey) {
            banner.innerText = `${this.isSaved ? '✅' : '📝'} ${this.editingKey}`; banner.title = banner.innerText;
            banner.style.color = this.isSaved ? "#fff" : "#f0bc2f"; banner.style.background = "#d1a11920";
            btnSave.innerText = this.isSaved ? "Saved!" : "Save"; btnSave.style.background = this.isSaved ? "#007acc" : "#007acc";
        } else {
            banner.innerText = "📝 Select Edit ✏️ on an Preset"; banner.style.color = "#888"; banner.style.background = "#33333330";
        }
    }

    resetImageState() {
        this.fetchedBlobImage = null; this.dom.inpFile.value = "";
        this.dom.editor.classList.remove("has-image"); this.dom.editor.classList.add("no-image");
        if (this.localPreviewUrl) { URL.revokeObjectURL(this.localPreviewUrl); this.localPreviewUrl = null; }
        this.renderPreview();
    }

    clearFields() {
        this.currentMode = "new"; this.editingKey = ""; this.isSaved = false;
        this.dom.inpName.value = ""; this.dom.inpFolder.value = ""; this.dom.inpPreset.value = "";
        this.resetImageState(); this.updateBanner(); this.context.syncEditorHighlight();
    }

    async openPreset(styleKey) {
        if (!this.context.cache[styleKey]) return;
        this.context.setPanelCollapseState(false); this.resetImageState();
        this.editingKey = styleKey; this.currentMode = "edit"; this.isSaved = true;

        const parts = styleKey.split("/");
        this.dom.inpName.value = parts.pop() || ""; this.dom.inpFolder.value = parts.join("/");
        this.dom.inpPreset.value = this.context.cache[styleKey].preset || "";

        if (this.context.cache[styleKey].filename) {
            this.dom.editor.classList.replace("no-image", "has-image");
            this.renderPreview();
            try {
                const blob = await PresetGalleryAPI.fetchPresetImage(this.context.cache[styleKey].filename);
                if (this.editingKey === styleKey) this.fetchedBlobImage = blob;
            } catch (err) { this.resetImageState(); }
        } else this.renderPreview();

        this.updateBanner(); this.context.syncEditorHighlight();
    }

    async handleSave() {
        let name = this.dom.inpName.value.trim().toLowerCase().replace(/ /g, "_");
        if (!name) {
            const pt = this.dom.inpPreset.value.trim();
            if (!pt) return alert("Keywords or Name required to save.");
            name = pt.split(/\s+/).slice(0, 3).map(w => w.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()).filter(Boolean).join("_") || `unnamed_preset_${Date.now().toString().slice(-4)}`;
            this.dom.inpName.value = name;
        }

        const uniqueKey = (this.dom.inpFolder.value.trim() ? `${this.dom.inpFolder.value.trim().toLowerCase().replace(/ /g, "_")}/` : "") + name;
        let selections = this.context.getSelectedArray();

        if (this.currentMode === "new") {
            if (this.context.cache[uniqueKey] && !confirm(`Overwrite "${uniqueKey}"?`)) return;
            if (this.dom.editor.classList.contains("no-image")) { this.fetchedBlobImage = null; this.dom.inpFile.value = ""; }
        }

        const fd = new FormData();
        fd.append("preset_name", name); fd.append("subfolder", this.dom.inpFolder.value.trim().toLowerCase().replace(/ /g, "_"));
        fd.append("preset_text", this.dom.inpPreset.value.trim()); fd.append("overwrite", "true");

        if (this.dom.inpFile.files[0]) fd.append("image_file", this.dom.inpFile.files[0]);
        else if (this.fetchedBlobImage && !this.dom.editor.classList.contains("no-image")) fd.append("image_file", this.fetchedBlobImage, "image.jpg");
        else fd.append("clear_image", "true");

        const res = await PresetGalleryAPI.savePreset(fd);
        if (!res.success) return alert(`Save failed: ${res.error}`);

        if (this.currentMode === "edit" && this.editingKey !== uniqueKey && this.context.cache[this.editingKey]) {
            await PresetGalleryAPI.deletePreset(this.editingKey);
            selections = selections.map(item => item === this.editingKey ? uniqueKey : item);
        }

        if (!selections.includes(uniqueKey)) selections.push(uniqueKey);

        this.editingKey = uniqueKey; this.currentMode = "edit"; this.isSaved = true;
        await this.context.loadGallery(); this.context.updateWidgetValue(selections); this.updateBanner();
    }

    async handleDelete() {
        if (!this.editingKey || !this.context.cache[this.editingKey]) return alert("No valid target.");
        if (!confirm(`Delete "${this.editingKey}"?`)) return;

        await PresetGalleryAPI.deletePreset(this.editingKey);
        await this.context.loadGallery();
        this.context.updateWidgetValue(this.context.getSelectedArray().filter(v => v !== this.editingKey));
        this.clearFields();
    }

    bindEvents() {
        const markDirty = () => {
            if (this.currentMode === "edit" && this.isSaved) { this.isSaved = false; this.updateBanner(); }
            if (this.dom.editor.classList.contains("no-image")) this.renderPreview();
        };

        ['inpName', 'inpFolder', 'inpPreset'].forEach(id => this.dom[id].addEventListener("input", markDirty));
        this.dom.editorPreview.addEventListener("click", (e) => {
            if (e.target.closest("#j0n4t-pg-rm-img-btn")) { e.stopPropagation(); if (confirm("Clear image?")) { this.resetImageState(); markDirty(); } } 
            else this.dom.inpFile.click();
        });
        this.dom.inpFile.addEventListener("change", () => { if (this.dom.inpFile.files[0]) { this.fetchedBlobImage = null; this.dom.editor.classList.replace("no-image", "has-image"); this.renderPreview(); markDirty(); } });

        const handleQuickSave = (e) => { if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); this.dom.btnSave.click(); } };
        ['inpName', 'inpFolder', 'inpPreset'].forEach(id => this.dom[id].addEventListener("keydown", handleQuickSave));

        this.dom.inpPreset.addEventListener("paste", (e) => {
            if (!this.dom.inpName.value.trim() || this.currentMode === "new") {
                const text = (e.clipboardData || window.clipboardData).getData("text");
                if (text) {
                    const suggested = text.split(/[,\n]/)[0].trim().toLowerCase().replace(/[^a-z0-9\s-_]/g, "").trim().replace(/\s+/g, "_").split("_").slice(0, 4).join("_");
                    if (suggested) { this.dom.inpName.value = suggested; markDirty(); }
                }
            }
        });

        this.dom.btnClearFields.addEventListener("click", () => this.clearFields());
        this.dom.btnSave.addEventListener("click", () => this.handleSave());
        this.dom.btnDel.addEventListener("click", () => this.handleDelete());
    }

    initFolderAutocomplete() {
        const input = this.dom.inpFolder;
        let popup = null, matches = [], activeIdx = 0;

        const close = () => { popup?.remove(); popup = null; matches = []; };
        const select = (val) => { input.value = val; close(); input.focus(); };

        input.addEventListener("input", () => {
            const query = input.value.trim().toLowerCase().replace(/ /g, "_");
            close(); if (!query) return;

            matches = Array.from(new Set(Object.values(this.context.cache).flatMap(i => i.tags?.length ? [i.tags.join("/")] : []))).filter(f => f.toLowerCase().includes(query));
            if (!matches.length) return;

            activeIdx = 0;
            popup = Object.assign(document.createElement("div"), { className: "j0n4t-pg-folder-autocomplete-popup" });
            const rect = input.getBoundingClientRect();
            popup.style.top = `${window.scrollY + rect.bottom + 2}px`; popup.style.left = `${window.scrollX + rect.left}px`; popup.style.minWidth = `${rect.width}px`;

            document.body.appendChild(popup);
            matches.forEach((folder, i) => {
                const row = document.createElement("div"); row.className = `j0n4t-pg-folder-autocomplete-item${i === activeIdx ? ' active' : ''}`;
                row.innerText = folder.replace(/_/g, " ");
                row.addEventListener("mousedown", (e) => { e.preventDefault(); select(folder); });
                popup.appendChild(row);
            });
        });

        input.addEventListener("keydown", (e) => {
            if (!popup) return;
            if (["Tab", "Enter"].includes(e.key) && !e.ctrlKey) { e.preventDefault(); select(matches[activeIdx]); }
            else if (e.key === "ArrowDown") { e.preventDefault(); activeIdx = (activeIdx + 1) % matches.length; popup.querySelectorAll(".j0n4t-pg-folder-autocomplete-item").forEach((item, i) => item.classList.toggle("active", i === activeIdx)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); activeIdx = (activeIdx - 1 + matches.length) % matches.length; popup.querySelectorAll(".j0n4t-pg-folder-autocomplete-item").forEach((item, i) => item.classList.toggle("active", i === activeIdx)); }
            else if (e.key === "Escape") { e.preventDefault(); close(); }
        });
        input.addEventListener("blur", () => setTimeout(close, 200));
    }
}

// --- 5. Main App Controller --- //
class PresetGalleryApp {
    constructor(node, widget) {
        this.node = node; this.widget = widget; this.cache = {};
        this.dom = this.buildDOMStructure();
        
        this.basket = new PresetBasket(this.dom.basketContainer, this.dom.wrap.querySelector(".j0n4t-pg-basket-pool"), this.dom.rawTextarea, this);
        this.editor = new PresetEditor(this.dom, this);
        this.grid = new PresetGrid(this.dom, this);

        this.bindEvents(); this.editor.renderPreview();
    }

    buildDOMStructure() {
        const wrap = document.createElement("div"); wrap.className = "j0n4t-pg-wrap";
        wrap.innerHTML = `
            <div class="j0n4t-pg-basket-container">
                <div class="j0n4t-pg-basket-header">
                    <div class="j0n4t-pg-basket-title">🧺 Presets Basket</div>
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <label class="j0n4t-pg-checkbox-wrap" style="height:auto; padding:0; margin-right:4px;"><input type="checkbox" id="j0n4t-pg-basket-raw-toggle" />Raw</label>
                        <button type="button" id="j0n4t-pg-basket-copy-btn" title="Copy" style="font-size:9px; color:#fff; background:#444; border:none; padding:2px 6px; border-radius:3px; cursor:pointer;">📋 Copy</button>
                        <button type="button" class="j0n4t-pg-basket-clear-btn" title="Clear" style="font-size:9px; color:#fff; background:#b23b3b; border:none; padding:2px 6px; border-radius:3px; cursor:pointer;">🗑️ Clear</button>
                    </div>
                </div>
                <div class="j0n4t-pg-basket-pool"></div>
                <div class="j0n4t-pg-raw-wrapper"><textarea class="j0n4t-pg-basket-raw-textarea" id="j0n4t-pg-raw-input" placeholder="Tokens..."></textarea></div>
            </div>
            <div class="j0n4t-pg-top-bar">
                <div class="j0n4t-pg-search-wrapper"><input type="text" class="j0n4t-pg-search" placeholder="Search..." /><div class="j0n4t-pg-search-clear">${PresetUtils.icons.close}</div></div>
                <div class="j0n4t-pg-views">
                    <div class="j0n4t-pg-view-btn" data-view="small">${PresetUtils.icons.small}</div><div class="j0n4t-pg-view-btn" data-view="big">${PresetUtils.icons.big}</div><div class="j0n4t-pg-view-btn" data-view="list">${PresetUtils.icons.list}</div>
                </div>
                <div class="j0n4t-pg-toggle-gallery-wrap"><div class="j0n4t-pg-view-btn active" id="j0n4t-pg-hide-gallery-btn">${PresetUtils.icons.eye}</div></div>
            </div>
            <div class="j0n4t-pg-grid"></div>
            <div class="j0n4t-pg-control-bar">
                <div class="j0n4t-pg-toggle" id="j0n4t-pg-toggle">⚙️ Panel</div>
                <button type="button" id="j0n4t-pg-global-collapse" style="background:#2a2a2a80; border:1px solid #444; color:#ccc; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:10px;">↕️ Collapse All</button>
                <label class="j0n4t-pg-checkbox-wrap"><input type="checkbox" id="j0n4t-pg-group-toggle" />Group</label>
            </div>
            <div class="j0n4t-pg-editor collapsed no-image">
                <div class="j0n4t-pg-row">
                    <div id="j0n4t-pg-banner" class="j0n4t-pg-editor-banner">📝 Select an Item</div>
                    <input type="file" id="j0n4t-pg-zip-file" accept=".zip" style="display:none;" />
                    <button type="button" id="j0n4t-pg-import-btn" class="j0n4t-pg-btn" style="background:#454545;">${PresetUtils.icons.import}</button>
                    <button type="button" id="j0n4t-pg-export-btn" class="j0n4t-pg-btn" style="background:#454545;">${PresetUtils.icons.export}</button>
                    <button type="button" id="j0n4t-pg-clear-fields-btn" class="j0n4t-pg-btn" style="background:#555;">Clear</button>
                    <button type="button" id="j0n4t-pg-save-btn" class="j0n4t-pg-btn" style="background:#007acc;">Save</button>
                    <button type="button" id="j0n4t-pg-del-btn" class="j0n4t-pg-btn" style="background:#a32a2a;">Delete</button>
                </div>
                <div style="display:flex; gap:6px; align-items:stretch;">
                    <div id="j0n4t-pg-editor-preview" class="j0n4t-pg-editor-preview"></div>
                    <div style="display:flex; flex-direction:column; gap:6px; flex-grow:1;">
                        <textarea id="j0n4t-pg-preset" placeholder="Keywords..."></textarea>
                        <div class="j0n4t-pg-row"><input type="text" id="j0n4t-pg-folder" placeholder="Folder" style="flex:1;" /><input type="text" id="j0n4t-pg-name" placeholder="Name" style="flex:1;" /></div>
                    </div>
                </div>
                <input type="file" id="j0n4t-pg-file" accept="image/*" style="display:none;" />
            </div>
        `;
        return {
            wrap, grid: wrap.querySelector(".j0n4t-pg-grid"), search: wrap.querySelector(".j0n4t-pg-search"), searchClear: wrap.querySelector(".j0n4t-pg-search-clear"),
            editor: wrap.querySelector(".j0n4t-pg-editor"), banner: wrap.querySelector("#j0n4t-pg-banner"), toggle: wrap.querySelector("#j0n4t-pg-toggle"),
            viewsContainer: wrap.querySelector(".j0n4t-pg-views"), chkGroup: wrap.querySelector("#j0n4t-pg-group-toggle"), btnGlobalCollapse: wrap.querySelector("#j0n4t-pg-global-collapse"),
            editorPreview: wrap.querySelector("#j0n4t-pg-editor-preview"), inpName: wrap.querySelector("#j0n4t-pg-name"), inpFolder: wrap.querySelector("#j0n4t-pg-folder"),
            inpPreset: wrap.querySelector("#j0n4t-pg-preset"), inpFile: wrap.querySelector("#j0n4t-pg-file"), btnClearFields: wrap.querySelector("#j0n4t-pg-clear-fields-btn"),
            btnSave: wrap.querySelector("#j0n4t-pg-save-btn"), btnDel: wrap.querySelector("#j0n4t-pg-del-btn"), inpZipFile: wrap.querySelector("#j0n4t-pg-zip-file"),
            btnImport: wrap.querySelector("#j0n4t-pg-import-btn"), btnExport: wrap.querySelector("#j0n4t-pg-export-btn"), btnCopyBasket: wrap.querySelector("#j0n4t-pg-basket-copy-btn"),
            btnClearBasket: wrap.querySelector(".j0n4t-pg-basket-clear-btn"), chkBasketRaw: wrap.querySelector("#j0n4t-pg-basket-raw-toggle"),
            basketContainer: wrap.querySelector(".j0n4t-pg-basket-container"), rawTextarea: wrap.querySelector("#j0n4t-pg-raw-input"), btnHideGallery: wrap.querySelector("#j0n4t-pg-hide-gallery-btn")
        };
    }

    getCollapsedFolders() { try { return JSON.parse(localStorage.getItem("pg_collapsed_folders_list")) || []; } catch (e) { return []; } }
    setCollapsedFolders(list) { localStorage.setItem("pg_collapsed_folders_list", JSON.stringify(list)); }
    getSelectedArray() { return this.widget.value ? this.widget.value.split(",").map(v => v.trim()).filter(Boolean) : []; }
    
    updateWidgetValue(arr) {
        this.widget.value = arr.join(", ");
        this.widget.callback?.(this.widget.value);
        this.syncUI(this.widget.value);
        if (this.node.graph) this.node.graph._version++;
    }

    setPanelCollapseState(col) {
        this.dom.editor.classList.toggle("collapsed", col);
        this.dom.toggle.innerText = col ? "⚙️ Management Panel" : "🔼 Hide Panel";
        localStorage.setItem("comfy_preset_gallery_collapsed", String(col));
    }

    syncEditorHighlight() { this.dom.grid.querySelectorAll(".j0n4t-pg-item").forEach(el => el.classList.toggle("editing", this.editor.currentMode === "edit" && el.dataset.style === this.editor.editingKey)); }
    openEditorForPreset(styleKey) { this.editor.openPreset(styleKey); }
    
    async loadGallery() { this.cache = await PresetGalleryAPI.fetchGallery(); this.grid.compile(this.cache); }
    async syncUI(val) {
        const arr = val ? val.split(",").map(v => v.trim()).filter(Boolean) : [];
        this.grid.syncSelection(arr); this.basket.render(arr); this.syncEditorHighlight();
    }

    bindEvents() {
        this.dom.toggle.addEventListener("click", () => this.setPanelCollapseState(!this.dom.editor.classList.contains("collapsed")));
        this.dom.search.addEventListener("input", () => this.grid.executeFilterPipeline(this.dom.search.value));
        this.dom.searchClear.addEventListener("click", () => { this.dom.search.value = ""; this.grid.executeFilterPipeline(); this.dom.search.focus(); });
        this.dom.btnExport.addEventListener("click", () => window.open('/custom_node/export_presets_zip', '_blank'));
        this.dom.btnImport.addEventListener("click", () => this.dom.inpZipFile.click());
        this.dom.inpZipFile.addEventListener("change", async () => {
            if (!this.dom.inpZipFile.files[0]) return;
            const fd = new FormData(); fd.append("zip_file", this.dom.inpZipFile.files[0]);
            if ((await PresetGalleryAPI.importZip(fd)).success) { this.dom.inpZipFile.value = ""; await this.loadGallery(); this.updateWidgetValue([]); alert("Imported!"); }
        });

        const toggleGallery = (hide) => { this.dom.wrap.classList.toggle("hide-gallery-mode", hide); this.dom.btnHideGallery.classList.toggle("active", !hide); localStorage.setItem("comfy_preset_gallery_hidden", String(hide)); };
        toggleGallery(localStorage.getItem("comfy_preset_gallery_hidden") === "true");
        this.dom.btnHideGallery.addEventListener("click", () => toggleGallery(!this.dom.wrap.classList.contains("hide-gallery-mode")));
    }

    initFilterAutocomplete() {
        const searchInput = this.dom.search;
        let popup = null, matches = [], activeIdx = 0;

        const close = () => { popup?.remove(); popup = null; matches = []; };
        const select = (val) => {
            const sel = this.getSelectedArray(); if (!sel.includes(val)) this.updateWidgetValue([...sel, val]);
            searchInput.value = ""; this.grid.executeFilterPipeline(); close(); searchInput.focus();
        };

        searchInput.addEventListener("input", () => {
            close(); const q = searchInput.value.toLowerCase().trim(); if (!q) return;
            matches = PresetUtils.getTopMatches(Object.keys(this.cache), q); if (!matches.length) return;
            
            activeIdx = 0; popup = Object.assign(document.createElement("div"), { className: "j0n4t-pg-filter-autocomplete-popup" });
            const rect = searchInput.getBoundingClientRect(), wrapRect = this.dom.wrap.getBoundingClientRect(), zoom = wrapRect.width / this.dom.wrap.offsetWidth || 1;
            popup.style.top = `${(rect.bottom - wrapRect.top) / zoom + 2}px`; popup.style.left = `${(rect.left - wrapRect.left) / zoom}px`; popup.style.width = `${Math.max(200, rect.width / zoom)}px`;
            
            this.dom.wrap.appendChild(popup);
            matches.forEach((key, i) => {
                const row = document.createElement("div"); row.className = `j0n4t-pg-filter-autocomplete-item${i === activeIdx ? ' active' : ''}`;
                row.innerHTML = `<span>${PresetUtils.escapeHTML(PresetUtils.toTitleCase(key.split("/").pop()))}</span><span class="j0n4t-pg-filter-autocomplete-meta">${PresetUtils.escapeHTML(key)}</span>`;
                row.addEventListener("mousedown", (e) => { e.preventDefault(); select(key); });
                popup.appendChild(row);
            });
        });

        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.ctrlKey) {
                e.preventDefault(); e.stopPropagation();
                if (matches[activeIdx]) select(matches[activeIdx]);
                else { select(e.target.value); }
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault(); activeIdx = (activeIdx + (e.key === "ArrowDown" ? 1 : -1 + matches.length)) % matches.length;
                popup?.querySelectorAll(".j0n4t-pg-filter-autocomplete-item").forEach((item, i) => item.classList.toggle("active", i === activeIdx));
            } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
        });
        searchInput.addEventListener("blur", () => setTimeout(close, 200));
    }

    async init() {
        await this.loadGallery();
        if (this.widget.value) await this.syncUI(this.widget.value);
        this.initFilterAutocomplete();
        this.setPanelCollapseState(localStorage.getItem("comfy_preset_gallery_collapsed") === "true");
        this.node.setSize([this.node.size[0] || MIN_NODE_WIDTH, this.node.size[1] || MIN_NODE_HEIGHT]);
    }
}

// --- 6. Registration --- //
PresetGalleryStyles.inject();

app.registerExtension({
    name: "Comfy.PresetGallery",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "PresetGalleryNode") return;
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);
            const widget = this.widgets?.find(w => w.name === "preset_selection");
            if (!widget) return;
            widget.hidden = true;

            const galleryView = new PresetGalleryApp(this, widget);
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
            node.size = node.min_size = [MIN_NODE_WIDTH, MIN_NODE_HEIGHT];
            node.properties = node.properties || {};
        }
    }
});