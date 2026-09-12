export interface BrowserDownloadEvent {
  downloadId: number;
  filename: string;
  url: string;
  mime?: string;
  totalBytes?: number;
  startTime?: string;
  state?: string;
}

/**
 * Future browser support plugs in here.
 * Only ChromeAdapter is implemented for MVP.
 */
export interface BrowserAdapter {
  readonly id: string;
  readonly displayName: string;
  normalizeDownload(raw: BrowserDownloadEvent): BrowserDownloadEvent;
}

export class ChromeAdapter implements BrowserAdapter {
  readonly id = "chrome";
  readonly displayName = "Google Chrome";

  normalizeDownload(raw: BrowserDownloadEvent): BrowserDownloadEvent {
    const filename =
      raw.filename?.split(/[/\\]/).pop()?.trim() ||
      raw.url?.split("?")[0].split("/").pop() ||
      "download";

    return {
      downloadId: Number(raw.downloadId),
      filename,
      url: String(raw.url || ""),
      mime: raw.mime || "application/octet-stream",
      totalBytes: typeof raw.totalBytes === "number" ? raw.totalBytes : -1,
      startTime: raw.startTime || new Date().toISOString(),
      state: raw.state || "in_progress",
    };
  }
}

export function getActiveAdapter(): BrowserAdapter {
  return new ChromeAdapter();
}
