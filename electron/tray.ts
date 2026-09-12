import {
  Menu,
  Tray,
  nativeImage,
  app,
  NativeImage,
} from "electron";
import * as fs from "fs";
import * as path from "path";
import { APP_NAME } from "./config";
import { settings } from "./settings";
import { applyOpenAtLogin, isOpenAtLoginEnabled } from "./startup";
import { logger } from "./logger";
import { getChromeExtensionPath, showFirstRunSetup } from "./dialogManager";
import { shell } from "electron";

export interface TrayController {
  tray: Tray;
  refresh: () => void;
  destroy: () => void;
}

function loadTrayIcon(): NativeImage {
  const candidates = [
    path.join(app.getAppPath(), "assets", "tray.png"),
    path.join(__dirname, "..", "..", "assets", "tray.png"),
    path.join(process.resourcesPath || "", "assets", "tray.png"),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const img = nativeImage.createFromPath(candidate);
        if (!img.isEmpty()) return img.resize({ width: 16, height: 16 });
      }
    } catch {
      // try next
    }
  }

  // 16x16 dark square PNG fallback (embedded)
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKElEQVQ4T2NkYGD4z0ABYBzVMKoBBg0wGlQDgwYYDaoBBg0wGlQDjAYYAGLfAf8D7qZNAAAAAElFTkSuQmCC",
    "base64"
  );
  return nativeImage.createFromBuffer(png);
}

export function createTray(options: {
  isChromeConnected: () => boolean;
  onExit: () => void;
}): TrayController {
  const tray = new Tray(loadTrayIcon());
  tray.setToolTip(APP_NAME);

  const rebuild = (): void => {
    const enabled = settings.getProtectionEnabled();
    const chrome = options.isChromeConnected() ? "Connected" : "Not connected";
    const startup = isOpenAtLoginEnabled();

    const menu = Menu.buildFromTemplate([
      { label: APP_NAME, enabled: false },
      { type: "separator" },
      {
        label: `Status: ${enabled ? "Active" : "Disabled"}`,
        enabled: false,
      },
      {
        label: `Chrome: ${chrome}`,
        enabled: false,
      },
      { type: "separator" },
      {
        label: "Enable protection",
        type: "radio",
        checked: enabled,
        click: () => {
          settings.setProtectionEnabled(true);
          logger.info("Protection enabled.");
          rebuild();
        },
      },
      {
        label: "Disable protection",
        type: "radio",
        checked: !enabled,
        click: () => {
          settings.setProtectionEnabled(false);
          logger.info("Protection disabled.");
          rebuild();
        },
      },
      { type: "separator" },
      {
        label: startup ? "Disable start with Windows" : "Enable start with Windows",
        click: () => {
          applyOpenAtLogin(!startup);
          rebuild();
        },
      },
      {
        label: "Set up Chrome extension…",
        click: () => {
          void showFirstRunSetup();
        },
      },
      {
        label: "Open extension folder",
        click: () => {
          void shell.openPath(getChromeExtensionPath());
        },
      },
      { type: "separator" },
      {
        label: "Exit",
        click: () => options.onExit(),
      },
    ]);

    tray.setContextMenu(menu);
  };

  rebuild();
  tray.on("click", () => tray.popUpContextMenu());

  const interval = setInterval(rebuild, 3000);

  return {
    tray,
    refresh: rebuild,
    destroy: () => {
      clearInterval(interval);
      tray.destroy();
    },
  };
}
