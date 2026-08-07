import PresetGalleryAPI from "./PresetGalleryAPI.js";
import PresetUtils from "./PresetUtils.js";

export default class PresetGrid {
  static GROUP_HEADER_STYLES = /*css*/ `
    .j0n4t-pg-group-header { grid-column: 1 / -1; display: flex; align-items: center; gap: 4px; color: #bdbdbd; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; user-select: none; cursor: pointer; padding: 4px 0; position: relative; }
    .j0n4t-pg-group-header:focus-visible { outline: 2px solid #007acc; outline-offset: 2px; border-radius: 2px; }
    .j0n4t-pg-group-header::before { content: "▼"; font-size: 8px; color: #888; transition: transform 0.15s ease; }
    .j0n4t-pg-group-header.collapsed::before { transform: rotate(-90deg); }
    .j0n4t-pg-group-color-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); transition: transform 0.15s ease, box-shadow 0.15s ease; position: relative; }
    .j0n4t-pg-group-color-dot:hover, .j0n4t-pg-group-color-dot:focus-visible { transform: scale(1.25); box-shadow: 0 0 4px rgba(255,255,255,0.4); outline: none; }
    .j0n4t-pg-group-color-picker { position: absolute; opacity: 0; width: 100%; height: 100%; top: 0; left: 0; cursor: pointer; border: none; padding: 0; margin: 0; }
    .j0n4t-pg-group-line { flex-grow: 1; height: 1px; background: #bdbdbd40; margin-right: 8px; }
    .j0n4t-pg-group-edit { color: #bbb; border-radius: 3px; width: 10px; height: 10px; display: flex; align-items: center; justify-content: center; transition: 0.15s; cursor: pointer; margin-right: 4px; }
    .j0n4t-pg-group-edit:hover, .j0n4t-pg-group-edit:focus-visible { background: #d1a119; color: #fff; border-color: #d1a119; outline: none; }
    .j0n4t-pg-group-edit svg { width: 11px; height: 11px; fill: currentColor; }
    .j0n4t-pg-group-header[data-group-raw="root_presets"] .j0n4t-pg-group-edit { display: none !important; }
    .j0n4t-pg-group-input { background: #222; border: 1px solid #d1a119; color: #fff; font-size: 10px; font-weight: bold; text-transform: uppercase; padding: 1px 4px; outline: none; border-radius: 2px; font-family: inherit; letter-spacing: 0.5px; flex-grow: 1; max-width: 200px; max-height: 12px; margin-right: 8px; }
    .j0n4t-pg-grid.hide-folders .j0n4t-pg-group-header, .j0n4t-pg-grid.hide-folders .j0n4t-pg-global-collapse-btn { display: none !important; }
  `;

  static ITEM_THUMB_STYLES = /*css*/ `
    .j0n4t-pg-item { cursor: pointer; text-align: center; border: 2px solid transparent; border-radius: 4px; padding: 4px; background: #1a1a1a80; transition: 0.1s; height: fit-content; box-sizing: border-box; user-select: none; position: relative; outline: none; }
    .j0n4t-pg-item:hover, .j0n4t-pg-item:focus-visible { background: #2a2a2a; border-color: #444; }
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
    .j0n4t-pg-tag-badge { position: absolute; top: 6px; left: 6px; background: var(--item-color, #444); color: #fff; font-size: 7.5px; font-weight: bold; padding: 1px 4px; border-radius: 2px; text-transform: uppercase; pointer-events: none; max-width: 50px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; z-index: 3; }
    .j0n4t-pg-corner-edit { position: absolute; top: 6px; right: 6px; background: #2a2a2a; color: #bbb; border-radius: 3px; width: 18px; height: 18px; display: none; align-items: center; justify-content: center; z-index: 4; border: 1px solid #444; transition: 0.15s; cursor: pointer; outline: none; }
    .j0n4t-pg-corner-edit:hover, .j0n4t-pg-corner-edit:focus-visible { background: #d1a119; color: #fff; border-color: #d1a119; }
    .j0n4t-pg-corner-edit svg { width: 11px; height: 11px; fill: currentColor; }
    .j0n4t-pg-item:hover .j0n4t-pg-corner-edit, .j0n4t-pg-item:focus-within .j0n4t-pg-corner-edit { display: flex; }
  `;

  static VIEW_LIST_OVERRIDES = /*css*/ `
    .view-list .j0n4t-pg-item { display: flex; align-items: center; gap: 6px; text-align: left; padding: 2px 4px; }
    .view-list .j0n4t-pg-thumb-box { display: none !important; }
    .view-list .j0n4t-pg-label { margin-top: 0; font-size: 11px; flex-grow: 1; line-height: 1; }
    .view-list .j0n4t-pg-tag-badge { position: relative; top: auto; left: auto; background: var(--item-color, #444); color: #bbb; max-width: none; font-size: 8px; padding: 1px 3px; }
    .view-list .j0n4t-pg-corner-edit { position: static; width: auto; height: auto; }
    .view-list .j0n4t-pg-corner-edit svg { width: 9px; height: 9px; }
  `;

  constructor(dom, context) {
    this.dom = dom;
    this.context = context;
    PresetUtils.injectStyles("j0n4t-pg-group-header-styles", PresetGrid.GROUP_HEADER_STYLES);
    PresetUtils.injectStyles("j0n4t-pg-item-thumb-styles", PresetGrid.ITEM_THUMB_STYLES);
    PresetUtils.injectStyles("j0n4t-pg-view-list-overrides-styles", PresetGrid.VIEW_LIST_OVERRIDES);
    this.bindEvents();
  }

  switchView(viewName) {
    ["small", "big", "list"].forEach((v) =>
      this.dom.grid.classList.remove(`view-${v}`)
    );
    this.dom.viewsContainer
      .querySelectorAll(".j0n4t-pg-view-btn")
      .forEach((btn) => {
        const isActive = btn.dataset.view === viewName;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-pressed", String(isActive));
      });
    this.dom.grid.classList.add(`view-${viewName}`);
    localStorage.setItem("comfy_preset_gallery_view", viewName);
  }

  executeFilterPipeline(query = "") {
    const queryWords = query.toLowerCase().trim()
      ? query.toLowerCase().trim().split(/\s+/)
      : [];
    this.dom.searchClear.style.display = query ? "flex" : "none";

    const hideBtn = this.dom.btnHideHidden;
    const showHidden = hideBtn ? hideBtn.classList.contains("active") : false;
    const shouldHideHidden = !showHidden;

    const isHiddenPreset = (el, rawGroup) => {
      const styleKey = el.dataset.style || "";
      const presetName = PresetUtils.getPresetName(styleKey);
      const folder = rawGroup || PresetUtils.getPresetFolder(styleKey) || "";
      return styleKey.startsWith("_") || presetName.startsWith("_") || folder.startsWith("_");
    };

    this.dom.grid.querySelectorAll(".j0n4t-pg-item").forEach((el) => {
      const matchesQuery =
        !queryWords.length ||
        queryWords.every((word) => el.dataset.searchBlob.includes(word));
      const isHidden = isHiddenPreset(el);

      el.classList.toggle(
        "j0n4t-pg-hidden",
        !matchesQuery || (shouldHideHidden && isHidden)
      );
    });

    if (this.dom.chkGroup.classList.contains("active")) {
      this.dom.grid
        .querySelectorAll(".j0n4t-pg-group-header")
        .forEach((header) => {
          const rawGroup = header.dataset.groupRaw || "";
          let next = header.nextElementSibling,
            hasVisibleChildren = false;
          while (next && !next.classList.contains("j0n4t-pg-group-header")) {
            const matchesQuery =
              !queryWords.length ||
              queryWords.every((word) =>
                (next.dataset.searchBlob || "").includes(word)
              );
            const isHidden = isHiddenPreset(next, rawGroup);

            if (matchesQuery && !(shouldHideHidden && isHidden)) {
              hasVisibleChildren = true;
              next.classList.toggle(
                "j0n4t-pg-hidden",
                header.classList.contains("collapsed")
              );
            } else next.classList.add("j0n4t-pg-hidden");
            next = next.nextElementSibling;
          }
          header.classList.toggle("j0n4t-pg-hidden", !hasVisibleChildren);
        });
    }
  }

  compile(cache) {
    let htmlBuffer = "",
      lastGroup = null;
    const collapsedList = this.context.getCollapsedFolders();

    const sortedKeys = Object.keys(cache).sort((a, b) => {
      const groupA = PresetUtils.getUiFolder(a) || "root_presets";
      const groupB = PresetUtils.getUiFolder(b) || "root_presets";
      const isAHidden = groupA.startsWith("_");
      const isBHidden = groupB.startsWith("_");
      if (isAHidden !== isBHidden) {
        return isAHidden ? 1 : -1;
      }
      if (groupA === "root_presets" && groupB !== "root_presets") return -1;
      if (groupB === "root_presets" && groupA !== "root_presets") return 1;
      return groupA !== groupB
        ? groupA.localeCompare(groupB)
        : a.localeCompare(b);
    });

    sortedKeys.forEach((key) => {
      const item = cache[key];
      const cleanLabel = PresetUtils.toTitleCase(PresetUtils.getPresetName(key));
      const initials = PresetUtils.getPresetInitials(key);
      const searchBlob = PresetUtils.getSearchBlob(key, item);
      const rawGroup = PresetUtils.getPresetFolder(key) || "root_presets";
      const uiGroup = PresetUtils.getUiFolder(key);
      const groupColor = cache[rawGroup] ? cache[rawGroup].__color__ : '#888888';

      if (uiGroup !== lastGroup) {
        lastGroup = uiGroup;
        htmlBuffer += `
            <div class="j0n4t-pg-group-header${collapsedList.includes(rawGroup) ? " collapsed" : ""}" data-group="${PresetUtils.escapeHTML(uiGroup)}" data-group-raw="${PresetUtils.escapeHTML(rawGroup)}" tabindex="0" role="button" aria-expanded="${!collapsedList.includes(rawGroup)}">
                <span class="j0n4t-pg-group-color-dot" tabindex="0" role="button" style="background-color: ${groupColor};" title="Click to customize group color" aria-label="Customize group color">
                    <input type="color" class="j0n4t-pg-group-color-picker" value="${groupColor}" tabindex="-1" aria-hidden="true" />
                </span>
                <span class="j0n4t-pg-group-title">${PresetUtils.escapeHTML(uiGroup)}</span>
                <div class="j0n4t-pg-group-line"></div>
                <div class="j0n4t-pg-group-edit" tabindex="-1" role="button" title="Rename Group" aria-label="Rename Group">${PresetUtils.icons.edit}</div>
            </div>`;
      }

      if (!item.preset) return;

      const thumb = item.filename
        ? `<img class="j0n4t-pg-img" src="${item.filename}" loading="lazy" alt="${PresetUtils.escapeHTML(cleanLabel)} preview">`
        : `<div style="background-color: ${groupColor}; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#fff;" aria-hidden="true">${PresetUtils.icons.file}</div>`;
      const badge = PresetUtils.getPresetFolder(key)
        ? `<div class="j0n4t-pg-tag-badge" style="--item-color: ${groupColor};">${PresetUtils.escapeHTML(PresetUtils.toTitleCase(PresetUtils.getPresetFolder(key).split("/").pop()))}</div>`
        : "";

      htmlBuffer += `
       <div class="j0n4t-pg-item" data-style="${PresetUtils.escapeHTML(key)}" data-search-blob="${PresetUtils.escapeHTML(searchBlob)}" draggable="true" tabindex="0" role="option" aria-selected="false" title="${PresetUtils.escapeHTML(cleanLabel)} [${PresetUtils.escapeHTML(key)}]\n${PresetUtils.escapeHTML(item.preset || "")}">
          ${badge}
          <div class="j0n4t-pg-thumb-box">
            ${thumb}
            <div class="j0n4t-pg-initials">${PresetUtils.escapeHTML(initials)}</div>
          </div>
          <div class="j0n4t-pg-label">${PresetUtils.escapeHTML(cleanLabel)}</div>
          <div class="j0n4t-pg-corner-edit" tabindex="-1" role="button" title="Edit" aria-label="Edit Preset">${PresetUtils.icons.edit}</div>
        </div>`;
    });

    this.dom.grid.innerHTML =
      htmlBuffer ||
      `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#666; font-size:11px;">No presets found</div>`;
    const totalHeaders = this.dom.grid.querySelectorAll(".j0n4t-pg-group-header").length;
    const isMajorityCollapsed = totalHeaders > 0 && collapsedList.length > totalHeaders / 2;

    this.dom.btnGlobalCollapse.title = isMajorityCollapsed ? "Expand All" : "Collapse All";
    this.dom.btnGlobalCollapse.setAttribute("aria-label", isMajorityCollapsed ? "Expand All" : "Collapse All");
    this.dom.btnGlobalCollapse.classList.toggle("collapsed-state", isMajorityCollapsed);
    this.attachGridItemEvents();
    this.switchView(localStorage.getItem("comfy_preset_gallery_view") || "big");
    this.executeFilterPipeline(this.dom.search.value);
    this.context.syncEditorHighlight();
  }

  attachGridItemEvents() {
    this.dom.grid
      .querySelectorAll(".j0n4t-pg-group-header")
      .forEach((header) => {
        const rawFolder = header.dataset.groupRaw;
        const colorPicker = header.querySelector(".j0n4t-pg-group-color-picker");
        const editBtn = header.querySelector(".j0n4t-pg-group-edit");

        if (colorPicker) {
          colorPicker.addEventListener("click", (e) => e.stopPropagation());
          colorPicker.addEventListener("mousedown", (e) => e.stopPropagation());

          colorPicker.addEventListener("change", async (e) => {
            e.stopPropagation();
            const newColor = e.target.value;
            await PresetGalleryAPI.setGroupColor(rawFolder, newColor);
            await this.context.loadGallery();
          });
        }

        if (editBtn) {
          editBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (rawFolder === "root_presets") return;

            const titleSpan = header.querySelector(".j0n4t-pg-group-title");
            if (!titleSpan || header.querySelector(".j0n4t-pg-group-input")) return;

            titleSpan.style.display = "none";
            const inputHtml = `<input type="text" class="j0n4t-pg-group-input" tabindex="0" value="${rawFolder.replace(/_/g, " ")}" />`;
            titleSpan.insertAdjacentHTML("afterend", inputHtml);

            const input = titleSpan.nextElementSibling;
            input.focus();
            input.select();

            let saved = false;

            const save = async () => {
              if (saved) return;
              saved = true;

              const newName = input.value
                .trim()
                .toLowerCase()
                .replace(/ /g, "_");

              input.remove();
              titleSpan.style.display = "";

              if (!newName || newName === rawFolder) return;

              const res = await PresetGalleryAPI.renameFolder(rawFolder, newName);
              if (res.success) {
                this.context.setCollapsedFolders(
                  this.context.getCollapsedFolders().filter((i) => i !== rawFolder)
                );
                await this.context.loadGallery();
                this.context.updateWidgetValue(
                  this.context
                    .getSelectedArray()
                    .map((i) =>
                      i.startsWith(`${rawFolder}/`)
                        ? i.replace(`${rawFolder}/`, `${newName}/`)
                        : i
                    )
                );
              } else {
                await PresetUtils.alert("Rename failed");
              }
            };

            const cancel = () => {
              if (saved) return;
              saved = true;
              input.remove();
              titleSpan.style.display = "";
            };

            input.addEventListener("click", (ev) => ev.stopPropagation());
            input.addEventListener("mousedown", (ev) => ev.stopPropagation());
            input.addEventListener("keydown", (ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                save();
              } else if (ev.key === "Escape") {
                ev.preventDefault();
                cancel();
              }
            });
            input.addEventListener("blur", () => {
              save();
            });
          });
        }

        header.addEventListener("click", (e) => {
          if (
            e.target.closest(".j0n4t-pg-group-color-picker") ||
            e.target.closest(".j0n4t-pg-group-color-dot") ||
            e.target.closest(".j0n4t-pg-group-edit") ||
            e.target.closest(".j0n4t-pg-group-input")
          )
            return;
          const isCollapsed = header.classList.toggle("collapsed");
          header.setAttribute("aria-expanded", String(!isCollapsed));
          let list = this.context.getCollapsedFolders();
          if (isCollapsed && !list.includes(rawFolder)) {
            list.push(rawFolder);
          } else {
            list = list.filter((i) => i !== rawFolder);
          }
          this.context.setCollapsedFolders(list);
          this.executeFilterPipeline(this.dom.search.value);
        });
      });

    this.dom.grid.querySelectorAll(".j0n4t-pg-item").forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        item.classList.add("dragging");
        e.dataTransfer.effectAllowed = "copyMove";
        e.dataTransfer.setData("text/plain", item.dataset.style);
        e.dataTransfer.setData("source/grid", "true");
      });
      item.addEventListener("dragend", () => item.classList.remove("dragging"));
      item
        .querySelector(".j0n4t-pg-corner-edit")
        .addEventListener("click", (e) => {
          e.stopPropagation();
          this.context.openEditorForPreset(item.dataset.style);
        });
    });
  }

  syncSelection(activeList) {
    this.dom.grid
      .querySelectorAll(".j0n4t-pg-item")
      .forEach((el) => {
        const isSelected = activeList.includes(el.dataset.style);
        el.classList.toggle("selected", isSelected);
        el.setAttribute("aria-selected", String(isSelected));
      });
  }

  bindEvents() {
    this.dom.viewsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".j0n4t-pg-view-btn");
      if (btn) this.switchView(btn.dataset.view);
    });

    const isGrouped = localStorage.getItem("comfy_preset_gallery_grouped") !== "false";
    this.dom.chkGroup.classList.toggle("active", isGrouped);
    this.dom.chkGroup.setAttribute("aria-pressed", String(isGrouped));
    this.dom.grid.classList.toggle("hide-folders", !isGrouped);
    this.dom.btnGlobalCollapse.style.display = isGrouped ? "flex" : "none";

    this.dom.chkGroup.addEventListener("click", () => {
      const willGroup = !this.dom.chkGroup.classList.contains("active");
      localStorage.setItem("comfy_preset_gallery_grouped", String(willGroup));
      this.dom.chkGroup.classList.toggle("active", willGroup);
      this.dom.chkGroup.setAttribute("aria-pressed", String(willGroup));
      this.dom.grid.classList.toggle("hide-folders", !willGroup);
      this.dom.btnGlobalCollapse.style.display = willGroup ? "flex" : "none";
      this.executeFilterPipeline(this.dom.search.value);
    });

    const hideBtn = this.dom.btnHideHidden;
    if (hideBtn) {
      const isShowActive = localStorage.getItem("comfy_preset_gallery_show_hidden") === "true";
      hideBtn.classList.toggle("active", isShowActive);
      hideBtn.setAttribute("aria-pressed", String(isShowActive));

      hideBtn.addEventListener("click", () => {
        const willShow = !hideBtn.classList.contains("active");
        localStorage.setItem("comfy_preset_gallery_show_hidden", String(willShow));
        hideBtn.classList.toggle("active", willShow);
        hideBtn.setAttribute("aria-pressed", String(willShow));
        this.executeFilterPipeline(this.dom.search.value);
      });
    }

    this.dom.btnGlobalCollapse.addEventListener("click", () => {
      const headers = this.dom.grid.querySelectorAll(".j0n4t-pg-group-header");
      const collapseAll = this.dom.btnGlobalCollapse.title === "Collapse All";
      this.context.setCollapsedFolders(
        collapseAll ? [...headers].map((h) => h.dataset.groupRaw) : []
      );
      this.dom.btnGlobalCollapse.title = collapseAll ? "Expand All" : "Collapse All";
      this.dom.btnGlobalCollapse.setAttribute("aria-label", collapseAll ? "Expand All" : "Collapse All");
      this.dom.btnGlobalCollapse.classList.toggle("collapsed-state", collapseAll);

      headers.forEach((h) => {
        h.classList.toggle("collapsed", collapseAll);
        h.setAttribute("aria-expanded", String(!collapseAll));
      });
      this.executeFilterPipeline(this.dom.search.value);
    });

    this.dom.grid.addEventListener("click", (e) => {
      if (
        e.target.closest(".j0n4t-pg-corner-edit") ||
        e.target.closest(".j0n4t-pg-group-header")
      )
        return;
      const item = e.target.closest(".j0n4t-pg-item");
      if (!item || !this.context.widget.callback) return;
      const key = item.dataset.style;
      let sel = this.context.getSelectedArray();
      this.context.updateWidgetValue(
        sel.includes(key) ? sel.filter((v) => v !== key) : [...sel, key]
      );
    });

    this.dom.grid.addEventListener("keydown", (e) => {
      const target = e.target.closest(".j0n4t-pg-item, .j0n4t-pg-group-header");
      if (!target) return;

      const focusables = [...this.dom.grid.querySelectorAll(".j0n4t-pg-group-header:not(.j0n4t-pg-hidden), .j0n4t-pg-item:not(.j0n4t-pg-hidden)")];

      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        if (this.dom.search) {
          this.dom.search.focus();
        } else {
          this.dom.grid.focus();
        }
        return;
      }

      if (e.shiftKey && (e.key === "Enter" || e.key === " ")) {
        e.stopPropagation();
        e.preventDefault();
        if (target.classList.contains("j0n4t-pg-item")) {
          this.context.openEditorForPreset(target.dataset.style);
        } else if (target.classList.contains("j0n4t-pg-group-header")) {
          const editBtn = target.querySelector(".j0n4t-pg-group-edit");
          if (editBtn) editBtn.click();
        }
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        e.stopPropagation();
        e.preventDefault();
        target.click();
        return;
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.stopPropagation();
        e.preventDefault();

        const currentRect = target.getBoundingClientRect();
        const currentCenter = {
          x: currentRect.left + currentRect.width / 2,
          y: currentRect.top + currentRect.height / 2
        };

        let bestCandidate = null;
        let minScore = Infinity;

        focusables.forEach((el) => {
          if (el === target) return;
          const rect = el.getBoundingClientRect();
          const center = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          };

          let primaryDist = 0;
          let secondaryDist = 0;
          let isValid = false;

          if (e.key === "ArrowDown") {
            if (rect.top >= currentRect.bottom - 2) {
              primaryDist = rect.top - currentRect.bottom;
              secondaryDist = Math.abs(center.x - currentCenter.x);
              isValid = true;
            }
          } else if (e.key === "ArrowUp") {
            if (rect.bottom <= currentRect.top + 2) {
              primaryDist = currentRect.top - rect.bottom;
              secondaryDist = Math.abs(center.x - currentCenter.x);
              isValid = true;
            }
          } else if (e.key === "ArrowRight") {
            if (rect.left >= currentRect.right - 2) {
              primaryDist = rect.left - currentRect.right;
              secondaryDist = Math.abs(center.y - currentCenter.y);
              isValid = true;
            }
          } else if (e.key === "ArrowLeft") {
            if (rect.right <= currentRect.left + 2) {
              primaryDist = currentRect.left - rect.right;
              secondaryDist = Math.abs(center.y - currentCenter.y);
              isValid = true;
            }
          }

          if (isValid) {
            const score = primaryDist + secondaryDist * 1.5;
            if (score < minScore) {
              minScore = score;
              bestCandidate = el;
            }
          }
        });

        if (bestCandidate) {
          bestCandidate.focus();
        }
      }
    });
  }
}