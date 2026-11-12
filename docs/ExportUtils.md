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
- **Row**: The dialog mounts `buildLibraryPicker` seeded with a single row, named after the library the file is being imported into. The row carries that library's preset tree, its preset count and its duplicate count, so what is already on the server is what the badges and diffs compare against.
- **Landing the import**: The row's pencil (`✎`) renames it. An unchanged name writes to that library; a served library's name merges into it and reports its duplicates; any other name creates a new library. A folder renamed to `lib#folder` moves its presets into that row.
- **Duplicate Handling Strategy Dropdown** (one, shared by every row):
  - _Overwrite existing presets_
  - _Skip duplicates_
  - _Keep both (Rename imported with `_copy`)_
- **Import Custom Colors**: Toggle for importing group colors (`__color__`).
- **Import Summary**: One line per row in the confirmation modal - new / replaced / unchanged, and the preset count the destination library will hold once the strategy is applied.

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
- **Integration**: A zip carrying a root manifest goes to `showImportBundleModal`; anything else goes to `showImportModal`. Both end in `writeImport`, which writes each selected row one destination at a time - reading the destination fresh before every save, so two rows aimed at the same library accumulate instead of the second clobbering the first.

### 8. Multi-Library Bundles

- **Purpose**: Export and import several libraries as one archive, and restore a whole installation.
- **Container**: Always one `.zip`, named `preset_gallery_libraries_<mode>.zip`. A bundle is told apart from a single-library export by a root `manifest.json` (`{ version, layout, libraries: [{ id, name }] }`); `readBundleFromZip` returns `null` without one, and `importFile` then takes the single-library path.
- **Layouts**: The File Layout dropdown picks what is inside the archive.
  - `ZIP` (manifest `layout: "files"`): `<libraryId>/<key>.txt`, `<libraryId>/<key>.<ext>`, `<libraryId>/<folder>/__color__.txt`. This is the single-library layout namespaced by library id, assembled through `addPresetZipEntries` so the two cannot drift.
  - `JSON` / `YAML` (manifest `layout: "json" | "yaml"`): one document per library at `libraries/<libraryId>.<ext>`, in the same shape the single-library export writes, so the existing parser reads it back.
- **Build path**: `buildBundleEntries` produces the file table as a plain record (path -> text, or `{ base64 }` for an image), which is also what makes the layout unit-testable without a zip library. An optional per-library key selection narrows each library to what the picker checked; a library left with nothing selected is left out of the archive, manifest included. `buildLibraryBundleZip` writes that table into a JSZip instance; `exportLibraryBundle` downloads it.
- **Picker**: `buildLibraryPicker` is the one row container, used by the Settings export scopes and by both import dialogs. Each row holds one library's preset tree (`buildPresetSelectorTree` with `nested`, which drops its own select-all and scroll cap), its preset count and, in import mode, its duplicate count and a consequence line saying what writing it will do. A master row selects or clears every row. In import mode each row also carries a pencil (`✎`) that renames the destination: an unchanged name writes where the row came from, a served library's name merges into it and reports its duplicates, and any other name creates a new library. In export mode the pencil names the library that gets written, and there is no consequence line - there is nothing to merge on the server. Renaming onto another row folds the two into one. The duplicate strategy is one global switch, rendered only in import mode.
- **Export path**: the Settings tab mounts one picker per scope - a single row seeded from the library `<select>`, or one row per served library - and the Export button reads the active picker's rows. The scope decides the container: `All libraries (bundle)` always writes one archive, so the file matches the scope picked; `Single library` writes one file, unless a folder move added a row, because the moved presets have to go somewhere. A row with nothing checked is left out.
- **Import path**: `importFile` routes a zip with a manifest to `showImportBundleModal`, which mounts the picker seeded with one row per library in the bundle. A row's presets are compared against the destination the row is named after, so renaming a row re-measures the badges and diffs. `importBundle` writes the selected rows one destination at a time, so two rows aiming at the same library accumulate. Rows with nothing selected are left out, and empty ones are reported and not written.
- **New library names**: a row's pencil prompts for a name, in both directions. The rule is shared - letters, numbers, underscores and hyphens - and renaming onto another row folds the two into one, so names stay unique. In export the name is the library that gets written; in import it is the destination.
