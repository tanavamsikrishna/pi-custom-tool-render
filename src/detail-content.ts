/**
 * Presentation helpers for the tool-call detail overlay.
 * Colors JSON and YAML with highlight.js core plus those two grammars.
 * Not a tool renderer. Does not load the rest of highlight.js.
 */
import hljs from "highlight.js/lib/core.js";
import json from "highlight.js/lib/languages/json.js";
import yaml from "highlight.js/lib/languages/yaml.js";
import {
  getMarkdownTheme,
  highlightCode,
} from "@earendil-works/pi-coding-agent";
import {
  Markdown,
  visibleWidth,
  wrapTextWithAnsi,
  type Component,
} from "@earendil-works/pi-tui";
import type { DetailDiffTheme } from "./detail-diff.js";
import type { DetailField } from "./detail-viewer-model.js";

hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);

const HIGHLIGHT_SCOPE: Record<string, string> = {
  attr: "syntaxVariable",
  string: "syntaxString",
  number: "syntaxNumber",
  literal: "syntaxKeyword",
  keyword: "syntaxKeyword",
  bullet: "syntaxKeyword",
  comment: "syntaxComment",
  meta: "muted",
  type: "syntaxType",
};

function decodeHighlightEntity(entity: string): string {
  if (entity === "amp") return "&";
  if (entity === "lt") return "<";
  if (entity === "gt") return ">";
  if (entity === "quot") return '"';
  if (entity === "#39" || entity.toLowerCase() === "#x27") return "'";
  if (entity[0] === "#") {
    const hex = entity[1] === "x" || entity[1] === "X";
    const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    if (Number.isFinite(code) && code >= 0 && code <= 0x10ffff)
      return String.fromCodePoint(code);
  }
  return `&${entity};`;
}

function paintHighlightChunk(
  theme: DetailDiffTheme,
  color: string | undefined,
  value: string,
): string {
  if (!color) return value;
  return value
    .split("\n")
    .map((line) => (line ? (theme.fg(color, line) ?? line) : line))
    .join("\n");
}

/** Map highlight.js spans onto the overlay theme. The caller rejects a text mismatch. */
function colorHighlightHtml(
  html: string,
  theme: DetailDiffTheme,
): { colored: string; plain: string } | undefined {
  let colored = "";
  let plain = "";
  let pending = "";
  let pendingColor: string | undefined;
  const scopes: string[] = [];
  const push = (chunk: string, color: string | undefined) => {
    if (!chunk) return;
    if (pending && color !== pendingColor) {
      colored += paintHighlightChunk(theme, pendingColor, pending);
      pending = "";
    }
    pendingColor = color;
    pending += chunk;
  };
  for (let index = 0; index < html.length; ) {
    if (html.startsWith("<span", index)) {
      const end = html.indexOf(">", index);
      if (end === -1) return undefined;
      const klass = /class="([^"]*)"/.exec(html.slice(index, end))?.[1] ?? "";
      scopes.push(
        klass
          .split(/\s+/)
          .find((name) => name.startsWith("hljs-"))
          ?.slice("hljs-".length) ?? "",
      );
      index = end + 1;
      continue;
    }
    if (html.startsWith("</span>", index)) {
      scopes.pop();
      index += "</span>".length;
      continue;
    }
    if (html[index] === "<") return undefined;
    let next = html.length;
    const tag = html.indexOf("<", index);
    const amp = html.indexOf("&", index);
    if (tag !== -1) next = tag;
    if (amp !== -1 && amp < next) next = amp;
    const color = [...scopes]
      .reverse()
      .map((scope) => HIGHLIGHT_SCOPE[scope])
      .find((slot) => slot !== undefined);
    if (next > index) {
      const chunk = html.slice(index, next);
      plain += chunk;
      push(chunk, color);
      index = next;
      continue;
    }
    const semi = html.indexOf(";", index);
    if (semi === -1 || semi - index > 16) return undefined;
    const decoded = decodeHighlightEntity(html.slice(index + 1, semi));
    plain += decoded;
    push(decoded, color);
    index = semi + 1;
  }
  if (pending) colored += paintHighlightChunk(theme, pendingColor, pending);
  return { colored, plain };
}

/** Coloring only. A grammar mismatch keeps the original characters. */
function colorHighlighted(
  text: string,
  language: "json" | "yaml",
  theme?: DetailDiffTheme,
): string {
  if (!theme) return text;
  try {
    const html = hljs.highlight(text, {
      language,
      ignoreIllegals: true,
    }).value;
    const rendered = colorHighlightHtml(html, theme);
    if (!rendered || rendered.plain !== text) return text;
    return rendered.colored;
  } catch {
    return text;
  }
}

/** Coloring only: the original JSON characters and whitespace are unchanged. */
export function colorDetailJson(text: string, theme?: DetailDiffTheme): string {
  return colorHighlighted(text, "json", theme);
}

/** Coloring only: the original YAML characters and whitespace are unchanged. */
export function colorDetailYaml(text: string, theme?: DetailDiffTheme): string {
  return colorHighlighted(text, "yaml", theme);
}

export function colorDetailCode(text: string, language: string): string {
  try {
    return highlightCode(text, language).join("\n");
  } catch {
    return text;
  }
}

/** ANSI-aware wrap with an explicit placeholder for an unrenderable wide grapheme. */
export function wrapDetailLine(text: string, width: number): string[] {
  const rows = wrapTextWithAnsi(text, Math.max(1, width));
  return rows.flatMap((row, index) => {
    if (
      row === "" &&
      index + 1 < rows.length &&
      visibleWidth(rows[index + 1]!) > width
    )
      return [];
    return [visibleWidth(row) > width ? "…" : row];
  });
}

export function layoutDetailFields(
  fields: readonly DetailField[],
  width: number,
  theme?: DetailDiffTheme,
): { rows: string[]; fieldByRow: number[]; firstRowByField: number[] } {
  if (width < 1 || !Number.isFinite(width))
    return { rows: [], fieldByRow: [], firstRowByField: [] };
  const keyWidth = Math.min(
    18,
    Math.max(
      0,
      ...fields.map((field) => visibleWidth(field.key.replace(/\s+/g, " "))),
    ),
  );
  const rows: string[] = [];
  const fieldByRow: number[] = [];
  const firstRowByField: number[] = [];
  let previousBlock = false;
  for (const [fieldIndex, field] of fields.entries()) {
    const start = rows.length;
    firstRowByField.push(start);
    const key = field.key.replace(/\s+/g, " ");
    const value =
      field.kind === "string" && field.value === "" ? '""' : field.value;
    const scalar =
      !field.language &&
      field.kind !== "json" &&
      !value.includes("\n") &&
      visibleWidth(key) <= keyWidth &&
      keyWidth + 2 + visibleWidth(value) <= width;
    if (rows.length > 0 && (!scalar || previousBlock)) rows.push("");
    if (scalar) {
      const label = key + " ".repeat(Math.max(0, keyWidth - visibleWidth(key)));
      const color =
        field.kind === "string"
          ? "syntaxString"
          : field.kind === "number"
            ? "syntaxNumber"
            : "syntaxKeyword";
      rows.push(
        `${theme?.fg("muted", label) ?? label}  ${theme?.fg(color, value) ?? value}`,
      );
    } else {
      rows.push(...wrapDetailLine(theme?.fg("muted", key) ?? key, width));
      const indent = width >= 4 ? "  " : "";
      const content = field.language
        ? colorDetailCode(value, field.language)
        : field.kind === "json"
          ? colorDetailJson(value, theme)
          : value;
      for (const line of wrapTextWithAnsi(
        content.replace(/\t/g, "    "),
        Number.MAX_SAFE_INTEGER,
      )) {
        rows.push(
          ...wrapDetailLine(line, width - indent.length).map(
            (row) => indent + row,
          ),
        );
      }
    }
    for (let index = start; index < rows.length; index++)
      fieldByRow.push(fieldIndex);
    previousBlock = !scalar;
  }
  return { rows, fieldByRow, firstRowByField };
}

export function renderDetailFields(
  fields: readonly DetailField[],
  width: number,
  theme?: DetailDiffTheme,
): string[] {
  return layoutDetailFields(fields, width, theme).rows;
}

/** Only our Markdown component is used, never a tool-owned renderer callback. */
export function createDetailMarkdown(text: string): Pick<Component, "render"> {
  let markdown: Markdown | undefined;
  try {
    markdown = new Markdown(text, 0, 0, getMarkdownTheme());
  } catch {
    /* An unbound theme falls back to source text. */
  }
  return {
    render(width) {
      try {
        if (markdown) return markdown.render(width);
      } catch {
        /* Preserve readable source if a Markdown block cannot render. */
      }
      return wrapTextWithAnsi(text, Math.max(1, width));
    },
  };
}
