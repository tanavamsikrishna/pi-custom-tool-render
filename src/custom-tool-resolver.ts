/**
 * Draws every tool row. Never calls next(), so Pi's own drawers are not used.
 * One call line for every name. edit and write results are diffs; every other result is empty.
 */
import type { ExtensionAPI, ToolRenderers, ToolRenderResultOptions } from "@earendil-works/pi-coding-agent";
import { Text, type Component } from "@earendil-works/pi-tui";
import { formatFlatArgumentPreview } from "./arg-preview.js";
import { wrapDetailRenderers } from "./detail-click.js";
import { renderEditDiffResult, renderWriteDiffResult } from "./diff-renderer.js";
import { getDisplaySummary } from "./display-summary.js";
import { extractTextOutput } from "./render-utils.js";
import { applyToolResultStyle, formatClaudeToolCall } from "./tool-call-style.js";
import { toRecord } from "./tool-metadata.js";
import type { ToolDisplayConfig } from "./types.js";

const DIFF_TOOL_NAMES = new Set(["edit", "write"]);

interface RenderTheme {
	fg(color: string, text: string): string;
	bold(text: string): string;
}

interface RenderContext {
	args?: unknown;
	isError?: boolean;
	isPartial?: boolean;
	executionStarted?: boolean;
}

function textField(value: unknown, field: string): string | undefined {
	const raw = toRecord(value)[field];
	return typeof raw === "string" ? raw : undefined;
}

function toolPath(args: unknown): string | undefined {
	return textField(args, "file_path") ?? textField(args, "path");
}

function isToolError(result: unknown, context?: RenderContext): boolean {
	return context?.isError === true || toRecord(result).isError === true;
}

function hiddenResult(): Text {
	return new Text("", 0, 0);
}

function errorResult(result: unknown, theme: RenderTheme, fallback: string): Component {
	const text = extractTextOutput(result as { content?: Array<{ type: string; text?: string }> }).trim() || fallback;
	return applyToolResultStyle(new Text(theme.fg("error", text), 0, 0), { theme }) as Component;
}

function renderDiffResult(
	toolName: string,
	result: unknown,
	options: ToolRenderResultOptions,
	theme: RenderTheme,
	context: RenderContext | undefined,
	config: ToolDisplayConfig,
): Component {
	if (isToolError(result, context)) {
		return errorResult(result, theme, toolName === "edit" ? "Edit failed." : "Write failed.");
	}

	const args = context?.args;
	const filePath = toolPath(args);
	const partial = options.isPartial === true || context?.isPartial === true;
	if (toolName === "write") {
		const content = textField(args, "content");
		if (typeof content !== "string") return hiddenResult();
		return renderWriteDiffResult(
			content,
			{ expanded: options.expanded, filePath, fileExistedBeforeWrite: false },
			config,
			theme,
			"",
		);
	}

	const details = toRecord(result).details;
	const diff = textField(details, "diff");
	if (partial && !diff?.trim()) return hiddenResult();
	return renderEditDiffResult(
		details,
		{ expanded: options.expanded, filePath },
		config,
		theme,
		"",
	);
}

export function resolveToolRenderers(
	toolName: string,
	getConfig: () => ToolDisplayConfig,
): ToolRenderers {
	return wrapDetailRenderers(toolName, {
		renderShell: "self",
		renderCall(args, theme, context) {
			const config = getConfig();
			const summary = getDisplaySummary(args, config.toolIntent.maxLength);
			const intentSuffix = summary
				? `${theme.fg("muted", " — ")}${theme.fg("accent", summary)}`
				: "";
			const line = formatClaudeToolCall(
				toolName,
				theme.fg("muted", formatFlatArgumentPreview(args)),
				"",
				intentSuffix,
				theme,
				context,
			);
			return new Text(line, 0, 0);
		},
		renderResult(result, options, theme, context) {
			if (!DIFF_TOOL_NAMES.has(toolName)) return hiddenResult();
			return renderDiffResult(toolName, result, options, theme, context, getConfig());
		},
	});
}

export function registerToolRenderers(
	pi: ExtensionAPI,
	getConfig: () => ToolDisplayConfig,
): void {
	pi.registerToolRenderer((toolName) => resolveToolRenderers(toolName, getConfig));
}
