import { contextBridge, ipcRenderer } from "electron";

export interface SacrificeResult {
  ok: boolean;
  cancelled?: boolean;
  reason?: string;
  sacrifice?: {
    path: string;
    name: string;
    sizeLabel: string;
    sizeBytes: number;
  };
}

const digambaran = {
  continueDownload(downloadId: number): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke("condition:continue", downloadId);
  },
  cancelDownload(downloadId: number): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke("condition:cancel", downloadId);
  },
  chooseSacrifice(downloadId: number): Promise<SacrificeResult> {
    return ipcRenderer.invoke("condition:choose-sacrifice", downloadId);
  },
  confirmSacrifice(
    downloadId: number,
    sacrificePath: string
  ): Promise<{ ok: boolean; reason?: string }> {
    return ipcRenderer.invoke("condition:confirm-sacrifice", {
      downloadId,
      sacrificePath,
    });
  },
  openExtensionFolder(): Promise<{ ok: boolean; path: string }> {
    return ipcRenderer.invoke("setup:open-extension-folder");
  },
  openChromeExtensions(): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke("setup:open-chrome-extensions");
  },
};

contextBridge.exposeInMainWorld("digambaran", digambaran);

export type DigambaranApi = typeof digambaran;
