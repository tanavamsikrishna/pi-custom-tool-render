/**
 * Call-line previews: sanitize first, then one string per tool.
 * edit and write show only the path. Arrays are dot-joined. Timeouts are omitted.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sanitizePreviewArgs } from "../src/arg-sanitize.ts";
import {
  ARGUMENT_PATH_MAX_LENGTH,
  CUSTOM_ARGUMENT_PREVIEW_MAX_LENGTH,
  formatPreviewPath,
} from "../src/arg-preview.ts";
import {
  formatToolArgumentPreview,
  registerToolArgumentPreview,
} from "../src/tool-argument-preview.ts";

const location = { cwd: "/proj", home: "/Users/vamsi" };

function preview(toolName: string, args: unknown): string {
  return formatToolArgumentPreview(toolName, args, location);
}

test("paths inside cwd show the relative path", () => {
  assert.equal(
    formatPreviewPath("/proj/src/arg-preview.ts", location),
    "./src/arg-preview.ts",
  );
  assert.equal(formatPreviewPath("/proj/README.md", location), "./README.md");
  assert.equal(formatPreviewPath("src/a.ts", location), "./src/a.ts");
  assert.equal(formatPreviewPath("/proj", location), ".");
  assert.equal(formatPreviewPath(".", location), ".");
  assert.equal(formatPreviewPath("/proj-other/a.ts", location), "/proj-other/a.ts");
});

test("paths inside home use ~ and paths outside home stay absolute", () => {
  assert.equal(
    formatPreviewPath("/Users/vamsi/.pi/agent/settings.json", location),
    "~/.pi/agent/settings.json",
  );
  assert.equal(formatPreviewPath("/Users/vamsi/notes.txt", location), "~/notes.txt");
  assert.equal(formatPreviewPath("/Users/vamsi", location), "~");
  assert.equal(formatPreviewPath("~/notes.txt", location), "~/notes.txt");
  assert.equal(
    formatPreviewPath("../../.pi/agent/settings.json", {
      cwd: "/Users/vamsi/repo/app",
      home: "/Users/vamsi",
    }),
    "~/.pi/agent/settings.json",
  );
  assert.equal(formatPreviewPath("/etc/hosts", location), "/etc/hosts");
});

test("a long path keeps its tail and is left-truncated", () => {
  const segments = Array.from({ length: 30 }, (_, index) => `s${String(index).padStart(2, "0")}`);
  const formatted = formatPreviewPath(`/proj/${segments.join("/")}/file.ts`, location);
  assert.equal(formatted.endsWith("/file.ts"), true);
  assert.equal(formatted.startsWith("…/"), true);
  assert.equal(formatted.includes("s00"), false);
  assert.ok(Array.from(formatted).length <= ARGUMENT_PATH_MAX_LENGTH);

  const homePath = `/Users/vamsi/${segments.join("/")}/file.ts`;
  const homeFormatted = formatPreviewPath(homePath, location);
  assert.equal(homeFormatted.startsWith("~/…/"), true);
  assert.equal(homeFormatted.endsWith("/file.ts"), true);
  assert.equal(homeFormatted.includes("s00"), false);
  assert.ok(Array.from(homeFormatted).length <= ARGUMENT_PATH_MAX_LENGTH);
});

test("an overlong path segment is left-truncated by character", () => {
  const name = "x".repeat(ARGUMENT_PATH_MAX_LENGTH + 12);
  const formatted = formatPreviewPath(`/proj/${name}`, location);
  assert.equal(formatted, `…${name.slice(-(ARGUMENT_PATH_MAX_LENGTH - 1))}`);
});

test("sanitizing walks nested keys and strings, drops timeouts, and dot-joins arrays", () => {
  const sanitized = sanitizePreviewArgs({
    query: "hi\x1b[31m there",
    timeout: 30,
    token: "visible",
    files: ["src", "test"],
    items: [{ id: 1 }, { id: 2 }],
    meta: {
      note: "https://user:pass@example.com/a/b?token=1",
      timeoutMs: 5,
      nested: { secret: "nope" },
    },
  });
  assert.equal(sanitized.query, "hi there");
  assert.equal("timeout" in sanitized, false);
  assert.equal(sanitized.token, "•••");
  assert.equal(sanitized.files, "src.test");
  assert.equal(sanitized.items, "id=1.id=2");
  const meta = sanitized.meta as { note: string; nested: { secret: string } };
  assert.equal(meta.note, "example.com/a/b");
  assert.equal("timeoutMs" in meta, false);
  assert.equal(meta.nested.secret, "•••");
});

test("edit and write only sanitize the path", () => {
  const args = {
    path: "/proj/src/a.ts",
    content: "secret body",
    edits: [{ oldText: "secret", newText: "next" }],
    timeout: 5,
  };
  assert.deepEqual(sanitizePreviewArgs(args, ["path", "file_path"]), {
    path: "/proj/src/a.ts",
  });
  assert.equal(preview("edit", args), "./src/a.ts");
  assert.equal(preview("write", args), "./src/a.ts");
  assert.equal(preview("edit", args).includes("secret"), false);
  assert.equal(preview("write", args).includes("secret"), false);
});

test("known tools render one sanitized string and never show timeouts", () => {
  assert.equal(preview("read", { path: "/proj/src/a.ts" }), "./src/a.ts");
  assert.equal(preview("read", { path: "/proj/src/a.ts", offset: 1 }), "./src/a.ts");
  assert.equal(preview("read", { path: "/proj/src/a.ts", offset: 4 }), "./src/a.ts 4-");
  assert.equal(preview("read", { path: "/proj/src/a.ts", limit: 10 }), "./src/a.ts 1-10");
  assert.equal(preview("read", { path: "/proj/src/a.ts", offset: 4, limit: 10 }), "./src/a.ts 4-13");
  assert.equal(preview("bash", { command: "ls -la", timeout: 30 }), "ls -la");
  assert.equal(preview("bash", { command: "ls\n-la" }), "ls -la");
  assert.equal(
    preview("bash", { command: "export TOKEN=sk-abcdefghijklmnopqrstuvwxyz" }),
    "•••",
  );
  assert.equal(preview("grep", { pattern: "foo", path: "/proj/src/a.ts", glob: "*.ts" }), "foo in ./src/a.ts");
  assert.equal(preview("grep", { pattern: "foo" }), "foo");
  assert.equal(preview("find", { pattern: "*.ts", path: "/etc" }), "*.ts in /etc");
  assert.equal(preview("ls", {}), ".");
  assert.equal(preview("ls", { path: "/proj/src" }), "./src");
  assert.equal(preview("custom", { files: ["a", "b"], timeout: 9 }), "files=a.b");
});

test("web_search shows only the sanitized query value", () => {
  assert.equal(
    preview("web_search", {
      query: "how does pi render tools",
      urls: ["https://example.com/a?token=1"],
    }),
    "how does pi render tools",
  );
  assert.equal(preview("web_search", { query: "docs" }), "docs");
  assert.equal(preview("web_search", { query: "hi\nthere" }), "hi there");
  assert.equal(
    preview("web_search", { query: "sk-abcdefghijklmnopqrstuvwxyz" }),
    "\u2022\u2022\u2022",
  );

  const query = "q".repeat(CUSTOM_ARGUMENT_PREVIEW_MAX_LENGTH + 12);
  const formatted = preview("web_search", { query });
  assert.equal(
    formatted,
    `${"q".repeat(CUSTOM_ARGUMENT_PREVIEW_MAX_LENGTH - 1)}\u2026`,
  );
  assert.ok(Array.from(formatted).length <= CUSTOM_ARGUMENT_PREVIEW_MAX_LENGTH);

  assert.equal(
    preview("web_search", { urls: ["https://example.com/a?token=1"] }),
    "urls=example.com/a",
  );
  assert.equal(
    preview("web_search", { query: "   ", urls: ["https://example.com/a"] }),
    "query=\"\" \u00b7 urls=example.com/a",
  );
  assert.equal(
    preview("web_search", { query: 1, urls: ["https://example.com"] }),
    "query=1 \u00b7 urls=example.com",
  );
  assert.equal(preview("mcp__x__web_search", { query: "docs" }), "query=docs");
});

test("a registered preview replaces the builtin and can be removed", () => {
  const dispose = registerToolArgumentPreview("read", {
    format: () => "special",
  });
  try {
    assert.equal(preview("read", { path: "/proj/a.ts" }), "special");
  } finally {
    dispose();
  }
  assert.equal(preview("read", { path: "/proj/a.ts" }), "./a.ts");
});
