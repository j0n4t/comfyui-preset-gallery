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

## User-facing test plan

Use the `dev/` Playwright harness for end-to-end checks: it runs the real
frontend against predictable in-memory preset libraries and exposes the
composed widget value. Keep parser and component edge cases in the existing
unit suites; add an end-to-end test when behavior crosses UI, basket state, or
prompt serialization.

### 1. Verify chip edits change the prompt as shown

- In `tests/e2e/gallery.spec.ts`, add a fixture preset whose text contains a
  variant group with at least two choices.
- Add it from the gallery and verify the Basket shows one chip and the widget
  contains the preset key.
- Open the chip menu, choose the other variant, and verify the chip's displayed
  selection and serialized `evaluated_preset` contain the new choice, not the
  original one.
- Repeat with a weight change; verify both the Basket selection and serialized
  prompt preserve the weight.
- Cover **None** for the variant and verify that choice contributes no text.
- Keep focused parser/menu edge cases in `preset_logic.test.ts` and
  `chip_menu_manager.test.ts`.

**Done when:** Each edit is observable in the Basket and in the exact prompt
ComfyUI will receive; no stale or duplicate text remains.

### 2. Verify common Basket operations preserve content and order

- Add two distinct presets, drag the second chip before the first, and verify
  the visible chip order, widget value, and serialized prompt all use the new
  order.
- Select multiple chips, copy them, paste them, and verify the pasted order and
  text. Where the browser supports the rich clipboard payload, also verify pin
  state is retained; plain-text paste must still work.
- Delete a selected chip and verify only that chip is removed from both the
  Basket and final prompt.
- Use keyboard navigation/reordering for one move and assert the same visible
  and prompt result.
- Put DOM-level interaction mechanics in `preset_basket.test.ts`; use
  `gallery.spec.ts` for behavior whose correctness depends on rendered UI and
  widget synchronization.

**Done when:** Reordering, copy/paste, and deletion have matching Basket,
widget, and final-prompt state.

### 3. Verify search suggestions behave like search controls promise

- Type a known preset name, choose its autocomplete suggestion, then verify the
  preset is added once and the search field clears.
- Type unmatched text and press Enter with no suggestion selected; verify that
  text is added as a chip and the prompt contains it.
- Verify Escape clears or defocuses search as intended, and the documented
  shortcut focuses the search field when the gallery is mounted.
- Keep generic arrow/Enter popup mechanics in `autocomplete_manager.test.ts`;
  exercise the real search wiring in `gallery.spec.ts`.

**Done when:** Suggestions, Enter, Escape, and the shortcut produce the
documented result without accidental duplicate chips or lost text.

### 4. Verify Basket state survives reload and tab switching

- Add multiple chips, pin one, create a second Basket tab, and give that tab a
  different selection.
- Switch tabs and verify each tab restores its own chips, pins, and active
  state.
- Reload the page and verify the active tab and its Basket state return.
- Where a deterministic variant fixture is available, verify its chosen value
  remains stable after switching away and back.
- Retain serialization/storage edge cases in `preset_basket.test.ts` and add
  user-visible reload assertions to `gallery.spec.ts`.

**Done when:** Users return to the same active Basket state after switching
tabs or reloading, without state leaking between tabs.

### 5. Verify automatic rolling settings have visible effects

- In the harness, change the settings to roll on generation and trigger the
  generation path; verify the Basket and serialized prompt reflect the new
  roll.
- Repeat for seed-change rolling by changing a seed widget and verifying a
  roll occurs only when that option is enabled.
- Verify the manual dice action still works and that Shift invokes the
  alternate roll behavior.
- Keep deterministic selection and seed detection cases in
  `preset_session.test.ts`; use `gallery.spec.ts` to verify the user-visible
  result.

**Done when:** Each setting controls the corresponding event, and disabled
automatic rolling does not silently alter the Basket.

### 6. Verify preset management through the visible UI

- Save a new preset and verify it appears in the grid and can be added to the
  Basket.
- Attempt to overwrite an existing preset; cancel and verify the stored value
  is unchanged, then confirm and verify the new value appears in the grid and
  serialized prompt.
- Delete a preset and verify it disappears from the gallery and no longer
  resolves in the prompt.
- Import a small fixture with a duplicate and a new entry; verify the selected
  duplicate strategy and target library determine what appears afterward.
- Export a selected preset and verify the download is produced in the chosen
  format.
- Keep API/form edge cases in `preset_editor.test.ts`, `preset_gallery_api.test.ts`,
  and `export_utils.test.ts`; add browser coverage for user-visible outcomes in
  `gallery.spec.ts`.

**Done when:** Save, cancel, overwrite, delete, import, and export outcomes are
confirmed through the UI and reflected in the right library.

## Execution order

Start with steps 1 and 2 before simplifying preset/chip logic: they protect the
core promise that editing chips changes the prompt predictably. Then add steps
3–6 as focused Playwright cases, keeping each fixture and assertion limited to
the user outcome under test. Run the affected unit tests and `npm run test:e2e`
for each batch; use `npm run verify` before merging the broader change.
