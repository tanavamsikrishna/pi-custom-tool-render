/**
 * Settings-object loading for the pi-custom-tool-render key.
 * The extension reads pi.getSettings(), not a config file.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loadToolDisplayConfigFromSettings } from "../src/config-store.ts";

test("diff and intent settings are applied and obsolete result modes are ignored", () => {
	const loaded = loadToolDisplayConfigFromSettings({
		"pi-custom-tool-render": {
			version: 2,
			intent: { maxLength: 40 },
			toolCalls: { bashCommandPreviewRows: 2 },
			results: { mode: "hidden", previewRows: 4 },
			diff: { layout: "unified", collapsedRows: 8 },
		},
	});
	assert.equal(loaded.error, undefined);
	assert.equal(loaded.notice, undefined);
	assert.equal(loaded.config.diffViewMode, "unified");
	assert.equal(loaded.config.diffCollapsedRows, 8);
	assert.equal(loaded.config.toolIntent.maxLength, 40);
	assert.equal("resultMode" in loaded.config, false);
});

test("a missing key uses defaults", () => {
	const loaded = loadToolDisplayConfigFromSettings({ theme: "system" });
	assert.equal(loaded.error, undefined);
	assert.equal(loaded.config.diffViewMode, "auto");
	assert.equal(loaded.config.toolIntent.maxLength, 96);
});
