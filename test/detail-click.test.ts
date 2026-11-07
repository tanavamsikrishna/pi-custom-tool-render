/**
 * Click-wrapper contract for the tool-call detail overlay.
 * No TUI. Confirms drawn rows open the viewer and no name falls through.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { Component, TuiMouseEvent } from "@earendil-works/pi-tui";
import { resolveToolRenderers } from "../src/custom-tool-resolver.ts";
import {
  bindDetailOpener,
  clearDetailClickState,
  wrapDetailRenderers,
} from "../src/detail-click.ts";
import type { DetailModel } from "../src/detail-viewer-model.ts";
import {
  DEFAULT_TOOL_DISPLAY_CONFIG,
  type ToolDisplayConfig,
} from "../src/types.ts";

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

function config(overrides: Partial<ToolDisplayConfig> = {}): ToolDisplayConfig {
  return {
    ...DEFAULT_TOOL_DISPLAY_CONFIG,
    ...overrides,
  };
}

function click(
  type: TuiMouseEvent["type"] = "click",
  extra: Partial<TuiMouseEvent> = {},
): TuiMouseEvent {
  return {
    type,
    button: type === "wheel" ? "none" : "left",
    x: 0,
    y: 0,
    screenX: 0,
    screenY: 0,
    width: 10,
    height: 1,
    shift: false,
    alt: false,
    ctrl: false,
    ...extra,
  };
}

function line(text: string): Component {
  return { render: () => [text], invalidate() {} };
}

test("render output matches the child and a later result is what the click opens", async () => {
  clearDetailClickState();
  const opened: DetailModel[] = [];
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  bindDetailOpener(
    {
      hasUI: true,
      mode: "tui",
      ui: {
        custom: (
          factory: (
            tui: unknown,
            theme: unknown,
            keybindings: unknown,
            done: () => void,
          ) => { model: DetailModel },
        ) => {
          opened.push(
            factory(
              { terminal: { rows: 24 }, requestRender() {} },
              theme,
              {},
              () => {},
            ).model,
          );
          return pending;
        },
      },
    } as never,
    () => config(),
  );

  const wrapped = wrapDetailRenderers("memory_search", {
    renderCall: (_args: unknown, _theme: unknown, _context?: unknown) =>
      line("query=docs"),
    renderResult: (
      _result: unknown,
      _options: unknown,
      _theme: unknown,
      _context?: unknown,
    ) => line("found it"),
  });
  const call = wrapped.renderCall?.({ query: "docs" }, theme, {
    toolCallId: "call-1",
    executionStarted: false,
  } as never) as Component;
  assert.equal(call.render(40).join("\n"), " query=docs");
  const result = wrapped.renderResult?.(
    { content: [{ type: "text", text: "found it" }], details: undefined },
    { expanded: false, isPartial: false },
    theme,
    {
      toolCallId: "call-1",
      args: { query: "docs" },
      isPartial: false,
      durationMs: 12,
    },
  ) as Component;
  assert.equal(result.render(40).join("\n"), " found it");

  const first = call.handleMouse?.(click());
  const second = call.handleMouse?.(click());
  assert.deepEqual(first, { handled: true });
  assert.deepEqual(second, { handled: true });
  assert.equal(opened.length, 1);
  assert.equal(opened[0]?.title, "memory_search");
  assert.match(
    opened[0]?.tabs.find((tab) => tab.id === "args")?.text ?? "",
    /docs/,
  );
  assert.match(
    opened[0]?.tabs.find((tab) => tab.id === "result")?.text ?? "",
    /found it/,
  );
  assert.equal(opened[0]?.timing, "12ms");
  release?.();
  await pending;
  clearDetailClickState();
});

test("a child-handled click is not stolen and wheel does not open", () => {
  clearDetailClickState();
  let opened = 0;
  bindDetailOpener(
    {
      hasUI: true,
      mode: "tui",
      ui: {
        custom: () => {
          opened += 1;
          return Promise.resolve();
        },
      },
    } as never,
    () => config(),
  );
  const handled = wrapDetailRenderers("bash", {
    renderCall: (_args: unknown, _theme: unknown, _context?: unknown) => ({
      render: () => ["child"],
      handleMouse: () => ({ handled: true, capture: true }),
    }),
  });
  const handledComponent = handled.renderCall?.({}, theme, {
    toolCallId: "call-2",
  }) as unknown as Component;
  assert.deepEqual(handledComponent.handleMouse?.(click()), {
    handled: true,
    capture: true,
  });
  const wheel = wrapDetailRenderers("bash", {
    renderCall: (_args: unknown, _theme: unknown, _context?: unknown) =>
      line("child"),
  });
  const wheelComponent = wheel.renderCall?.({}, theme, {
    toolCallId: "call-3",
  }) as Component;
  assert.equal(wheelComponent.handleMouse?.(click("wheel")), undefined);
  assert.equal(opened, 0);
  clearDetailClickState();
});

test("a missing opener does not throw", () => {
  clearDetailClickState();
  const wrapped = wrapDetailRenderers("read", {
    renderCall: (_args: unknown, _theme: unknown, _context?: unknown) =>
      line("read"),
  });
  const component = wrapped.renderCall?.({}, theme, {}) as Component;
  assert.deepEqual(component.handleMouse?.(click()), { handled: true });
  clearDetailClickState();
});

test("resolveToolRenderers draws read and generic rows without the host renderer", () => {
  clearDetailClickState();
  const read = resolveToolRenderers("read", () => config());
  const readText = (
    read.renderCall?.(
      { path: "a.ts" },
      theme as never,
      { executionStarted: false, cwd: "/proj" } as never,
    ) as Component
  )
    .render(120)
    .join("\n");
  assert.match(readText, /^ .*read \(\.\/a\.ts\)/);

  const generic = resolveToolRenderers("memory_search", () => config());
  const text = (
    generic.renderCall?.(
      { query: "docs" },
      theme as never,
      { executionStarted: false } as never,
    ) as Component
  )
    .render(120)
    .join("\n");
  assert.match(text, /^ .*memory_search \(query=docs\)/);
  const result = (
    generic.renderResult?.(
      {
        content: [{ type: "text", text: "host result" }],
      },
      { expanded: false, isPartial: false },
      theme as never,
      {} as never,
    ) as Component
  )
    .render(120)
    .join("\n");
  assert.equal(result.includes("host result"), false);
  clearDetailClickState();
});
