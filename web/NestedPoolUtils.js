const NestedPoolUtils = {
    flatToNested(pool, presetOnly = true, includeColors = true) {
        const root = {};
        for (const [key, item] of Object.entries(pool)) {
            if (!item) continue;

            if (!item.preset && item.__color__) {
                if (!includeColors) continue;
                const parts = key.split("/");
                let curr = root;
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    if (!curr[part] || typeof curr[part] !== "object") {
                        curr[part] = {};
                    }
                    if (i === parts.length - 1) {
                        curr[part].__color__ = item.__color__;
                    } else {
                        curr = curr[part];
                    }
                }
                continue;
            }

            const parts = key.split("/");
            let curr = root;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (!curr[part] || typeof curr[part] !== "object") {
                    curr[part] = {};
                }
                curr = curr[part];
            }
            const lastPart = parts[parts.length - 1];

            if (presetOnly) {
                curr[lastPart] = typeof item === "string" ? item : item.preset || "";
            } else {
                const copy = typeof item === "object" ? { ...item } : { preset: String(item) };
                if (!includeColors) delete copy.__color__;
                curr[lastPart] = copy;
            }
        }
        return root;
    },
    nestedToFlat(obj, prefix = "") {
        let flat = {};
        for (const [key, val] of Object.entries(obj)) {
            if (key === "__color__") {
                if (prefix) {
                    flat[prefix] = { ...(flat[prefix] || {}), __color__: String(val) };
                }
                continue;
            }

            const fullKey = prefix ? `${prefix}/${key}` : key;

            if (val !== null && typeof val === "object" && !("preset" in val)) {
                if (val.__color__) {
                    flat[fullKey] = { ...(flat[fullKey] || {}), __color__: String(val.__color__) };
                }
                Object.assign(flat, NestedPoolUtils.nestedToFlat(val, fullKey));
            } else {
                const tags = fullKey.includes("/") ? fullKey.split("/").slice(0, -1) : [];
                if (typeof val === "string") {
                    flat[fullKey] = {
                        preset: val,
                        tags: tags,
                        filename: null,
                    };
                } else if (typeof val === "object" && val !== null) {
                    if ("preset" in val) {
                        const item = {
                            preset: val.preset || "",
                            tags: val.tags || tags,
                            filename: val.filename || null,
                        };
                        if (val.__color__) item.__color__ = val.__color__;
                        flat[fullKey] = item;
                    } else if ("__color__" in val) {
                        flat[fullKey] = { ...(flat[fullKey] || {}), __color__: String(val.__color__) };
                    }
                }
            }
        }
        return flat;
    },
};

export default NestedPoolUtils;