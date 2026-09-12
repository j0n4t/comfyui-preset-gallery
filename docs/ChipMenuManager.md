# ChipMenuManager Documentation

## Overview
`ChipMenuManager` is a robust UI class responsible for generating, positioning, and managing interactive contextual popup menus for "chips" (typically representing tags, nodes, or preset styles in a generation UI). It allows users to quickly adjust weights, cycle through variants, edit underlying presets, and delete items from their active selection.

## Dependencies
This module interacts tightly with the following dependencies:
*   **`PresetDOM`**: Used for accessing UI icons and sanitizing/escaping HTML.
*   **`PresetLogic`**: Provides core data manipulation utilities (string formatting, grouping, rolling/randomization, template unrolling).
*   **`AutocompleteManager`**: Powers the searchable dropdown fields for variant selection.

## Core Features

### 1. Dynamic Variant Parsing and Editing
When a chip contains dynamic text variants (e.g., `{group:value}` syntax), `ChipMenuManager` actively parses these using a nested Regular Expression algorithm. 
*   **Recursive Resolution:** It resolves nested templates and groups recursively.
*   **Variant UI:** For each found variant group, it generates an interactive row containing:
    *   A searchable autocomplete input (to select a specific value, "🎲 Random", or "🚫 None").
    *   An **Edit** button to directly open the preset editor for the chosen variant.
    *   A **Re-roll** (dice) button to randomly select a new variant for that specific group.

### 2. Weight Modification
It natively supports prompt weighting syntax (e.g., `(keyword:1.2)`).
*   **Extraction:** Strips and identifies the core text and the current numeric weight using regex (`/^\((.+?):([-+]?[0-9]*\.?[0-9]+)\)$/`).
*   **UI Controls:** Provides a toggleable weight modifier interface with `+` and `-` buttons that increment/decrement the weight in steps of `0.05`. Users can also type a specific number.

### 3. Quick Action Toolbar
The bottom of the popup offers a standardized toolbar for common chip operations:
*   **+/- (Toggle Weight):** Opens the weight adjustment panel.
*   **Swap:** Triggers an inline editor to replace the current chip with another.
*   **Edit:** Opens the inline editor for raw strings, or the preset editor if the chip is tied to a saved preset.
*   **Locate / Create:** If the chip is a saved preset, it offers a "Locate in Gallery" (eye icon) action. If it's a raw string, it offers a "Create Preset" (add icon) action.
*   **Remove:** A danger action (close icon) that splices the chip out of the active selection basket.

### 4. Smart Viewport Positioning
When `show()` is invoked, the manager calculates the bounding rectangle of the target chip and positions the popup to ensure it stays within the visible viewport bounds:
*   Attempts to place it directly above the chip.
*   Falls back to placing it below if scrolling pushes it out of bounds.
*   Adjusts the `left` property based on available horizontal space.

### 5. Keyboard Navigation & Accessibility
The popup includes built-in keyboard event listeners for seamless accessibility:
*   **Arrow Keys:** Cycle focus through interactive elements (buttons, actions).
*   **Enter / Space:** Trigger the currently focused action.
*   **Escape:** Closes the popup and returns focus to the parent chip.

### 6. String Replacement & Data Injection
When a user changes a variant or weight, `ChipMenuManager` performs safe, indexed string replacements:
*   Uses a custom `replaceNth` function to ensure that if multiple identical variant groups exist, only the specifically targeted one is updated.
*   Dynamically updates the chip's HTML dataset attributes (`dataset.id` and `dataset.preset`).
*   Notifies the root application context to update the underlying application state/widget values.

## Methods Breakdown

### `constructor(context, delegateBasket)`
Initializes the manager.
*   `context`: The main application context (providing cache, editor, and selection state).
*   `delegateBasket`: The UI basket holding the chips, used to trigger re-renders and re-rolls.

### `show(chipElement, styleKey, item, startIndex, endIndex, focusWeight = false)`
The main execution function that builds and displays the popup.
*   **Parameters:**
    *   `chipElement`: The DOM element of the chip being clicked.
    *   `styleKey`: The raw string value of the chip (e.g., `(1girl:1.2)`).
    *   `item`: The preset object (if the chip maps to a known preset).
    *   `startIndex` / `endIndex`: Array bounds for this chip in the parent selection list.
    *   `focusWeight`: Boolean dictating whether the weight modifier should be automatically expanded and focused on open.

### `close()`
Destroys the popup instance.
*   Removes all dynamically bound global event listeners (like the outside click detector).
*   Strips `.active-menu` classes from the origin chip.
*   Safely removes the DOM node.
