/**
 * Resolver decision tests for custom and MCP tool drawing.
 * Built-ins call next(). Every other name returns drawers and does not.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { ToolRenderers } from "@earendil-works/pi-coding-agent";
import {
	isMcpToolName,
	mcpCallLabel,
	resolveCustomToolRenderers,
} from "../src/custom-tool-resolver.ts";
import { formatGenericToolCallLine } from "../src/tool-overrides.ts";
import { DEFAULT_TOOL_DISPLAY_CONFIG, type ToolDisplayConfig } from "../src/types.ts";

const theme = {
	fg: (_color: string, text: string) => text,
	bold: (text: string) => text,
};

function config(overrides: Partial<ToolDisplayConfig> = {}): ToolDisplayConfig {
	return {
		...DEFAULT_TOOL_DISPLAY_CONFIG,
		customToolOverrides: {},
		...overrides,
	};
}

function rendered(component: { render(width: number): string[] } | undefined): string {
	return component?.render(120).join("\n") ?? "";
}

test("isMcpToolName matches only the wiring name shapes", () => {
	assert.equal(isMcpToolName("mcp"), true);
	assert.equal(isMcpToolName("mcp_foo"), true);
	assert.equal(isMcpToolName("mcp-foo"), true);
	assert.equal(isMcpToolName("foo_mcp"), true);
	assert.equal(isMcpToolName("mcp__docs__search"), true);
	assert.equal(isMcpToolName("memory_search"), false);
	assert.equal(isMcpToolName("web_search"), false);
	assert.equal(isMcpToolName("read"), false);
	assert.equal(isMcpToolName(""), false);
});

test("mcpCallLabel derives a display target from the name only", () => {
	assert.equal(mcpCallLabel("mcp"), "MCP Proxy");
	assert.equal(mcpCallLabel("mcp__docs__search"), "docs/search");
	assert.equal(mcpCallLabel("mcp_foo"), "mcp_foo");
	assert.equal(mcpCallLabel("foo_mcp"), "foo_mcp");
});

test("built-in names return next() and do not build drawers", () => {
	const author: ToolRenderers = { renderCall: () => "author" as never };
	let called = false;
	const resolved = resolveCustomToolRenderers("read", () => {
		called = true;
		return author;
	}, () => config());
	assert.equal(called, true);
	assert.equal(resolved, author);
});

test("tools.custom returns drawers and does not call next()", () => {
	const author: ToolRenderers = { renderCall: () => "author" as never };
	let called = false;
	const resolved = resolveCustomToolRenderers("web_search", () => {
		called = true;
		return author;
	}, () => config({
		customToolOverrides: { web_search: { kind: "generic", outputMode: "summary" } },
	}));
	assert.equal(called, false);
	assert.notEqual(resolved, author);
	assert.equal(resolved?.renderShell, "self");
	assert.equal(typeof resolved?.renderCall, "function");
	assert.equal(typeof resolved?.renderResult, "function");
});

test("MCP-shaped names take the MCP branch without an override", () => {
	for (const toolName of ["mcp", "mcp_foo", "mcp-foo", "foo_mcp", "mcp__docs__search"]) {
		const resolved = resolveCustomToolRenderers(toolName, () => {
			throw new Error(`next() called for ${toolName}`);
		}, () => config({ mcpOutputMode: "hidden" }));
		const text = rendered(resolved?.renderCall?.({ query: "secret-value" }, theme as never, {} as never) as { render(width: number): string[] });
		assert.equal(text.includes("secret-value"), false, toolName);
		assert.match(text, /1 arg/, toolName);
	}
});

test("names without an override or MCP shape use generic summary and do not call next()", () => {
	for (const toolName of ["memory_search", "web_search"]) {
		let called = false;
		const resolved = resolveCustomToolRenderers(toolName, () => {
			called = true;
			return { renderResult: () => "Found 0 results" as never };
		}, () => config());
		assert.equal(called, false, toolName);
		assert.equal(resolved?.renderShell, "self", toolName);
		const call = rendered(resolved?.renderCall?.({ query: "docs" }, theme as never, { executionStarted: false } as never) as { render(width: number): string[] });
		assert.match(call, /query=docs/, toolName);
		const result = rendered(resolved?.renderResult?.(
			{ content: [{ type: "text", text: "one\ntwo" }], details: undefined },
			{ expanded: false, isPartial: false },
			theme as never,
			{} as never,
		) as { render(width: number): string[] });
		assert.match(result, /2 lines returned/, toolName);
		assert.equal(result.includes("Found 0 results"), false, toolName);
	}
});

test("a custom entry wins over the MCP name rule", () => {
	const resolved = resolveCustomToolRenderers("mcp__docs__search", () => {
		throw new Error("next() called");
	}, () => config({
		customToolOverrides: {
			"mcp__docs__search": { kind: "generic", outputMode: "preview" },
		},
	}));
	const text = rendered(resolved?.renderCall?.({ query: "secret-value" }, theme as never, { executionStarted: false } as never) as { render(width: number): string[] });
	assert.match(text, /query=secret-value/);
	assert.equal(resolved?.renderShell, "self");
});

test("renderCall and renderResult read config after the resolver returns", () => {
	let outputMode: "hidden" | "summary" = "hidden";
	const getConfig = (): ToolDisplayConfig => config({
		customToolOverrides: { web_search: { kind: "generic", outputMode } },
	});
	const resolved = resolveCustomToolRenderers("web_search", () => undefined, getConfig);
	assert.equal(resolved?.renderShell, "self");
	const hidden = rendered(resolved?.renderResult?.(
		{ content: [{ type: "text", text: "one\ntwo" }], details: undefined },
		{ expanded: false, isPartial: false },
		theme as never,
		{} as never,
	) as { render(width: number): string[] });
	assert.equal(hidden.includes("2 lines returned"), false);
	outputMode = "summary";
	const call = rendered(resolved?.renderCall?.({ query: "docs" }, theme as never, { executionStarted: false } as never) as { render(width: number): string[] });
	assert.match(call, /query=docs/);
	const result = rendered(resolved?.renderResult?.(
		{ content: [{ type: "text", text: "one\ntwo" }], details: undefined },
		{ expanded: false, isPartial: false },
		theme as never,
		{} as never,
	) as { render(width: number): string[] });
	assert.match(result, /2 lines returned/);
});

test("formatGenericToolCallLine suffixes an existing displaySummary and does not invent one", () => {
	const displayConfig = config();
	const context = { executionStarted: false };
	const withSummary = rendered(formatGenericToolCallLine(
		"web_search",
		{ query: "docs", displaySummary: "Checking docs" },
		theme as never,
		displayConfig,
		context as never,
	) as { render(width: number): string[] });
	const withoutSummary = rendered(formatGenericToolCallLine(
		"web_search",
		{ query: "docs" },
		theme as never,
		displayConfig,
		context as never,
	) as { render(width: number): string[] });
	assert.match(withSummary, /Checking docs/);
	assert.equal(withoutSummary.includes("—"), false);
});
