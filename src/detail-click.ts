/**
 * Opens the tool-call detail overlay from a plain left click.
 * Wraps drawers this package returns and insets those rows by 1 column.
 * Does not draw the popup or own Ctrl+O.
 */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  truncateToWidth,
  type Component,
  type TuiMouseEvent,
  type TuiMouseEventResult,
} from "@earendil-works/pi-tui";
import { openDetailViewer, type DetailRequest } from "./detail-viewer.js";
import type { ToolDisplayConfig } from "./types.js";

type ToolDetailRequest = Extract<DetailRequest, { kind: "tool" }>;

interface DetailRenderContext {
  args?: unknown;
  toolCallId?: string;
  isError?: boolean;
  isPartial?: boolean;
  durationMs?: number;
}

interface DetailRenderers {
  renderShell?: unknown;
  renderCall?: (
    args: unknown,
    theme: unknown,
    context?: DetailRenderContext,
  ) => unknown;
  renderResult?: (
    result: unknown,
    options: { isPartial?: boolean },
    theme: unknown,
    context?: DetailRenderContext,
  ) => unknown;
}

type DetailOpener = (request: ToolDetailRequest) => Promise<void>;

const snapshots = new Map<string, ToolDetailRequest>();
let opener: DetailOpener | undefined;
let viewerOpen = false;
const TOOL_RENDER_MARGIN = 1;

function isComponent(value: unknown): value is Component {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Component).render === "function"
  );
}

function isPlainLeftClick(event: TuiMouseEvent): boolean {
  return (
    event.type === "click" &&
    event.button === "left" &&
    !event.shift &&
    !event.ctrl &&
    !event.alt
  );
}

function isErrorResult(result: unknown): boolean {
  return (
    !!result &&
    typeof result === "object" &&
    (result as { isError?: unknown }).isError === true
  );
}

function timingFrom(
  context: DetailRenderContext | undefined,
): string | undefined {
  const durationMs = context?.durationMs;
  return typeof durationMs === "number" && Number.isFinite(durationMs)
    ? `${durationMs}ms`
    : undefined;
}

function statusFrom(
  context: DetailRenderContext | undefined,
  result: unknown,
  partial: boolean,
): string | undefined {
  if (context?.isError === true || isErrorResult(result)) return "error";
  if (result !== undefined && !partial) return "success";
  return undefined;
}

export function rememberToolSnapshot(
  toolCallId: string | undefined,
  request: ToolDetailRequest,
): void {
  if (!toolCallId) return;
  const previous = snapshots.get(toolCallId);
  snapshots.set(toolCallId, {
    kind: "tool",
    toolName: request.toolName,
    args: request.args !== undefined ? request.args : previous?.args,
    result: request.result !== undefined ? request.result : previous?.result,
    status: request.status ?? previous?.status,
    timing: request.timing ?? previous?.timing,
  });
}

export function bindDetailOpener(
  ctx: ExtensionContext,
  getConfig: () => ToolDisplayConfig,
): void {
  if (ctx?.hasUI === false || typeof ctx?.ui?.custom !== "function") {
    opener = undefined;
    return;
  }
  opener = async (request) => {
    await openDetailViewer(ctx, request, getConfig());
  };
}

export function clearDetailClickState(): void {
  opener = undefined;
  viewerOpen = false;
  snapshots.clear();
}

function openLatest(
  toolCallId: string | undefined,
  captured: ToolDetailRequest,
): void {
  if (viewerOpen || !opener) return;
  const request =
    (toolCallId ? snapshots.get(toolCallId) : undefined) ?? captured;
  const open = opener;
  viewerOpen = true;
  void open(request)
    .catch(() => {
      /* The UI may have closed with its session. */
    })
    .finally(() => {
      viewerOpen = false;
    });
}

function wrapComponent(
  child: unknown,
  toolCallId: string | undefined,
  captured: ToolDetailRequest,
): unknown {
  if (!isComponent(child)) return child;
  const wrapped: Component = {
    render(width) {
      if (width <= 0) return [];
      const contentWidth = Math.max(1, width - TOOL_RENDER_MARGIN * 2);
      const pad = " ".repeat(TOOL_RENDER_MARGIN);
      return child
        .render(contentWidth)
        .map((line) => truncateToWidth(`${pad}${line}`, width, ""));
    },
    invalidate() {
      child.invalidate?.();
    },
    handleMouse(event) {
      const childResult = child.handleMouse?.(event);
      if (childResult) return childResult;
      if (!isPlainLeftClick(event)) return undefined;
      openLatest(toolCallId, captured);
      return { handled: true } satisfies TuiMouseEventResult;
    },
  };
  return wrapped;
}

export function wrapDetailRenderers<T extends object>(
  toolName: string,
  renderers: T,
): T {
  const source = renderers as T & DetailRenderers;
  const wrapped = { ...renderers } as T & DetailRenderers;
  if (typeof source.renderCall === "function") {
    const renderCall = source.renderCall;
    wrapped.renderCall = (args, theme, context) => {
      const request: ToolDetailRequest = {
        kind: "tool",
        toolName,
        args,
        result: undefined,
        status: context?.isError === true ? "error" : undefined,
        timing: timingFrom(context),
      };
      rememberToolSnapshot(context?.toolCallId, request);
      return wrapComponent(
        renderCall.call(source, args, theme, context),
        context?.toolCallId,
        request,
      );
    };
  }
  if (typeof source.renderResult === "function") {
    const renderResult = source.renderResult;
    wrapped.renderResult = (result, options, theme, context) => {
      const partial =
        context?.isPartial === true || options?.isPartial === true;
      const request: ToolDetailRequest = {
        kind: "tool",
        toolName,
        args: context?.args,
        result,
        status: statusFrom(context, result, partial),
        timing: timingFrom(context),
      };
      rememberToolSnapshot(context?.toolCallId, request);
      return wrapComponent(
        renderResult.call(source, result, options, theme, context),
        context?.toolCallId,
        request,
      );
    };
  }
  return wrapped as T;
}
