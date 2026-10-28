# PresetBasket.js Feature Documentation

## Overview

`PresetBasket` is a core UI class responsible for managing a dynamic, interactive "basket" or collection of selected presets. It provides a visual interface bridging raw text prompt generation and a user-friendly graphical interface consisting of draggable, editable "chips".

## Core Features

### 1. Visual "Chip" Management

- **Dynamic Rendering**: Translates raw text strings and preset keys into interactive visual tokens called "chips" (`render` method).
- **Segmented Labels**: Supports displaying combo presets with segmented labels for complex chained prompts.
- **Weight Badges**: Visually represents and manages prompt weights using syntax like `(preset:1.5)`.

### 2. Advanced Drag-and-Drop (DnD)

- **Reordering**: Users can click and drag chips within the basket to reorder them seamlessly.
- **External Drop Support**: Accepts items dragged into the basket from external sources, correctly splicing them into the active array based on drop coordinates.
- **Visual Indicators**: Displays a responsive drop-indicator line (`j0n4t-pg-basket-drop-indicator`) to show exactly where a dropped chip will land.

### 3. Dual UI Modes

- **Raw Mode**: A toggleable state (`raw-mode`) that hides the visual chips and displays a standard raw textarea managed by `RawTextareaManager`. State is persisted in `localStorage` (`comfy_preset_gallery_raw_basket`).
- **Visual Mode**: The default state showing stylized UI chips.

### 4. Inline Interaction & Editing

- **Inline Editing**: Double-clicking a chip or clicking the "+ Add" button spawns an inline text editor (`InlineEditorManager`) to manually modify or add presets on the fly.
- **Dynamic Inputs**: Automatically detects and handles embedded dynamic inputs within a chip (checkboxes, number spinners, select dropdowns), instantly updating the active selection when modified.
- **Context Menus**: Clicking a chip triggers a contextual popup menu (via `ChipMenuManager`) for further actions.

### 5. Keyboard Navigation & Accessibility

- **Spatial Navigation**: Users can traverse chips using the `ArrowLeft`, `ArrowRight`, `ArrowUp`, and `ArrowDown` keys.
- **Multi-selection**: Enable the basket's Select mode to toggle chips by clicking, or use Ctrl/Cmd-click to toggle chips and Shift-click or Shift+Arrow to select a range. Ctrl/Cmd+Arrow toggles the adjacent chip; Ctrl/Cmd+A selects all chips.
- **Copy and Paste**: Ctrl/Cmd+C copies selected chips and Ctrl/Cmd+V appends them. Preset text remains compatible with plain-text clipboards, while rich clipboard support also carries each chip's pinned state and resolved rolling choices.
- **Bulk Actions**: Basket buttons copy, paste, pin/unpin, or delete selected chips. `Delete` removes selected chips, `P` pins them (or unpins them when all are already pinned), and Alt+Arrow or dragging moves the selected chips together while preserving their order.
- **Keyboard Reordering**: Holding `Alt` + an arrow moves the selected chips together past the adjacent chip in that direction.
- **Quick Deletion**: Pressing `Delete` removes the currently focused chip and intelligently shifts focus to the nearest remaining item.
- **Trigger Support**: Pressing `Enter` or `Space` on a chip acts as a click event.

### 6. Reroll Mechanism

- **Variable Rerolling**: The `reRollChipGroup` method allows users to randomly select or cycle through variations of a specific preset group, utilizing `RollManager` (imported directly from `./RollManager.js`) to keep track of roll counts and seeds.
- **Pinned Chips**: You can pin chips to keep them when rerolling or overwriting the basket.

### 7. Import/Export & Gallery Integration

- **Copy Functionality**: Copies selected chips to the clipboard as compatible plain text and, when supported, retains pin and roll state for pasting back into the basket.
- **Gallery Highlighting**: The `locatePreset` method locates the corresponding preset in the main UI gallery, expands its parent folder if collapsed, scrolls it into view, and highlights it with a temporary visual glow.

## State Ownership

Three things describe "what is selected", and only one of them is authoritative:

| State                                                   | Owner           | Lives in                                                                     |
| ------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| Ordered selection (the raw preset tokens the node runs) | the host widget | `widget.value`, comma separated                                              |
| Pins of the active tab                                  | the session     | `PresetSession.pinnedChips` (persisted per node as `j0n4t-pg-pins-<nodeId>`) |
| Rolled choices of the active tab                        | the session     | `PresetSession.rollManager.rolls`                                            |

A tab is a snapshot of exactly those three: `{ id, title, basket, pins, rolls }`,
persisted with the active tab id under `comfy_preset_gallery_basket_tabs`.
`PresetBasketTabs` owns that list, the active tab, the snapshots and the storage
key; `PresetBasket` draws the sidebar, the tab menu and the title, and forwards
every tab action to it. `render()` hands the selection it just rendered to
`PresetBasketTabs.snapshotList()` - the one place that sees the selection, the
pins and the rolls together - so a tab's saved state always matches the last
render. The grid selection, the chips and the evaluated prompt are _derived_
views of the widget value and are never a source of truth.

### Selection transitions

Every action ends in one of two operations on the app, and both end in a single
write to the widget:

- **A user edit** - add, edit, reorder, delete, paste, roll - calls
  `context.updateWidgetValue(arr)`. It prunes pins the new selection no longer
  contains, then writes the widget.
- **A tab restore** - switch, create, duplicate, add-chips-to-new-tab, and the
  constructor restoring the saved active tab - calls
  `context.restoreTabSelection(tab)`. It installs the tab's pins and rolled
  choices first, persists the pins, then writes the selection, so the render the
  write triggers already reads the restored state.

ComfyUI's `DOMWidget` value setter fires the widget callback, and that callback
(`syncUI` + prompt composition) is the single render entry: the grid, the basket
and the evaluated prompt are all rebuilt from the written value in one pass. So
nothing may repair the UI after a write - that would be a second full rebuild,
which is what tab switching used to do.

### What each part owns

| Module                      | Owns                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `PresetBasketTabs`          | the tab list, the active tab, snapshots, the storage key                                                                                    |
| `BasketSelectionController` | the selected chip indexes, the range anchor, Select mode, and the copy/paste payload format                                                 |
| `BasketDragDrop`            | the drop indicator and its geometry, chip drop insertion, image drops                                                                       |
| `PresetBasket`              | chips and tab-sidebar rendering, keyboard wiring, the chip menu and inline-editor entry points, and one-line delegations to the three above |

`PresetBasket` keeps its method names (`switchTab`, `copySelectedChips`,
`deleteSelectedChips`, …) so the chip menu and the tests call it, not the
modules it forwards to.

Two exceptions, both deliberate:

- `PresetGalleryApp.init()` syncs once after construction. The constructor
  restores the saved tab before the gallery's widget callback is attached, so
  that write installs state but cannot render.
- Pin and re-roll actions do not change the selection, so they call `syncUI`
  directly to refresh the views.

## CSS Architecture

The class natively handles its own styling injection via `PresetDOM.injectStyles`.

- `BASKET_CONTAINER_STYLES`: Defines the structural layout, sticky headers, raw mode toggling, and global container styling.
- `BASKET_CHIP_ETC_STYLES`: Dictates the detailed appearance of chips, interactive inputs, inline editors, weight badges, hover states, and contextual popups.

## Key Dependencies

- `PresetDOM`: Used for DOM manipulation, HTML escaping, and CSS injection.
- `PresetBasketTabs`: Owns the tab list, the active tab, their snapshots and the
  storage key; the Basket only presents them.
- `BasketSelectionController`: Owns the chip selection, Select mode and the
  copy/paste payload; the Basket forwards its selection commands here.
- `BasketDragDrop`: Owns the drop indicator, chip drop insertion and image drops.
- `PresetLogic`: Handles token parsing, recursion expansion, string matching, and roll tracking.
- `PresetDisplay`: How a preset is named, labelled and coloured - the path helpers, title casing and colours the chip render uses.
- `ModalUtils`: Drives confirmation dialogs and the copy-to-clipboard modal.
- `ChipMenuManager` & `InlineEditorManager`: Handle secondary interaction layers attached to the chips.
- `RawTextareaManager`: Synchronizes visual selections with the raw text fallback.
