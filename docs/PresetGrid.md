# PresetGrid.js - Feature Documentation & Architecture Reference

## Overview
`PresetGrid.js` is a core UI component class responsible for rendering, managing, and interacting with a preset gallery grid (typically used in ComfyUI extensions). It handles dynamic layout views, folder grouping, color customization, multi-keyword search filtering, drag-and-drop operations, and robust keyboard accessibility.

---

## Architecture & Dependencies
The class relies on several helper modules:
- **`ModalUtils.js`**: Provides modal dialogs (`prompt`, `alert`) for group renaming.
- **`PresetDOM.js`**: Utility functions for CSS style injection (`injectStyles`), HTML escaping (`escapeHTML`), and UI icon definitions (`PresetDOM.icons`).
- **`PresetGalleryAPI.js`**: Backend API communication layer for persistence (e.g., setting group colors, renaming folders).
- **`PresetLogic.js`**: Pure utility logic for parsing preset names, folder paths, initials, title case formatting, and generating search blobs.

---

## Detailed Feature Breakdown

### 1. Dynamic View Modes (`switchView`)
The component supports three distinct visual layout modes:
- **Big View (`big`)**: Default thumbnail grid view with larger preview boxes (`100px` height).
- **Small View (`small`)**: Compact grid view with reduced thumbnail height (`50px`).
- **List View (`list`)**: Horizontal row layout omitting large thumbnails in favor of inline labels, badges, and quick-access edit controls.
- **Persistence**: User view selections are automatically saved and restored via `localStorage` under the key `comfy_preset_gallery_view`.

### 2. Multi-Keyword Search & Filtering (`executeFilterPipeline`)
- **Multi-Word Matching**: Splits search input into individual whitespace-separated lowercase keywords. An item must match *all* keywords to be displayed (`searchBlob` comparison).
- **Hidden Preset Management**: Identifies hidden presets (items/folders starting with an underscore `_`) and toggles visibility based on the global "Show Hidden" state preference (persisted in `localStorage` as `comfy_preset_gallery_show_hidden`).
- **Group Header Filtering**: Automatically hides group headers when all child items within a group are filtered out or hidden.

### 3. Folder Grouping & Customization
- **Hierarchical Grouping**: Organizes presets into collapsible category folders (`uiGroup` / `rawGroup`), keeping root presets (`root_presets`) at the top.
- **Group Color Customization**: Each group header features an interactive color dot and native color picker input. Changes are saved instantly via `PresetGalleryAPI.setGroupColor`.
- **Group Renaming**: Users can rename non-root groups via an inline prompt dialog, which automatically updates folder paths and widget selections.
- **Collapse / Expand Management**: Supports individual folder collapse/expand toggling as well as a global collapse/expand toggle button. State is tracked and restored across sessions.

### 4. Interactive Preset Items & Drag-and-Drop
- **Thumbnails & Badges**: Renders images or fallback file icons, thumbnail overlay initials, cleaned title-case labels, and dynamic category badges colored matching their parent group.
- **Corner Edit Action**: Hovering or focusing a preset item reveals a quick-access corner edit button that opens the preset editor.
- **Drag and Drop**: Items support native HTML5 drag-and-drop (`draggable="true"`), passing style keys and source metadata for external drop handling.

### 5. Selection State Synchronization (`syncSelection`)
- Synchronizes UI selection states with active data arrays.
- Dynamically toggles CSS `selected` classes and updates `aria-selected` attributes for accessibility.

### 6. Robust Accessibility & 2D Spatial Keyboard Navigation
The component implements extensive keyboard navigation (`keydown` event listener):
- **Escape (`Escape`)**: Returns focus to the search input or grid container.
- **Selection / Activation (`Enter` / `Space`)**: Toggles selection of preset items or collapses/expands group headers.
- **Advanced Editing (`Shift + Enter` / `Shift + Space`)**: Opens the preset editor for items or triggers group renaming for group headers.
- **2D Spatial Grid Navigation (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`)**:
  - Implements a custom geometric distance algorithm to navigate between grid items and group headers in 2D space.
  - Calculates bounding client rectangles and evaluates candidate elements using primary directional distance and secondary alignment weighting (`score = primaryDist + secondaryDist * 1.5`), ensuring smooth and intuitive spatial arrow-key navigation.

---

## CSS Styling Architecture
Styles are dynamically injected into the document head via `PresetDOM.injectStyles`:
1. **`GROUP_HEADER_STYLES`**: Styling for group rows, collapse arrows (`▼` rotated `-90deg` when collapsed), color dots, color pickers, divider lines, edit icons, and folder visibility toggles (`hide-folders`).
2. **`ITEM_THUMB_STYLES`**: Styling for grid cards, hover states, selection outlines, editing states, dragging opacity, thumbnail boxes, badge overlays, and corner edit buttons.
3. **`VIEW_LIST_OVERRIDES`**: Flexbox row adaptations for list view mode.
