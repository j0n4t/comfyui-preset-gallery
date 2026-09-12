# Preset Logic & Syntax Documentation

This document provides a comprehensive technical guide to the **Preset Syntax** and execution mechanics implemented in `PresetLogic.js`. It details the grammar, expansion pipeline, state management, and helper logic used for template expansion, variable substitution, and prompt processing.

---

## 1. Executive Summary & Core Concepts

`PresetLogic.js` is a prompt template parsing and expansion engine designed for visual generation tools (such as Stable Diffusion prompt builders). It allows users to write compact, modular prompt expressions containing variables, randomized rolls, weighted tags, and nested preset references, and expands them deterministically or probabilistically into clean target text.

### Key Features
* **Nested Preset Expansion:** Recursively unrolls referenced preset templates from a cache dictionary.
* **Variable & Variant Selection:** Dynamic replacements using `{group}` or `{group:variant}` syntax.
* **Child Variable Injection:** Passing inline parameters into child preset templates (e.g., `{character:warrior{weapon:sword}}`).
* **Deterministic Roll State Management:** Tracked randomized choices via `RollManager` for reproducible prompt generation.
* **Smart Structure-Aware Tokenization:** Splitting multi-token strings on commas while preserving nested parentheses `()`, angle brackets `<>`, and braces `{}`.
* **Virtual Null Value Support:** Omission of variants using reserved keywords (`none`, `null`).
* **Folder Prepend / Append Wrapping:** Global folder-level prefixing and suffixing via configuration keys (`_/config/prepend/...`, `_/config/append/...`).
* **UI Segment & Chip Metadata Resolution:** Evaluation of UI tokens into clean titles, background images, color codes, and tooltips.

---

## 2. Preset Syntax Reference

### 2.1 Overview of Syntax Elements

| Syntax Pattern | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| `preset_key` | **Direct Preset Match** | `styles/anime` | Matches an exact key in the preset cache and replaces it with the preset template. |
| `{group}` | **Random Group Variant Roll** | `{hair_color}` | Randomly selects one preset key belonging to the `hair_color` folder group. |
| `{group:value}` | **Explicit Variant Selection** | `{hair_color:blonde}` | Selects a specific preset/variant within the `hair_color` group. |
| `{group:value{child:val}}` | **Nested Variable Parameter** | `{outfit:armor{material:gold}}` | Selects a variant and injects/overrides child variable placeholders inside the variant's preset. |
| `{group:none}` / `{group:null}` | **Virtual Null (Omission)** | `{hat:none}` | Explicitly evaluates to an empty string, omitting the element. |
| `(prompt:weight)` | **Weighted Prompt Tag** | `(masterpiece:1.2)` | Standard attention weighting construct preserved during expansion. |
| `<tag_type:name:value>` | **LoRA / Special Tag** | `<lora:anime_style:0.8>` | External model or hypernetwork modifier syntax. |

---

### 2.2 Deep Dive: Variables & Variants Syntax

The primary mechanism for dynamic substitution is the regular expression `VAR_REGEX`:

```javascript
const VAR_REGEX = /\{([^{}:]+)(?::((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*))?\}/g;
```

#### Syntax Rules:
1. **Group Name Extraction:** The group name is extracted before the colon `:` (or the entire content if no colon exists). Group names are normalized: whitespace is trimmed, converted to lowercase, and internal spaces are replaced with underscores `_`.
2. **Variant Expression:** The variant expression comes after the colon `:`. It supports up to two levels of nested braces (allowing child variable syntax).

#### A. Unspecified Variant (Random Roll)
* **Syntax:** `{group_name}`
* **Behavior:** Searches the cache for all preset keys matching `group_name` using `getGroupMatches()`.
  - A key matches if its folder path equals `group_name`, starts with `group_name/`, or ends with `/group_name`.
  - If a `RollManager` is active, the choice is retrieved from or recorded into `RollManager`.
  - If no `RollManager` is provided, a match is chosen at random (`Math.random()`).
  - If no matches exist in the cache, the raw `{group_name}` string is left intact.

#### B. Explicit Variant Selection
* **Syntax:** `{group_name:variant_value}`
* **Behavior:** 
  1. Resolves `variant_value` against the cache using `resolveVariantKey()`.
  2. If resolved to a cached preset key, the preset's text is loaded.
  3. If `variant_value` is `none` or `null` (case-insensitive), it is treated as a **Virtual Null** and evaluates to an empty string `""`.
  4. If `variant_value` is plain text not in the cache, the literal text is returned.

#### C. Child Variable Parameter Injection
* **Syntax:** `{group:base_value{child_group:child_value}}`
* **Behavior:** 
  When a parent preset contains placeholders (e.g., preset `outfit/armor` has content `plate armor made of {material}`), passing `{outfit:armor{material:gold}}` will locate any occurrences of `{material}` within the loaded preset and replace/override them with `{material:gold}` before recursive expansion.

---

### 2.3 Virtual Null Options

The function `isVirtualNull(val)` evaluates whether a string represents an explicit null selection:

```javascript
isVirtualNull: (val) => {
  if (!val) return false;
  const lower = val.trim().toLowerCase();
  return lower === "none" || lower === "null";
}
```

* **Effect:** When a variant resolves to `none` or `null`, the expansion removes the token entirely without inserting extra commas or dangling whitespace.

---

### 2.4 Prepend and Append Configuration Wrapping

The engine supports automated folder-level wrappers. If configuration presets exist at specific internal cache keys:
* Prepend Key: `_/config/prepend/<folder_path>`
* Append Key: `_/config/append/<folder_path>`

When expanding a preset key located inside `<folder_path>`, the engine checks for these wrapper keys. If present:
```text
Wrapped String = `${prepend_text} ${preset_text} ${append_text}`
```
This enables applying standard modifier tags to all presets under a specific directory.

---

## 3. Core Algorithms & Logic

### 3.1 Token Splitting with Depth Tracking (`splitPresets`)

To prevent breaking nested structures, `splitPresets` parses comma-separated lists while maintaining depth counters for parentheses `()`, angle brackets `<>`, and braces `{}`.

```javascript
// Simplified depth tracking loop
if (char === '(') depthParen++;
else if (char === ')') depthParen = Math.max(0, depthParen - 1);
else if (char === '<') depthAngle++;
else if (char === '>') depthAngle = Math.max(0, depthAngle - 1);
else if (char === '{') depthBrace++;
else if (char === '}') depthBrace = Math.max(0, depthBrace - 1);

if (char === ',' && depthParen === 0 && depthAngle === 0 && depthBrace === 0) {
  // Split token boundary
}
```

This guarantees that tokens such as `(masterpiece, top quality:1.2)` or `{hair:blonde, curly}` are not split at internal commas.

---

### 3.2 Recursive Expansion Pipeline (`expandRecursively`)

`expandRecursively` is the main entry point for processing templates.

```
                  ┌──────────────────────────────┐
                  │   Input Prompt / Template    │
                  └──────────────┬───────────────┘
                                 │
                        splitPresets(val)
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
             [ Token 1 ]               [ Token 2 ]
                    │                         │
            Expand Preset Key         Expand Text Variables
           (Cache Lookup)             (VAR_REGEX Replace)
                    │                         │
            Check Circular           Check Virtual Null /
           Dependency (seen)         Roll Selection / Child Injection
                    │                         │
                    └────────────┬────────────┘
                                 │
                     Re-join via ", "
                                 │
                   Normalize Whitespace
                                 │
                  ┌──────────────▼──────────────┐
                  │    Fully Expanded Prompt    │
                  └─────────────────────────────┘
```

#### Step-by-Step Expansion Algorithm:
1. **Token Decomposition:** Calls `splitPresets(val)` to break the prompt into individual primary tokens.
2. **Cache Key Unrolling:** Checks if a token matches a preset key in `cache`. If so, retrieves its template string (applying any folder prepends/appends).
3. **Variable Regex Matching:** Replaces all `{group}` and `{group:value}` tokens using `VAR_REGEX`.
4. **Roll Resolution:** For un-valued `{group}`, calls `RollManager.getRoll(groupName, matches)`.
5. **Child Parameter Substitution:** Injects child variable parameters into parent templates where applicable.
6. **Circular Dependency Guard:** Maintains a `seen = Set<string>()` tracking stack. If a preset key is encountered that is already in `seen`, recursion stops to prevent infinite loops.
7. **Re-assembly:** Cleans whitespace, removes empty entries, and joins tokens back with `, `.

---

### 3.3 Dynamic State Management (`RollManager`)

`RollManager` keeps track of randomized rolls across generation requests so that pre-rolled decisions remain consistent and can be inspected or restored.

```javascript
class RollManager {
  constructor(initialRolls = {}) {
    this.rolls = { ...initialRolls }; // Key: `${group}_${index}` -> Value: selected key
    this.counts = {};                  // Key: group -> Value: invocation index
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
}
```

* **Indexed Roll Keys:** Each group invocation gets a unique key based on its sequence count (`hair_color_0`, `hair_color_1`).
* **State Persistence:** Preserves roll selections across evaluation passes so that UI render calls (`parseBasketChip`) match the text expansion pass.

---

### 3.4 Tokenization and UI Chip Processing (`parseTokens`, `parseBasketChip`)

`PresetLogic.js` includes advanced lexers and parsers for UI representation:

1. **`parseTokens(val, cache, ignorePreset)`:**
   - Performs boundary-validated matching of prompt strings against cache candidates.
   - Longest match first: sorts candidates by length descending to match full preset strings before partial phrases.
   - Categorizes tokens into `isTag` (`<...>`), `isVar` (`{...}`), preset matches, delimiters (`,`), or plain text.

2. **`parseBasketChip(chipData, cache, rollManager)`:**
   - Evaluates chip tokens into visual metadata.
   - Extracts weights e.g. `(content:1.2)`.
   - Generates clean title labels using `toTitleCase()`.
   - Assigns visual colors:
     - Checks `__color__` in parent folders.
     - Falls back to `getHashColor(topLevelFolder)` which generates a deterministic HSL color: `hsl(hue, 65%, 35%)`.
   - Formats tooltip strings detailing the original template, expanded text, resolved key, and rolled variant history.

---

## 4. Helper Utilities Reference

| Method | Parameters | Return Type | Purpose |
| :--- | :--- | :--- | :--- |
| `toTitleCase(str)` | `str: string` | `string` | Converts `snake_case` or `kebab-case` strings into Title Case phrases. |
| `getHashColor(str)` | `str: string` | `string` | Generates a deterministic HSL color string based on a 32-bit integer hash of `str`. |
| `getGroupMatches(group, cache)` | `group: string, cache: object` | `string[]` | Finds all cache keys whose folder matches the group name. |
| `resolveVariantKey(group, val, cache)` | `group: string, val: string, cache: object` | `string \| null` | Resolves short variant strings or preset names to full cache keys. |
| `getTopMatches(list, query, ...)` | `list: string[], query: string, ...` | `SearchResult[]` | Performs prefix and fuzzy search filtering over preset keys and titles. |
| `parseDataURL(dataUrl)` | `dataUrl: string` | `object \| null` | Extracts file extension (`png`, `jpg`, `webp`, `gif`) and base64 payload from data URLs. |

---

## 5. Execution Walkthrough Example

### Example Setup

#### Cache Content:
```json
{
  "_/config/prepend/styles": "masterpiece, best quality,",
  "styles/anime": {
    "preset": "{character_type}, vibrant colors, anime aesthetics",
    "filename": "anime.png"
  },
  "character/warrior": {
    "preset": "{gender} warrior holding a {weapon:sword}",
    "filename": "warrior.png"
  },
  "weapons/sword": {
    "preset": "sharp steel longsword"
  },
  "weapons/axe": {
    "preset": "battle axe"
  },
  "gender/female": {
    "preset": "female"
  }
}
```

### Prompt Input:
```text
styles/anime, {character:warrior{gender:female}}, <lora:detail_enhancer:0.5>
```

---

### Step-by-Step Expansion Trace:

1. **Token Splitting (`splitPresets`):**
   - Token 1: `styles/anime`
   - Token 2: `{character:warrior{gender:female}}`
   - Token 3: `<lora:detail_enhancer:0.5>`

2. **Expanding Token 1 (`styles/anime`):**
   - Matches cache key `styles/anime`.
   - Folder is `styles`. Prepend key `_/config/prepend/styles` exists with value `"masterpiece, best quality,"`.
   - Wrapped template: `masterpiece, best quality, {character_type}, vibrant colors, anime aesthetics`.
   - `{character_type}` has no matches in cache, retained as literal or unrolled token.

3. **Expanding Token 2 (`{character:warrior{gender:female}}`):**
   - Group: `character`, Raw value: `warrior{gender:female}`.
   - Base value: `warrior`, Child variables: `{gender:female}`.
   - Resolves `warrior` to `character/warrior`.
   - Loaded preset: `{gender} warrior holding a {weapon:sword}`.
   - Child replacement: replaces `{gender}` with `{gender:female}` inside the preset.
   - Updated template: `{gender:female} warrior holding a {weapon:sword}`.
   - Recursively expands:
     - `{gender:female}` -> `female`
     - `{weapon:sword}` -> `sharp steel longsword`
   - Result: `female warrior holding a sharp steel longsword`.

4. **Expanding Token 3 (`<lora:detail_enhancer:0.5>`):**
   - Recognized as a tag token. Left intact.

5. **Final Output Assembly:**
   ```text
   masterpiece, best quality, {character_type}, vibrant colors, anime aesthetics, female warrior holding a sharp steel longsword, <lora:detail_enhancer:0.5>
   ```

---

## 6. Summary for Developers

When modifying or building upon `PresetLogic.js`:
* **Always maintain depth tracking** when introducing new delimiter patterns or bracket types to prevent breaking `splitPresets()`.
* **Ensure `RollManager` instances are passed** through recursive calls (`expandRecursively`) to guarantee consistent choices across expansion passes and UI state evaluations.
* **Keep `VAR_REGEX` balanced** if adjusting regex capturing groups, as both `expandRecursively` and `parseChipDetails` rely on identical group index structures (`gName` = group 1, `sVal` = group 2).
