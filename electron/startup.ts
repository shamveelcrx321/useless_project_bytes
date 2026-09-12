import { app } from "electron";
import { settings } from "./settings";
import { logger } from "./logger";

export function applyOpenAtLogin(enabled: boolean): void {
  try {
    settings.setOpenAtLogin(enabled);
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true,
      path: process.execPath,
      args: app.isPackaged ? [] : [app.getAppPath()],
    });
    logger.info(
      enabled
        ? "Windows startup registration enabled."
        : "Windows startup registration disabled."
    );
  } catch (err) {
    logger.error("Failed to update login item settings:", err);
  }
}

export function syncStartupFromSettings(): void {
  applyOpenAtLogin(settings.getOpenAtLogin());
}

export function isOpenAtLoginEnabled(): boolean {
  try {
    const login = app.getLoginItemSettings();
    return Boolean(login.openAtLogin);
  } catch {
    return settings.getOpenAtLogin();
  }
}
