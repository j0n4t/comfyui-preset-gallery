# Current User-Facing Features

This is a behavior-focused snapshot of what users can do in Preset Gallery and
what the extension does in response. It describes the current experience as a
baseline for simplifying preset and chip behavior; it is not a proposal for how
that behavior should work later.

## Use presets in a workflow

Add a **Preset Gallery** node, connect `final_preset` to a text encoder, and
optionally connect text to `base_preset` to prepend it. Selecting presets builds
the prompt sent through `final_preset`.

## Browse and select presets

- Click a preset in the gallery to add it to or remove it from the Basket.
  Multiple selections combine in order.
- Search filters by matching preset text, names, and folder paths. Every
  whitespace-separated search term must match. Clear Search restores the full
  list. Suggestions can be selected to add a preset to the Basket and clear the
  search field; pressing Enter with no suggestion selected adds the entered
  text as a chip.
- Choose large-grid, small-grid, or list view. Folder groups can be collapsed
  individually or together; grouping can be toggled, and hidden presets can be
  shown or hidden.
- Presets and folders beginning with `_` are hidden unless **Show Hidden** is
  enabled. Folder headers also let users change a folder color, rename the
  folder, or exclude/include it in random preset selection.
- Drag a gallery preset into the Basket to place it at a specific position.
  The gallery can also be hidden when only the Basket is needed.

## Build and edit the Basket

- The Basket displays selections as chips. Drag chips to reorder them.
- Click a chip to open its actions: adjust weight, choose or reroll its variants,
  pin it, edit or swap it, locate its saved preset in the gallery, create a
  preset from an unsaved chip, or remove it.
- Double-click a chip or use **+ Add** to enter or edit text inline. **Raw**
  switches to a text area for editing the whole selection; edits are reflected
  in the chips and composed prompt.
- Add and switch between Basket tabs to keep separate selections. Each tab
  remembers its selection, pins, and rolled choices. Click the Basket title to
  rename the active tab; its tab menu can duplicate, close, export, or import
  tabs.
- Select multiple chips using the **Select** button, Ctrl/Cmd-click, or
  Shift-click. Copy, paste, pin/unpin, or delete the selected chips. Clipboard
  text works as plain text; where rich clipboard data is supported, pin and
  rolled-choice state is carried too.
- The dice button can reroll variants in the current Basket or replace its
  selection with randomly chosen presets. Settings choose the main behavior,
  the preset-count range, and whether rolling happens on generation or seed
  changes. Holding Shift while clicking the dice button uses the other behavior.

### Text entered as chips

The Basket accepts saved preset keys, prompt text, and prompt syntax:

- A saved preset key expands to its stored text; preset references inside that
  text expand as well.
- `{folder}` chooses a random preset in that folder. `{folder:preset}` chooses
  a specific preset, and `{folder:none}` omits that choice.
- `(text:1.2)` applies a prompt weight. Chip actions can change the weight.
- Other text, including tags such as `<lora:name:0.8>`, passes through as prompt
  text.

When a chip contains a variant, its menu lets the user choose a matching preset,
choose **Random** or **None**, and reroll a variant. The chip tooltip shows the
resolved prompt text and, when applicable, the preset or rolled choice.

## Create and manage presets

Open the management panel to create, edit, or delete presets. A preset has
keyword/prompt text, a name, an optional folder, and an optional preview image.
Click a gallery item's edit control to load it into the editor. Saving over an
existing preset asks for confirmation; deleting also asks for confirmation.
Folder colors and group names can be managed from the gallery's folder headers.

Import accepts `.zip`, `.json`, `.yaml`, and `.yml`; export offers `.zip`,
`.json`, and `.yaml`. The import/export dialogs let users choose which presets
to transfer and how duplicates are handled.

## Preset libraries

The bundled `main` library is always available. Additional `.json` files in the
`presets/` folder are available as libraries. In **Settings → Display**, users
can enable or disable libraries and change their order. Enabled libraries merge
into the gallery; duplicate names remain distinguishable by library, and the
last library in the list takes precedence for an unqualified name.

An entry from a non-winning library can be kept distinct in the Basket with its
`library#preset-key` qualifier. **Tag basket chips with their library** controls
whether that qualifier is retained when adding a gallery item. The editor's
Folder field also accepts `library#folder` to save into a library.

## Settings and persistence

Settings include library selection and priority, library badges, chip
qualification, rolling behavior, gallery height, and whether Basket/editor
panel sizes are remembered. Display options include the three gallery views,
grouping, hidden presets, and gallery visibility. Keyboard shortcuts include
`Ctrl+F` or `/` to focus search, `Ctrl+E` to toggle the editor, `Ctrl+H` to
toggle the gallery, and `Ctrl+D` / `Ctrl+Shift+D` for the two rolling behaviors.

Preset data is saved through the ComfyUI extension to its library files.
Selections, tabs, pins, rolled choices, and UI preferences are remembered in
browser storage.
