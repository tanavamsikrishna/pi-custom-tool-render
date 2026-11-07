/**
 * Loads the pi-custom-tool-render settings object from pi.getSettings().
 * Reads intent and diff only. Other keys are ignored so older settings still load.
 * Does not read or write a config file.
 */
import { toRecord } from "./tool-metadata.js";
import {
	DEFAULT_TOOL_DISPLAY_CONFIG,
	DIFF_COLLAPSED_MODES,
	DIFF_INDICATOR_MODES,
	DIFF_VIEW_MODES,
	TOOL_DISPLAY_CONFIG_VERSION,
	type ConfigLoadResult,
	type DiffCollapsedMode,
	type DiffIndicatorMode,
	type DiffViewMode,
	type ToolDisplayConfig,
} from "./types.js";

const PI_CUSTOM_TOOL_RENDER_SETTINGS_KEY = "pi-custom-tool-render";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.floor(value)));
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
	return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function readDiff(source: Record<string, unknown>): Pick<
	ToolDisplayConfig,
	"diffViewMode" | "diffIndicatorMode" | "diffSplitMinWidth" | "diffCollapsedRows" | "diffCollapsedMode" | "diffWordWrap"
> {
	const nested = isRecord(source.diff) ? source.diff : {};
	return {
		diffViewMode: enumValue(
			nested.layout ?? source.diffViewMode,
			DIFF_VIEW_MODES,
			DEFAULT_TOOL_DISPLAY_CONFIG.diffViewMode,
		) as DiffViewMode,
		diffIndicatorMode: enumValue(
			nested.indicators ?? source.diffIndicatorMode,
			DIFF_INDICATOR_MODES,
			DEFAULT_TOOL_DISPLAY_CONFIG.diffIndicatorMode,
		) as DiffIndicatorMode,
		diffSplitMinWidth: clampNumber(
			nested.splitMinWidth ?? source.diffSplitMinWidth,
			70,
			240,
			DEFAULT_TOOL_DISPLAY_CONFIG.diffSplitMinWidth,
		),
		diffCollapsedRows: clampNumber(
			nested.collapsedRows ?? source.diffCollapsedRows ?? source.diffCollapsedLines,
			4,
			240,
			DEFAULT_TOOL_DISPLAY_CONFIG.diffCollapsedRows,
		),
		diffCollapsedMode: enumValue(
			nested.collapsedMode ?? source.diffCollapsedMode,
			DIFF_COLLAPSED_MODES,
			DEFAULT_TOOL_DISPLAY_CONFIG.diffCollapsedMode,
		) as DiffCollapsedMode,
		diffWordWrap: toBoolean(nested.wordWrap ?? source.diffWordWrap, DEFAULT_TOOL_DISPLAY_CONFIG.diffWordWrap),
	};
}

function readIntent(source: Record<string, unknown>): ToolDisplayConfig["toolIntent"] {
	const nested = isRecord(source.intent)
		? source.intent
		: isRecord(source.toolIntent)
			? source.toolIntent
			: isRecord(source.displaySummary)
				? source.displaySummary
				: {};
	return {
		maxLength: clampNumber(
			nested.maxLength,
			16,
			256,
			DEFAULT_TOOL_DISPLAY_CONFIG.toolIntent.maxLength,
		),
	};
}

export function loadToolDisplayConfigFromSettings(settings: unknown): ConfigLoadResult {
	if (!isRecord(settings)) {
		return { config: { ...DEFAULT_TOOL_DISPLAY_CONFIG }, error: "settings: expected object" };
	}
	const section = settings[PI_CUSTOM_TOOL_RENDER_SETTINGS_KEY];
	if (section === undefined) return { config: { ...DEFAULT_TOOL_DISPLAY_CONFIG } };
	if (!isRecord(section)) {
		return {
			config: { ...DEFAULT_TOOL_DISPLAY_CONFIG },
			error: `${PI_CUSTOM_TOOL_RENDER_SETTINGS_KEY}: expected object`,
		};
	}
	if (typeof section.version === "number" && section.version > TOOL_DISPLAY_CONFIG_VERSION) {
		return {
			config: { ...DEFAULT_TOOL_DISPLAY_CONFIG },
			error: `Unsupported tool display config version in settings.${PI_CUSTOM_TOOL_RENDER_SETTINGS_KEY}: ${String(section.version)}`,
		};
	}
	const source = toRecord(section);
	return {
		config: {
			toolIntent: readIntent(source),
			...readDiff(source),
		},
	};
}
