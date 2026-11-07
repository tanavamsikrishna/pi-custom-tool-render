# Tool row drawing

This package draws every tool row. It does not change execution, parameter schemas, or prompt text. There is no aggregate Run ledger and no `/tools` command.

## Contract

`pi.registerToolRenderer` runs for every name, including built-ins and tools registered by other extensions. The resolver does not call `next()`. Pi's drawers and another extension's `renderCall` / `renderResult` are not used.

A plain left click on a call or result component opens the detail overlay. `Ctrl+O` still expands or collapses the inline row.

Settings are the `pi-custom-tool-render` key from `pi.getSettings()`. Only `diff` is read. `intent`, `results.mode`, `tools.custom`, and built-in ownership keys are ignored.

## Groups

```text
resolve(toolName):
  renderCall = name (argument preview)
  renderResult = edit or write ? diff : empty
```

`edit` uses `details.diff` from the tool result. `write` uses `content` from the call arguments and shows it as additions. A failed edit or write shows the error text instead of a successful diff. No other name has its own drawer.
