# Agent notes

Pi's own agent guidelines are `~/.pi/AGENTS.md`. `~/.pi` is a symlink to `~/repo/scripts/pi`. Read that file before changing Pi extension, theme, skill, or TUI behavior, and follow the doc paths it lists.

This package reads its settings from `pi.getSettings()`, under the `pi-custom-tool-render` key. That call throws until Pi binds the extension runtime, so do not call it from the factory before bind. The stored value is still the `pi-custom-tool-render` object in `~/.pi/agent/settings.json`.
