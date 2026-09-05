class RollManager {
  constructor(initialRolls = {}) {
    this.rolls = { ...initialRolls };
    this.counts = {};
  }

  resetCounts() {
    this.counts = {};
    return this;
  }

  clearAll() {
    this.rolls = {};
    this.counts = {};
    return this;
  }

  getCount(group) {
    return this.counts[group] || 0;
  }

  cloneCounts() {
    return { ...this.counts };
  }

  restoreCounts(counts) {
    this.counts = { ...counts };
    return this;
  }

  getRoll(group, matches = null) {
    const idx = this.getCount(group);
    this.counts[group] = idx + 1;
    const key = `${group}_${idx}`;

    if (matches && matches.length > 0) {
      if (!this.rolls[key] || !matches.includes(this.rolls[key])) {
        this.rolls[key] = matches[Math.floor(Math.random() * matches.length)];
      }
    }
    return this.rolls[key];
  }

  peekRoll(group, index) {
    return this.rolls[`${group}_${index}`];
  }

  deleteRoll(group, index) {
    delete this.rolls[`${group}_${index}`];
  }
}

const PresetLogic = {
  RollManager,

  /**
   * Recursively expands presets but leaves {group} variants intact.
   * @param {string} val - Template string to expand.
   * @param {PresetCache} cache - Preset cache lookup dictionary.
   * @param {Set<string>} [seen=new Set()] - Circular dependency tracking set.
   * @returns {string} Unrolled template string.
   */
  getUnrolledTemplate: (val, cache, seen = new Set()) => {
    if (!val) return "";

    const getWrappedPreset = (key, baseStr) => {
      if (!cache) return baseStr;
      const folder = PresetLogic.getPresetFolder(key);
      const prependMatch = cache[`_/config/prepend/${folder}`]?.preset;
      const appendMatch = cache[`_/config/append/${folder}`]?.preset;

      if (prependMatch || appendMatch) {
        const pre = prependMatch ? `${prependMatch} ` : "";
        const app = appendMatch ? ` ${appendMatch}` : "";
        return `${pre}${baseStr}${app}`.trim();
      }
      return baseStr;
    };

    const expandToken = (tokenStr) => {
      const trimmed = tokenStr.trim();
      if (!trimmed) return "";

      const item = cache?.[trimmed];
      if (item && item.preset) {
        if (seen.has(trimmed)) return trimmed;
        const newSeen = new Set(seen);
        newSeen.add(trimmed);
        const wrappedPreset = getWrappedPreset(trimmed, item.preset);
        return PresetLogic.getUnrolledTemplate(wrappedPreset, cache, newSeen);
      }
      return trimmed;
    };

    const keys = PresetLogic.splitPresets(val);
    const expanded = keys.map(expandToken);
    return expanded.filter(Boolean).join(", ").trim().replace(/\s+/g, ' ');
  },

  /**
   * Splits comma-separated preset strings while preserving nested structures inside (), <>, and {}.
   * @param {string} str - Raw input string.
   * @returns {string[]} Tokens extracted.
   */
  splitPresets: (str) => {
    if (!str) return [];
    const tokens = [];
    let current = "";
    let depthParen = 0;
    let depthAngle = 0;
    let depthBrace = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '(') depthParen++;
      else if (char === ')') depthParen = Math.max(0, depthParen - 1);
      else if (char === '<') depthAngle++;
      else if (char === '>') depthAngle = Math.max(0, depthAngle - 1);
      else if (char === '{') depthBrace++;
      else if (char === '}') depthBrace = Math.max(0, depthBrace - 1);

      if (char === ',' && depthParen === 0 && depthAngle === 0 && depthBrace === 0) {
        tokens.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      tokens.push(current.trim());
    }
    return tokens.filter(Boolean);
  },

  /**
   * Finds cache keys matching a specific preset folder group name.
   * @param {string} groupName - Target folder/group name.
   * @param {PresetCache} [cache={}] - Cache lookup map.
   * @returns {string[]} Matching keys.
   */
  getGroupMatches: (groupName, cache = {}) => {
    if (!cache || !groupName) return [];
    const lowerGroup = groupName.toLowerCase();
    return Object.keys(cache).filter((k) => {
      if (!cache[k]?.preset || k.startsWith("_/config/append") || k.startsWith("_/config/prepend")) return false;
      const folder = PresetLogic.getPresetFolder(k).toLowerCase();
      return folder === lowerGroup || folder.startsWith(lowerGroup + "/") || folder.endsWith("/" + lowerGroup);
    });
  },

  /**
   * Checks if a variant value represents a virtual null option to omit it.
   * @param {string} val - Variant value string.
   * @returns {boolean} True if virtual null ("none" or "null").
   */
  isVirtualNull: (val) => {
    if (!val) return false;
    const lower = val.trim().toLowerCase();
    return lower === "none" || lower === "null";
  },

  /**
   * Resolves a target variant key within the cache.
   * @param {string} groupName - Group context.
   * @param {string} val - Variant value to match.
   * @param {PresetCache} [cache={}] - Cache lookup map.
   * @returns {string|null} Resolved key or null.
   */
  resolveVariantKey: (groupName, val, cache = {}) => {
    if (!val) return null;
    if (cache[val]) return val;
    const lowerVal = val.toLowerCase();
    const lowerGroup = groupName ? groupName.toLowerCase() : "";

    for (const k of Object.keys(cache)) {
      const lowerK = k.toLowerCase();
      const presetName = PresetLogic.getPresetName(k).toLowerCase();
      if (
        lowerK === lowerVal ||
        presetName === lowerVal ||
        (lowerGroup && lowerK.startsWith(lowerGroup + "/") && presetName === lowerVal)
      ) {
        return k;
      }
    }
    return null;
  },

  /**
   * Recursively expands `{group:value}` syntax and references within templates.
   * @param {string} val - Template string to expand.
   * @param {PresetCache} cache - Preset cache lookup dictionary.
   * @param {Set<string>} [seen=new Set()] - Circular dependency tracking set.
   * @param {RollState|null} [rollState=null] - Dynamic roll state tracer.
   * @returns {string} Fully expanded prompt text.
   */
  expandRecursively: (val, cache, seen = new Set(), rollManager = null) => {
    if (!val) return "";

    const getWrappedPreset = (key, baseStr) => {
      if (!cache) return baseStr;
      const folder = PresetLogic.getPresetFolder(key);
      const prependMatch = cache[`_/config/prepend/${folder}`]?.preset;
      const appendMatch = cache[`_/config/append/${folder}`]?.preset;

      if (prependMatch || appendMatch) {
        const pre = prependMatch ? `${prependMatch} ` : "";
        const app = appendMatch ? ` ${appendMatch}` : "";
        return `${pre}${baseStr}${app}`.trim();
      }
      return baseStr;
    };

    const expandText = (/** @type {string} */ str) => {
      if (!str) return "";
      return str.replace(/\{([^{}:]+)(?::([^{}]+))?\}/g,
        (/** @type {any} */ match, /** @type {string} */ gName, /** @type {string} */ sVal) => {
          const groupName = gName.trim().toLowerCase().replace(/\s+/g, "_");
          const selectedVal = sVal ? sVal.trim() : "";

          if (selectedVal) {
            if (rollManager) {
              rollManager.counts[groupName] = (rollManager.counts[groupName] || 0) + 1;
            }
            if (PresetLogic.isVirtualNull(selectedVal)) {
              return "";
            }
            const selectedKey = PresetLogic.resolveVariantKey(groupName, selectedVal, cache) || selectedVal;
            const item = cache?.[selectedKey];
            if (item && item.preset) {
              if (seen.has(selectedKey)) return item.preset;
              const newSeen = new Set(seen);
              newSeen.add(selectedKey);
              const wrappedPreset = getWrappedPreset(selectedKey, item.preset);
              return PresetLogic.expandRecursively(wrappedPreset, cache, newSeen, rollManager);
            }
            return selectedVal;
          }

          const matches = PresetLogic.getGroupMatches(groupName, cache);
          if (matches.length > 0) {
            const pickedKey = rollManager
              ? rollManager.getRoll(groupName, matches)
              : matches[Math.floor(Math.random() * matches.length)];

            if (seen.has(pickedKey)) return pickedKey;
            const newSeen = new Set(seen);
            newSeen.add(pickedKey);
            const wrappedPreset = getWrappedPreset(pickedKey, cache[pickedKey].preset || "");
            return PresetLogic.expandRecursively(wrappedPreset, cache, newSeen, rollManager);
          }
          return match;
        });
    };

    const expandToken = (/** @type {string} */ tokenStr) => {
      const trimmed = tokenStr.trim();
      if (!trimmed) return "";

      const item = cache?.[trimmed];
      if (item && item.preset) {
        if (seen.has(trimmed)) return trimmed;
        const newSeen = new Set(seen);
        newSeen.add(trimmed);
        const wrappedPreset = getWrappedPreset(trimmed, item.preset);
        return expandText(PresetLogic.expandRecursively(wrappedPreset, cache, newSeen, rollManager));
      }
      return expandText(trimmed);
    };

    const keys = PresetLogic.splitPresets(val);
    const expanded = keys.map(expandToken);
    return expanded.filter(Boolean).join(", ").trim().replace(/\s+/g, ' ');
  },

  /**
   * Parses a string token to extract tag info, variant list, or cache match.
   * @param {string} text - Raw token text.
   * @param {PresetCache} [cache] - Preset cache.
   * @returns {ParsedChipDetails} Parsed metadata.
   */
  parseChipDetails: (text, cache) => {
    if (!text) return { variants: [], tag: null, presetMatch: null, trimmed: "" };
    const trimmed = text.trim();

    const varRegex = /\{([^{}:]+)(?::([^{}]+))?\}/g;
    const variants = Array.from(trimmed.matchAll(varRegex)).map((m) => ({
      full: m[0],
      groupRaw: m[1].trim(),
      groupName: m[1].trim().toLowerCase().replace(/\s+/g, "_"),
      val: m[2] ? m[2].trim() : "",
    }));

    const tagMatch = trimmed.match(/^<(.+?)>$/);
    let tag = null;
    if (tagMatch) {
      const parts = tagMatch[1].split(/[:;]/);
      if (parts[0].match(/lora|lyco/) || parts.length === 2) {
        const val = parts.pop()?.trim() || "";
        const label = parts.pop()?.trim() || "";
        tag = {
          label,
          val,
          isBoolean: /^(true|false)$/i.test(val),
          isNumeric: !isNaN(Number(val)) && val !== "",
        };
      }
    }

    return { variants, tag, presetMatch: PresetLogic.findPresetMatch(trimmed, cache), trimmed };
  },

  /**
   * Resolves metadata (title and thumbnail) for single tokens within complex segment prompts.
   * @param {string} token - Inner text token.
   * @param {PresetCache} [cache] - Cache object.
   * @param {Record<string, string>} [variantRolls={}] - Map of pre-rolled variant choices.
   * @param {Record<string, number>} [countsTracker={}] - Tracker of variant group indices.
   * @returns {PresetSegment} Resolved title and image filename.
   */
  resolvePresetSegment: (token, cache, rollManager) => {
    if (!token) return { title: "", filename: null };
    const parsed = PresetLogic.parseChipDetails(token, cache);

    if (parsed.presetMatch) {
      return {
        title: PresetLogic.toTitleCase(PresetLogic.getPresetName(parsed.presetMatch.key)),
        filename: parsed.presetMatch.item?.filename || null
      };
    }
    if (parsed.tag) {
      return { title: parsed.tag.label, filename: null };
    }
    if (parsed.variants.length > 0) {
      /** @type {string|null} */
      let filename = null;
      const title = token.replace(/\{([^{}:]+)(?::([^{}]+))?\}/g, (full, g1, sVal) => {
        const groupRaw = g1.trim();
        const groupName = groupRaw.toLowerCase().replace(/\s+/g, "_");
        const val = sVal ? sVal.trim() : "";

        if (val && PresetLogic.isVirtualNull(val)) {
          return "";
        }

        const resolvedKey = val
          ? PresetLogic.resolveVariantKey(groupName, val, cache)
          : rollManager?.getRoll(groupName);

        if (resolvedKey && cache) {
          if (!filename && cache[resolvedKey]?.filename) {
            filename = cache[resolvedKey].filename;
          }
          return PresetLogic.toTitleCase(PresetLogic.getPresetName(resolvedKey));
        }
        return PresetLogic.toTitleCase(groupRaw);
      });
      return { title, filename };
    }
    return { title: token, filename: null };
  },

  /**
   * Processes input chip data and returns non-DOM pure calculated state.
   * @param {ChipGroupInput} chipData - Raw chip group input.
   * @param {PresetCache} [cache={}] - Preset cache map.
   * @param {RollManager} [rollManager] - Dynamic roll tracker state.
   * @returns {ProcessedChip} Evaluated chip pure data structure.
   */
  parseBasketChip: (chipData, cache = {}, rollManager = new PresetLogic.RollManager()) => {
    const { styleKey, item, startIndex, endIndex, subArray } = chipData;
    let joinedStr = subArray.join(", ");

    const wMatch = joinedStr.match(/^\((.+?):([-+]?[0-9]*\.?[0-9]+)\)$/);
    const weightVal = wMatch ? parseFloat(wMatch[2]) : null;
    let coreStr = wMatch ? wMatch[1] : joinedStr;

    if (cache && item && coreStr === styleKey) {
      const folder = PresetLogic.getPresetFolder(styleKey);
      const prependMatch = cache[`_/config/prepend/${folder}`]?.preset;
      const appendMatch = cache[`_/config/append/${folder}`]?.preset;

      if (prependMatch || appendMatch) {
        const pre = prependMatch ? `${prependMatch} ` : "";
        const app = appendMatch ? ` ${appendMatch}` : "";
        const baseContent = item.preset || styleKey;
        coreStr = `${pre}${baseContent}${app}`.trim();
        joinedStr = weightVal !== null ? `(${coreStr}:${weightVal})` : coreStr;
      }
    }

    const beforeCounts = rollManager.cloneCounts();
    const chipExpandedCore = PresetLogic.expandRecursively(coreStr, cache, new Set(), rollManager);
    const chipExpanded = wMatch ? `(${chipExpandedCore}:${wMatch[2]})` : chipExpandedCore;

    const rolledInfo = [];
    for (const [group, endCount] of Object.entries(rollManager.counts)) {
      const start = beforeCounts[group] || 0;
      for (let k = start; k < endCount; k++) {
        const rolledKey = rollManager.peekRoll(group, k);
        if (rolledKey) {
          rolledInfo.push(`🎲 ${PresetLogic.toTitleCase(group.split("_")[0])}: ${PresetLogic.getPresetName(rolledKey)}`);
        }
      }
    }
    const rolledText = rolledInfo.length > 0 ? `\n\nRolled Variants:\n${rolledInfo.join("\n")}` : "";

    const parsed = PresetLogic.parseChipDetails(chipExpandedCore, cache);
    let presetMatch = parsed.presetMatch;
    if (!presetMatch) {
      const varMatch = coreStr.match(/^\{([^{}:]+)(?::([^{}]+))?\}$/);
      if (varMatch) {
        const groupName = varMatch[1].trim().toLowerCase().replace(/\s+/g, "_");
        const val = varMatch[2] ? varMatch[2].trim() : "";
        const resolvedKey = val
          ? PresetLogic.resolveVariantKey(groupName, val, cache)
          : rollManager.peekRoll(groupName, beforeCounts[groupName] || 0);

        if (resolvedKey && cache[resolvedKey]) {
          presetMatch = { key: resolvedKey, item: cache[resolvedKey] };
        }
      }
    }

    let cleanLabel, bgImage, color, tooltipTitle, evalId;

    if (presetMatch) {
      evalId = presetMatch.key;
      const matchItem = presetMatch.item;
      cleanLabel = PresetLogic.toTitleCase(PresetLogic.getPresetName(evalId));
      bgImage = matchItem?.filename || null;
      color = PresetLogic.getPresetColor(evalId, cache);
      tooltipTitle = `${cleanLabel} [${evalId}]\n${matchItem?.preset || evalId}`;
    } else {
      evalId = chipExpandedCore;
      cleanLabel = item ? PresetLogic.toTitleCase(PresetLogic.getPresetName(styleKey)) : coreStr;
      bgImage = item?.filename || null;
      color = PresetLogic.getPresetColor(styleKey, cache);
      tooltipTitle = item ? `${chipExpandedCore}\n\n${PresetLogic.toTitleCase(PresetLogic.getPresetName(styleKey))} [${styleKey}]\n${item.preset}` : chipExpandedCore;
    }

    const tempManager = new PresetLogic.RollManager();
    const basePreset = item?.preset || PresetLogic.expandRecursively(styleKey, cache, new Set(), tempManager);
    const hasMoreVar = /\{[^{}:]+(?::[^{}]+)?\}/.test(coreStr + basePreset);

    let segmentedLabels = null;
    const tokens = coreStr.match(/<[^>]*>|{[^}]*}|\S+/g) || [];
    if (tokens.length > 1 && tokens.some(t => /[{<]/.test(t))) {
      const tempTracer = new PresetLogic.RollManager(rollManager.rolls).restoreCounts(beforeCounts);
      segmentedLabels = [];
      let segmentImg = null;

      for (const token of tokens) {
        const seg = PresetLogic.resolvePresetSegment(token, cache, tempTracer);
        segmentedLabels.push(seg.title);
        if (!segmentImg && seg.filename) {
          segmentImg = seg.filename;
        }
      }

      if (segmentImg) {
        bgImage = segmentImg;
      }
    }

    return {
      joinedStr,
      evalId,
      cleanLabel: parsed.tag ? parsed.tag.label : cleanLabel,
      bgImage,
      color,
      tooltipTitle: `${tooltipTitle}${rolledText}`,
      chipExpanded,
      item,
      startIndex,
      endIndex,
      weightVal,
      segmentedLabels,
      hasMoreVar,
      tag: parsed.tag
    };
  },

  /**
   * Groups raw token elements from list sequence into aggregated chip entries.
   * @param {string[]} activeList - Sequential token inputs.
   * @param {PresetCache} cache - Preset cache map.
   * @returns {ChipGroupInput[]} Grouped chip item definitions.
   */
  getGroupedChips(activeList, cache) {
    /** @type {ChipGroupInput[]} */
    const chips = [];
    if (!activeList || activeList.length === 0) return chips;

    const lookupMap = new Map();
    if (cache) {
      for (const [key, item] of Object.entries(cache)) {
        if (!item) continue;
        if (item.preset?.trim()) {
          const trimmedPreset = item.preset.trim();
          lookupMap.set(trimmedPreset, { foundKey: key, foundItem: item });
          const expanded = PresetLogic.expandRecursively(trimmedPreset, cache);
          if (expanded) lookupMap.set(expanded, { foundKey: key, foundItem: item });
        }
        if (key) {
          lookupMap.set(key, { foundKey: key, foundItem: item });
          lookupMap.set(key.trim(), { foundKey: key, foundItem: item });
        }
      }
    }

    let i = 0;
    while (i < activeList.length) {
      let matched = null;
      let matchedLen = 0;

      for (let len = Math.min(activeList.length - i, 10); len >= 1; len--) {
        const subArray = activeList.slice(i, i + len);
        const joined = subArray.join(", ");

        const wMatch = joined.match(/^\((.+?):([-+]?[0-9]*\.?[0-9]+)\)$/);
        const coreJoined = wMatch ? wMatch[1] : joined;

        const cached = lookupMap.get(coreJoined) || lookupMap.get(coreJoined.replace(/\{([^{}:]+):[^{}]+\}/g, '{$1}'));

        if (cached || len === 1 || coreJoined.match(/^<[^<>]+>$/) || coreJoined.match(/^\{[^{}]+(?::[^{}]+)?\}$/)) {
          matched = {
            styleKey: cached?.foundKey || subArray[0],
            item: cached?.foundItem || (cached?.foundKey ? cache[cached.foundKey] : cache[subArray[0]]),
            startIndex: i,
            endIndex: i + len,
            subArray,
          };
          matchedLen = len;
          break;
        }
      }

      if (matched) {
        chips.push(matched);
        i += matchedLen;
      } else {
        chips.push({
          styleKey: activeList[i],
          item: cache[activeList[i]] || null,
          startIndex: i,
          endIndex: i + 1,
          subArray: [activeList[i]],
        });
        i += 1;
      }
    }
    return chips;
  },

  /**
   * Evaluates whether string input directly matches a cache key or preset string.
   * @param {string} text - Plain text input.
   * @param {PresetCache} [cache] - Preset cache map.
   * @returns {PresetMatch | null} Preset key and item if matched.
   */
  findPresetMatch: (text, cache) => {
    if (!text || !cache) return null;
    const trimmed = text.trim();
    if (!trimmed) return null;

    if (cache[trimmed]) {
      return { key: trimmed, item: cache[trimmed] };
    }

    for (const [key, item] of Object.entries(cache)) {
      if (!item) continue;
      if (key.trim() === trimmed || (item.preset && item.preset.trim() === trimmed)) {
        return { key, item };
      }
    }
    return null;
  },

  /**
   * Parses metadata from base64 data URL strings.
   * @param {string} dataUrl - Raw image base64 URL.
   * @returns {DataURLParseResult | null} Extension and base64 payload.
   */
  parseDataURL: (dataUrl) => {
    if (!dataUrl || !dataUrl.startsWith("data:")) return null;
    const matches = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
    if (!matches) return null;
    let ext = matches[1].toLowerCase();
    if (ext === "jpeg") ext = "jpg";
    return { ext, base64: matches[2] };
  },

  /**
   * Lexically parses tokens from a string prompt input.
   * @param {string} val - Prompt raw string.
   * @param {PresetCache|null} [cache=null] - Cache object.
   * @param {string|null} [ignorePreset=null] - Preset key to ignore during expansion.
   * @returns {ParsedToken[]} Array of token positions and metadata.
   */
  parseTokens: (val, cache = null, ignorePreset = null) => {
    /** @type {ParsedToken[]} */
    const tokens = [];
    if (!val) return tokens;

    const candidates = [];
    if (cache) {
      for (const [key, item] of Object.entries(cache)) {
        if (item?.preset && item.preset.trim()) {
          const expanded = PresetLogic.expandRecursively(item.preset.trim(), cache);
          if (expanded && expanded.trim()) {
            candidates.push({ matchStr: expanded, key, item });
          }

          const trimmedPreset = item.preset.trim();
          if (expanded !== trimmedPreset && trimmedPreset) {
            candidates.push({ matchStr: trimmedPreset, key, item });
          }
        }
        if (key && key.trim()) {
          candidates.push({ matchStr: key.trim(), key, item });
        }
      }
    }

    const candidateMap = new Map();
    for (const cand of candidates) {
      if (!cand.matchStr || !cand.matchStr.trim()) continue;
      if (!candidateMap.has(cand.matchStr) || cand.item) {
        candidateMap.set(cand.matchStr, cand);
      }
    }

    const sortedCandidates = Array.from(candidateMap.values()).sort(
      (a, b) => b.matchStr.length - a.matchStr.length
    );

    const isValidBoundary = (/** @type {number} */ startIdx, /** @type {number} */ endIdx) => {
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
      const startIdx = idx;
      let matched = null;

      for (const cand of sortedCandidates) {
        if (!cand.matchStr) continue;
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

      if (matched && matched.matchStr.length > 0) {
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
        if (val[idx] === ',') {
          tokens.push({
            start: idx,
            end: idx + 1,
            text: ',',
            isDelimiter: true
          });
          idx += 1;
        } else {
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
                if (!cand.matchStr) continue;
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

      // Safety fallback to prevent infinite loops if index fails to advance
      if (idx <= startIdx) {
        idx = startIdx + 1;
      }
    }

    return tokens;
  },

  /**
   * Resolves standard MIME-type for explicit image extensions.
   * @param {string} ext - Extension string.
   * @returns {string} Matching MIME-type string.
   */
  getMimeType: (ext) => {
    const e = ext.toLowerCase();
    if (e === "jpg" || e === "jpeg") return "image/jpeg";
    if (e === "png") return "image/png";
    if (e === "webp") return "image/webp";
    if (e === "gif") return "image/gif";
    return "image/png";
  },

  /**
   * Formats underscore/hyphen delimited strings into Title Case.
   * @param {string} str - Raw input text.
   * @returns {string} Formatted string.
   */
  toTitleCase: (str) =>
    str
      .replace(/_/g, " ")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase()),

  /**
   * Generates a deterministic HSL color value from a string hash.
   * @param {string} str - Identifier string.
   * @returns {string} Valid HSL color string.
   */
  getHashColor: (str) => {
    let hash = 0;
    for (let i = 0; i < 6; i++) hash = Math.imul(hash ^ str.charCodeAt(i), 15485863);
    hash = (hash ^ (hash >>> 16)) * 0x85ebca6b;
    hash = (hash ^ (hash >>> 13)) * 0xc2b2ae35;
    const hue = Math.abs((hash ^ (hash >>> 15)) % 360);
    return `hsl(${hue}, 65%, 35%)`;
  },

  /**
   * Returns unique folder paths extracted from the entire cache dictionary.
   * @param {PresetCache} cache - Preset cache map.
   * @returns {string[]} List of unique folder path strings.
   */
  getAllPresetFolders: (cache) => Array.from(new Set(
    Object.keys(cache).map(key => PresetLogic.getPresetFolder(key))
  )),

  /**
   * Computes the assigned or computed HSL color for a given preset key.
   * @param {string} [presetKey=""] - Preset identifier path key.
   * @param {PresetCache|null} [cache=null] - Optional lookup cache.
   * @returns {string} CSS Color string.
   */
  getPresetColor: (presetKey = "", cache = null) => {
    const parts = presetKey.split("/");
    for (let i = parts.length; i > 0; i--) {
      const parentPath = parts.slice(0, i).join("/");
      if (cache && cache[parentPath] && cache[parentPath].__color__) {
        return cache[parentPath].__color__;
      }
    }
    const topLevel = parts[0];
    return PresetLogic.getHashColor(topLevel);
  },

  /**
   * Gets root folder prefix of a key.
   * @param {string} key - Cache key.
   * @returns {string} Root folder path.
   */
  getPresetBaseFolder: (key) => (key.includes("/") ? key.split("/")[0] : key),

  /**
   * Extracts name portion of path key.
   * @param {string} key - Cache key.
   * @returns {string} File or preset name.
   */
  getPresetName: (key) => key.split("/").pop() || "",

  /**
   * Returns full formatted title and description body for tooltips.
   * @param {string} key - Cache key.
   * @param {PresetCache} cache - Cache object.
   * @returns {string} Formatted multiline title text.
   */
  getPresetTitle: (key, cache) => {
    if (!key) return "";
    if (PresetLogic.isVirtualNull(key)) {
      return "None [omit variant]";
    }
    return `${PresetLogic.toTitleCase(PresetLogic.getPresetName(key))} [${key}]\n${cache[key]?.preset || ""}`;
  },

  /**
   * Creates initialized standard 2-character initials string for items.
   * @param {string} key - Target key.
   * @returns {string} Up to 6 character initials.
   */
  getPresetInitials: (key) => {
    const raw = key.includes("/") ? PresetLogic.getPresetName(key) : key;
    return PresetLogic.toTitleCase(raw)
      .split(/\s+/)
      .map((w) => w.slice(0, 2))
      .join("")
      .substring(0, 6);
  },

  /**
   * Extracts parent folder path string of key.
   * @param {string} key - Preset key path.
   * @returns {string} Folder path string.
   */
  getPresetFolder: (key) => key.split("/").slice(0, -1).join("/"),

  /**
   * Gets formatted human readable path (using breadcrumb chevron format).
   * @param {string} key - Key path.
   * @returns {string} Breadcrumb UI folder representation.
   */
  getUiFolder: (key) => PresetLogic.getPresetFolder(key).split("/").join(" › "),

  /**
   * Constructs searchable lowercase blob text for indexing.
   * @param {string} key - Preset key path.
   * @param {PresetCacheItem} item - Cache item object.
   * @returns {string} Searchable text query blob.
   */
  getSearchBlob: (key, item) =>
    `${PresetLogic.getPresetName(key)} ${key} ${PresetLogic.getPresetInitials(key)} ${item?.preset || ""}`.toLowerCase(),

  /**
   * Filters list items matching a search query string.
   * @param {string[]} list - Key list array.
   * @param {string} query - Query filter string.
   * @param {(item: string) => string} [getSearchBlob] - Custom search blob mapper callback.
   * @param {PresetCache|null} [cache=null] - Cache reference.
   * @param {string|null} [ignorePreset=null] - Preset key to exclude.
   * @returns {SearchResult[]} Top matched items.
   */
  getTopMatches: (list, query, getSearchBlob, cache = null, ignorePreset = null) => {
    const blobFn = getSearchBlob || ((i) => PresetLogic.getSearchBlob(i, cache?.[i] || {}));
    const queryWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!queryWords.length) return [];
    const buckets = list.reduce(
      (/** @type {{startsWith: SearchResult[], fuzzy: SearchResult[]}} */ acc, item) => {
        if ((cache && !cache[item]?.preset && !PresetLogic.isVirtualNull(item)) || item === ignorePreset) return acc;
        const blob = blobFn(item).toLowerCase();
        if (!queryWords.every((word) => blob.includes(word))) return acc;
        const title = cache ? PresetLogic.getPresetTitle(item, cache) : "";
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
    const sortBucket = (/** @type {SearchResult[]} */ arr) =>
      arr.sort((a, b) => (a.idx !== b.idx ? a.idx - b.idx : a.item.localeCompare(b.item)));
    return Array.from(new Set([...sortBucket(buckets.startsWith), ...sortBucket(buckets.fuzzy)]));
  },
};

export default PresetLogic;