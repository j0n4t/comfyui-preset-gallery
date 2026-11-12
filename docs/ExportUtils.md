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
- **`PresetDisplay.js`**: Provides folder extraction, name formatting and title-casing; `PresetLogic` provides MIME type detection.
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
  - **Folder Grouping**: Automatically groups presets by folder (`PresetDisplay.getPresetFolder`), displaying custom folder accent colors (`__color__`) and item counts.
  - **Folder Renaming**: Interactive rename button (`✎`) allowing users to rename folders on the fly.
  - **Folder Collapsing**: Expand/collapse (`▼`/`▶`) sections.
  - **Status Badges**: Visual indicator tags for `+New`, `~Replaced`, and `=Same` items.
  - **Item Details & Diff View (`⊞`)**: Expandable diff drawer showing current vs. imported text and thumbnail comparison.
  - **In-Line Item Editor (`✎`)**: Allows editing preset names, text content, previewing current pictures, uploading replacement images, and saving changes live.
  - **State Propagation**: Automatic handling of indeterminate states and recursive checkbox selection propagation (Master ↔ Group ↔ Item).
  - **Duplicate Strategy Application**: Programmatically updates item selection states based on chosen duplicate handling strategies (`skip`, `overwrite`, `keep_both`).

### 4. Export Form (Settings → Import / Export)

- **Purpose**: The export interface, hosted in a Settings tab rather than a modal.
- **Scope**: Single library (a library picker plus the preset selector tree) or
  All libraries (a checkbox list with Select / Deselect All; whole libraries
  only, no per-preset tree).
- **Configuration Options**:
  - **File Layout**: ZIP (one file per preset), JSON or YAML (one document per
    library). A bundle is always one `.zip`; the layout is what is inside it.
  - **Data Content Mode**: Full Data (with images) vs. Presets Only (clean text/structure).
  - **Custom Colors**: Toggle to include/exclude custom group color definitions (`__color__`).
  - **Preset Tree Mount**: Embedded preset selector tree, for the single-library scope.

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
  - _Overwrite existing presets_
  - _Skip duplicates_
  - _Keep both (Rename imported with `_copy`)_
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
  - Normalizes keys: lowercased, spaces to underscores - the same rule the editor's save, the export tree's rename and the zip import apply, so an imported preset cannot exist under two spellings.
  - Generates thumbnails for embedded data URL images.
- **Integration**: Triggers `showImportModal`, resolves duplicate handling according to chosen strategy, appends unique copy suffixes if required, preserves group colors, and saves final presets via `PresetGalleryAPI.savePresets`.

### 8. Multi-Library Bundles

- **Purpose**: Export and import several libraries as one archive, and restore a whole installation.
- **Container**: Always one `.zip`, named `preset_gallery_libraries_<mode>.zip`. A bundle is told apart from a single-library export by a root `manifest.json` (`{ version, layout, libraries: [{ id, name }] }`); `readBundleFromZip` returns `null` without one, and `importFile` then takes the single-library path.
- **Layouts**: The File Layout dropdown picks what is inside the archive.
  - `ZIP` (manifest `layout: "files"`): `<libraryId>/<key>.txt`, `<libraryId>/<key>.<ext>`, `<libraryId>/<folder>/__color__.txt`. This is the single-library layout namespaced by library id, assembled through `addPresetZipEntries` so the two cannot drift.
  - `JSON` / `YAML` (manifest `layout: "json" | "yaml"`): one document per library at `libraries/<libraryId>.<ext>`, in the same shape the single-library export writes, so the existing parser reads it back.
- **Build path**: `buildBundleEntries` produces the file table as a plain record (path -> text, or `{ base64 }` for an image), which is also what makes the layout unit-testable without a zip library. `buildLibraryBundleZip` writes that table into a JSZip instance; `exportLibraryBundle` downloads it.
- **Import path**: `importFile` routes a zip with a manifest to `showImportBundleModal`. Each library gets a row with its own target (Restore to its id, Skip, or merge into another served library) and its own duplicate strategy, plus one shared colors toggle. `importBundle` writes the selected rows one target at a time, so two rows aiming at the same library accumulate. Empty libraries are reported and not written.
