# PresetDisplay.js Feature Documentation

## Overview

`PresetDisplay` turns a cache key and the cache into what the UI shows: a label,
a tooltip, a colour, a search blob, a ranked suggestion list. It reads keys; it
does not parse the token grammar or expand a prompt.

This is the presentation half of what used to be one module. `PresetLogic` keeps
the grammar, the expansion and chip evaluation; `ChipProjection` builds the chip
list. The split is the point: a change to how a preset is labelled or coloured
should not require reasoning about `{group:value}` expansion, and vice versa.

## API

### Path helpers

| Helper | Returns |
| --- | --- |
| `getPresetFolder(key)` | the parent path, `Faces/Portrait` → `Faces` |
| `getPresetName(key)` | the last segment, `Faces/Portrait` → `Portrait` |
| `getPresetBaseFolder(key)` | the root segment, `wear/sock/knee` → `wear` |
| `getUiFolder(key)` | the breadcrumb form, `wear/sock` → `wear › sock` |
| `getPresetInitials(key)` | up to 6 characters, `socks#wear/sock` → `So` |

All of them read the **plain path behind a library qualifier**. A merged cache
files every entry a library displaced under `libraryId#key`, so
`socks#wear/sock` is `wear/sock` from the `socks` library: the folder is `wear`,
the name is `sock`, and a colour hashes `wear` rather than `socks#wear`.

### Labels and tooltips

- `toTitleCase(str)` — `portrait_solo-shot` → `Portrait Solo Shot`.
- `getPresetTitle(key, cache, rollManager)` — the tooltip body. Names the preset
  and its own body, and prepends the evaluated value when expansion produces
  something else (`look/combo` → `simple look, extra` over
  `Combo [look/combo]\nlook/simple, extra`). A virtual null names itself instead
  of expanding: `None [omit variant]`.

### Colours

- `getHashColor(str)` — a deterministic HSL string from a string hash. Pinned by
  test: `getHashColor("Faces")` is `hsl(107, 65%, 35%)`. The colour is part of
  what the user sees, so the hash constant is not a detail.
- `getPresetColor(key, cache)` — walks up the key's path looking for an assigned
  `__color__` on a folder, and falls back to the hash of the top-level folder.

### Search

- `getSearchBlob(key, item)` — the lowercase blob the filter and the autocomplete
  match against: name, key, initials and preset text, with a `library# ` prefix
  for a qualified key so two libraries' entries are told apart.
- `getTopMatches(list, query, blobFn, cache, ignorePreset)` — the ranked
  suggestion list. Every whitespace-separated query word must appear in the blob.
  Matches whose blob *starts with* the query outrank fuzzy ones, and within each
  bucket the earlier occurrence wins; each bucket is capped at three. A cache
  entry with no preset is not a candidate unless it is a virtual null.

## Key Dependencies

- `PresetLogic`: `splitQualifiedKey`, `isVirtualNull`, `expandRecursively` — the
  grammar the helpers read keys through, and the expansion `getPresetTitle`
  prepends.
- `RollManager`: `getPresetTitle`'s optional roll state, for the expanded value.

`PresetDisplay` is imported by the modules that render — `PresetGrid`,
`RawTextareaManager`, `ChipMenuManager`, `InlineEditorManager`, `PresetEditor`,
`PresetBasket`, `PresetGalleryApp`, `ExportUtils`, `PresetSession` — and by
`PresetLogic` itself for the two path helpers its module-level index builders
call. It does not import `ChipProjection`, so the chip list and the display
metadata stay independently changeable.
