/**
 * Formats tool-call arguments for a call line.
 * Path display is `<basename> <parent/>`. The flat fallback is `key=value · key=value`.
 * Does not clean untrusted input; that is arg-sanitize.
 */
import os from "node:os";
import path from "node:path";
import { cleanPreviewText, sanitizePreviewArgs, truncatePreview } from "./arg-sanitize.js";

export const CUSTOM_ARGUMENT_PREVIEW_MAX_LENGTH = 120;
export const ARGUMENT_PARENT_PATH_MAX_LENGTH = 48;
const SIMPLE_VALUE_PATTERN = /^[A-Za-z0-9_./:@+-]+$/;

export interface ArgumentPreviewContext {
  cwd: string;
  home: string;
}

export { truncatePreview } from "./arg-sanitize.js";

export function previewLimit(maxLength: number): number {
  return Number.isFinite(maxLength)
    ? Math.max(1, Math.floor(maxLength))
    : CUSTOM_ARGUMENT_PREVIEW_MAX_LENGTH;
}

export function resolvePreviewContext(
  context: Partial<ArgumentPreviewContext> = {},
): ArgumentPreviewContext {
  const cwd = context.cwd?.trim() ? context.cwd : process.cwd();
  const home = context.home?.trim() ? context.home : os.homedir();
  return { cwd: path.resolve(cwd), home: path.resolve(home) };
}

function leftTruncatePath(value: string, maxLength: number): string {
  if (Array.from(value).length <= maxLength) return value;
  if (maxLength <= 1) return "…".slice(0, maxLength);

  const home = value.startsWith("~");
  const body = home ? value.slice(1) : value;
  const parts = body.split("/").filter((segment) => segment.length > 0);
  let kept: string[] = [];
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const next = [parts[index], ...kept];
    if (Array.from(`…/${next.join("/")}`).length > maxLength) break;
    kept = next;
  }

  if (kept.length === 0) {
    const segment = parts[parts.length - 1] ?? value;
    const characters = Array.from(segment);
    if (characters.length <= maxLength) return segment;
    if (maxLength <= 1) return "…".slice(0, maxLength);
    return `…${characters.slice(characters.length - (maxLength - 1)).join("")}`;
  }

  const tail = `…/${kept.join("/")}`;
  if (home && Array.from(`~/${tail}`).length <= maxLength) return `~/${tail}`;
  return tail;
}

function formatParent(resolved: string, cwd: string, home: string): string {
  const parent = path.dirname(resolved);
  const fromCwd = path.relative(cwd, resolved);
  const inCwd =
    fromCwd === "" ||
    (fromCwd !== ".." && !fromCwd.startsWith(`..${path.sep}`) && !path.isAbsolute(fromCwd));
  if (inCwd) {
    const relative = path.relative(cwd, parent);
    return relative === "" ? "." : relative.split(path.sep).join("/");
  }

  const fromHome = path.relative(home, resolved);
  const inHome =
    fromHome === "" ||
    (fromHome !== ".." && !fromHome.startsWith(`..${path.sep}`) && !path.isAbsolute(fromHome));
  if (inHome) {
    const relative = path.relative(home, parent);
    return relative === "" ? "~" : `~/${relative.split(path.sep).join("/")}`;
  }
  return parent.split(path.sep).join("/");
}

export function formatPreviewPath(
  raw: string,
  location: ArgumentPreviewContext,
  maxLength = CUSTOM_ARGUMENT_PREVIEW_MAX_LENGTH,
): string {
  if (raw === "•••") return "•••";
  const cleaned = cleanPreviewText(raw);
  if (!cleaned) return "";

  const cwd = path.resolve(location.cwd);
  const home = path.resolve(location.home);
  const expanded =
    cleaned === "~" ? home : cleaned.startsWith("~/") ? path.join(home, cleaned.slice(2)) : cleaned;
  const resolved = path.resolve(cwd, expanded);
  if (resolved === cwd) return ".";
  if (resolved === home) return "~";
  if (resolved === path.parse(resolved).root) return resolved;

  const base = path.basename(resolved);
  const parentLimit = Math.min(ARGUMENT_PARENT_PATH_MAX_LENGTH, maxLength);
  const rawParent = formatParent(resolved, cwd, home);
  const budget = rawParent.endsWith("/") ? parentLimit : Math.max(0, parentLimit - 1);
  const shortened = leftTruncatePath(rawParent, budget);
  const parent = shortened.endsWith("/") ? shortened : `${shortened}/`;
  const room = maxLength - Array.from(parent).length - 1;
  if (room < 1) return truncatePreview(parent, maxLength);
  return truncatePreview(base, room) + " " + parent;
}

export function formatFlatArgumentPreview(
  args: unknown,
  maxLength = CUSTOM_ARGUMENT_PREVIEW_MAX_LENGTH,
): string {
  return formatSanitizedArgumentPreview(sanitizePreviewArgs(args), maxLength);
}

export function formatSanitizedArgumentPreview(
  args: Record<string, unknown>,
  maxLength = CUSTOM_ARGUMENT_PREVIEW_MAX_LENGTH,
): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "no args";
  return truncatePreview(
    entries
      .map(([key, value]) => {
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          return Object.keys(value).length === 0 ? `${key}{}` : `${key}{…}`;
        }
        if (typeof value === "number" || typeof value === "boolean" || value === null) {
          return `${key}=${String(value)}`;
        }
        const text = typeof value === "string" ? value : "";
        const shown =
          text === "•••" || (text.length > 0 && SIMPLE_VALUE_PATTERN.test(text))
            ? text
            : JSON.stringify(text);
        return `${key}=${shown}`;
      })
      .join(" · "),
    previewLimit(maxLength),
  );
}
