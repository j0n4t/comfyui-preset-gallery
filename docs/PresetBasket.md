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
- **Keyboard Reordering**: Holding `Alt` + `ArrowLeft`/`ArrowRight` swaps the currently focused chip with its adjacent neighbor, dynamically moving the array index.
- **Quick Deletion**: Pressing `Delete` removes the currently focused chip and intelligently shifts focus to the nearest remaining item.
- **Trigger Support**: Pressing `Enter` or `Space` on a chip acts as a click event.

### 6. Reroll Mechanism

- **Variable Rerolling**: The `reRollChipGroup` method allows users to randomly select or cycle through variations of a specific preset group, utilizing `PresetLogic.RollManager` to keep track of roll counts and seeds.
- **Pinned Chips**: You can pin chips you don't want to lose when clearing/rerolling the basket.

### 7. Import/Export & Gallery Integration

- **Copy Functionality**: Features a modal (`showCopyModal`) that compiles the basket's contents into a raw comma-separated text format (expanding prompt variations and weights) and copies it to the user's clipboard.
- **Gallery Highlighting**: The `locatePreset` method locates the corresponding preset in the main UI gallery, expands its parent folder if collapsed, scrolls it into view, and highlights it with a temporary visual glow.

## CSS Architecture

The class natively handles its own styling injection via `PresetDOM.injectStyles`.

- `BASKET_CONTAINER_STYLES`: Defines the structural layout, sticky headers, raw mode toggling, and global container styling.
- `BASKET_CHIP_ETC_STYLES`: Dictates the detailed appearance of chips, interactive inputs, inline editors, weight badges, hover states, and contextual popups.

## Key Dependencies

- `PresetDOM`: Used for DOM manipulation, HTML escaping, and CSS injection.
- `PresetLogic`: Handles token parsing, recursion expansion, string matching, and roll tracking.
- `ModalUtils`: Drives confirmation dialogs and the copy-to-clipboard modal.
- `ChipMenuManager` & `InlineEditorManager`: Handle secondary interaction layers attached to the chips.
- `RawTextareaManager`: Synchronizes visual selections with the raw text fallback.
