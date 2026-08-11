import PresetLogic from './PresetLogic.js';

const PresetDOM = {
    /**
     * SVG Icon collection mapped to key identifiers.
     * @type {Record<string, string>}
     */
    icons: {
        add: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
        close: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
        edit: `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
        file: `<svg class="j0n4t-pg-icon" viewBox="0 0 24 24" style="opacity: 0.25; color: #fff; width: 32px; height: 32px;"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
        list: `<svg viewBox="0 0 16 16"><rect x="1" y="2" width="3" height="2"/><rect x="6" y="2" width="9" height="2"/><rect x="1" y="7" width="3" height="2"/><rect x="6" y="7" width="9" height="2"/><rect x="1" y="12" width="3" height="2"/><rect x="6" y="12" width="9" height="2"/></svg>`,
        small: `<svg viewBox="0 0 16 16"><rect x="1" y="1" width="3" height="3"/><rect x="6" y="1" width="3" height="3"/><rect x="11" y="1" width="3" height="3"/><rect x="1" y="6" width="3" height="3"/><rect x="6" y="6" width="3" height="3"/><rect x="11" y="6" width="3" height="3"/><rect x="1" y="11" width="3" height="3"/><rect x="6" y="11" width="3" height="3"/><rect x="11" y="11" width="3" height="3"/></svg>`,
        big: `<svg viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6"/><rect x="9" y="1" width="6" height="6"/><rect x="1" y="9" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/></svg>`,
        eye: `<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
        export: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6 20q-.825 0-1.412-.587T4 18v-2q0-.425.288-.712T5 15t.713.288T6 16v2h12v-2q0-.425.288-.712T19 15t.713.288T20 16v2q0 .825-.587 1.413T18 20zm5-12.15L9.125 9.725q-.3.3-.712.288T7.7 9.7q-.275-.3-.288-.7t.288-.7l3.6-3.6q.15-.15.325-.212T12 4.425t.375.063t.325.212l3.6 3.6q.3.3.288.7t-.288.7q-.3.3-.712.313t-.713-.288L13 7.85V15q0 .425-.288.713T12 16t-.712-.288T11 15z" /></svg>`,
        import: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M11.625 15.513q-.175-.063-.325-.213l-3.6-3.6q-.3-.3-.288-.7t.288-.7q.3-.3.713-.312t.712.287L11 12.15V5q0-.425.288-.712T12 4t.713.288T13 5v7.15l1.875-1.875q.3-.3.713-.288t.712.313q.275.3.288.7t-.288.7l-3.6 3.6q-.15.15-.325.213t-.375.062t-.375-.062M6 20q-.825 0-1.412-.587T4 18v-2q0-.425.288-.712T5 15t.713.288T6 16v2h12v-2q0-.425.288-.712T19 15t.713.288T20 16v2q0 .825-.587 1.413T18 20z" /></svg>`,
        group: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.5"><path d="M8 5h12m-7 7h7m-7 7h7"/><path stroke-linejoin="round" d="M4.375 5H4.25m.25 0A.25.25 0 1 1 4 5a.25.25 0 0 1 .5 0m3.875 7H8.25m.25 0a.25.25 0 1 1-.5 0a.25.25 0 0 1 .5 0m-.125 7H8.25m.25 0a.25.25 0 1 1-.5 0a.25.25 0 0 1 .5 0"/></g></svg>`,
        collapse: `<svg class="rotatable" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 36 36"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.5"><path fill="currentColor" d="M29 19.41a1 1 0 0 1-.71-.29L18 8.83L7.71 19.12a1 1 0 0 1-1.41-1.41L18 6l11.71 11.71a1 1 0 0 1-.71 1.7" class="clr-i-outline clr-i-outline-path-1" /><path fill="currentColor" d="M29 30.41a1 1 0 0 1-.71-.29L18 19.83L7.71 30.12a1 1 0 0 1-1.41-1.41L18 17l11.71 11.71a1 1 0 0 1-.71 1.7" class="clr-i-outline clr-i-outline-path-2" /></g></svg>`,
        preset: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16"><path d="M0 0h16v16H0z" fill="none" /><path fill="currentColor" fill-rule="evenodd" d="M1 2a1 1 0 0 1 2 0zm2 12V3H.5a.5.5 0 0 1-.5-.5V2C0 .9.895 0 2 0h8.5A2.5 2.5 0 0 1 13 2.5V13h2.5a.5.5 0 0 1 .5.5a2.5 2.5 0 0 1-2.5 2.5H5c-1.1 0-2-.895-2-2m9-1V2.5A1.5 1.5 0 0 0 10.5 1H3.73c.17.294.268.636.268 1v12a1 1 0 0 0 2 0v-.5a.5.5 0 0 1 .5-.5h5.5zm-5 1c0 .364-.097.706-.268 1h6.77c.653 0 1.21-.417 1.41-1h-7.91zM6.5 4a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1zM6 6.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5M6.5 8a.5.5 0 0 0 0 1h2a.5.5 0 0 0 0-1z" clip-rule="evenodd" /></svg>`,
        more: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M14 18a2 2 0 1 1-4 0a2 2 0 0 1 4 0m0-6a2 2 0 1 1-4 0a2 2 0 0 1 4 0m-2-4a2 2 0 1 0 0-4a2 2 0 0 0 0 4"/></svg>`,
        hidden: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M13 9h1v2h-3V7h2zm5.5 0l-2.12-2.12l1.25-1.25L20 8v2h-2v1h-3V9zM13 3.5V2h-1v2h1v2h-2V4H9V2H8v2H6v1H4V4c0-1.11.89-2 2-2h8l2.36 2.36l-1.25 1.25zM20 20a2 2 0 0 1-2 2h-2v-2h2v-1h2zm-2-5h2v3h-2zm-6 7v-2h3v2zm-4 0v-2h3v2zm-2 0a2 2 0 0 1-2-2v-2h2v2h1v2zm-2-8h2v3H4zm0-4h2v3H4zm14 1h2v3h-2zM4 6h2v3H4z"/></svg>`,
        copy: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M20 2H10c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m0 12H10V4h10z"/><path fill="currentColor" d="M14 20H4V10h2V8H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-2h-2z"/></svg>`,
        dice: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M10.998 1.58a2 2 0 0 1 2.004 0l7.5 4.342a2 2 0 0 1 .998 1.731v8.694a2 2 0 0 1-.998 1.73l-7.5 4.343a2 2 0 0 1-2.004 0l-7.5-4.342a2 2 0 0 1-.998-1.731V7.653a2 2 0 0 1 .998-1.73zM5.25 8.092a.5.5 0 0 0-.751.433v6.669a2 2 0 0 0 .998 1.73l5.751 3.33a.5.5 0 0 0 .751-.432v-6.669a2 2 0 0 0-.998-1.73zm10.517-2.575c-.478-.276-1.254-.276-1.732 0s-.478.724 0 1s1.254.276 1.732 0s.478-.724 0-1m-5.8 0c-.478-.276-1.254-.276-1.732 0s-.478.724 0 1s1.254.276 1.732 0c.479-.276.479-.724 0-1m7.025 10.328c.597-.345 1.082-1.184 1.082-1.875c0-.69-.485-.97-1.082-.625S15.91 14.53 15.91 15.22s.485.97 1.082.625M6.365 12.2c.478.277.866.053.866-.5c0-.552-.388-1.223-.866-1.5s-.866-.052-.866.5c0 .553.388 1.224.866 1.5m4.33 5.498c0 .552-.389.776-.867.5s-.866-.948-.866-1.5s.388-.776.866-.5s.866.948.866 1.5M7.231 15.7c0 .553-.388.777-.866.5c-.478-.276-.866-.947-.866-1.5c0-.552.388-.776.866-.5c.478.277.866.948.866 1.5m3.463-2c0 .553-.388.777-.866.5c-.479-.275-.866-.947-.866-1.5c0-.551.387-.775.866-.5c.478.277.866.949.866 1.5"/></svg>`,
        folder: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 7h8c0.55 0 1 0.45 1 1v10c0 0.55 -0.45 1 -1 1h-16c-0.55 0 -1 -0.45 -1 -1v-11Z"/><path d="M12 7h-9v-1c0 -0.55 0.45 -1 1 -1h6Z"/></g></svg>`,
    },

    /**
     * Escapes standard plain text string for safe HTML injection.
     * @param {*} str - Text string input.
     * @returns {string} Sanitized text string.
     */
    escapeHTML: (str) => {
        if (str == null) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    /**
     * Resizes raw image Base64 data and draws thumbnail image via HTML5 Canvas.
     * @param {string} dataUrl - Raw image data string.
     * @returns {Promise<string>} Downscaled JPEG Data URL string.
     */
    createThumbnail: async (dataUrl) => {
        if (!dataUrl || !dataUrl.startsWith("data:image/")) return dataUrl;
        try {
            const img = new Image();
            img.src = dataUrl;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
            const canvas = document.createElement("canvas");
            const MAX_DIMENSION = 200;
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > MAX_DIMENSION) {
                    height = Math.round((height * MAX_DIMENSION) / width);
                    width = MAX_DIMENSION;
                }
            } else {
                if (height > MAX_DIMENSION) {
                    width = Math.round((width * MAX_DIMENSION) / height);
                    height = MAX_DIMENSION;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
            }
            return canvas.toDataURL("image/jpeg", 0.7);
        } catch (error) {
            console.error("Error creating thumbnail:", error);
            return dataUrl;
        }
    },

    /**
     * Appends a custom dynamic CSS stylesheet tag into the document head element.
     * @param {string} id - HTML element element ID string.
     * @param {string} css - Raw CSS stylesheet rule strings.
     * @returns {void}
     */
    injectStyles: (id, css) => {
        if (document.getElementById(id)) return;
        const styles = document.createElement("style");
        styles.id = id;
        styles.textContent = css;
        document.head.appendChild(styles);
    },

    /**
     * Generates render-ready HTML structure elements for basket display chips.
     * @param {ChipGroupInput} chipData - Input group object.
     * @param {PresetCache} [cache={}] - Preset cache map.
     * @param {Record<string, string>} [variantRolls={}] - Rolled variants map.
     * @param {RollState} [chipRollState={ rolls: {}, counts: {} }] - Dynamic roll tracker state.
     * @returns {RenderedChip} Rendered chip definition containing HTML markup snippets.
     */
    renderBasketChip: (chipData, cache = {}, variantRolls = {}, chipRollState = { rolls: {}, counts: {} }) => {
        const processed = PresetLogic.parseBasketChip(chipData, cache, variantRolls, chipRollState);

        const bgStyle = processed.bgImage
            ? `background-image: url("${processed.bgImage}")`
            : `background-color: ${processed.color}`;

        let inputHtml = "";
        if (processed.hasMoreVar) {
            inputHtml = `<span class="j0n4t-pg-var-more">${PresetDOM.icons.more}</span>`;
        } else if (processed.tag) {
            const { label, val, isBoolean, isNumeric } = processed.tag;
            const escLabel = PresetDOM.escapeHTML(label);
            const escVal = PresetDOM.escapeHTML(val);

            if (isBoolean) {
                const isChecked = val.toLowerCase() === "true" ? "checked" : "";
                inputHtml = `<input type="checkbox" class="j0n4t-pg-bool-input bool-input" tabindex="0" ${isChecked} title="${escLabel} toggle" aria-label="${escLabel} toggle" />`;
            } else if (isNumeric) {
                inputHtml = `<input type="number" step="0.05" class="j0n4t-pg-num-input num-input" tabindex="0" value="${escVal}" title="${escLabel} value" aria-label="${escLabel} value" />`;
            } else {
                inputHtml = `<input type="text" class="j0n4t-pg-text-input text-input" tabindex="0" value="${escVal}" title="${escLabel} text" aria-label="${escLabel} text" />`;
            }
        }

        let weightIconHtml = "";
        if (processed.weightVal !== null) {
            const labelPrefix = processed.weightVal > 0 ? `+${processed.weightVal}` : `${processed.weightVal}`;
            weightIconHtml = `<div class="j0n4t-pg-basket-chip-weight" data-action="open-weight" title="Adjust Weight (Current: ${processed.weightVal})">${labelPrefix}</div>`;
        }

        return {
            joinedStr: processed.joinedStr,
            evalId: processed.evalId,
            cleanLabel: processed.cleanLabel,
            bgStyle,
            tooltipTitle: processed.tooltipTitle,
            chipExpanded: processed.chipExpanded,
            item: processed.item,
            startIndex: processed.startIndex,
            endIndex: processed.endIndex,
            inputHtml,
            weightIconHtml,
            segmentedLabels: processed.segmentedLabels
        };
    }
};

export default PresetDOM;