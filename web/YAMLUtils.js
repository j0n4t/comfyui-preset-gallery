const YAMLUtils = {
    /** @param {Record<string, any>} obj */
    stringify(obj, indent = 0) {
        let yaml = "";
        const spaces = " ".repeat(indent);
        const needsQuotes = /[\n:#"{}@]|^\s|^$/;

        const escapeString = (/** @type {string} */ str) =>
            `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;

        for (const [key, value] of Object.entries(obj)) {
            let strKey = String(key);
            if (needsQuotes.test(strKey)) {
                strKey = escapeString(strKey);
            }

            if (value !== null && typeof value === "object" && !Array.isArray(value)) {
                yaml += `${spaces}${strKey}:\n${YAMLUtils.stringify(value, indent + 2)}`;
            } else if (Array.isArray(value)) {
                if (value.length === 0) {
                    yaml += `${spaces}${strKey}: []\n`;
                    continue;
                }
                yaml += `${spaces}${strKey}:\n`;
                for (const item of value) {
                    const itemSpaces = " ".repeat(indent + 2);
                    if (item !== null && typeof item === "object") {
                        yaml += `${itemSpaces}-\n${YAMLUtils.stringify(item, indent + 4)}`;
                    } else {
                        if (item === null || item === undefined) continue;
                        const strVal = String(item ?? "");
                        if (needsQuotes.test(strVal)) {
                            yaml += `${itemSpaces}- ${escapeString(strVal)}\n`;
                        } else {
                            yaml += `${itemSpaces}- ${strVal}\n`;
                        }
                    }
                }
            } else {
                if (value === null || value === undefined) continue;
                const strVal = String(value ?? "");
                if (needsQuotes.test(strVal)) {
                    yaml += `${spaces}${strKey}: ${escapeString(strVal)}\n`;
                } else {
                    yaml += `${spaces}${strKey}: ${strVal}\n`;
                }
            }
        }
        return yaml;
    },
    /**
     * @param {string} yamlStr
     * @returns {Record<string, any>}
     */
    parse(yamlStr) {
        const lines = yamlStr.split(/\r?\n/);
        /** @type {Record<string, any>} */
        const result = {};
        /** @type {{ indent: number; obj: any; isArray: boolean }[]} */
        const stack = [{ indent: -1, obj: result, isArray: false }];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const commentIdx = line.indexOf(" #");
            if (commentIdx !== -1) line = line.slice(0, commentIdx);
            if (!line.trim()) continue;

            const indent = line.search(/\S/);
            const trimmed = line.trim();

            // List item
            if (trimmed.startsWith("- ") || trimmed === "-") {
                while (stack.length > 1 && (stack[stack.length - 1].indent > indent ||
                    (stack[stack.length - 1].indent === indent && !stack[stack.length - 1].isArray))) {
                    stack.pop();
                }
                const parent = stack[stack.length - 1];
                if (!parent.isArray) continue;

                const itemContent = trimmed === "-" ? "" : trimmed.slice(2).trim();

                if (itemContent === "") {
                    const nextLine = lines[i + 1];
                    if (nextLine && /^\s*-(\s|$)/.test(nextLine)) {
                        /** @type {any[]} */
                        const newArr = [];
                        parent.obj.push(newArr);
                        stack.push({ indent, obj: newArr, isArray: true });
                    } else {
                        /** @type {Record<string, any>} */
                        const newObj = {};
                        parent.obj.push(newObj);
                        stack.push({ indent, obj: newObj, isArray: false });
                    }
                } else if (itemContent.includes(":")) {
                    const colonIdx = itemContent.indexOf(":");
                    const key = YAMLUtils._parseKey(itemContent.slice(0, colonIdx).trim());
                    const val = itemContent.slice(colonIdx + 1).trim();
                    /** @type {Record<string, any>} */
                    const newObj = {};
                    newObj[key] = YAMLUtils._coerceValue(val);
                    parent.obj.push(newObj);
                    stack.push({ indent, obj: newObj, isArray: false });
                } else {
                    parent.obj.push(YAMLUtils._coerceValue(itemContent));
                }
                continue;
            }

            // Key: value
            const colonIdx = trimmed.indexOf(":");
            if (colonIdx === -1) continue;

            const key = YAMLUtils._parseKey(trimmed.slice(0, colonIdx).trim());
            const valStr = trimmed.slice(colonIdx + 1).trim();

            while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
                stack.pop();
            }

            const current = stack[stack.length - 1];

            if (valStr === "[]") {
                current.obj[key] = [];
            } else if (valStr === "{}") {
                current.obj[key] = {};
            } else if (valStr === "" || valStr === "null" || valStr === "~") {
                let nextLine = "";
                let nextIndent = indent;
                for (let j = i + 1; j < lines.length; j++) {
                    if (lines[j].trim()) {
                        nextLine = lines[j];
                        nextIndent = lines[j].search(/\S/);
                        break;
                    }
                }
                if (nextLine && /^\s*-(\s|$)/.test(nextLine) && nextIndent > indent) {
                    /** @type {any[]} */
                    const newArr = [];
                    current.obj[key] = newArr;
                    stack.push({ indent, obj: newArr, isArray: true });
                } else {
                    /** @type {Record<string, any>} */
                    const newObj = {};
                    current.obj[key] = newObj;
                    stack.push({ indent, obj: newObj, isArray: false });
                }
            } else {
                current.obj[key] = YAMLUtils._coerceValue(valStr);
            }
        }
        return result;
    },

    /** @param {string} rawKey */
    _parseKey(rawKey) {
        if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
            return rawKey.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
        }
        return rawKey;
    },

    /** @param {string} val */
    _coerceValue(val) {
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            return val.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
        }
        if (val === "true") return true;
        if (val === "false") return false;
        if (val === "null" || val === "~") return null;
        if (/^-?\d+$/.test(val)) return parseInt(val, 10);
        if (/^-?\d*\.\d+$/.test(val)) return parseFloat(val);
        return val;
    },
};

export default YAMLUtils;
