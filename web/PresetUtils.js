const PresetUtils = {
    escapeHTML: (str) => {
        if (str == null) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
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
    hslToHex: (h, s, l) => {
        l /= 100;
        const a = (s * Math.min(l, 1 - l)) / 100;
        const f = (n) => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, "0");
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    },
    getInheritedGroupColor: (groupRaw) => {
        if (!groupRaw) return PresetUtils.getHashColor("");

        try {
            const customColors = JSON.parse(localStorage.getItem("pg_group_colors") || "{}");
            const parts = groupRaw.split("/");
            for (let i = parts.length; i > 0; i--) {
                const parentPath = parts.slice(0, i).join("/");
                if (customColors[parentPath]) {
                    return customColors[parentPath];
                }
            }

            const topLevel = parts[0] || "";
            return PresetUtils.getHashColor(topLevel);
        } catch (e) {
            const parts = groupRaw.split("/");
            const topLevel = parts[0] || "";
            return PresetUtils.getHashColor(topLevel);
        }
    },

    getGroupColor: (groupRaw) => PresetUtils.getInheritedGroupColor(groupRaw),
    getGroupHexColor: (groupRaw) => {
        const color = PresetUtils.getGroupColor(groupRaw);
        if (color.startsWith("#")) return color;
        const hslMatch = color.match(/hsl\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*\)/i);
        if (hslMatch) {
            return PresetUtils.hslToHex(parseFloat(hslMatch[1]), parseFloat(hslMatch[2]), parseFloat(hslMatch[3]));
        }
        return "#007acc";
    },
    setGroupColor: (groupRaw, color) => {
        try {
            const customColors = JSON.parse(localStorage.getItem("pg_group_colors") || "{}");
            if (color) customColors[groupRaw] = color;
            else delete customColors[groupRaw];
            localStorage.setItem("pg_group_colors", JSON.stringify(customColors));
        } catch (e) { }
    },
    getPresetBaseFolder: (key) => (key.includes("/") ? key.split("/")[0] : key),
    getPresetColor: (key) => {
        if (!key.includes("/")) {
            return PresetUtils.getHashColor(key);
        }
        const groupPath = key.substring(0, key.lastIndexOf("/"));
        return PresetUtils.getInheritedGroupColor(groupPath);
    },
    getPresetName: (key) => key.split("/").pop(),
    getPresetTitle: (key, cache) =>
        PresetUtils.escapeHTML(
            `${PresetUtils.toTitleCase(PresetUtils.getPresetName(key))} [${key}]\n${cache[key]?.preset || ""}`
        ),
    getPresetInitials: (key) => {
        const raw = key.includes("/") ? PresetUtils.getPresetName(key) : key;
        return PresetUtils.toTitleCase(raw)
            .split(/\s+/)
            .map((w) => w.slice(0, 2))
            .join("")
            .substring(0, 6);
    },
    getSearchBlob: (key, item) =>
        `${PresetUtils.getPresetName(key)} ${key} ${PresetUtils.getPresetInitials(key)} ${item.preset || ""} ${(item.tags || []).join(" ")}`.toLowerCase(),
    getTopMatches: (list, query, getSearchBlob = (i) => i) => {
        const queryWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
        if (!queryWords.length) return [];
        const buckets = list.reduce(
            (acc, item) => {
                const blob = getSearchBlob(item).toLowerCase();
                if (!queryWords.every((word) => blob.includes(word))) return acc;
                let idx = blob.indexOf(queryWords.join(" "));
                if (idx === -1) idx = blob.indexOf(queryWords[0]);
                if (idx === 0) {
                    if (acc.startsWith.length < 3) acc.startsWith.push({ item, idx });
                } else {
                    if (acc.fuzzy.length < 3) acc.fuzzy.push({ item, idx });
                }
                return acc;
            },
            { startsWith: [], fuzzy: [] }
        );

        const sortBucket = (arr) =>
            arr
                .sort((a, b) => (a.idx !== b.idx ? a.idx - b.idx : a.item.localeCompare(b.item)))
                .map((entry) => entry.item);

        return Array.from(new Set([...sortBucket(buckets.startsWith), ...sortBucket(buckets.fuzzy)]));
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
    },
};

export default PresetUtils; 
