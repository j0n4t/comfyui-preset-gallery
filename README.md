# Preset Gallery for ComfyUI

A simple visual extension for ComfyUI to save, organize, filter, and reuse your favorite preset snippets and styles using an interactive embedded grid.

## 🚀 Quick Start

### 1. Installation

Open your terminal, navigate to your ComfyUI custom nodes directory, and clone this repository:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/j0n4t/comfyui-preset-gallery.git
```

Restart your ComfyUI server to load the extension.

### 2. Using the Node

1. **Add the Node:** Right-click anywhere on the ComfyUI canvas background and select **Add Node → Utils → Preset Gallery**.
2. **Connect the Output:** Link the `TEXT` string output of the *Preset Gallery* node to a text encoder node (such as a *CLIP Text Encode*).
    * *Optional:* Connect a string to the `base_preset` input to prepend existing text to the final output.
3. **Manage Presets:** Add the presets you want to use by either creating them from scratch or importing a `.zip` file.
    * *Optional:* Expand the **⚙️ Management Panel** at the bottom of the node to import, build, categorize, or delete your custom preset templates.
4. **Select Presets:** Click on a preset thumbnail in the grid to load that preset into the output.
    * *Multi-select:* Hold `Ctrl` while clicking thumbnails to select and concatenate multiple presets in the order they are clicked.
5. **Generate:** Queue your workflow. The full, concatenated preset will be sent to the text encoder.

## Key Features

### 🖼️ Visual Preset Grid

* **Three Grid Layouts:** Choose between a small thumbnail grid, a large thumbnail grid, or a text list view using the layout icons at the top right.
* **Smart Initials & Backgrounds:** Presets without an attached image automatically generate color-coded background cards with letter initials so you can find them easily.

### 🔍 Search, Filter & Multi-Select

* **Live Search:** Type into the search bar at the top to instantly filter your presets by name, subfolder category, or preset contents.
* **Folder Grouping:** Keep presets organized by their subfolders, or uncheck **"Group Folders"** at the bottom to collapse everything into a single flat list view.
* **Multi-Select Combinations:** Click a preset card to apply its preset to the node. **Ctrl + Click** multiple presets to combine, stack, and append them into a single compound preset sequence.

### ⚙️ Management & Preset Editor

Click the **⚙️ Management Panel** button at the bottom to expand the creator toolbox:

* **New / Edit Mode Toggle:** * Switch to **➕ New Profile Mode** to clear the fields and create a brand-new preset card from scratch.
    * Click any existing preset in your grid or select **✏️ Edit Existing Mode** to modify an already saved card.
* **Subfolders & Categorization:** Use the `Sub-folder` input field to create categories (e.g., `chars`, `styles`, `backgrounds/outside`). This automatically creates sorted sections in your grid.
* **Image Asset Actions:**
    * **Pick / Change Image:** Upload a local image (`.png`, `.jpg`, `.webp`) to serve as the visual thumbnail cover for your preset.
    * **Clear Img:** Erase the image cover file while keeping your text preset asset intact.
* **Delete Asset:** Permanently erase a preset and its image from your disk storage entirely.

### 📦 Import & Export Packages

* **Export:** Back up your entire library by clicking the export button, which packages all text presets and thumbnail images into a clean `.zip` file.
* **Import:** Upload a previously exported or shared `.zip` archive to immediately merge a set of presets right into your library.