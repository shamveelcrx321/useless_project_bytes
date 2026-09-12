import { app, BrowserWindow, ipcMain, shell } from "electron";
import * as path from "path";
import { WAIT_DURATION_SECONDS } from "./config";
import { downloadManager } from "./downloadManager";
import { logger } from "./logger";
import {
  chooseSacrificeFile,
  formatBytes,
  recycleSacrificeFile,
  validateSacrificeFile,
} from "./sacrificeManager";
import { DownloadSession } from "./types";

const openDialogs = new Map<number, BrowserWindow>();
const allowClose = new Set<number>();

function resolveRenderer(...parts: string[]): string {
  return path.join(__dirname, "..", "renderer", ...parts);
}

function createConditionWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 440,
    height: 560,
    resizable: false,
    maximizable: false,
    minimizable: false,
    closable: false,
    alwaysOnTop: true,
    fullscreenable: false,
    show: false,
    autoHideMenuBar: true,
    title: "DIGAMBARAN",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setMenuBarVisibility(false);
  win.setMenu(null);

  // Block Escape / Alt+F4 from dismissing the condition without a decision.
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "Escape") {
      event.preventDefault();
      return;
    }
    if (input.alt && (input.key === "F4" || input.code === "F4")) {
      event.preventDefault();
    }
  });

  return win;
}

function closeConditionWindow(downloadId: number): void {
  const win = openDialogs.get(downloadId);
  if (!win || win.isDestroyed()) {
    openDialogs.delete(downloadId);
    return;
  }
  allowClose.add(downloadId);
  win.removeAllListeners("closed");
  openDialogs.delete(downloadId);
  win.destroy();
  allowClose.delete(downloadId);
}

export async function showConditionDialog(session: DownloadSession): Promise<void> {
  if (!session.condition) {
    downloadManager.deny(session.downloadId, "No condition selected.");
    return;
  }

  if (openDialogs.has(session.downloadId) || session.dialogOpen) {
    logger.warn("Dialog already open for download", session.downloadId);
    return;
  }

  downloadManager.markConditionActive(session.downloadId);

  const win = createConditionWindow();
  openDialogs.set(session.downloadId, win);

  win.on("close", (e) => {
    if (!allowClose.has(session.downloadId)) {
      e.preventDefault();
    }
  });

  win.on("closed", () => {
    openDialogs.delete(session.downloadId);
    const current = downloadManager.getSession(session.downloadId);
    if (current && !current.decision) {
      downloadManager.deny(session.downloadId, "User closed condition dialog.");
    }
  });

  await win.loadFile(resolveRenderer("condition-dialog", "index.html"), {
    query: {
      downloadId: String(session.downloadId),
      filename: session.filename,
      totalBytes: String(session.totalBytes),
      condition: session.condition,
      waitSeconds: String(WAIT_DURATION_SECONDS),
      sizeLabel: formatBytes(session.totalBytes),
    },
  });

  win.show();
  win.focus();
  win.moveTop();
}

export function registerDialogIpc(): void {
  ipcMain.handle("condition:continue", (_event, downloadId: number) => {
    const id = Number(downloadId);
    const session = downloadManager.getSession(id);
    if (!session || session.decision) {
      return { ok: false, reason: "Session not pending." };
    }
    if (session.condition === "SACRIFICE") {
      downloadManager.deny(id, "Sacrifice required — cannot continue without sacrifice.");
      closeConditionWindow(id);
      return { ok: false, reason: "Sacrifice required." };
    }
    downloadManager.allow(id);
    closeConditionWindow(id);
    return { ok: true };
  });

  ipcMain.handle("condition:cancel", (_event, downloadId: number) => {
    const id = Number(downloadId);
    downloadManager.deny(id, "User refused condition.");
    closeConditionWindow(id);
    return { ok: true };
  });

  ipcMain.handle("condition:choose-sacrifice", async (event, downloadId: number) => {
    const id = Number(downloadId);
    const session = downloadManager.getSession(id);
    if (!session || session.decision) {
      return { ok: false, reason: "Session not pending." };
    }
    if (session.condition !== "SACRIFICE") {
      return { ok: false, reason: "Condition is not SACRIFICE." };
    }

    downloadManager.setSessionState(id, "SACRIFICE_FILE_SELECTION");
    const win = BrowserWindow.fromWebContents(event.sender);
    const selected = await chooseSacrificeFile(win);

    if (!selected) {
      downloadManager.deny(id, "Sacrifice file picker cancelled.");
      closeConditionWindow(id);
      return { ok: false, cancelled: true, reason: "File picker cancelled." };
    }

    const validation = validateSacrificeFile(selected.path, session.filename);
    if (!validation.ok || !validation.file) {
      downloadManager.deny(
        id,
        validation.reason || "Invalid sacrifice file."
      );
      closeConditionWindow(id);
      return { ok: false, reason: validation.reason || "Invalid sacrifice file." };
    }

    downloadManager.setSessionState(id, "SACRIFICE_CONFIRMATION");
    return {
      ok: true,
      sacrifice: {
        path: validation.file.path,
        name: validation.file.name,
        sizeLabel: formatBytes(validation.file.sizeBytes),
        sizeBytes: validation.file.sizeBytes,
      },
    };
  });

  ipcMain.handle(
    "condition:confirm-sacrifice",
    async (
      _event,
      payload: { downloadId: number; sacrificePath: string }
    ) => {
      const id = Number(payload.downloadId);
      const session = downloadManager.getSession(id);

      if (!session || session.decision) {
        return { ok: false, reason: "Session not pending." };
      }
      if (session.condition !== "SACRIFICE") {
        downloadManager.deny(id, "Condition is not SACRIFICE.");
        closeConditionWindow(id);
        return { ok: false, reason: "Condition is not SACRIFICE." };
      }

      downloadManager.setSessionState(id, "SACRIFICE_EXECUTING");
      logger.info("Waiting for sacrifice confirmation execution.");

      const result = await recycleSacrificeFile(
        payload.sacrificePath,
        session.filename
      );

      if (!result.ok) {
        logger.warn("Sacrifice failed:", result.reason);
        downloadManager.deny(id, result.reason || "Sacrifice failed.");
        closeConditionWindow(id);
        return { ok: false, reason: result.reason || "Sacrifice failed." };
      }

      downloadManager.setSessionState(id, "SACRIFICE_SUCCESS");
      logger.info("Sacrifice successful.");
      downloadManager.allow(id);
      closeConditionWindow(id);
      return { ok: true };
    }
  );

  ipcMain.handle("setup:open-extension-folder", async () => {
    const folder = getChromeExtensionPath();
    await shell.openPath(folder);
    return { ok: true, path: folder };
  });

  ipcMain.handle("setup:open-chrome-extensions", async () => {
    const { spawn } = await import("child_process");
    const candidates = [
      process.env.LOCALAPPDATA
        ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
        : "",
      process.env.PROGRAMFILES
        ? `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`
        : "",
      process.env["PROGRAMFILES(X86)"]
        ? `${process.env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`
        : "",
    ].filter(Boolean);

    for (const chromePath of candidates) {
      try {
        const fs = await import("fs");
        if (!fs.existsSync(chromePath)) continue;
        spawn(chromePath, ["chrome://extensions"], {
          detached: true,
          stdio: "ignore",
        }).unref();
        return { ok: true };
      } catch {
        // try next
      }
    }

    await shell.openExternal(
      "https://support.google.com/chrome_webstore/answer/2664769"
    );
    return { ok: true, fallback: true };
  });
}

export function getChromeExtensionPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "chrome-extension");
  }
  return path.join(app.getAppPath(), "chrome-extension");
}

export async function showFirstRunSetup(): Promise<void> {
  const win = new BrowserWindow({
    width: 460,
    height: 360,
    resizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    title: "DIGAMBARAN",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setMenuBarVisibility(false);
  await win.loadFile(resolveRenderer("setup", "index.html"));
  win.show();
}
