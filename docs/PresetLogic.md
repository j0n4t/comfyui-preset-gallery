# PresetLogic.js Documentation

## Overview

`PresetLogic.js` is a comprehensive module designed to manage, parse, and expand templated strings (prompts), handle randomized variant selections ("rolls"), and process UI elements ("chips") representing grouped tag sequences.

## 1. Constants

- **`VAR_REGEX`**: A regular expression (`/\{([^{}:]+)(?::((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*))?\}/g`) used to parse variant groups utilizing the `{group}` or `{group:value}` syntax.

## 2. Classes

### `RollManager`

A stateful class responsible for managing randomized "rolls" (selections) for specific groups. It ensures consistency when retrieving or peeking at randomized variants during parsing.

- **`constructor(initialRolls = {})`**: Initializes the rolls and counts objects.
- **`resetCounts()`**: Resets the tracking indices of rolled groups back to zero.
- **`clearAll()`**: Wipes all saved rolls and counts.
- **`getCount(group)`**: Retrieves the current count index for a specific group.
- **`cloneCounts()`**: Returns a copy of the current counts state.
- **`restoreCounts(counts)`**: Replaces current counts with a provided state map.
- **`getRoll(group, matches)`**: Retrieves an existing roll for the current index, or randomly picks one from `matches` if it doesn't exist. Increments the group count.
- **`peekRoll(group, index)`**: Looks up a specific roll by group and index without modifying the tracked counts.
- **`deleteRoll(group, index)`**: Deletes a specific roll from the cache.

## 3. Core Objects & Methods

Chip grouping (`getGroupedChips`) is no longer here: it is presentation rather
than prompt semantics and now lives in `ChipProjection`. The cache-derived
indexes both modules share are owned by `CacheDerived`.

Display metadata - title casing, colours, folder and name helpers, initials,
the search blob and `getTopMatches` - moved to `PresetDisplay` for the same
reason. What is left here is the grammar, the expansion, and the evaluation of
a chip. `PresetLogic` binds the two path helpers it needs as imports for its
module-level index builders, and `PresetDisplay` imports the grammar back, so
neither module is a facade for the other.

### `PresetLogic`

The main namespace holding all parsing logic, string formatting, and utility functions.

#### Template Expansion & Parsing

- **`getUnrolledTemplate(val, cache, seen)`**: Recursively expands standard presets while leaving `{group}` variant syntax intact. Wraps presets if prepend/append configs exist in the cache.
- **`expandRecursively(val, cache, seen, rollManager)`**: Performs deep, recursive expansion of both standard presets and `{group:value}` references within templates. Integrates seamlessly with `RollManager` to track dynamic rolls.
- **`parseTokens(val, cache, ignorePreset)`**: Lexically parses a raw prompt string into structural tokens (tags, variables, delimiters, plain text, and known preset matches) while respecting logical boundaries.

#### Chip Processing

- **`parseChipDetails(text, cache)`**: Parses a string token to extract metadata such as tags, `{group}` variants, and direct preset matches.
- **`resolvePresetSegment(token, cache, rollManager)`**: Resolves metadata (titles and image filenames) for single string tokens within complex segment prompts.
- **`parseBasketChip(chipData, cache, rollManager)`**: Core processor for UI input chips. It calculates the purely expanded chip data structure, including weight extraction `(text:weight)`, tooltip generation, color mapping, and dynamic roll evaluations.

#### Utility Functions

- **`splitPresets(str)`**: Splits comma-separated strings safely, ignoring commas nested inside parentheses `()`, angle brackets `<>`, or curly braces `{}`.
- **`getGroupMatches(groupName, cache)`**: Finds all cache keys that belong to a specific group/folder.
- **`isVirtualNull(val)`**: Checks if a string acts as a nullifier (e.g., "none" or "null").
- **`resolveVariantKey(groupName, val, cache)`**: Looks up and resolves a target variant key within the preset cache dictionary.
- **`findPresetMatch(text, cache)`**: Evaluates if a raw text input maps directly to an exact preset key or preset string value.

#### Formatting & Extraction

- **`toTitleCase(str)`**: Moved to `PresetDisplay`; the `WEIGHT_REGEX` this module keeps is the one `(core:weight)` parsing needs.
- **`parseDataURL(dataUrl)`**: Extracts the file extension and base64 payload from a standard Data URI image string.
- **`getMimeType(ext)`**: Returns the appropriate MIME type mapping for standard image extensions (e.g., `jpg`, `png`, `webp`).

#### UI & Pathing Utilities

See `docs/PresetDisplay.md`. `getHashColor`, `getPresetColor`,
`getAllPresetFolders`, `getPresetBaseFolder`, `getPresetName`, `getPresetFolder`,
`getUiFolder`, `getPresetInitials`, `getPresetTitle`, `getSearchBlob` and
`getTopMatches` are display metadata and live there. `splitQualifiedKey` stays
here - it is grammar, and it is what every one of those helpers reads a key
through.

#### Searching & Filtering

`getSearchBlob` and `getTopMatches` are in `PresetDisplay`.
