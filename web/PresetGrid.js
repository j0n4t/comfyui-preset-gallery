import PresetGalleryAPI from "./PresetGalleryAPI.js";
import PresetUtils from "./PresetUtils.js";

export default class PresetGrid {
    constructor(dom, context) {
        this.dom = dom;
        this.context = context;
        this.bindEvents();
    }

    switchView(viewName) {
        ["small", "big", "list"].forEach((v) =>
            this.dom.grid.classList.remove(`view-${v}`)
        );
        this.dom.viewsContainer
            .querySelectorAll(".j0n4t-pg-view-btn")
            .forEach((btn) =>
                btn.classList.toggle("active", btn.dataset.view === viewName)
            );
        this.dom.grid.classList.add(`view-${viewName}`);
        localStorage.setItem("comfy_preset_gallery_view", viewName);
    }

    executeFilterPipeline(query = "") {
        const queryWords = query.toLowerCase().trim()
            ? query.toLowerCase().trim().split(/\s+/)
            : [];
        this.dom.searchClear.style.display = query ? "flex" : "none";

        this.dom.grid.querySelectorAll(".j0n4t-pg-item").forEach((el) => {
            el.classList.toggle(
                "j0n4t-pg-hidden",
                queryWords.length &&
                !queryWords.every((word) => el.dataset.searchBlob.includes(word))
            );
        });

        if (this.dom.chkGroup.checked) {
            this.dom.grid
                .querySelectorAll(".j0n4t-pg-group-header")
                .forEach((header) => {
                    let next = header.nextElementSibling,
                        hasVisibleChildren = false;
                    while (next && !next.classList.contains("j0n4t-pg-group-header")) {
                        const matches =
                            !queryWords.length ||
                            queryWords.every((word) =>
                                (next.dataset.searchBlob || "").includes(word)
                            );
                        if (matches) {
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
            const groupA = cache[a].tags?.length
                ? cache[a].tags.join(" > ")
                : "root_presets";
            const groupB = cache[b].tags?.length
                ? cache[b].tags.join(" > ")
                : "root_presets";
            if (groupA === "root_presets" && groupB !== "root_presets") return -1;
            if (groupB === "root_presets" && groupA !== "root_presets") return 1;
            return groupA !== groupB
                ? groupA.localeCompare(groupB)
                : a.localeCompare(b);
        });

        sortedKeys.forEach((key) => {
            const item = cache[key];
            const cleanLabel = PresetUtils.toTitleCase(
                PresetUtils.getPresetName(key)
            ),
                initials = PresetUtils.getPresetInitials(key);
            const searchBlob =
                `${key} ${initials} ${item.preset} ${(item.tags || []).join(" ")}`.toLowerCase();
            const uiGroup = item.tags?.length
                ? item.tags.map(PresetUtils.toTitleCase).join(" › ")
                : "Root Presets";
            const rawGroup = item.tags?.length ? item.tags.join("/") : "root_presets";

            if (uiGroup !== lastGroup) {
                lastGroup = uiGroup;
                const groupColor = PresetUtils.getGroupColor(rawGroup);
                const hexColor = PresetUtils.getGroupHexColor(rawGroup);
                htmlBuffer += `
            <div class="j0n4t-pg-group-header${collapsedList.includes(rawGroup) ? " collapsed" : ""}" data-group="${PresetUtils.escapeHTML(uiGroup)}" data-group-raw="${PresetUtils.escapeHTML(rawGroup)}">
                <span class="j0n4t-pg-group-color-dot" style="background-color: ${groupColor};" title="Click to customize group color">
                    <input type="color" class="j0n4t-pg-group-color-picker" value="${hexColor}" title="Customize group color" />
                </span>
                <span>${PresetUtils.escapeHTML(uiGroup)}</span>
                <div class="j0n4t-pg-group-line"></div>
                <span class="j0n4t-pg-group-rename-tip">Right-click to rename</span>
            </div>`;
            }

            const thumb = item.filename
                ? `<img class="j0n4t-pg-img" src="${item.filename}" loading="lazy">`
                : `<div style="background-color: ${PresetUtils.getPresetColor(key)}; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#fff;">${PresetUtils.icons.file}</div>`;
            const badge = item.tags?.length
                ? `<div class="j0n4t-pg-tag-badge" style="--item-color: ${PresetUtils.getPresetColor(key)};">${PresetUtils.escapeHTML(PresetUtils.toTitleCase(item.tags[item.tags.length - 1]))}</div>`
                : "";

            htmlBuffer += `
       <div class="j0n4t-pg-item" data-style="${PresetUtils.escapeHTML(key)}" data-search-blob="${PresetUtils.escapeHTML(searchBlob)}" draggable="true" title="${PresetUtils.escapeHTML(cleanLabel)} [${PresetUtils.escapeHTML(key)}]\n${PresetUtils.escapeHTML(item.preset || "")}">
          <div class="j0n4t-pg-corner-edit" title="Edit">${PresetUtils.icons.edit}</div>
          ${badge}
          <div class="j0n4t-pg-thumb-box">
            ${thumb}
            <div class="j0n4t-pg-initials">${PresetUtils.escapeHTML(initials)}</div>
          </div>
          <div class="j0n4t-pg-label">${PresetUtils.escapeHTML(cleanLabel)}</div>
        </div>`;
        });

        this.dom.grid.innerHTML =
            htmlBuffer ||
            `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#666; font-size:11px;">No presets found</div>`;
        this.dom.btnGlobalCollapse.innerText =
            collapsedList.length >
                this.dom.grid.querySelectorAll(".j0n4t-pg-group-header").length / 2
                ? "↕️ Expand All"
                : "↕️ Collapse All";
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
                const colorDot = header.querySelector(".j0n4t-pg-group-color-dot");
                const colorPicker = header.querySelector(".j0n4t-pg-group-color-picker");
                if (colorPicker) {
                    colorPicker.addEventListener("click", (e) => e.stopPropagation());
                    colorPicker.addEventListener("mousedown", (e) => e.stopPropagation());

                    colorPicker.addEventListener("input", (e) => {
                        e.stopPropagation();
                        const newColor = e.target.value;
                        if (colorDot) colorDot.style.backgroundColor = newColor;
                        PresetUtils.setGroupColor(rawFolder, newColor);
                    });

                    colorPicker.addEventListener("change", (e) => {
                        e.stopPropagation();
                        const newColor = e.target.value;
                        PresetUtils.setGroupColor(rawFolder, newColor);
                        this.compile(this.context.cache);
                    });
                }

                header.addEventListener("click", (e) => {
                    if (
                        e.target.closest(".j0n4t-pg-group-color-picker") ||
                        e.target.closest(".j0n4t-pg-group-color-dot")
                    )
                        return;
                    const isCollapsed = header.classList.toggle("collapsed");
                    let list = this.context.getCollapsedFolders();
                    if (isCollapsed && !list.includes(rawFolder)) {
                        list.push(rawFolder);
                    } else {
                        list = list.filter((i) => i !== rawFolder);
                    }
                    this.context.setCollapsedFolders(list);
                    this.dom.btnGlobalCollapse.innerText =
                        list.length >
                            this.dom.grid.querySelectorAll(".j0n4t-pg-group-header").length / 2
                            ? "↕️ Expand All"
                            : "↕️ Collapse All";
                    this.executeFilterPipeline(this.dom.search.value);
                });
                header.addEventListener("contextmenu", async (e) => {
                    if (rawFolder === "root_presets") return;
                    e.preventDefault();
                    e.stopPropagation();
                    const newName = prompt(
                        `Rename folder "${rawFolder.replace(/_/g, " ")}" to:`,
                        rawFolder.replace(/_/g, " ")
                    )
                        ?.trim()
                        .toLowerCase()
                        .replace(/ /g, "_");
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
                    } else alert(`Rename failed`);
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
            .forEach((el) =>
                el.classList.toggle("selected", activeList.includes(el.dataset.style))
            );
    }

    bindEvents() {
        this.dom.viewsContainer.addEventListener("click", (e) => {
            const btn = e.target.closest(".j0n4t-pg-view-btn");
            if (btn) this.switchView(btn.dataset.view);
        });

        this.dom.chkGroup.checked =
            localStorage.getItem("comfy_preset_gallery_grouped") !== "false";
        this.dom.grid.classList.toggle("hide-folders", !this.dom.chkGroup.checked);
        this.dom.btnGlobalCollapse.style.display = this.dom.chkGroup.checked
            ? "block"
            : "none";

        this.dom.chkGroup.addEventListener("change", () => {
            localStorage.setItem(
                "comfy_preset_gallery_grouped",
                String(this.dom.chkGroup.checked)
            );
            this.dom.grid.classList.toggle(
                "hide-folders",
                !this.dom.chkGroup.checked
            );
            this.dom.btnGlobalCollapse.style.display = this.dom.chkGroup.checked
                ? "block"
                : "none";
            this.executeFilterPipeline(this.dom.search.value);
        });

        this.dom.btnGlobalCollapse.addEventListener("click", () => {
            const headers = this.dom.grid.querySelectorAll(".j0n4t-pg-group-header");
            const collapseAll =
                !this.dom.btnGlobalCollapse.innerText.includes("Expand");
            this.context.setCollapsedFolders(
                collapseAll ? [...headers].map((h) => h.dataset.groupRaw) : []
            );
            this.dom.btnGlobalCollapse.innerText = collapseAll
                ? "↕️ Expand All"
                : "↕️ Collapse All";
            headers.forEach((h) => h.classList.toggle("collapsed", collapseAll));
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
    }
}