# PresetLogic.js Documentation

## Overview
`PresetLogic.js` is a comprehensive module designed to manage, parse, and expand templated strings (prompts), handle randomized variant selections ("rolls"), and process UI elements ("chips") representing grouped tag sequences.

## 1. Constants
*   **`VAR_REGEX`**: A regular expression (`/\{([^{}:]+)(?::((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*))?\}/g`) used to parse variant groups utilizing the `{group}` or `{group:value}` syntax.

## 2. Classes

### `RollManager`
A stateful class responsible for managing randomized "rolls" (selections) for specific groups. It ensures consistency when retrieving or peeking at randomized variants during parsing.
*   **`constructor(initialRolls = {})`**: Initializes the rolls and counts objects.
*   **`resetCounts()`**: Resets the tracking indices of rolled groups back to zero.
*   **`clearAll()`**: Wipes all saved rolls and counts.
*   **`getCount(group)`**: Retrieves the current count index for a specific group.
*   **`cloneCounts()`**: Returns a copy of the current counts state.
*   **`restoreCounts(counts)`**: Replaces current counts with a provided state map.
*   **`getRoll(group, matches)`**: Retrieves an existing roll for the current index, or randomly picks one from `matches` if it doesn't exist. Increments the group count.
*   **`peekRoll(group, index)`**: Looks up a specific roll by group and index without modifying the tracked counts.
*   **`deleteRoll(group, index)`**: Deletes a specific roll from the cache.

## 3. Core Objects & Methods

### `PresetLogic`
The main namespace holding all parsing logic, string formatting, and utility functions.

#### Template Expansion & Parsing
*   **`getUnrolledTemplate(val, cache, seen)`**: Recursively expands standard presets while leaving `{group}` variant syntax intact. Wraps presets if prepend/append configs exist in the cache.
*   **`expandRecursively(val, cache, seen, rollManager)`**: Performs deep, recursive expansion of both standard presets and `{group:value}` references within templates. Integrates seamlessly with `RollManager` to track dynamic rolls.
*   **`parseTokens(val, cache, ignorePreset)`**: Lexically parses a raw prompt string into structural tokens (tags, variables, delimiters, plain text, and known preset matches) while respecting logical boundaries.

#### Chip Processing
*   **`parseChipDetails(text, cache)`**: Parses a string token to extract metadata such as tags, `{group}` variants, and direct preset matches.
*   **`resolvePresetSegment(token, cache, rollManager)`**: Resolves metadata (titles and image filenames) for single string tokens within complex segment prompts.
*   **`parseBasketChip(chipData, cache, rollManager)`**: Core processor for UI input chips. It calculates the purely expanded chip data structure, including weight extraction `(text:weight)`, tooltip generation, color mapping, and dynamic roll evaluations.
*   **`getGroupedChips(activeList, cache)`**: Iterates through an array of sequential input strings, aggregating them into logical grouped chip components based on preset cache matches and formatting.

#### Utility Functions
*   **`splitPresets(str)`**: Splits comma-separated strings safely, ignoring commas nested inside parentheses `()`, angle brackets `<>`, or curly braces `{}`.
*   **`getGroupMatches(groupName, cache)`**: Finds all cache keys that belong to a specific group/folder.
*   **`isVirtualNull(val)`**: Checks if a string acts as a nullifier (e.g., "none" or "null").
*   **`resolveVariantKey(groupName, val, cache)`**: Looks up and resolves a target variant key within the preset cache dictionary.
*   **`findPresetMatch(text, cache)`**: Evaluates if a raw text input maps directly to an exact preset key or preset string value.

#### Formatting & Extraction
*   **`toTitleCase(str)`**: Formats strings containing hyphens or underscores into a clean Title Case format.
*   **`parseDataURL(dataUrl)`**: Extracts the file extension and base64 payload from a standard Data URI image string.
*   **`getMimeType(ext)`**: Returns the appropriate MIME type mapping for standard image extensions (e.g., `jpg`, `png`, `webp`).

#### UI & Pathing Utilities
*   **`getHashColor(str)`**: Generates a deterministic CSS HSL color string based on a string's calculated hash.
*   **`getPresetColor(presetKey, cache)`**: Traverses up the preset key path to find an explicitly assigned color, falling back to a deterministic hash color.
*   **`getAllPresetFolders(cache)`**: Returns a unique list of all folder paths found in the current preset cache.
*   **`getPresetBaseFolder(key)`**: Gets the top-level root folder from a provided key path.
*   **`getPresetName(key)`**: Extracts the final file or preset name from a key path.
*   **`getPresetFolder(key)`**: Extracts the parent directory path string of a key.
*   **`getUiFolder(key)`**: Formats a folder path into a readable UI breadcrumb format utilizing chevrons (`›`).
*   **`getPresetInitials(key)`**: Generates a 2-character per-word initials string for a preset key (up to 6 characters max).
*   **`getPresetTitle(key, cache)`**: Constructs a fully formatted tooltip title string, including names and underlying descriptions.

#### Searching & Filtering
*   **`getSearchBlob(key, item)`**: Constructs a normalized, lowercase search string payload for quick text matching and indexing.
*   **`getTopMatches(list, query, getSearchBlob, cache, ignorePreset)`**: Filters an array of items based on a text query, sorting them logically into "starts with" and "fuzzy" match arrays, and returning the top results.
