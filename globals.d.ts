/** Item structure stored in the preset cache. */
type PresetCacheItem = {
    preset?: string;
    filename?: string;
    __color__?: string;
}

/** Cache dictionary mapping preset keys to CacheItems. */
type PresetCache = Record<string, PresetCacheItem>;

/** State object tracking active rolls and occurrence counts during variant expansion. */
type RollState = {
    rolls: Record<string, string>;
    counts: Record<string, number>;
}

/** Parsed details of a variant template `{group:value}`. */
type ParsedVariant = {
    full: string;
    groupRaw: string;
    groupName: string;
    val: string;
}

/** Parsed details of a tag `<label:value>`. */
type ParsedTag = {
    label: string;
    val: string;
    isBoolean: boolean;
    isNumeric: boolean;
}

/** Matched preset key and cache item pair. */
type PresetMatch = {
    key: string;
    item?: PresetCacheItem;
}

/** Details extracted from chip string tokens. */
type ParsedChipDetails = {
    variants: ParsedVariant[];
    tag: ParsedTag | null;
    presetMatch: PresetMatch | null;
    trimmed: string;
}

/** Resolved segment metadata for composite chips. */
type PresetSegment = {
    title: string;
    filename: string | null;
}

/** Raw input segment data passed for chip grouping. */
type ChipGroupInput = {
    styleKey: string;
    item?: PresetCacheItem | null;
    startIndex: number;
    endIndex: number;
    subArray: string[];
}

/** Evaluated pure data structure of a chip (free of HTML strings). */
type ProcessedChip = {
    joinedStr: string;
    evalId: string;
    cleanLabel: string;
    bgImage: string | null;
    color: string;
    tooltipTitle: string;
    chipExpanded: string;
    item?: PresetCacheItem | null;
    startIndex: number;
    endIndex: number;
    weightVal: number | null;
    segmentedLabels: string[] | null;
    hasMoreVar: boolean;
    tag: ParsedTag | null;
}

/** Final rendered output object containing generated HTML markups. */
type RenderedChip = {
    joinedStr: string;
    evalId: string;
    cleanLabel: string;
    bgStyle: string;
    tooltipTitle: string;
    chipExpanded: string;
    item?: PresetCacheItem | null;
    startIndex: number;
    endIndex: number;
    inputHtml: string;
    weightIconHtml: string;
    segmentedLabels: string[] | null;
}

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
}

/** Search match result item. */
type SearchResult = {
    item: string;
    title: string;
}

/** Parsed Base64 Data URL result. */
type DataURLParseResult = {
    ext: string;
    base64: string;
}

// ============================================================================
// Utility types & = Module Exports
// ============================================================================

type IPresetLogic = {
    splitPresets(str: string): string[];
    getGroupMatches(groupName: string, cache?: Cache): string[];
    resolveVariantKey(groupName: string, val: string, cache?: Cache): string | null;
    expandRecursively(
        val: string,
        cache: Cache,
        seen?: Set<string>,
        rollState?: RollState | null
    ): string;
    parseChipDetails(text: string, cache?: Cache): ParsedChipDetails;
    resolvePresetSegment(
        token: string,
        cache?: Cache,
        variantRolls?: Record<string, string>,
        countsTracker?: Record<string, number>
    ): PresetSegment;
    parseBasketChip(
        chipData: ChipGroupInput,
        cache?: Cache,
        variantRolls?: Record<string, string>,
        chipRollState?: RollState
    ): ProcessedChip;
    getGroupedChips(activeList: string[], cache: Cache): ChipGroupInput[];
    findPresetMatch(text: string, cache?: Cache): PresetMatch | null;
    parseDataURL(dataUrl: string): DataURLParseResult | null;
    parseTokens(val: string, cache?: Cache | null, ignorePreset?: string | null): ParsedToken[];
    getMimeType(ext: string): string;
    toTitleCase(str: string): string;
    getHashColor(str: string): string;
    getAllPresetFolders(cache: Cache): string[];
    getPresetColor(presetKey?: string, cache?: Cache | null): string;
    getPresetBaseFolder(key: string): string;
    getPresetName(key: string): string;
    getPresetTitle(key: string, cache: Cache): string;
    getPresetInitials(key: string): string;
    getPresetFolder(key: string): string;
    getUiFolder(key: string): string;
    getSearchBlob(key: string, item?: PresetCacheItem): string;
    getTopMatches(
        list: string[],
        query: string,
        getSearchBlob?: (item: string) => string,
        cache?: Cache | null,
        ignorePreset?: string | null
    ): SearchResult[];
}

type IPresetDOM = {
    icons: Record<string, string>;
    escapeHTML(str: unknown): string;
    createThumbnail(dataUrl: string): Promise<string>;
    injectStyles(id: string, css: string): void;
    renderBasketChip(
        chipData: ChipGroupInput,
        cache?: Cache,
        variantRolls?: Record<string, string>,
        chipRollState?: RollState
    ): RenderedChip;
}
