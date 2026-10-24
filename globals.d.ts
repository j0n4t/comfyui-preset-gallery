/** Item structure stored in the preset cache. */
type PresetCacheItem = {
  preset?: string;
  filename?: string;
  __color__?: string;
};

/** Cache dictionary mapping preset keys to CacheItems. */
type PresetCache = Record<string, PresetCacheItem>;

/** Parsed details of a variant template `{group:value}`. */
type ParsedVariant = {
  full: string;
  groupRaw: string;
  groupName: string;
  val: string;
};

/** Parsed details of a tag `<label:value>`. */
type ParsedTag = {
  label: string;
  val: string;
  isBoolean: boolean;
  isNumeric: boolean;
};

/** Matched preset key and cache item pair. */
type PresetMatch = {
  key: string;
  item: PresetCacheItem;
};

/** Details extracted from chip string tokens. */
type ParsedChipDetails = {
  variants: ParsedVariant[];
  tag: ParsedTag | null;
  presetMatch: PresetMatch | null;
  trimmed: string;
};

/** Resolved segment metadata for composite chips. */
type PresetSegment = {
  title: string;
  filename: string | null;
};

/** Raw input segment data passed for chip grouping. */
type ChipGroupInput = {
  styleKey: string;
  item?: PresetCacheItem | null;
  startIndex: number;
  endIndex: number;
  subArray: string[];
};

type ChipVariantData = {
  groupRaw: string;
  groupName: string;
  val: string;
  childVarsStr: string;
  rootGroup: string;
  isSub: boolean;
};

type AutocompleteConfig = {
  group: string;
  gIndex: number;
  matches: string[];
  groupRegex: RegExp;
};

/** Evaluated pure data structure of a chip (free of HTML strings). */
type ProcessedChip = {
  chipData: ChipGroupInput;
  joinedStr: string;
  evalId: string;
  cleanLabel: string;
  bgImage: string | null;
  color: string;
  tooltipTitle: string;
  chipExpanded: string;
  chipExpandedCore: string;
  weightVal: number | null;
  segmentedLabels: string[] | null;
  hasMoreVar: boolean;
  tag: ParsedTag | null;
};

/** Final rendered output object containing generated HTML markups. */
type RenderedChip = {
  processed: ProcessedChip;
  inputHtml: string;
  weightIconHtml: string;
  bgStyle: string;
};

/** Parsed text token details. */
type ParsedToken = {
  start: number;
  end: number;
  text: string;
  key?: string;
  item?: PresetCacheItem;
  isTag?: boolean;
  isVar?: boolean;
  isDelimiter?: boolean;
  isPlainText?: boolean;
};

/** Search match result item. */
type SearchResult = {
  item: string;
  idx: number;
  title: string;
};

/** Parsed Base64 Data URL result. */
type DataURLParseResult = {
  ext: string;
  base64: string;
};

type BasketTab = {
  id: string;
  title: string;
  basket: string[];
  pins: string[];
  rolls: Record<string, string>;
};

/**
 * How the gallery viewport is capped. Mirrored onto `data-height-mode` on the
 * wrap, which PresetGalleryApp.HEIGHT_STYLES keys its rules off.
 */
type GalleryHeightMode = "fit" | "fixed" | "unlimited";

/**
 * Heights of the two panels the user can drag - the basket container and the
 * editor's keyword box - kept only while "remember panel sizes" is on.
 */
type GalleryPanelSizes = {
  basket?: number;
  editor?: number;
};

/**
 * The shared context object handed to every gallery sub-component
 * (PresetBasket, PresetEditor, PresetGrid, PresetGallerySettings and the
 * managers they own). Built by `createGalleryContext`, not by the app itself,
 * so tests can construct one without a ComfyUI host.
 *
 * `editor` and `grid` are attached by PresetGalleryApp immediately after
 * construction, because the three siblings reference each other.
 */
type GalleryContext = {
  session: import("./web/PresetSession.js").default;
  dom: ReturnType<import("./web/PresetGalleryApp.js").default["buildDOMStructure"]>;
  /** ComfyUI widget; shape is host-provided. */
  widget: any;
  editor: import("./web/PresetEditor.js").default;
  grid: import("./web/PresetGrid.js").default;
  settings?: import("./web/PresetGallerySettings.js").default;

  // --- session-backed state (live views onto PresetSession) ---
  cache: PresetCache;
  pinnedChips: Set<string>;
  rollManager: import("./web/RollManager.js").default;

  // --- session-backed methods ---
  getSelectedArray: () => string[];
  savePins: () => void;
  transferPin: (oldVal: string, newVal: string) => void;
  getCollapsedFolders: () => string[];
  setCollapsedFolders: (list: string[]) => void;
  getExcludedRollFolders: () => string[];
  setExcludedRollFolders: (list: string[]) => void;

  // --- view / host, supplied by PresetGalleryApp ---
  setPanelCollapseState: (collapsed: boolean) => void;
  syncEditorHighlight: () => void;
  openEditorForPreset: (styleKey: string, focus?: boolean) => void;
  syncUI: (val: string) => void | Promise<void>;
  loadGallery: () => Promise<void>;
  updateWidgetValue: (arr: string[]) => void;
  restoreTabSelection: (tab: { basket?: string[]; pins?: string[]; rolls?: Record<string, string> }) => void;
  applyLibraries: (ids: string[]) => void;
  selectionKey: (key: string) => string;
  refreshLibraries: () => Promise<void>;
  settleEmptiedLibrary: (libraryId: string | null) => Promise<void>;
};

interface Window {
  JSZip: any;
  clipboardData: any;
}
