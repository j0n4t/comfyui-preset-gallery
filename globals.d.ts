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

interface Window {
  JSZip: any;
  clipboardData: any;
}
