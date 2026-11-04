# pi-custom-tool-render

Individual tool rendering for Pi, forked from `@zhcsyncer/pi-tool-display-intent` 0.10.1. Built-in rows, diffs, bash intent, and the accent-gutter user message box stay. There is no aggregate Run ledger and no `/tools` command.

Do not load this package together with `npm:@zhcsyncer/pi-tool-display-intent`. The first registration of each built-in name wins.

## Install

Disable the upstream package, then load this directory with `pi install` or `pi -e`. Restart Pi or run `/reload`. This repository does not edit `~/.pi/agent/settings.json`.

## Use

Settings live only in `~/.pi/agent/extension-data/pi-custom-tool-render/config.json`. Edit that file, then `/reload`. On first load, if that file is missing, settings are seeded from `extension-data/pi-tool-display-intent/config.json`. Aggregate-only keys are dropped. The original file is not written.

A name that is not a built-in and is not MCP-shaped uses the generic drawer with `summary` results. Memory tools do not need a `tools.custom` entry. That drawer replaces the author's result line, including `Found 0 results`.

`tools.custom` is an override. `renderer` is `generic` or `mcp`. `mode` is `hidden`, `summary`, or `preview`. A listed name wins over both the generic fallback and the MCP name rule.

```json
{
  "version": 2,
  "results": { "mode": "summary" },
  "tools": {
    "custom": {
      "web_search": { "renderer": "generic", "mode": "preview" }
    }
  }
}
```

Automatic MCP names (`mcp`, `mcp_*`, `mcp-*`, `*_mcp`, including `mcp__server__tool`) use the MCP drawer without a `tools.custom` entry. The call line shows an argument count, not values. Result visibility follows `results.mode`: `compact` hides the body, `summary` and `preview` follow. A `tools.custom` entry's `mode` is the result override. The call line still renders when the result is hidden.

`displaySummary` is appended only when the arguments already contain it. This package does not add that field to another extension's schema.

## License

MIT. See `LICENSE` and `UPSTREAM_LICENSE`.
