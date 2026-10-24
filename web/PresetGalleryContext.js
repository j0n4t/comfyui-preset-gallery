/**
 * Builds the `GalleryContext` that every gallery sub-component receives.
 *
 * The context used to be the PresetGalleryApp instance itself, which meant no
 * sub-component could be constructed without a live ComfyUI node and a full
 * DOM. It is now a plain object assembled from two explicit sources:
 *
 *   - a PresetSession for all pure state and selection logic
 *   - the app itself for view, host and orchestration methods
 *
 * Tests can therefore build a context from a fake session plus a handful of
 * stubs and construct any single component in isolation.
 *
 * `cache` and `pinnedChips` are accessor properties, not copies: consumers
 * read `context.cache` and reassign `context.pinnedChips`, so both must stay
 * live views onto the session.
 */

/**
 * @param {{
 *   session: import("./PresetSession.js").default,
 *   dom: any,
 *   widget: any,
 *   view: {
 *     setPanelCollapseState: (collapsed: boolean) => void,
 *     syncEditorHighlight: () => void,
 *     openEditorForPreset: (styleKey: string, focus?: boolean) => void,
 *     syncUI: (val: string) => void | Promise<void>,
 *     loadGallery: () => Promise<void>,
 *     updateWidgetValue: (arr: string[]) => void,
 *     restoreTabSelection: (tab: { basket?: string[]; pins?: string[]; rolls?: Record<string, string> }) => void,
 *     applyLibraries: (ids: string[]) => void,
 *     selectionKey: (key: string) => string,
 *     refreshLibraries: () => Promise<void>,
 *     settleEmptiedLibrary: (libraryId: string | null) => Promise<void>,
 *   },
 * }} options
 * @returns {GalleryContext}
 */
export default function createGalleryContext({ session, dom, widget, view }) {
  const ctx = {
    session,
    dom,
    widget,
    // Attached by PresetGalleryApp right after construction: the siblings
    // reference each other, so neither can be passed in here.
    editor: /** @type {any} */ (null),
    grid: /** @type {any} */ (null),

    getSelectedArray: () => session.getSelectedArray(widget.value),
    savePins: () => session.savePins(),
    transferPin: (/** @type {string} */ oldVal, /** @type {string} */ newVal) =>
      session.transferPin(oldVal, newVal),
    getCollapsedFolders: () => session.getCollapsedFolders(),
    setCollapsedFolders: (/** @type {string[]} */ list) => session.setCollapsedFolders(list),
    getExcludedRollFolders: () => session.getExcludedRollFolders(),
    setExcludedRollFolders: (/** @type {string[]} */ list) => session.setExcludedRollFolders(list),

    setPanelCollapseState: (/** @type {boolean} */ collapsed) => view.setPanelCollapseState(collapsed),
    syncEditorHighlight: () => view.syncEditorHighlight(),
    openEditorForPreset: (/** @type {string} */ styleKey, /** @type {boolean} */ focus) =>
      view.openEditorForPreset(styleKey, focus),
    syncUI: (/** @type {string} */ val) => view.syncUI(val),
    loadGallery: () => view.loadGallery(),
    updateWidgetValue: (/** @type {string[]} */ arr) => view.updateWidgetValue(arr),
    restoreTabSelection: (/** @type {{ basket?: string[], pins?: string[], rolls?: Record<string, string> }} */ tab) =>
      view.restoreTabSelection(tab),
    applyLibraries: (/** @type {string[]} */ ids) => view.applyLibraries(ids),
    selectionKey: (/** @type {string} */ key) => view.selectionKey(key),
    refreshLibraries: () => view.refreshLibraries(),
    settleEmptiedLibrary: (/** @type {string | null} */ libraryId) =>
      view.settleEmptiedLibrary(libraryId),
  };

  Object.defineProperties(ctx, {
    cache: {
      get: () => session.cache,
      set: (/** @type {PresetCache} */ v) => { session.cache = v; },
      enumerable: true,
    },
    pinnedChips: {
      get: () => session.pinnedChips,
      set: (/** @type {Set<string>} */ v) => { session.pinnedChips = v; },
      enumerable: true,
    },
    rollManager: {
      get: () => session.rollManager,
      enumerable: true,
    },
  });

  return /** @type {GalleryContext} */ (ctx);
}
