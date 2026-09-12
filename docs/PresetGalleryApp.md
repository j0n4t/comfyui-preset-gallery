# Preset Gallery Application Documentation

This document outlines the features and functionalities of the `PresetGalleryApp` component, a custom UI extension designed for ComfyUI. 

## 1. Overview
The `PresetGalleryApp` serves as an interactive graphical interface attached to the `PresetGalleryNode`. It replaces default text inputs with a rich gallery view, allowing users to visually manage, search, organize, and select prompt presets.

## 2. Core Features

### 2.1. User Interface & Gallery Views
* **Dynamic Grid Layouts:** The gallery supports multiple display modes:
  * **Small View:** Compact grid for dense preset viewing.
  * **Big View:** Larger grid thumbnails.
  * **List View:** Standard list format.
* **Group Controls:** Users can group presets by folders, toggle grouping visibility, collapse all folders, and toggle the visibility of hidden presets.
* **Hide Gallery Mode:** A toggle button allows users to completely hide the gallery and more options, minimizing the UI footprint when not actively browsing.

### 2.2. Preset Basket (Selection Management)
* **Visual Selection Pool:** Displays currently selected presets in a dedicated basket area.
* **"Feeling Lucky" / Reroll:** A dice button that auto-generates a random selection of presets. The logic intelligently picks 10 to 20 presets distributed across 3 to 7 random groups/folders to provide a varied prompt.
* **Raw Toggle:** Users can switch to a raw textarea input to manually edit the token string.
* **Quick Actions:** Includes a button to copy the basket's contents to the clipboard and a "Clear" button to empty current selections.

### 2.3. Search & Autocomplete
* **Real-time Filtering:** A search bar instantly filters the gallery grid.
* **Autocomplete Manager:** Features an intelligent autocomplete dropdown that suggests top matches as the user types. Hitting `Enter` automatically selects the matched preset and adds it to the basket.
* **Clear Search:** A quick-clear button ("x") resets the search bar and restores the full gallery view.

### 2.4. Built-in Preset Editor
* **Management Panel:** A collapsible editor panel lets users create, update, or delete presets directly from the node.
* **Fields:** Includes inputs for preset Name, Folder categorization, Keywords (tokens), and an Image upload for preview thumbnails.
* **Preview Highlight:** The gallery highlights the specific preset currently being edited.

### 2.5. Import & Export
* **Bulk Import:** Users can upload `.zip`, `.json`, `.yaml`, or `.yml` files to import external preset collections.
* **Bulk Export:** Supports exporting the current preset library via an export modal, which packages the configurations into the user's preferred format.

## 3. Technical Integration & Data Management
* **ComfyUI Node Replacement:** The app hooks into `beforeRegisterNodeDef` to intercept the `PresetGalleryNode`. It hides the default `preset_selection` and `evaluated_preset` widgets, replacing them with the custom HTML DOM element.
* **Recursive Evaluation:** As selections change, the app expands preset references recursively using `PresetLogic.expandRecursively`, handling dynamic roll counts and nested preset logic before passing the final string to the backend widget.
* **State Persistence:** User preferences—such as the collapsed state of folders, the editor panel, and the gallery visibility mode—are saved to and loaded from `localStorage` (`pg_collapsed_folders_list`, `comfy_preset_gallery_collapsed`, `comfy_preset_gallery_hidden`).
* **Keyboard Accessibility:** Event listeners allow navigating and triggering primary actions (search, clear, toggle) using `Enter` or `Space` keys.
