const YAMLUtils = {
    stringify(obj, indent = 0) {
        let yaml = "";
        const spaces = " ".repeat(indent);
        for (const [key, value] of Object.entries(obj)) {
            if (value !== null && typeof value === "object" && !Array.isArray(value)) {
                yaml += `${spaces}${key}:\n${YAMLUtils.stringify(value, indent + 2)}`;
            } else {
                const strVal = String(value ?? "");
                if (strVal.includes("\n") || strVal.includes(":") || strVal.includes("#") || strVal.startsWith(" ") || strVal === "") {
                    yaml += `${spaces}${key}: "${strVal.replace(/"/g, '\\"')}"\n`;
                } else {
                    yaml += `${spaces}${key}: ${strVal}\n`;
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

            const key = trimmed.slice(0, colonIdx).trim().replace(/^['"]|['"]$/g, "");
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
                    cleanVal = cleanVal.slice(1, -1).replace(/\\"/g, '"');
                }
                currentParent[key] = cleanVal;
            }
        }
        return result;
    },
};

export default YAMLUtils;
