# Wiring custom tool rendering for any custom tool

How this package draws a tool it did not register. This is the individual-mode path. It does not change execution, the parameter schema, or aggregate's Run ledger. There is no aggregate mode in this package.

## Contract

Pi draws a call by asking `resolveToolRenderers(toolName, base)`. Resolvers run in extension load order. Each receives `(toolName, next)`. `next()` is the rest of the chain, then the registered tool's own `renderShell`, `renderCall`, and `renderResult`. The object returned to the widget is only those three fields. The same chain is used for HTML export.

Returning renderers without calling `next()` replaces the tool author's drawer, including a later extension's. `next() ?? mine` only fills a hole. Unknown names do not use that hole: they get the generic summary drawer.

`pi.getAllTools()` is not part of this path. It returns name, description, schema, and source. It does not return `execute` or the render functions, and mutating that copy does not change what Pi draws. Re-registering the same name does not replace the first registration.

## Decision

Register one resolver. Read config at draw time, not at registration, so a reload picks up `tools.custom` without wrapping `registerTool`. Settings are the config file only. There is no `/tools` command.

```text
resolve(toolName, next):
  if toolName is a built-in (read, grep, find, ls, bash, edit, write):
    return next()

  override = config.tools.custom[toolName]
  if override is set:
    return drawers(toolName, override.kind, override.mode)

  if name looks like an MCP tool:
    return drawers(toolName, "mcp", config.mcpOutputMode)

  return drawers(toolName, "generic", "summary")
```

`drawers` must not call `next()`. That is the whole override. Load order does not matter once this returns its own renderers.

Built-ins stay on their existing registration path. This resolver does not restyle `read` or `bash`.

A name with no `tools.custom` entry and no MCP shape uses generic/summary. That replaces an author line such as `Found 0 results`. List a name only to choose a different kind or mode.

## Drawers

```text
drawers(toolName, kind, outputMode):
  renderCall(args, theme, context):
    if kind is mcp:
      return formatMcpCallLine(toolName, label(toolName), args, theme, config, context)
    return formatGenericToolCallLine(toolName, args, theme, config, context)

  renderResult(result, options, theme, context):
    component = renderCustomToolResult(result, options, config, outputMode, theme, context)
    return applyToolResultStyle(component)

  renderShell:
    "self"
```

`renderShell: "self"` is what drops the green card. A custom `renderCall` inside the default shell is still the card.

`kind` is `generic` or `mcp`, already stored as `customToolOverrides`.

- `generic` draws `● name(key=value · ...)`. Values clip at 48 characters, the line at 120.
- `mcp` draws an argument count, not the values.
- `outputMode` is `hidden`, `summary`, or `preview`. `summary` is `↳ N lines returned • Ctrl+O to expand`. It replaces the author's result line. It does not keep `Found 0 results`.

`formatGenericToolCallLine` already appends `displaySummary` when the arguments contain it. This wiring does not add that field to another extension's schema, so the suffix stays absent for tools this extension does not own.

## MCP names without the tool object

The resolver receives a name, not the definition. Automatic MCP detection uses the name only:

```text
name is "mcp"
or name matches /^mcp[_-]/i
or name matches /_mcp$/i
```

A `tools.custom` entry does not need a tool-object lookup. The name is enough, and it wins over the automatic MCP rule.

The MCP extension's own resolver is `next() ?? createMcpToolRenderers(...)`. It fills in only when nobody else drew the call. Returning drawers here wins whether this extension loads before or after that resolver.

## What to stop doing

The registration interceptor and the `session_start` / `before_agent_start` discovery pass decorate copies. Leave them out of the drawing path. They cannot see another extension's `registerTool`, and the copies they do see are not the tools Pi executes.

There is no `decorateToolForDisplay` export. Nothing in this install called it. The resolver covers tools this package did not register.

## Non-goals

- Do not re-register the tool and do not hide it. Execution stays on the original registration.
- Do not change parameters, prompt guidelines, or `displaySummary`.
- Do not install an aggregate Run ledger.
