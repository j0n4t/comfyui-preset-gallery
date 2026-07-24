export default class PresetGalleryStyles {
  static inject() {
    if (document.getElementById("j0n4t-pg-global-styles")) return;
    const styles = document.createElement("style");
    styles.id = "j0n4t-pg-global-styles";
    styles.textContent = /*css*/ `
      .j0n4t-pg-wrap { display: flex; flex-direction: column; gap: 4px; padding: 0; border-radius: 4px; box-sizing: border-box; width: 100%; height: 100%; font-family: sans-serif; position: relative; }
      .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-grid, .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-views, .j0n4t-pg-wrap.hide-gallery-mode #j0n4t-pg-global-collapse, .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-checkbox-wrap:has(#j0n4t-pg-group-toggle) { display: none !important; }

      .j0n4t-pg-basket-container { display: flex; flex-direction: column; gap: 4px; background: #15151580; border: 1px dashed #777; border-radius: 4px; padding: 0; box-sizing: border-box; width: 100%; flex-shrink: 0; transition: border-color 0.2s, background-color 0.2s; position: relative; resize: vertical; overflow-y: auto; overflow-x: hidden; min-height: 40px; }
      .j0n4t-pg-basket-container.drag-over { border-color: #007acc; background: #1a242db0; }
      .j0n4t-pg-basket-header { display: flex; justify-content: space-between; align-items: center; padding: 4px; background: #222;  position: sticky; top: 0; z-index: 1; }
      .j0n4t-pg-basket-title { font-size: 9px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; pointer-events: none; }
      .j0n4t-pg-basket-clear-btn:hover { background: #912e2e; }
      .j0n4t-pg-basket-pool { display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; align-items: center; padding: 4px; }
      .j0n4t-pg-raw-wrapper { position: relative; width: 100%; height: 100%; display: none; padding: 4px; box-sizing: border-box; }
      .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-raw-wrapper { display: block !important; }
      .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-basket-pool { display: none !important; }
      .j0n4t-pg-raw-highlights, .j0n4t-pg-basket-raw-textarea { width: 100%; height: 100%; min-height: 48px; font-family: monospace; font-size: 11px; padding: 4px; box-sizing: border-box; border-radius: 3px; margin: 0; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; line-height: 1.4; border: 1px solid transparent; letter-spacing: normal; word-spacing: normal; text-transform: none; text-indent: 0px; text-shadow: none; }
      .j0n4t-pg-raw-highlights { position: absolute; top: 4px; left: 4px; right: 4px; bottom: 4px; pointer-events: none; color: transparent; overflow: hidden; background: transparent; z-index: 1; width: calc(100% - 8px); height: calc(100% - 8px); }
      .j0n4t-pg-basket-raw-textarea { display: block; background: transparent; border-color: #444; color: transparent; caret-color: #fff; resize: none; position: relative; z-index: 2; }
      .j0n4t-pg-raw-token { color: #569cd6; font-weight: bold; }
      .j0n4t-pg-raw-token.plain-text { color: #cccccc; font-weight: normal; }

      .j0n4t-pg-autocomplete-popup, .j0n4t-pg-filter-autocomplete-popup, .j0n4t-pg-chip-popup { position: absolute; background: #1f1f1fe8; border: 1px solid #007acc; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: flex; overflow-y: auto; overflow-x: hidden; font-family: sans-serif; box-sizing: border-box; max-height: 250px; width: max-content; }
      .j0n4t-pg-autocomplete-popup, .j0n4t-pg-filter-autocomplete-popup { flex-direction: column; }
      .j0n4t-pg-chip-popup { z-index: 10002; padding: 2px; background: #1a1a1ff5; border-color: #007acc; flex-direction: row; gap: 2px; border-radius: 4px; }
      .j0n4t-pg-chip-popup-item { padding: 2px; font-size: 11px; color: #ddd; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 3px; transition: background 0.1s, color 0.1s; }
      .j0n4t-pg-chip-popup-item:hover { background: #007acc; color: #fff; }
      .j0n4t-pg-chip-popup-item.danger:hover { background: #b23b3b; color: #fff; }
      .j0n4t-pg-chip-popup-item svg { width: 14px; height: 14px; fill: currentColor; }
      .j0n4t-pg-basket-chip.active-menu, .j0n4t-pg-basket-chip:focus { border-color: #007acc; background: #1a2c3d; box-shadow: 0 0 6px rgba(0, 122, 204, 0.6); }
      .j0n4t-pg-autocomplete-popup { z-index: 9999; max-width: 280px; }
      .j0n4t-pg-filter-autocomplete-popup { z-index: 10001; }
      .j0n4t-pg-autocomplete-item, .j0n4t-pg-filter-autocomplete-item { padding: 6px 10px; font-size: 11px; color: #ddd; cursor: pointer; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      .j0n4t-pg-autocomplete-item:last-child, .j0n4t-pg-filter-autocomplete-item:last-child { border-bottom: none; }
      .j0n4t-pg-autocomplete-item.active, .j0n4t-pg-filter-autocomplete-item.active { background: #007acc; color: #fff; }
      .j0n4t-pg-autocomplete-meta, .j0n4t-pg-filter-autocomplete-meta { font-size: 9px; color: #888; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; }
      .j0n4t-pg-autocomplete-item.active .j0n4t-pg-autocomplete-meta, .j0n4t-pg-filter-autocomplete-item.active .j0n4t-pg-filter-autocomplete-meta { color: #bee3ff; }

      .j0n4t-pg-basket-empty { font-size: 10px; color: #555; font-style: italic; pointer-events: none; }
      .j0n4t-pg-basket-drop-indicator { width: 2px; background-color: #007acc; box-shadow: 0 0 4px #007acc; border-radius: 1px; transition: transform 0.05s ease; pointer-events: none; }
      .j0n4t-pg-basket-chip { display: flex; align-items: center; background-size: cover; background-position: center; border: 1px solid #3d3d3d; border-radius: 3px; padding: 2px 4px; box-sizing: border-box; cursor: grab; user-select: none; transition: background 0.15s, border-color 0.15s; position: relative; overflow: hidden; min-height: 1.4em; }
      .j0n4t-pg-basket-chip::before { content: ""; position: absolute; inset: 0; background: rgba(0, 0, 0, 0.2); z-index: 0; pointer-events: none; }
      .j0n4t-pg-basket-chip:active { cursor: grabbing; }
      .j0n4t-pg-basket-chip.dragging { opacity: 0.4; border-color: #007acc; }
      .j0n4t-pg-basket-chip-label { font-size: 10px; color: #fff; white-space: nowrap; max-width: 90px; overflow: hidden; text-overflow: ellipsis; pointer-events: none; position: relative; z-index: 1; text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.8); font-weight: 600; }
      .j0n4t-pg-basket-chip.inline-editing { border-color: #d1a119; cursor: text; padding: 2px 4px; background-image: none !important; }
      .j0n4t-pg-basket-chip.inline-editing::before { display: none; }
      .j0n4t-pg-inline-edit { background: transparent; border: none; color: #fff; font-family: monospace; font-size: 11px; outline: none; width: 100%; min-width: 50px; padding: 0; margin: 0; }
      .j0n4t-pg-basket-add-btn { display: flex; align-items: center; justify-content: center; background: transparent; border: 1px dashed #777; border-radius: 3px; padding: 2px 8px; cursor: pointer; color: #aaa; font-size: 10px; font-weight: bold; transition: 0.15s; height: 22px; user-select: none; }
      .j0n4t-pg-basket-add-btn:hover { border-color: #007acc; color: #fff; background: #1a242db0; }
      .j0n4t-pg-lora-weight { width: 38px; height: 16px; background: #1a1a1a; border: 1px solid #444; color: #fff; font-size: 9px; border-radius: 2px; padding: 0 0 0 2px; text-align: center; margin: 0 2px; outline: none; }
      .j0n4t-pg-lora-weight:focus { border-color: #007acc; }

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
      .j0n4t-pg-grid { display: grid; gap: 6px; flex-grow: 1; overflow-y: auto; min-height: 60px; height: 50%; max-height: 100vh; align-content: start; margin-top: 2px; resize: vertical; }
      .j0n4t-pg-grid.view-small { grid-template-columns: repeat(auto-fill, minmax(55px, 1fr)); }
      .j0n4t-pg-grid.view-big { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
      .j0n4t-pg-grid.view-list { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 4px; }

      .j0n4t-pg-group-header { grid-column: 1 / -1; display: flex; align-items: center; gap: 4px; color: #bdbdbd; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; user-select: none; cursor: pointer; padding: 4px 0; position: relative; }
      .j0n4t-pg-group-header::before { content: "▼"; font-size: 8px; color: #888; transition: transform 0.15s ease; }
      .j0n4t-pg-group-header.collapsed::before { transform: rotate(-90deg); }
      .j0n4t-pg-group-color-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); transition: transform 0.15s ease, box-shadow 0.15s ease; position: relative; }
      .j0n4t-pg-group-color-dot:hover { transform: scale(1.25); box-shadow: 0 0 4px rgba(255,255,255,0.4); }
      .j0n4t-pg-group-color-picker { position: absolute; opacity: 0; width: 100%; height: 100%; top: 0; left: 0; cursor: pointer; border: none; padding: 0; margin: 0; }
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

      .view-list .j0n4t-pg-item { display: flex; align-items: center; gap: 6px; text-align: left; padding: 2px 4px; }
      .view-list .j0n4t-pg-thumb-box { display: none !important; }
      .view-list .j0n4t-pg-label { margin-top: 0; font-size: 11px; flex-grow: 1; line-height: 1; }
      .view-list .j0n4t-pg-tag-badge { position: relative; top: auto; left: auto; background: var(--item-color, #444); color: #bbb; max-width: none; font-size: 8px; padding: 1px 3px; }
      .view-list .j0n4t-pg-corner-edit { position: relative; top: auto; right: auto; display: flex !important; margin-left: auto; flex-shrink: 0; width: 14px; height: 14px; }
      .view-list .j0n4t-pg-corner-edit svg { width: 9px; height: 9px; }

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

      .j0n4t-pg-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(3px); z-index: 20000; display: flex; align-items: center; justify-content: center; }
      .j0n4t-pg-modal { background: #1f1f1f; border: 1px solid #007acc; border-radius: 8px; width: 320px; padding: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); font-family: sans-serif; display: flex; flex-direction: column; gap: 12px; color: #eee; }
      .j0n4t-pg-modal.j0n4t-pg-modal-large { width: 420px; max-width: 90vw; }
      .j0n4t-pg-modal h3 { margin: 0; font-size: 13px; font-weight: bold; color: #fff; display: flex; align-items: center; gap: 6px; }
      .j0n4t-pg-modal-row { display: flex; gap: 10px; width: 100%; }
      .j0n4t-pg-modal-field { display: flex; flex-direction: column; gap: 4px; font-size: 11px; }
      .j0n4t-pg-modal-field label { color: #aaa; font-weight: bold; }
      .j0n4t-pg-modal-field select { background: #111; border: 1px solid #444; color: #fff; padding: 6px; border-radius: 4px; font-size: 11px; outline: none; }
      .j0n4t-pg-modal-field select:focus { border-color: #007acc; }
      .j0n4t-pg-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }

      /* Preset Tree Selector Styles */
      .j0n4t-pg-selector-container { border: 1px solid #333; background: #141414; border-radius: 4px; padding: 6px; display: flex; flex-direction: column; gap: 6px; }
      .j0n4t-pg-selector-controls { border-bottom: 1px solid #222; padding-bottom: 4px; }
      .j0n4t-pg-selector-tree { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 4px; }
      .j0n4t-pg-tree-group { display: flex; flex-direction: column; gap: 2px; }
      .j0n4t-pg-tree-group-header { background: #1e1e1e; padding: 2px 6px; border-radius: 3px; }
      .j0n4t-pg-tree-group-items { padding-left: 16px; display: flex; flex-direction: column; gap: 1px; }
      .j0n4t-pg-tree-item { padding: 1px 0; }
    `;
    document.head.appendChild(styles);
  }
}
