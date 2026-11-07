/**
 * Per-tool call-line previews.
 * Arguments are sanitized first, including nested keys and strings. Each
 * preview then returns one string. edit and write only read the path, so
 * file bodies never enter the call line.
 * Built-in tools are a fixed table. registerToolArgumentPreview replaces one
 * until dispose. Unknown tools use the flat preview.
 */
import { sanitizePreviewArgs } from "./arg-sanitize.js";
import {
  type ArgumentPreviewContext,
  CUSTOM_ARGUMENT_PREVIEW_MAX_LENGTH,
  formatPreviewPath,
  formatSanitizedArgumentPreview,
  previewLimit,
  resolvePreviewContext,
  truncatePreview,
} from "./arg-preview.js";

export interface ToolArgumentPreview {
  /** When set, only these keys are sanitized and passed to format. */
  readonly fields?: readonly string[];
  format(
    args: Record<string, unknown>,
    context: ArgumentPreviewContext,
    maxLength: number,
  ): string | undefined;
}

const PATH_FIELDS = ["path", "file_path"] as const;
const READ_FIELDS = ["path", "file_path", "offset", "limit"] as const;
const overrides = new Map<string, ToolArgumentPreview>();

export function registerToolArgumentPreview(
  toolName: string,
  preview: ToolArgumentPreview,
): () => void {
  const previous = overrides.get(toolName);
  const hadPrevious = overrides.has(toolName);
  overrides.set(toolName, preview);
  return () => {
    if (overrides.get(toolName) !== preview) return;
    if (hadPrevious && previous) overrides.set(toolName, previous);
    else overrides.delete(toolName);
  };
}

function textField(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function pathField(args: Record<string, unknown>): string | undefined {
  return textField(args, "file_path") ?? textField(args, "path");
}

function integerField(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  return undefined;
}

/** `4-13` is a window, `4-` starts at a line, `1-10` is a count from the top. */
function readSpan(offset: number | undefined, limit: number | undefined): string | undefined {
  const start = offset !== undefined && offset >= 2 ? offset : undefined;
  const count = limit !== undefined && limit >= 0 ? limit : undefined;
  if (start === undefined && count === undefined) return undefined;
  const from = start ?? 1;
  if (count === undefined) return `${from}-`;
  if (count === 0) return `${from}+0`;
  return `${from}-${from + count - 1}`;
}

const pathOnly: ToolArgumentPreview = {
  fields: PATH_FIELDS,
  format(args, context, maxLength) {
    const file = pathField(args);
    if (!file) return undefined;
    return formatPreviewPath(file, context, maxLength);
  },
};

function formatSearch(
  args: Record<string, unknown>,
  context: ArgumentPreviewContext,
  maxLength: number,
): string | undefined {
  const pattern = textField(args, "pattern");
  const file = pathField(args);
  if (!pattern && !file) return undefined;
  if (!file) return truncatePreview(pattern ?? "", maxLength);
  const location = formatPreviewPath(file, context, maxLength);
  if (!pattern) return location;
  const suffix = ` in ${location}`;
  const suffixLength = Array.from(suffix).length;
  if (suffixLength >= maxLength) return truncatePreview(location, maxLength);
  return `${truncatePreview(pattern, maxLength - suffixLength)}${suffix}`;
}

const builtins: Record<string, ToolArgumentPreview> = {
  read: {
    fields: READ_FIELDS,
    format(args, context, maxLength) {
      const file = pathField(args);
      const span = readSpan(integerField(args, "offset"), integerField(args, "limit"));
      if (!file) return span;
      const location = formatPreviewPath(file, context, maxLength);
      if (!span) return location;
      const suffix = ` ${span}`;
      const suffixLength = Array.from(suffix).length;
      if (suffixLength >= maxLength) return truncatePreview(span, maxLength);
      return truncatePreview(location, maxLength - suffixLength) + suffix;
    },
  },
  edit: pathOnly,
  write: pathOnly,
  bash: {
    format(args, _context, maxLength) {
      const command = textField(args, "command");
      if (!command) return undefined;
      return truncatePreview(command, maxLength);
    },
  },
  grep: { format: formatSearch },
  find: { format: formatSearch },
  ls: {
    fields: PATH_FIELDS,
    format(args, context, maxLength) {
      const file = pathField(args);
      return file ? formatPreviewPath(file, context, maxLength) : ".";
    },
  },
};

export function formatToolArgumentPreview(
  toolName: string,
  args: unknown,
  context: Partial<ArgumentPreviewContext> = {},
  maxLength = CUSTOM_ARGUMENT_PREVIEW_MAX_LENGTH,
): string {
  const location = resolvePreviewContext(context);
  const limit = previewLimit(maxLength);
  const preview = overrides.get(toolName) ?? builtins[toolName];
  const sanitized = sanitizePreviewArgs(args, preview?.fields);
  const rendered = preview?.format(sanitized, location, limit);
  const text =
    rendered !== undefined && rendered.trim() !== ""
      ? rendered
      : formatSanitizedArgumentPreview(sanitized, limit);
  return truncatePreview(text, limit);
}
