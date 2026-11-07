# pi-custom-tool-render

Individual tool rendering for Pi, forked from `@zhcsyncer/pi-tool-display-intent` 0.10.1. This package draws every tool row. `edit` and `write` results are diffs. Every other result is hidden. The accent-gutter user message box stays. There is no aggregate Run ledger and no `/tools` command. A plain click on a row opens the detail overlay. `Ctrl+O` still expands or collapses that row inline.

Do not load this package together with `npm:@zhcsyncer/pi-tool-display-intent`.

## Install

Disable the upstream package, then load this directory with `pi install` or `pi -e`. Restart Pi or run `/reload`. This repository does not edit `~/.pi/agent/settings.json`.

## Use

Settings are the `pi-custom-tool-render` key from `pi.getSettings()`. That value is stored in `~/.pi/agent/settings.json`. Edit it, then `/reload`. `getSettings()` throws until Pi binds the extension runtime. The old `extension-data/pi-custom-tool-render/config.json` is not read.

Every name uses the same call line: `name (args)`. `edit` and `write` then show a diff. Every other tool, including built-ins, MCP tools, and other extensions, shows no result body. Pi's own drawers are not used. Older `results.mode` and `tools.custom` keys are ignored.

```json
{
  "version": 2,
  "diff": { "layout": "auto" }
}
```

## License

MIT. See `LICENSE` and `UPSTREAM_LICENSE`.
