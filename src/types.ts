/**
 * Runtime config for tool-row drawing.
 * Only diff layout is configurable.
 * Result visibility is not a setting: edit and write are diffs, everything else is hidden.
 */
export const DIFF_VIEW_MODES = ["auto", "split", "unified"] as const;
export const DIFF_INDICATOR_MODES = ["bars", "classic", "none"] as const;
export const DIFF_COLLAPSED_MODES = ["body", "summary"] as const;
export const TOOL_DISPLAY_CONFIG_VERSION = 2 as const;

export type DiffViewMode = (typeof DIFF_VIEW_MODES)[number];
export type DiffIndicatorMode = (typeof DIFF_INDICATOR_MODES)[number];
export type DiffCollapsedMode = (typeof DIFF_COLLAPSED_MODES)[number];

/** Effective runtime configuration. Output groups are fixed, not stored here. */
export interface ToolDisplayConfig {
	/** Expanded diff row cap. Zero means no cap. Not a settings key; the popup sets 0. */
	expandedPreviewMaxRows: number;
	diffViewMode: DiffViewMode;
	diffIndicatorMode: DiffIndicatorMode;
	diffSplitMinWidth: number;
	diffCollapsedRows: number;
	diffCollapsedMode: DiffCollapsedMode;
	diffWordWrap: boolean;
}

export const DEFAULT_TOOL_DISPLAY_CONFIG: ToolDisplayConfig = {
	expandedPreviewMaxRows: 4000,
	diffViewMode: "auto",
	diffIndicatorMode: "bars",
	diffSplitMinWidth: 120,
	diffCollapsedRows: 24,
	diffCollapsedMode: "body",
	diffWordWrap: true,
};

export interface ConfigLoadResult {
	config: ToolDisplayConfig;
	error?: string;
	notice?: string;
}
