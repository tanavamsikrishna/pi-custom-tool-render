/**
 * Individual tool-display extension.
 * Draws every tool row: edit and write are diffs, every other result is hidden.
 * Settings are the pi-custom-tool-render key from pi.getSettings().
 * There is no /tools command and no aggregate Run ledger.
 * Session events bind the tool-call detail overlay.
 */
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { loadToolDisplayConfigFromSettings } from "./config-store.js";
import { registerToolRenderers } from "./custom-tool-resolver.js";
import { bindDetailOpener, clearDetailClickState } from "./detail-click.js";
import { disposeAll, registerCleanup, resetDisposed } from "./disposable.js";
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

const NOT_INITIALIZED = "Extension runtime not initialized";

export default function toolDisplayExtension(pi: ExtensionAPI): void {
  resetDisposed();
  registerCleanup(clearDetailClickState);

  pi.on("session_shutdown", (event: { reason: string }) => {
    clearDetailClickState();
    if (event.reason === "reload") {
      disposeAll();
    }
  });

  let loaded: { config: ToolDisplayConfig; error?: string; notice?: string } = {
    config: loadToolDisplayConfigFromSettings({}).config,
  };
  let settingsReady = false;
  let pendingLoadError: string | undefined;
  let pendingLoadNotice: string | undefined;

  const refreshFromSettings = (): void => {
    try {
      loaded = loadToolDisplayConfigFromSettings(pi.getSettings());
      settingsReady = true;
      pendingLoadError = loaded.error;
      pendingLoadNotice = loaded.notice;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!settingsReady && message.includes(NOT_INITIALIZED)) return;
      pendingLoadError = message;
    }
  };

  const getEffectiveConfig = (): ToolDisplayConfig => {
    refreshFromSettings();
    return loaded.config;
  };

  registerToolRenderers(pi, getEffectiveConfig);
  registerNativeUserMessageBox(pi);

  const bindOverlay = (ctx: ExtensionContext): void => {
    bindDetailOpener(ctx, getEffectiveConfig);
  };

  pi.on("session_start", async (_event, ctx) => {
    bindOverlay(ctx);
    if (pendingLoadError) {
      ctx.ui.notify(pendingLoadError, "warning");
      pendingLoadError = undefined;
    }
    if (pendingLoadNotice) {
      publishToolDisplayMigrationNotice(ctx.ui, pendingLoadNotice);
      pendingLoadNotice = undefined;
    }
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    bindOverlay(ctx);
  });

  pi.on("session_compact", async (_event, ctx) => {
    bindOverlay(ctx);
  });

  pi.on("session_tree", async (_event, ctx) => {
    bindOverlay(ctx);
  });
}
