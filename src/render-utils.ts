/**
 * Shared text helpers for tool rows and diffs.
 * Re-exports themed ANSI sanitizing, extracts tool text blocks, and pluralizes counts.
 */
import { sanitizeAnsiForThemedOutput } from "./ansi-utils.js";

export { sanitizeAnsiForThemedOutput };

interface TextLikeContent {
  type: string;
  text?: string;
}

interface ToolResultLike {
  content?: unknown;
}

export function extractTextOutput(result: ToolResultLike): string {
  const rawBlocks = Array.isArray(result.content) ? result.content : [];
  const blocks = rawBlocks.filter(
    (block): block is TextLikeContent =>
      typeof block === "object" &&
      block !== null &&
      "type" in block &&
      (block as TextLikeContent).type === "text" &&
      typeof (block as TextLikeContent).text === "string",
  );
  return blocks.map((block) => block.text ?? "").join("\n");
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return count === 1 ? singular : plural;
}
