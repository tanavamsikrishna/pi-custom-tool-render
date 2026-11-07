/**
 * Splits write-tool file content into display lines.
 * A trailing empty line is dropped so the diff row count matches the written file.
 */
export function splitWriteContentLines(content: string): string[] {
  if (!content) {
    return [];
  }

  const normalized = content.replace(/\r/g, "");
  const lines = normalized.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}
