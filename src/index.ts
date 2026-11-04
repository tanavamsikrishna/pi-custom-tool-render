/**
 * Individual tool-display extension.
 * Owns built-in rows and the custom-tool renderer resolver.
 * Settings live in the config file. There is no /tools command and no aggregate Run ledger.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadToolDisplayConfig } from "./config-store.js";
import {
  applyCapabilityConfigGuards,
  detectToolDisplayCapabilities,
  type ToolDisplayCapabilities,
} from "./capabilities.js";
import { registerToolDisplayOverrides } from "./tool-overrides.js";
import { disposeAll, resetDisposed } from "./disposable.js";
import registerNativeUserMessageBox from "./user-message-box-native.js";
import type { ToolDisplayConfig } from "./types.js";

export function publishToolDisplayMigrationNotice(
  ui: {
    setStatus(key: string, text: string | undefined): void;
    notify?(message: string, level: "warning"): void;
  },
  notice: string | undefined,
): void {
  if (!notice) return;
  ui.setStatus("tool-display-intent-migration", undefined);
  if (typeof ui.notify === "function") {
    ui.notify(notice, "warning");
    return;
  }
  ui.setStatus("tool-display-intent-migration", notice);
}

export default function toolDisplayExtension(pi: ExtensionAPI): void {
  const initial = loadToolDisplayConfig();
  resetDisposed();

  pi.on("session_shutdown", (event: { reason: string }) => {
    if (event.reason === "reload") {
      disposeAll();
    }
  });

  const config: ToolDisplayConfig = initial.config;
  let pendingLoadError = initial.error;
  let pendingLoadNotice = initial.notice;
  let capabilities: ToolDisplayCapabilities = {
    hasRtkOptimizer: false,
  };

  const refreshCapabilities = (): void => {
    capabilities = detectToolDisplayCapabilities(pi, process.cwd());
  };

  const getEffectiveConfig = (): ToolDisplayConfig =>
    applyCapabilityConfigGuards(config, capabilities);

  registerToolDisplayOverrides(pi, getEffectiveConfig);
  registerNativeUserMessageBox(pi, () => config);

  pi.on("session_start", async (_event, ctx) => {
    refreshCapabilities();
    if (pendingLoadError) {
      ctx.ui.notify(pendingLoadError, "warning");
      pendingLoadError = undefined;
    }
    if (pendingLoadNotice) {
      publishToolDisplayMigrationNotice(ctx.ui, pendingLoadNotice);
      pendingLoadNotice = undefined;
    }
  });

  pi.on("before_agent_start", async () => {
    refreshCapabilities();
  });
}
