/**
 * Call-line previews: sanitize first, then one string per tool.
 * edit and write show only the path. Arrays are dot-joined. Timeouts are omitted.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sanitizePreviewArgs } from "../src/arg-sanitize.ts";
import {
  ARGUMENT_PARENT_PATH_MAX_LENGTH,
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

function parentOf(formatted: string): string {
  const splitAt = formatted.indexOf(" ");
  return splitAt < 0 ? "" : formatted.slice(splitAt + 1);
}

test("paths inside cwd show the basename and the relative parent", () => {
  assert.equal(
    formatPreviewPath("/proj/src/arg-preview.ts", location),
    "arg-preview.ts src/",
  );
  assert.equal(formatPreviewPath("/proj/README.md", location), "README.md ./");
  assert.equal(formatPreviewPath("src/a.ts", location), "a.ts src/");
  assert.equal(formatPreviewPath("/proj", location), ".");
  assert.equal(formatPreviewPath(".", location), ".");
});

test("paths inside home use ~ and paths outside home stay absolute", () => {
  assert.equal(
    formatPreviewPath("/Users/vamsi/.pi/agent/settings.json", location),
    "settings.json ~/.pi/agent/",
  );
  assert.equal(formatPreviewPath("/Users/vamsi/notes.txt", location), "notes.txt ~/");
  assert.equal(formatPreviewPath("/Users/vamsi", location), "~");
  assert.equal(formatPreviewPath("~/notes.txt", location), "notes.txt ~/");
  assert.equal(
    formatPreviewPath("../../.pi/agent/settings.json", {
      cwd: "/Users/vamsi/repo/app",
      home: "/Users/vamsi",
    }),
    "settings.json ~/.pi/agent/",
  );
  assert.equal(formatPreviewPath("/etc/hosts", location), "hosts /etc/");
});

test("a long parent path keeps its tail and is left-truncated", () => {
  const segments = Array.from({ length: 14 }, (_, index) => `s${String(index).padStart(2, "0")}`);
  const formatted = formatPreviewPath(`/proj/${segments.join("/")}/file.ts`, location);
  const parent = parentOf(formatted);
  assert.equal(formatted.startsWith("file.ts "), true);
  assert.equal(parent.startsWith("…/"), true);
  assert.equal(parent.endsWith("s13/"), true);
  assert.equal(parent.includes("s00"), false);
  assert.ok(Array.from(parent).length <= ARGUMENT_PARENT_PATH_MAX_LENGTH);

  const homePath = `/Users/vamsi/${segments.join("/")}/file.ts`;
  const homeParent = parentOf(formatPreviewPath(homePath, location));
  assert.equal(homeParent.startsWith("~/…/"), true);
  assert.equal(homeParent.endsWith("s13/"), true);
  assert.equal(homeParent.includes("s00"), false);
  assert.ok(Array.from(homeParent).length <= ARGUMENT_PARENT_PATH_MAX_LENGTH);
});

test("a single overlong parent segment is left-truncated by character", () => {
  const formatted = formatPreviewPath(`/proj/${"x".repeat(60)}/file.ts`, location);
  assert.equal(formatted, `file.ts …${"x".repeat(46)}/`);
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
  assert.equal(preview("edit", args), "a.ts src/");
  assert.equal(preview("write", args), "a.ts src/");
  assert.equal(preview("edit", args).includes("secret"), false);
  assert.equal(preview("write", args).includes("secret"), false);
});

test("known tools render one sanitized string and never show timeouts", () => {
  assert.equal(preview("read", { path: "/proj/src/a.ts" }), "a.ts src/");
  assert.equal(preview("read", { path: "/proj/src/a.ts", offset: 1 }), "a.ts src/");
  assert.equal(preview("read", { path: "/proj/src/a.ts", offset: 4 }), "a.ts src/ 4-");
  assert.equal(preview("read", { path: "/proj/src/a.ts", limit: 10 }), "a.ts src/ 1-10");
  assert.equal(preview("read", { path: "/proj/src/a.ts", offset: 4, limit: 10 }), "a.ts src/ 4-13");
  assert.equal(preview("bash", { command: "ls -la", timeout: 30 }), "ls -la");
  assert.equal(preview("bash", { command: "ls\n-la" }), "ls -la");
  assert.equal(
    preview("bash", { command: "export TOKEN=sk-abcdefghijklmnopqrstuvwxyz" }),
    "•••",
  );
  assert.equal(preview("grep", { pattern: "foo", path: "/proj/src/a.ts", glob: "*.ts" }), "foo in a.ts src/");
  assert.equal(preview("grep", { pattern: "foo" }), "foo");
  assert.equal(preview("find", { pattern: "*.ts", path: "/etc" }), "*.ts in etc /");
  assert.equal(preview("ls", {}), ".");
  assert.equal(preview("ls", { path: "/proj/src" }), "src ./");
  assert.equal(preview("custom", { files: ["a", "b"], timeout: 9 }), "files=a.b");
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
  assert.equal(preview("read", { path: "/proj/a.ts" }), "a.ts ./");
});
