const YAMLUtils = {
    stringify(obj, indent = 0) {
        let yaml = "";
        const spaces = " ".repeat(indent);
        const needsQuotes = /[\n:#"{}@]|^\s|^$/;

        for (const [key, value] of Object.entries(obj)) {
            let strKey = String(key);
            if (needsQuotes.test(strKey)) {
                strKey = `"${strKey.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
            }

            if (value !== null && typeof value === "object" && !Array.isArray(value)) {
                yaml += `${spaces}${strKey}:\n${YAMLUtils.stringify(value, indent + 2)}`;
            } else {
                const strVal = String(value ?? "");
                if (needsQuotes.test(strVal)) {
                    yaml += `${spaces}${strKey}: "${strVal.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"\n`;
                } else {
                    yaml += `${spaces}${strKey}: ${strVal}\n`;
                }
            }
        }
        return yaml;
    },
    parse(yamlStr) {
        const lines = yamlStr.split(/\r?\n/);
        const result = {};
        const stack = [{ indent: -1, obj: result }];

        for (let line of lines) {
            const commentIdx = line.indexOf(" #");
            if (commentIdx !== -1) line = line.slice(0, commentIdx);
            if (!line.trim()) continue;

            const indent = line.search(/\S/);
            const trimmed = line.trim();
            const colonIdx = trimmed.indexOf(":");
            if (colonIdx === -1) continue;

            let rawKey = trimmed.slice(0, colonIdx).trim();
            let key = rawKey;
            if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
                key = rawKey.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            }

            const valStr = trimmed.slice(colonIdx + 1).trim();

            while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
                stack.pop();
            }

            const currentParent = stack[stack.length - 1].obj;

            if (valStr === "" || valStr === "null") {
                const newObj = {};
                currentParent[key] = newObj;
                stack.push({ indent, obj: newObj });
            } else {
                let cleanVal = valStr;
                if ((cleanVal.startsWith('"') && cleanVal.endsWith('"')) || (cleanVal.startsWith("'") && cleanVal.endsWith("'"))) {
                    cleanVal = cleanVal.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                }
                currentParent[key] = cleanVal;
            }
        }
        return result;
    },
};

export default YAMLUtils;