/**
 * Cleans untrusted tool arguments before a call-line preview reads them.
 * Strips terminal controls, redacts secrets, drops timeout keys, and turns
 * arrays into dot-joined text. Does not choose which fields a tool shows.
 */

const ARGUMENT_KEY_MAX_LENGTH = 32;
const PREVIEW_STRING_SAFETY_CAP = 4096;
const HIDDEN_PREVIEW_KEY = /timeout/i;
const SENSITIVE_KEY_PATTERN =
  /(?:api[_-]?key|token|secret|passw(?:or)?d|authorization|bearer|cookie|credential)/i;
const SENSITIVE_VALUE_PATTERN =
  /(?:\b(?:sk|tvly|fc|ghp|xoxb|xapp)[-_][A-Za-z0-9_-]{12,}\b|\bgithub_pat_[A-Za-z0-9_]{12,}\b|\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b)/i;
const URL_KEY_PATTERN = /(?:^|[_-])(?:url|uri)$|(?:Url|URL|Uri|URI)$/;

export function truncatePreview(value: string, maxLength: number): string {
  const characters = Array.from(value);
  if (characters.length <= maxLength) return value;
  if (maxLength <= 1) return "…".slice(0, maxLength);
  return `${characters.slice(0, maxLength - 1).join("")}…`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripControls(value: string): string {
  return value
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -\/]*[@-~]/g, "")
    .replace(/\x1b[@-_]/g, "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ");
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function cleanPreviewText(value: string): string {
  return collapseWhitespace(stripControls(value));
}

function safeKey(value: string): string {
  return truncatePreview(cleanPreviewText(value), ARGUMENT_KEY_MAX_LENGTH) || "arg";
}

function sanitizeStructuredString(key: string, value: string): string {
  const urlLikeKey = URL_KEY_PATTERN.test(key);
  if (!urlLikeKey && !/^https?:\/\//i.test(value)) return value;
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    return `${parsed.host}${pathname}`;
  } catch {
    return urlLikeKey ? (value.split(/[?#]/, 1)[0] ?? value) : value;
  }
}

function sanitizeString(key: string, value: string): string {
  const cleaned = cleanPreviewText(sanitizeStructuredString(key, stripControls(value)));
  if (!cleaned) return "";
  if (SENSITIVE_VALUE_PATTERN.test(cleaned)) return "•••";
  return truncatePreview(cleaned, PREVIEW_STRING_SAFETY_CAP);
}

function stringifySanitized(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  if (!isRecord(value)) return "";
  return Object.entries(value)
    .map(([key, child]) => {
      const rendered = stringifySanitized(child);
      return rendered ? `${key}=${rendered}` : "";
    })
    .filter((part) => part.length > 0)
    .join(".");
}

function sanitizeValue(value: unknown, key: string): unknown {
  if (typeof value === "string") return sanitizeString(key, value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifySanitized(sanitizeValue(item, key)))
      .filter((part) => part.length > 0)
      .join(".");
  }
  if (isRecord(value)) return sanitizeRecord(value);
  return "";
}

function sanitizeRecord(
  value: Record<string, unknown>,
  fields?: ReadonlySet<string>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    if (fields && !fields.has(rawKey)) continue;
    if (HIDDEN_PREVIEW_KEY.test(rawKey)) continue;
    const key = safeKey(rawKey);
    sanitized[key] = SENSITIVE_KEY_PATTERN.test(rawKey) ? "•••" : sanitizeValue(rawValue, rawKey);
  }
  return sanitized;
}

/** Clean keys and string values, including nested ones. Arrays become `a.b.c`. */
export function sanitizePreviewArgs(
  args: unknown,
  fields?: readonly string[],
): Record<string, unknown> {
  if (!isRecord(args)) return {};
  const allowed = fields ? new Set(fields) : undefined;
  return sanitizeRecord(args, allowed);
}
