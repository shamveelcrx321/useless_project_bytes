import { app, Notification, dialog } from "electron";
import { DEFAULT_PORT, HEARTBEAT_STALE_MS } from "./config";
import { downloadManager } from "./downloadManager";
import {
  registerDialogIpc,
  showConditionDialog,
  showFirstRunSetup,
} from "./dialogManager";
import { logger } from "./logger";
import { LocalServer, startLocalServer } from "./server";
import { settings } from "./settings";
import { syncStartupFromSettings } from "./startup";
import { createTray, TrayController } from "./tray";

let localServer: LocalServer | null = null;
let trayController: TrayController | null = null;
let isQuitting = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    logger.info("Second instance blocked.");
    if (Notification.isSupported()) {
      new Notification({
        title: "DIGAMBARAN",
        body: "Digambaran is already running.",
      }).show();
    }
  });
}

async function boot(): Promise<void> {
  logger.info("Starting...");

  // Hide dock-like behavior; Windows tray app.
  if (process.platform === "darwin") {
    app.dock?.hide();
  }

  syncStartupFromSettings();
  registerDialogIpc();

  try {
    localServer = await startLocalServer(DEFAULT_PORT);
  } catch (err) {
    logger.error("Failed to bind localhost server:", err);
    dialog.showErrorBox(
      "DIGAMBARAN",
      `Could not start local bridge on 127.0.0.1:${DEFAULT_PORT}.\nAnother process may be using the port.`
    );
    app.quit();
    return;
  }

  downloadManager.setDecisionHandler((session) => {
    void showConditionDialog(session);
  });

  trayController = createTray({
    isChromeConnected: () => {
      if (!localServer) return false;
      const hb = localServer.getLastHeartbeat();
      if (!hb) return false;
      return Date.now() - hb < HEARTBEAT_STALE_MS;
    },
    onExit: () => {
      isQuitting = true;
      app.quit();
    },
  });

  logger.info("Waiting for Chrome.");

  if (!settings.isFirstRunComplete() && process.env.DIGAMBARAN_SKIP_SETUP !== "1") {
    if (Notification.isSupported()) {
      new Notification({
        title: "DIGAMBARAN",
        body: "Digambaran is running. Chrome download protection requires the Digambaran Chrome extension.",
      }).show();
    }
    await showFirstRunSetup();
    settings.setFirstRunComplete(true);
  }

  // Tray application — stay alive until explicit Exit.
  app.on("window-all-closed", () => {
    // no-op on purpose
  });
}

app.whenReady().then(() => {
  void boot().catch((err) => {
    logger.error("Boot failed:", err);
    app.quit();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  trayController?.destroy();
  void localServer?.close();
});
