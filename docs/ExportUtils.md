# ExportUtils.js - Feature Documentation & Architecture Reference

## Overview
`ExportUtils.js` is a core utility module designed for a web-based Preset Gallery application. It provides comprehensive capabilities for **exporting**, **importing**, **managing duplicates**, **interactive tree selection**, and **live in-line editing** of text presets, associated images, and hierarchical folder structures across multiple formats (ZIP, YAML, and JSON).

---

## Architecture & Dependencies

The module relies on several helper modules:
- **`ModalUtils.js`**: Handles modal dialogs, alerts, and confirmations.
- **`NestedPresetUtils.js`**: Manages conversions between flat preset structures and nested hierarchical trees.
- **`PresetDOM.js`**: Manages DOM utilities, HTML escaping, and thumbnail creation.
- **`PresetGalleryAPI.js`**: Interfaces with preset storage and retrieval APIs.
- **`PresetLogic.js`**: Provides folder extraction, name formatting, MIME type detection, and title-casing.
- **`YAMLUtils.js`**: Handles YAML parsing and stringification.
- **`JSZip`**: Dynamically loaded from CDN for handling `.zip` archive creation and extraction.

---

## Detailed Feature Breakdown

### 1. Dynamic JSZip Loader (`loadJSZip`)
- **Purpose**: Ensures the `JSZip` library is available in the runtime environment.
- **Behavior**: Checks `window.JSZip` and `globalThis.JSZip`. If not present, dynamically injects the JSZip script tag from `cdnjs.cloudflare.com` (`3.10.1`), resolving when successfully loaded or rejecting on failure.

### 2. Selection Summary Calculator (`getSelectionSummary`)
- **Purpose**: Analyzes selected preset keys against an existing dataset.
- **Metrics Calculated**:
  - `newCount`: Presets present in selection but missing in existing data.
  - `replacedCount`: Presets where text content or image filename differs from existing data.
  - `sameCount`: Presets with identical content and images.
  - `total`: Total number of selected keys.

### 3. Interactive Preset Selector Tree (`buildPresetSelectorTree`)
- **Purpose**: Generates a rich, hierarchical DOM tree UI for inspecting, selecting, filtering, and editing presets prior to import or export.
- **UI & Control Features**:
  - **Master Controls**: "Select / Deselect All" master checkbox and "Collapse All" / "Expand All" toggle button.
  - **Folder Grouping**: Automatically groups presets by folder (`PresetLogic.getPresetFolder`), displaying custom folder accent colors (`__color__`) and item counts.
  - **Folder Renaming**: Interactive rename button (`✎`) allowing users to rename folders on the fly.
  - **Folder Collapsing**: Expand/collapse (`▼`/`▶`) sections.
  - **Status Badges**: Visual indicator tags for `+New`, `~Replaced`, and `=Same` items.
  - **Item Details & Diff View (`⊞`)**: Expandable diff drawer showing current vs. imported text and thumbnail comparison.
  - **In-Line Item Editor (`✎`)**: Allows editing preset names, text content, previewing current pictures, uploading replacement images, and saving changes live.
  - **State Propagation**: Automatic handling of indeterminate states and recursive checkbox selection propagation (Master ↔ Group ↔ Item).
  - **Duplicate Strategy Application**: Programmatically updates item selection states based on chosen duplicate handling strategies (`skip`, `overwrite`, `keep_both`).

### 4. Export Modal Dialog (`showExportModal`)
- **Purpose**: Provides a user interface for configuring export parameters.
- **Configuration Options**:
  - **File Format**: ZIP Archive (`.zip`), YAML (`.yaml`), or JSON (`.json`).
  - **Data Content Mode**: Full Data (with images) vs. Presets Only (clean text/structure).
  - **Custom Colors**: Toggle to include/exclude custom group color definitions (`__color__`).
  - **Preset Tree Mount**: Embedded preset selector tree for granular selection.
- **Summary & Confirmation**: Displays export summary statistics before triggering actual file generation.

### 5. Multi-Format Export Engine (`exportPresets`)
- **Purpose**: Generates and triggers browser file downloads for exported presets.
- **ZIP Export**:
  - Generates a `.zip` archive.
  - Saves preset text as `.txt` files and associated images in their native extension (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`).
  - Stores group colors in `__color__.txt` files within folder directories.
- **YAML / JSON Export**:
  - Converts flat or nested structures using `NestedPresetUtils`.
  - Serializes data via `YAMLUtils` or `JSON.stringify`.
  - Triggers client-side downloads with appropriate MIME types (`text/yaml` or `application/json`).

### 6. Import Modal Dialog (`showImportModal`)
- **Purpose**: Pre-import interface for inspecting imported data against current presets.
- **Duplicate Detection**: Automatically detects duplicate keys and displays duplicate counts.
- **Duplicate Handling Strategy Dropdown**:
  - *Overwrite existing presets*
  - *Skip duplicates*
  - *Keep both (Rename imported with `_copy`)*
- **Import Custom Colors**: Toggle for importing group colors (`__color__`).
- **Import Summary**: Displays pre-import counts (Total Selected, New Styles, Replaced Styles, Unchanged Styles) in a confirmation modal.

### 7. File Import Processor (`importFile`)
- **Purpose**: Parses and processes uploaded files (`.zip`, `.yaml`, `.yml`, `.json`).
- **ZIP File Processing**:
  - Reads zip entries, normalizes paths.
  - Extracts group color definitions (`__color__.txt`).
  - Separates `.txt` preset files and image files, converting images to base64 data URLs and generating optimized thumbnails via `PresetDOM.createThumbnail`.
- **YAML / JSON Processing**:
  - Reads file text via `FileReader`.
  - Parses YAML (`YAMLUtils.parse`) or JSON (`JSON.parse`).
  - Flattens nested structures (`NestedPresetUtils.nestedToFlat`).
  - Generates thumbnails for embedded data URL images.
- **Integration**: Triggers `showImportModal`, resolves duplicate handling according to chosen strategy, appends unique copy suffixes if required, preserves group colors, and saves final presets via `PresetGalleryAPI.savePresets`.
