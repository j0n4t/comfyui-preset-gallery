/**
 * ComfyUI host wiring for the preset gallery.
 *
 * This is the only module that imports ComfyUI's runtime `scripts/app.js`, so
 * that PresetGalleryApp and every component below it stay importable outside a
 * ComfyUI server (unit tests, `node --test`). ComfyUI loads every `.js` file in
 * the web directory, so importing this module is what registers the extension.
 */
// @ts-expect-error ComfyUI resolves this host-provided module at runtime.
import { app } from "../../../scripts/app.js";

import PresetGalleryApp, {
  MIN_NODE_WIDTH,
  MIN_NODE_HEIGHT,
} from "./PresetGalleryApp.js";

/**
 * Focuses the search box of the most relevant gallery instance: the one that
 * currently has focus, else the selected node's when exactly one is selected,
 * else the only visible instance.
 */
function focusActiveSearch() {
  const activeWrap = document.activeElement?.closest(".j0n4t-pg-wrap");
  const activeInstance = activeWrap
    ? PresetGalleryApp.instancesByWrap.get(activeWrap)
    : null;
  const selectedNodes = /** @type {any} */ (app.canvas)?.selected_nodes;
  const selectedInstances = Object.values(selectedNodes ?? [])
    .map((node) => PresetGalleryApp.instancesByNode.get(node))
    .filter(Boolean);
  const visibleInstances = [...document.querySelectorAll(".j0n4t-pg-wrap")]
    .map((wrap) => PresetGalleryApp.instancesByWrap.get(wrap))
    .filter(Boolean);
  const target =
    activeInstance ??
    (selectedInstances.length === 1 ? selectedInstances[0] : null) ??
    (visibleInstances.length === 1 ? visibleInstances[0] : null);

  target?.focusSearch();
}

/**
 * @typedef {Object} ComfyUiWidget
 * @property {string} name
 * @property {string} value
 * @property {boolean} hidden
 * @property {Function} callback
 * @property {Function} serializeValue
 */

app.registerExtension({
  name: "Comfy.PresetGallery",
  commands: [
    {
      id: "PresetGallery.FocusSearch",
      label: "Preset Gallery: Focus Search",
      function: () => focusActiveSearch(),
    },
  ],
  keybindings: [
    {
      combo: { key: "p", ctrl: true, shift: true },
      commandId: "PresetGallery.FocusSearch",
    },
  ],
  /**
   * @param {{ prototype: { onNodeCreated: (...args: any[]) => void; widgets: ComfyUiWidget[]; addDOMWidget: Function }}} nodeType
   * @param {{ name: string; }} nodeData
   */
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "PresetGalleryNode") return;
    const onNodeCreated = nodeType.prototype.onNodeCreated;

    nodeType.prototype.onNodeCreated = function () {
      // @ts-expect-error The host node callback uses a dynamic `this` context.
      onNodeCreated?.apply(this, arguments);
      const widget = this.widgets?.find(
        (/** @type {{ name: string; }} */ w) => w.name === "preset_selection",
      );
      const evaluatedWidget = this.widgets?.find(
        (/** @type {{ name: string; }} */ w) => w.name === "evaluated_preset",
      );
      if (!widget || !evaluatedWidget) return;
      widget.hidden = true;
      evaluatedWidget.hidden = true;

      const galleryView = new PresetGalleryApp(this, widget);
      const baseCallback = widget.callback;

      // Both host paths compose through `session.composePrompt`, so the value
      // shown in the evaluated widget and the prompt that is queued are the
      // same expansion of the same selection, cache and rolls.
      widget.callback = function (/** @type {string} */ value) {
        galleryView.syncUI(value);
        evaluatedWidget.value = galleryView.session.composePrompt(value);
        baseCallback?.apply(this, arguments);
      };

      evaluatedWidget.serializeValue = function () {
        const expanded = galleryView.session.composePrompt(widget.value || "");
        galleryView.scheduleAutomaticRoll();
        return expanded;
      };

      galleryView.init();
      this.addDOMWidget("preset_gallery_ui", "HTML", galleryView.dom.wrap);
    };
  },
  /**
   * @param {{ comfyClass: string; size: number[]; min_size: number[]; properties: {}; }} node
   */
  async nodeCreated(node) {
    if (node.comfyClass === "PresetGalleryNode") {
      node.size = node.min_size = [MIN_NODE_WIDTH, MIN_NODE_HEIGHT];
      node.properties = node.properties || {};
    }
  },
});
