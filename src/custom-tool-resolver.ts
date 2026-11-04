/**
 * Chooses drawers for tools this package did not register.
 * Built-ins stay on next(). Overrides, MCP-shaped names, and every other
 * name replace the chain without calling next(). Unknown names use generic/summary.
 */
import type { ToolRenderers } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { applyToolResultStyle } from "./tool-call-style.js";
import { toRecord } from "./tool-metadata.js";
import {
	formatGenericToolCallLine,
	formatMcpCallLine,
	getRuntimeCustomToolOverride,
	renderCustomToolResult,
} from "./tool-overrides.js";
import {
	BUILT_IN_TOOL_OVERRIDE_NAMES,
	type CustomToolOutputMode,
	type ToolDisplayConfig,
} from "./types.js";

export function isMcpToolName(toolName: string): boolean {
	if (!toolName) return false;
	return toolName === "mcp" || /^mcp[_-]/i.test(toolName) || /_mcp$/i.test(toolName);
}

export function mcpCallLabel(toolName: string): string {
	if (toolName === "mcp") return "MCP Proxy";
	const parts = toolName.split("__");
	if (parts.length >= 3 && parts[0]?.toLowerCase() === "mcp") {
		return `${parts[1]}/${parts.slice(2).join("__")}`;
	}
	return toolName;
}

function isBuiltInToolName(toolName: string): boolean {
	return (BUILT_IN_TOOL_OVERRIDE_NAMES as readonly string[]).includes(toolName);
}

function liveOutputMode(
	toolName: string,
	kind: "generic" | "mcp",
	getConfig: () => ToolDisplayConfig,
): CustomToolOutputMode {
	const config = getConfig();
	const override = getRuntimeCustomToolOverride(toolName, config);
	if (override) return override.outputMode;
	if (kind === "mcp") return config.mcpOutputMode;
	return "summary";
}

function drawers(
	toolName: string,
	kind: "generic" | "mcp",
	getConfig: () => ToolDisplayConfig,
): ToolRenderers {
	return {
		renderShell: "self",
		renderCall(args, theme, context) {
			const config = getConfig();
			if (kind === "mcp") {
				return formatMcpCallLine(toolName, mcpCallLabel(toolName), toRecord(args), theme, config, context);
			}
			return formatGenericToolCallLine(toolName, args, theme, config, context);
		},
		renderResult(result, options, theme, context) {
			const config = getConfig();
			const component = renderCustomToolResult(
				result,
				options,
				config,
				liveOutputMode(toolName, kind, getConfig),
				theme,
				context,
			);
			return applyToolResultStyle(component) as Component;
		},
	};
}

export function resolveCustomToolRenderers(
	toolName: string,
	next: () => ToolRenderers | undefined,
	getConfig: () => ToolDisplayConfig,
): ToolRenderers | undefined {
	if (isBuiltInToolName(toolName)) return next();
	const override = getRuntimeCustomToolOverride(toolName, getConfig());
	if (override) return drawers(toolName, override.kind, getConfig);
	if (isMcpToolName(toolName)) return drawers(toolName, "mcp", getConfig);
	return drawers(toolName, "generic", getConfig);
}
