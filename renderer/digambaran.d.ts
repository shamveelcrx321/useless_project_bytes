interface DigambaranApi {
  continueDownload(downloadId: number): Promise<{ ok: boolean }>;
  cancelDownload(downloadId: number): Promise<{ ok: boolean }>;
  chooseSacrifice(downloadId: number): Promise<{
    ok: boolean;
    cancelled?: boolean;
    reason?: string;
    sacrifice?: {
      path: string;
      name: string;
      sizeLabel: string;
      sizeBytes: number;
    };
  }>;
  confirmSacrifice(
    downloadId: number,
    sacrificePath: string
  ): Promise<{ ok: boolean; reason?: string }>;
  openExtensionFolder(): Promise<{ ok: boolean; path: string }>;
  openChromeExtensions(): Promise<{ ok: boolean }>;
}

interface Window {
  digambaran: DigambaranApi;
}
