# ChipProjection.js Feature Documentation

## Overview

`ChipProjection` turns an ordered selection into the chip entries the basket
renders. It answers one question: which cache entry does each token of the
selection name?

This is presentation, not prompt semantics. It does not parse the token
grammar, expand a preset, resolve a variant or evaluate what a chip runs -
those stay in `PresetLogic`. The split is the point: a change to how chips are
labelled or keyed should not require reasoning about `{group:value}` expansion,
and vice versa.

## API

### `getGroupedChips(activeList, cache)`

Maps a sequential list of selection tokens to `ChipGroupInput[]`, one entry per
chip, each carrying:

| Field | Meaning |
| --- | --- |
| `styleKey` | the cache key the chip is keyed on, or the token as written when it names no entry |
| `item` | the cache item behind `styleKey`, or `undefined` |
| `startIndex` / `endIndex` | the token range the chip covers |
| `subArray` | the tokens themselves |

Behaviour worth knowing, all pinned by `tests/unit/chip_projection.test.ts`:

- **One chip per token.** The collapse onto a preset is guarded to a single
  token. A run of tokens that happens to spell a preset body stays separate
  chips - otherwise dragging a spread preset onto the tab list and
  re-rendering would re-join it into the original preset chip.
- **A token resolves through its weight-stripped core**, so `(Faces/Portrait:1.5)`
  is keyed on `Faces/Portrait` and the weight stays in the chip text.
- **A qualified token keeps its qualifier** (`socks#wear/sock/knee`), because
  that is what points the chip at one library's entry rather than another's.
- **Variants and tags are keyed on their own text.** `{Faces:portrait}` and
  `<lora:abc:0.8>` are not resolved here; `parseBasketChip` rolls the former.

## The shared lookup

The match lookup - every string a chip can be matched by, mapped to the entry
it names - is the one cache-derived structure this module needs. It is stored
in the record `CacheDerived` keeps per cache object, so `PresetLogic` and this
module index a cache once between them rather than once each. Building it is
the cold-start cost `tests/unit/preset_logic.perf.test.ts` measures; see
`docs/chips-parsing-bottlenecks.md`.

## Key Dependencies

- `PresetLogic`: `getWrappedPreset`, `splitQualifiedKey`, `parseWeight` - the
  three primitives the lookup and the grouping need.
- `CacheDerived`: the per-cache index record the lookup is memoised in.
