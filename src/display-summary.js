/**
 * Reads or strips an existing displaySummary argument.
 * Does not add that field to a tool schema.
 */
export const DISPLAY_SUMMARY_FIELD = "displaySummary";
export const DEFAULT_DISPLAY_SUMMARY_MAX_LENGTH = 96;

const OSC_PATTERN = /\x1b\][^\x07]*(?:\x07|\x1b\\)/g;
const CSI_PATTERN = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const ESCAPE_PATTERN = /\x1b[@-_]/g;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clampMaxLength(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_DISPLAY_SUMMARY_MAX_LENGTH;
  }
  return Math.min(256, Math.max(16, Math.floor(value)));
}

export function normalizeDisplaySummary(value, maxLength = DEFAULT_DISPLAY_SUMMARY_MAX_LENGTH) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value
    .replace(OSC_PATTERN, "")
    .replace(CSI_PATTERN, "")
    .replace(ESCAPE_PATTERN, "")
    .replace(CONTROL_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, clampMaxLength(maxLength));
}

export function getDisplaySummary(args, maxLength = DEFAULT_DISPLAY_SUMMARY_MAX_LENGTH) {
  return isRecord(args)
    ? normalizeDisplaySummary(args[DISPLAY_SUMMARY_FIELD], maxLength)
    : undefined;
}

export function stripDisplaySummary(args) {
  if (!isRecord(args) || !Object.prototype.hasOwnProperty.call(args, DISPLAY_SUMMARY_FIELD)) {
    return args;
  }

  const { [DISPLAY_SUMMARY_FIELD]: _displaySummary, ...toolArgs } = args;
  return toolArgs;
}
