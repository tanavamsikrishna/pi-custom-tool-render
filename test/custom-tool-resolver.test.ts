/**
 * Every tool name is drawn here. next() is never called.
 * edit and write results are diffs. Every other result is empty.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolveToolRenderers } from "../src/custom-tool-resolver.ts";
import {
  DEFAULT_TOOL_DISPLAY_CONFIG,
  type ToolDisplayConfig,
} from "../src/types.ts";

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

function config(overrides: Partial<ToolDisplayConfig> = {}): ToolDisplayConfig {
  return { ...DEFAULT_TOOL_DISPLAY_CONFIG, ...overrides };
}

function rendered(
  component: { render(width: number): string[] } | undefined,
): string {
  return component?.render(120).join("\n") ?? "";
}

function callLine(
  toolName: string,
  args: unknown,
  context?: { cwd?: string },
): string {
  const resolved = resolveToolRenderers(toolName, () => config());
  return rendered(
    resolved.renderCall?.(
      args,
      theme as never,
      { executionStarted: false, ...context } as never,
    ) as { render(width: number): string[] },
  );
}

function resultLine(
  toolName: string,
  result: unknown,
  context?: unknown,
): string {
  const resolved = resolveToolRenderers(toolName, () => config());
  return rendered(
    resolved.renderResult?.(
      result,
      { expanded: false, isPartial: false },
      theme as never,
      context as never,
    ) as { render(width: number): string[] },
  );
}

test("no tool name falls through to next()", () => {
  for (const toolName of [
    "read",
    "bash",
    "edit",
    "write",
    "memory_search",
    "mcp__docs__search",
  ]) {
    const resolved = resolveToolRenderers(toolName, () => config());
    assert.equal(resolved.renderShell, "self", toolName);
    assert.equal(typeof resolved.renderCall, "function", toolName);
    assert.equal(typeof resolved.renderResult, "function", toolName);
  }
});

test("the call line is the tool name plus an argument preview", () => {
  const text = callLine("memory_search", { query: "docs" });
  assert.match(text, /^ .*memory_search \(query=docs\)/);
  assert.equal(text.includes("—"), false);
});

test("built-in call lines use the tool preview", () => {
  const cwd = "/proj";
  assert.match(
    callLine("read", { path: "/proj/src/a.ts", offset: 2 }, { cwd }),
    /read \(a\.ts src\/ 2-\)/,
  );
  assert.match(callLine("bash", { command: "ls -la", timeout: 5 }, { cwd }), /bash \(ls -la\)/);
  assert.equal(
    callLine("edit", { path: "/proj/src/a.ts", edits: [{ oldText: "secret", newText: "x" }] }, { cwd }).includes(
      "secret",
    ),
    false,
  );
});

test("non-diff tools hide the result body", () => {
  for (const toolName of ["read", "bash", "memory_search", "mcp"]) {
    const text = resultLine(toolName, {
      content: [{ type: "text", text: "Found 0 results" }],
      details: undefined,
    });
    assert.equal(text, "", toolName);
  }
});

test("edit renders the returned diff and write renders the written content", () => {
  const edit = resultLine(
    "edit",
    {
      content: [{ type: "text", text: "applied" }],
      details: {
        diff: "--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new\n",
      },
    },
    { args: { path: "file.ts" } },
  );
  assert.match(edit, /new/);
  assert.equal(edit.includes("applied"), false);

  const write = resultLine(
    "write",
    {
      content: [{ type: "text", text: "wrote" }],
      details: undefined,
    },
    { args: { path: "file.ts", content: "hello\n" } },
  );
  assert.match(write, /hello/);
  assert.equal(write.includes("wrote"), false);
});

test("a failed edit shows the error instead of a diff", () => {
  const text = resultLine(
    "edit",
    {
      isError: true,
      content: [{ type: "text", text: "patch did not match" }],
      details: {
        diff: "--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new\n",
      },
    },
    { args: { path: "file.ts" } },
  );
  assert.match(text, /patch did not match/);
  assert.equal(text.includes("+new"), false);
});
