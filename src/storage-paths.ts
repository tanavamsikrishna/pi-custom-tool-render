/**
 * Config and debug paths for this package.
 * The live file is extension-data/pi-custom-tool-render/config.json.
 * The upstream intent config is read once for seeding and never written.
 */
import { dirname, join } from "node:path";
import { resolvePiAgentDir } from "./agent-dir.js";

const PACKAGE_DATA_DIR = "pi-custom-tool-render";
const UPSTREAM_DATA_DIR = "pi-tool-display-intent";

export function getToolDisplayDataDir(agentDir = resolvePiAgentDir()): string {
	return join(agentDir, "extension-data", PACKAGE_DATA_DIR);
}

export function getUpstreamIntentConfigPath(agentDir = resolvePiAgentDir()): string {
	return join(agentDir, "extension-data", UPSTREAM_DATA_DIR, "config.json");
}

export function getToolDisplayConfigPath(agentDir = resolvePiAgentDir()): string {
	return join(getToolDisplayDataDir(agentDir), "config.json");
}

export function getLegacyToolDisplayConfigPath(agentDir = resolvePiAgentDir()): string {
	return join(agentDir, "extensions", "pi-tool-display-intent", "config.json");
}

export function getToolDisplayLegacyBackupPath(agentDir = resolvePiAgentDir()): string {
	return join(getToolDisplayDataDir(agentDir), "config.legacy.json");
}

export function getLegacyToolDisplayLegacyBackupPath(agentDir = resolvePiAgentDir()): string {
	return join(dirname(getLegacyToolDisplayConfigPath(agentDir)), "config.legacy.json");
}

export function getToolDisplayDebugLogPath(agentDir = resolvePiAgentDir()): string {
	return join(getToolDisplayDataDir(agentDir), "state", "debug.log");
}

export function getLegacyToolDisplayDebugLogPath(agentDir = resolvePiAgentDir()): string {
	return join(dirname(getLegacyToolDisplayConfigPath(agentDir)), "debug", "debug.log");
}
