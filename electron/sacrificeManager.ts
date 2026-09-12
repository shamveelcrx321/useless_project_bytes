import * as fs from "fs";
import * as path from "path";
import { app, dialog, BrowserWindow, shell } from "electron";
import { logger } from "./logger";

const BLOCKED_PREFIXES = [
  "C:\\Windows",
  "C:\\Program Files",
  "C:\\Program Files (x86)",
  path.join(process.env.SystemRoot || "C:\\Windows"),
  path.join(process.env.ProgramFiles || "C:\\Program Files"),
  path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)"),
];

export interface SacrificeFileInfo {
  path: string;
  name: string;
  sizeBytes: number;
}

export interface SacrificeResult {
  ok: boolean;
  reason?: string;
  file?: SacrificeFileInfo;
}

function normalize(p: string): string {
  return path.resolve(p).toLowerCase();
}

function isUnderBlocked(filePath: string): boolean {
  const target = normalize(filePath);
  return BLOCKED_PREFIXES.some((prefix) => {
    const p = normalize(prefix);
    return target === p || target.startsWith(p + path.sep.toLowerCase());
  });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown size";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export async function chooseSacrificeFile(
  parent: BrowserWindow | null
): Promise<SacrificeFileInfo | null> {
  const options = {
    title: "Choose a file to sacrifice",
    properties: ["openFile" as const],
    buttonLabel: "Select sacrifice",
  };

  const picked = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options);

  if (picked.canceled || !picked.filePaths[0]) {
    return null;
  }

  const filePath = picked.filePaths[0];
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return null;
    }
    return {
      path: filePath,
      name: path.basename(filePath),
      sizeBytes: stat.size,
    };
  } catch (err) {
    logger.error("Failed to read sacrifice file:", err);
    return null;
  }
}

export function validateSacrificeFile(
  filePath: string,
  downloadFilename: string
): SacrificeResult {
  try {
    if (!fs.existsSync(filePath)) {
      return { ok: false, reason: "Path does not exist." };
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return {
        ok: false,
        reason: "Sacrifice must be a regular file, not a directory.",
      };
    }

    const resolved = path.resolve(filePath);
    const exePath = path.resolve(process.execPath);
    const appPath = path.resolve(app.getAppPath());

    if (normalize(resolved) === normalize(exePath)) {
      return { ok: false, reason: "Cannot sacrifice DIGAMBARAN executable." };
    }

    if (
      normalize(resolved).startsWith(normalize(appPath) + path.sep.toLowerCase()) ||
      normalize(resolved) === normalize(appPath)
    ) {
      return {
        ok: false,
        reason: "Cannot sacrifice DIGAMBARAN application files.",
      };
    }

    if (isUnderBlocked(resolved)) {
      return { ok: false, reason: "Protected system path. Sacrifice refused." };
    }

    const base = path.basename(resolved).toLowerCase();
    if (base === path.basename(downloadFilename).toLowerCase()) {
      logger.warn(
        "Sacrifice shares filename with intercepted download:",
        base
      );
    }

    return {
      ok: true,
      file: {
        path: resolved,
        name: path.basename(resolved),
        sizeBytes: stat.size,
      },
    };
  } catch (err) {
    logger.error("Sacrifice validation failed:", err);
    return { ok: false, reason: "Validation failed." };
  }
}

/**
 * Moves the sacrifice file to the Windows Recycle Bin via Electron's
 * shell.trashItem (Windows Shell / IFileOperation with undo — not permanent delete).
 */
export async function recycleSacrificeFile(
  filePath: string,
  downloadFilename: string
): Promise<SacrificeResult> {
  const validation = validateSacrificeFile(filePath, downloadFilename);
  if (!validation.ok || !validation.file) {
    return validation;
  }

  const target = validation.file.path;

  try {
    if (!fs.existsSync(target)) {
      return { ok: false, reason: "Selected file no longer exists." };
    }

    await shell.trashItem(target);

    // Only report success if the file is no longer at the original path.
    if (fs.existsSync(target)) {
      logger.error("Recycle Bin operation reported success but file remains:", target);
      return {
        ok: false,
        reason: "Recycle Bin operation did not move the file.",
      };
    }

    logger.info("Sacrifice moved to Recycle Bin:", validation.file.name);
    return { ok: true, file: validation.file };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Recycle Bin operation failed.";
    logger.error("Sacrifice recycle failed:", message);
    return { ok: false, reason: message };
  }
}
