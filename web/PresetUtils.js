const PresetUtils = {
    expandRecursively: (val, cache, seen = new Set(), rollState = null) => {
        if (!val) return "";
        const expandText = (str) => {
            if (!str) return "";
            // Replace any inline {group} or {group:selected_value} occurrences within text
            return str.replace(/\{([^{}:]+)(?::([^{}]+))?\}/g, (match, gName, sVal) => {
                const groupName = gName.trim().toLowerCase().replace(/\s+/g, "_");
                const selectedVal = sVal ? sVal.trim() : "";

                if (selectedVal) {
                    // Check if selectedVal maps to a cached preset key or path
                    let selectedKey = selectedVal;
                    if (cache && !cache[selectedKey]) {
                        // Find matching key in cache under groupName or full key
                        for (const k of Object.keys(cache)) {
                            if (k.toLowerCase() === selectedVal.toLowerCase() ||
                                PresetUtils.getPresetName(k).toLowerCase() === selectedVal.toLowerCase() ||
                                (k.toLowerCase().startsWith(groupName + "/") && PresetUtils.getPresetName(k).toLowerCase() === selectedVal.toLowerCase())) {
                                selectedKey = k;
                                break;
                            }
                        }
                    }
                    const item = cache?.[selectedKey];
                    if (item && item.preset) {
                        if (seen.has(selectedKey)) return item.preset;
                        const newSeen = new Set(seen);
                        newSeen.add(selectedKey);
                        return PresetUtils.expandRecursively(item.preset, cache, newSeen, rollState);
                    }
                    return selectedVal;
                }

                // If no value specified, pick a random matching preset from group
                const matches = cache
                    ? Object.keys(cache).filter((k) => {
                        if (!cache[k]?.preset) return false;
                        const folder = PresetUtils.getPresetFolder(k).toLowerCase();
                        return folder === groupName || folder.startsWith(groupName + "/") || folder.endsWith("/" + groupName);
                    })
                    : [];
                if (matches.length > 0) {
                    let pickedKey;
                    if (rollState) {
                        const occKey = groupName + "_" + (rollState.counts[groupName] || 0);
                        rollState.counts[groupName] = (rollState.counts[groupName] || 0) + 1;
                        pickedKey = rollState.rolls[occKey];
                        // Roll a new value if undefined or no longer valid in cache
                        if (!pickedKey || !matches.includes(pickedKey)) {
                            pickedKey = matches[Math.floor(Math.random() * matches.length)];
                            rollState.rolls[occKey] = pickedKey;
                        }
                    } else {
                        pickedKey = matches[Math.floor(Math.random() * matches.length)];
                    }

                    if (seen.has(pickedKey)) return pickedKey;
                    const newSeen = new Set(seen);
                    newSeen.add(pickedKey);
                    return PresetUtils.expandRecursively(cache[pickedKey].preset, cache, newSeen, rollState);
                }
                return match;
            });
        };

        const expandToken = (tokenStr) => {
            const trimmed = tokenStr.trim();
            if (!trimmed) return "";

            const item = cache?.[trimmed];
            if (item && item.preset) {
                if (seen.has(trimmed)) return trimmed; // Prevent circular references
                const newSeen = new Set(seen);
                newSeen.add(trimmed);
                return expandText(PresetUtils.expandRecursively(item.preset, cache, newSeen, rollState));
            }
            return expandText(trimmed);
        };

        const keys = val.split(/,(?![^<]*>)/).map((k) => k.trim()).filter(Boolean);
        const expanded = keys.map(expandToken);
        return expanded.filter(Boolean).join(", ");
    },
    escapeHTML: (str) => {
        if (str == null) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },
    parseDataURL: (dataUrl) => {
        if (!dataUrl || !dataUrl.startsWith("data:")) return null;
        const matches = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
        if (!matches) return null;
        let ext = matches[1].toLowerCase();
        if (ext === "jpeg") ext = "jpg";
        return { ext, base64: matches[2] };
    },
    /**
     * Parse raw text into structured tokens considering multi-comma preset output strings.
     * Guarantees exact 1:1 character sequence reconstruction.
     * @param {string} val 
     * @returns {Array<{start: number, end: number, text: string, key?: string, item?: Object, isTag?: boolean, isDelimiter?: boolean, isPlainText?: boolean}>}
     */
    parseTokens: (val, cache = null, ignorePreset = null) => {
        const tokens = [];
        if (!val) return tokens;

        // Collect candidate preset strings & keys
        const candidates = [];
        if (cache) {
            for (const [key, item] of Object.entries(cache)) {
                if (item?.preset && item.preset.trim()) {
                    // Match against the fully expanded string to find the biggest possible chip
                    const expanded = PresetUtils.expandRecursively(item.preset.trim(), cache);
                    candidates.push({ matchStr: expanded, key, item });

                    // Also allow matching the unexpanded form if the user typed it manually
                    if (expanded !== item.preset.trim()) {
                        candidates.push({ matchStr: item.preset.trim(), key, item });
                    }
                }
                if (key && key.trim()) {
                    candidates.push({ matchStr: key.trim(), key, item });
                }
            }
        }

        // Deduplicate candidates by matchStr (preferring candidate with item)
        const candidateMap = new Map();
        for (const cand of candidates) {
            if (!candidateMap.has(cand.matchStr) || cand.item) {
                candidateMap.set(cand.matchStr, cand);
            }
        }

        // Sort by length descending so multi-comma preset strings match first
        const sortedCandidates = Array.from(candidateMap.values()).sort(
            (a, b) => b.matchStr.length - a.matchStr.length
        );

        const isValidBoundary = (startIdx, endIdx) => {
            for (let i = startIdx - 1; i >= 0; i--) {
                if (val[i] === ',') break;
                if (!/\s/.test(val[i])) return false;
            }
            for (let i = endIdx; i < val.length; i++) {
                if (val[i] === ',') break;
                if (!/\s/.test(val[i])) return false;
            }
            return true;
        };

        let idx = 0;
        while (idx < val.length) {
            let matched = null;

            // 1. Try matching cached presets
            for (const cand of sortedCandidates) {
                if (val.startsWith(cand.matchStr, idx)) {
                    if (cand.key === ignorePreset || cand.matchStr === ignorePreset) continue;
                    if (isValidBoundary(idx, idx + cand.matchStr.length)) {
                        matched = cand;
                        break;
                    }
                }
            }

            if (!matched) {
                const varMatch = val.slice(idx).match(/^\{[^{}]+(?::[^{}]+)?\}/i);
                if (varMatch) {
                    matched = { matchStr: varMatch[0], isVar: true };
                } else {
                    const tagMatch = val.slice(idx).match(/^<[^<>]+>/i);
                    if (tagMatch) {
                        matched = { matchStr: tagMatch[0], isTag: true };
                    }
                }
            }

            if (matched) {
                tokens.push({
                    start: idx,
                    end: idx + matched.matchStr.length,
                    text: matched.matchStr,
                    key: matched.key,
                    item: matched.item,
                    isTag: matched.isTag
                });
                idx += matched.matchStr.length;
            } else {
                // Handle comma delimiter
                if (val[idx] === ',') {
                    tokens.push({
                        start: idx,
                        end: idx + 1,
                        text: ',',
                        isDelimiter: true
                    });
                    idx += 1;
                } else {
                    // Consume plain text up to next comma or candidate/lora match
                    let endPlain = idx + 1;
                    while (endPlain < val.length) {
                        if (val[endPlain] === ',') break;

                        let foundNextMatch = false;
                        if (val[endPlain] === '<' && /^<[^<>]+/i.test(val.slice(endPlain))) {
                            foundNextMatch = true;
                        } else if (val[endPlain] === '{' && /^\{[^{}]+(?::[^{}]+)?\}/.test(val.slice(endPlain))) {
                            foundNextMatch = true;
                        } else {
                            for (const cand of sortedCandidates) {
                                if (val.startsWith(cand.matchStr, endPlain)) {
                                    if (cand.key === ignorePreset || cand.matchStr === ignorePreset) continue;
                                    if (isValidBoundary(endPlain, endPlain + cand.matchStr.length)) {
                                        foundNextMatch = true;
                                        break;
                                    }
                                }
                            }
                        }

                        if (foundNextMatch) break;
                        endPlain++;
                    }

                    const plainText = val.slice(idx, endPlain);
                    tokens.push({
                        start: idx,
                        end: idx + plainText.length,
                        text: plainText,
                        isPlainText: true
                    });
                    idx = endPlain;
                }
            }
        }

        return tokens;
    },
    getMimeType: (ext) => {
        const e = ext.toLowerCase();
        if (e === "jpg" || e === "jpeg") return "image/jpeg";
        if (e === "pn,g") return "image/png";
        if (e === "webp") return "image/webp";
        if (e === "gif") return "image/gif";
        return "image/png";
    },
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
            ctx.drawImage(img, 0, 0, width, height);
            return canvas.toDataURL("image/jpeg", 0.7);
        } catch (error) {
            console.error("Error creating thumbnail:", error);
            return dataUrl;
        }
    },
    toTitleCase: (str) =>
        str
            .replace(/_/g, " ")
            .replace(/-/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase()),
    getHashColor: (str) => {
        let hash = 0;
        for (let i = 0; i < 6; i++) hash = Math.imul(hash ^ str.charCodeAt(i), 15485863);
        hash = (hash ^ (hash >>> 16)) * 0x85ebca6b;
        hash = (hash ^ (hash >>> 13)) * 0xc2b2ae35;
        const hue = Math.abs((hash ^ (hash >>> 15)) % 360);
        return `hsl(${hue}, 65%, 35%)`;
    },
    getAllPresetFolders: (cache) => Array.from(new Set(
        Object.keys(cache).map(key => PresetUtils.getPresetFolder(key))
    )),
    getPresetColor: (presetKey = "", cache = null) => {
        const parts = presetKey.split("/");
        for (let i = parts.length; i > 0; i--) {
            const parentPath = parts.slice(0, i).join("/");
            if (cache && cache[parentPath] && cache[parentPath].__color__) {
                return cache[parentPath].__color__;
            }
        }
        const topLevel = parts[0];
        return PresetUtils.getHashColor(topLevel);
    },
    getPresetBaseFolder: (key) => (key.includes("/") ? key.split("/")[0] : key),
    getPresetName: (key) => key.split("/").pop(),
    getPresetTitle: (key, cache) => `${PresetUtils.toTitleCase(PresetUtils.getPresetName(key))} [${key}]\n${cache[key]?.preset || ""}`,
    getPresetInitials: (key) => {
        const raw = key.includes("/") ? PresetUtils.getPresetName(key) : key;
        return PresetUtils.toTitleCase(raw)
            .split(/\s+/)
            .map((w) => w.slice(0, 2))
            .join("")
            .substring(0, 6);
    },
    getPresetFolder: (key) => key.split("/").slice(0, -1).join("/"),
    getUiFolder: (key) => PresetUtils.getPresetFolder(key).split("/").join(" › "),
    getSearchBlob: (key, item) =>
        `${PresetUtils.getPresetName(key)} ${key} ${PresetUtils.getPresetInitials(key)} ${item.preset || ""}`.toLowerCase(),
    getTopMatches: (list, query, getSearchBlob = (i) => i, cache = null, ignorePreset = null) => {
        const queryWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
        if (!queryWords.length) return [];
        const buckets = list.reduce(
            (acc, item) => {
                if (cache && !cache[item].preset || item === ignorePreset) return acc;
                const blob = getSearchBlob(item).toLowerCase();
                if (!queryWords.every((word) => blob.includes(word))) return acc;
                const title = cache ? PresetUtils.getPresetTitle(item, cache) : "";
                let idx = blob.indexOf(queryWords.join(" "));
                if (idx === -1) idx = blob.indexOf(queryWords[0]);
                if (idx === 0) {
                    if (acc.startsWith.length < 3) acc.startsWith.push({ item, idx, title });
                } else {
                    if (acc.fuzzy.length < 3) acc.fuzzy.push({ item, idx, title });
                }
                return acc;
            },
            { startsWith: [], fuzzy: [] }
        );
        const sortBucket = (arr) =>
            arr
                .sort((a, b) => (a.idx !== b.idx ? a.idx - b.idx : a.item.localeCompare(b.item)))
                .map(({ item, title }) => ({ item, title }));
        return Array.from(new Set([...sortBucket(buckets.startsWith), ...sortBucket(buckets.fuzzy)]));
    },
    injectStyles: (id, css) => {
        if (document.getElementById(id)) return;
        const styles = document.createElement("style");
        styles.id = id;
        styles.textContent = css;
        document.head.appendChild(styles);
    },
    alert: (message) => {
        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.className = "j0n4t-pg-modal-overlay";
            const modal = document.createElement("div");
            modal.className = "j0n4t-pg-modal";
            modal.innerHTML = `
                <h3>⚠️ Notice</h3>
                <div style="font-size: 11px; color: #ccc; line-height: 1.4;">${PresetUtils.escapeHTML(message)}</div>
                <div class="j0n4t-pg-modal-actions">
                    <button type="button" class="j0n4t-pg-btn" style="background:#007acc; width: 60px;">OK</button>
                </div>
            `;
            overlay.appendChild(modal);
            const close = () => {
                overlay.remove();
                resolve();
            };
            modal.querySelector("button").addEventListener("click", close);
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) close();
            });
            document.body.appendChild(overlay);
        });
    },
    confirm: (message) => {
        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.className = "j0n4t-pg-modal-overlay";
            const modal = document.createElement("div");
            modal.className = "j0n4t-pg-modal";
            modal.innerHTML = `
                <h3>❓ Confirmation</h3>
                <div style="font-size: 11px; color: #ccc; line-height: 1.4;">${PresetUtils.escapeHTML(message)}</div>
                <div class="j0n4t-pg-modal-actions">
                    <button type="button" class="j0n4t-pg-btn" id="j0n4t-pg-conf-cancel" style="background:#444;">Cancel</button>
                    <button type="button" class="j0n4t-pg-btn" id="j0n4t-pg-conf-ok" style="background:#007acc;">Confirm</button>
                </div>
            `;
            overlay.appendChild(modal);
            const close = (result) => {
                overlay.remove();
                resolve(result);
            };
            modal.querySelector("#j0n4t-pg-conf-cancel").addEventListener("click", () => close(false));
            modal.querySelector("#j0n4t-pg-conf-ok").addEventListener("click", () => close(true));
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) close(false);
            });
            document.body.appendChild(overlay);
        });
    },
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
    },
};

export default PresetUtils;