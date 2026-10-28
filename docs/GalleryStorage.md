# GalleryStorage.js Feature Documentation

## Overview

`GalleryStorage` is the browser-storage boundary: the one module that knows the
key names, the shape each holds, and what a bad value in storage means.
Everything else asks it, through six small primitives.

The boundary exists because of three failure modes it removes:

- **A key name in one place.** A typo in a string literal reads back the default
  forever, silently - a preference that never sticks, with no error anywhere.
- **A bad value degrades instead of throwing.** `PresetSession` read its pins
  and its two folder lists with no parse guard, so one corrupt value threw out
  of its constructor and the gallery never mounted. The settings panel and the
  tab list already guarded theirs; this is the rest.
- **A wrong-typed value is dropped.** `"a string"` and `42` are valid JSON, and
  both used to be handed back to callers that call `.includes` on the result.

## The key names are a compatibility contract

The keys are the user's saved state. Renaming one loses it, so they are pinned
literally by `tests/unit/gallery_storage.test.ts` rather than derived from a
prefix.

Three generations of naming coexist and are deliberately left alone:

| Prefix                   | Keys                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `comfy_preset_gallery_*` | the original set: raw basket, basket tabs, panel collapsed, gallery hidden, view, grouped, show hidden |
| `pg_*`                   | added with the settings panel: `pg_settings`, `pg_collapsed_folders_list`, `pg_excluded_roll_folders`  |
| `j0n4t-pg-pins-<nodeId>` | the per-node pin list; `STORAGE_KEYS.pins(nodeId)` builds it, and no id falls back to `global`         |

## API

Every primitive takes the storage as its **last** argument and defaults to the
ambient one, so the common call reads what it wants and a test injects a fake:

```js
readBool(STORAGE_KEYS.grouped, true); // the browser's storage
readBool(STORAGE_KEYS.grouped, true, fakeStorage); // an injected one
```

| Function                              | Returns                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `defaultStorage()`                    | the ambient `localStorage`, or `null` when there is none or reading it throws |
| `readString(key, fallback, storage?)` | the stored string; an empty value counts as missing                           |
| `writeString(key, value, storage?)`   | stores the value verbatim                                                     |
| `readBool(key, fallback, storage?)`   | `true` only for the exact string `"true"`, else `fallback`                    |
| `writeBool(key, value, storage?)`     | stores `"true"` / `"false"`                                                   |
| `readJson(key, fallback, storage?)`   | the parsed value; a missing or unparseable one yields `fallback`              |
| `writeJson(key, value, storage?)`     | stores `JSON.stringify(value)`                                                |
| `readIdList(key, storage?)`           | a stored array of strings; anything else yields `[]`                          |

### The two decisions worth knowing

- **A boolean is exactly `"true"`.** `"TRUE"` and `"1"` are what a tidy-up
  would write, and reading them as on would flip a default-off preference for
  every existing user. The `fallback` covers both directions: `readBool(k, true)`
  reproduces the `!== "false"` keys (default on) and `readBool(k, false)` the
  `=== "true"` ones (default off).
- **`readIdList` validates, it does not trust.** A non-array (`"a string"`,
  `42`, `null`) yields `[]`, and a mixed array keeps only its strings. Callers
  do `includes` on the result, so handing them a non-array is how a folder list
  stops matching silently.

## Key Dependencies

- Nothing. The module has no imports, which is what lets `PresetSession` and
  `PresetBasketTabs` inject a fake storage and the components read the ambient
  one without any of them depending on the others.
