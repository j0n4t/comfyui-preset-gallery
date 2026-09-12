# PresetEditor.js Feature Documentation

## Overview
`PresetEditor` is a core UI management class responsible for handling the creation, modification, and deletion of presets. It acts as the bridge between the user interface and backend logic (`PresetGalleryAPI`, `PresetLogic`), offering a polished user experience with real-time previews, smart autocomplete, and form auto-generation.

## Core Features

### 1. State Management & Visual Feedback
- **Dynamic Status Banner:** The editor tracks current editing modes (`new` vs. `edit`) and whether unsaved changes are present (`isSaved`). A banner automatically updates with colors, text, and icons (e.g., "✨ Creating New Preset", "📝 [Preset Name]", or "✅ [Preset Name]") to visually communicate state.
- **Dirty State Tracking:** All input fields are monitored. Any user input immediately flags the editor as "dirty" (unsaved) and updates the visual banner.

### 2. Image Management & Preview
- **File Upload & Base64 Conversion:** Allows users to attach thumbnail images to presets. It utilizes a `FileReader` wrapper (`fileToDataURL`) to parse files into Base64 format for saving.
- **Dynamic & Interactive Previews:** Users can click the preview square to upload a file. The preview dynamically renders the uploaded image, or an existing preset image.
- **Image Removal:** Provides an accessible removal button (appears on hover/focus) to clear the current image.
- **Fallback Generated Previews:** If no image is provided, the editor automatically generates a stylish fallback thumbnail using a deterministic background color and the preset's initials (via `PresetLogic`).

### 3. Smart Form Interactions & UX
- **Auto-Naming on Paste:** If a user pastes text into the preset field while the name field is empty, the editor parses the text, sanitizes it (removing special characters, replacing spaces with underscores), and automatically suggests a preset name.
- **Auto-Naming on Save:** If the user attempts to save without providing a name, the editor intelligently derives one from the first three words of the preset content, or generates a fallback ID using a timestamp.
- **Folder Autocomplete:** Integrates an `AutocompleteManager` on the folder input field. As the user types, it fuzzy-matches against existing folders in the cache to provide dropdown suggestions.
- **Quick Save Shortcut:** Implements a global `Shift + Enter` keyboard shortcut across the form fields to trigger a quick save.

### 4. Integration with Ecosystem
- **RawTextareaManager:** Manages the main text area via `RawTextareaManager` to handle text highlighting and synchronization with the broader application context.
- **Style Injection:** Self-encapsulates its UI by injecting required CSS dynamically into the DOM (`PresetDOM.injectStyles`) upon instantiation.
- **API Communication:** Communicates seamlessly with `PresetGalleryAPI` to persist changes (saving/deleting) and updates the application's global cache and widget states.

## Key Methods Breakdown

- **`constructor(dom, context)`**: Initializes the editor state, injects required CSS, sets up the `RawTextareaManager`, binds DOM events, and initializes the folder autocomplete.
- **`renderPreview()`**: Re-renders the visual preview thumbnail. Handles displaying user-uploaded images, cached images, or the dynamically generated color/initials fallback.
- **`updateBanner()`**: Refreshes the visual state of the banner and save button based on whether the form is new, editing, saved, or dirty.
- **`resetImageState()`**: Clears any pending file uploads, revokes local object URLs to prevent memory leaks, and resets the preview UI.
- **`clearFields()`**: Fully resets the form to initiate a "new preset" state, wiping text inputs, highlights, and images.
- **`openPreset(styleKey, focus)`**: Loads an existing preset's data from the cache into the form inputs for editing and switches the mode to `edit`.
- **`handleSave()`**: The core save logic. Validates inputs, handles automatic naming, processes image data, and submits the payload to the `PresetGalleryAPI`.
- **`handleDelete()`**: Prompts the user for confirmation before sending a deletion request to the API and clearing the editor.
- **`bindEvents()`**: Attaches event listeners for clicks, keyboard shortcuts (like `Shift + Enter` and space/enter on previews), paste events, and input modifications.
- **`initFolderAutocomplete()`**: Sets up the floating autocomplete dropdown for the folder field, hooking into `PresetLogic.getAllPresetFolders`.
