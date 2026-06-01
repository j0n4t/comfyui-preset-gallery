# ComfyUI Preset Gallery
A sleek, visual extension for ComfyUI to save, organize, filter, and reuse your favorite prompt snippets and style templates using an interactive embedded grid.

![sample screenshot](sample.png)
## 🚀 Quick Start

### 1. Installation

Navigate to your ComfyUI custom nodes directory and clone the repository:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/j0n4t/comfyui-preset-gallery.git
```

> Sample presets: [presets_sample.zip](./presets_sample.zip)

Restart ComfyUI to load the extension.

### 2. Basic Workflow

1. **Add Node:** Right-click the canvas and select **Add Node → utils › Preset Gallery**.
2. **Connect Output:** Link `final_preset` to a text encoder (e.g., *CLIP Text Encode*). Prepend text by wiring into the optional `base_preset` slot.
3. **Select Items:** Click any grid thumbnail to add it to the **Basket**. Click multiple items to concatenate them into a single prompt sequence.
4. **Queue Prompt:** Run your generation; the combined string is sent right down the pipeline.


## Key Features

### 🧺 Interactive Presets Basket

* **Drag-and-Drop:** Drag presets directly from the grid to arrange, sort, or insert them exactly where you want them inside your basket.
* **Raw Mode & Auto-complete:** Toggle **Raw Mode** to edit your selection as raw comma-separated text. Includes an overlay auto-complete helper with fuzzy search matching.
* **Custom Snippets:** Click **+ Custom** to inject temporary, one-time keywords into your selection pool without cluttering your permanent library.

### 🔍 Live Grid Layouts & Filter Search

* **Dynamic Views:** Toggle between small grids, large visual grids, or clean list views instantly.
* **Live Search & Grouping:** Filter presets instantly by keyword, path, or tag. Keep things organized with mass-collapsible subfolder groups.
* **Automatic Initials:** Items missing thumbnail images automatically generate color-coded cards with title initials.

### ⚙️ Management & Preset Editor

Expand the **⚙️ Management Panel** at the bottom to curate your collection:

* **Save, Edit, Overwrite:** Create brand-new items or edit existing items on your grid to update text parameters or subfolders.
* **Image Assets:** Add, replace, or erase reference cover artwork (`.jpg`, `.png`, `.webp`) for any preset entry.
* **Portable Packages:** Import and export your entire asset tree via `.zip` archive backups for quick migrations.

## Technical Details

* **Node Class Name:** `PresetGalleryNode`
* **Category:** `utils`
* **Files Reference:** Frontend UI mutations and styles are orchestrated by `preset_gallery.js`, while the backend state, disk operations, and server endpoints are driven by `preset_gallery.py`.

### Storage Architecture

Your catalog data is stored as flat text configurations accompanied by image pairs inside the localized asset path:

```text
comfyui-preset-gallery/
├── preset_gallery.py
├── web/
│   └── preset_gallery.js
└── presets_pool/         # Managed library files
    ├── explicit_style.txt
    ├── explicit_style.jpg
    └── characters/
        ├── default_avatar.txt
        └── default_avatar.png
```