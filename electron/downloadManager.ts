import { DECISION_TIMEOUT_MS } from "./config";
import { selectCondition } from "./conditionEngine";
import { logger } from "./logger";
import { settings } from "./settings";
import { Decision, DownloadPayload, DownloadSession } from "./types";
import { getActiveAdapter } from "./adapters/BrowserAdapter";

type DecisionListener = (session: DownloadSession) => void;
type SessionListener = (session: DownloadSession) => void;

export class DownloadManager {
  private sessions = new Map<number, DownloadSession>();
  private timeouts = new Map<number, NodeJS.Timeout>();
  private onDecisionNeeded: SessionListener | null = null;
  private onSessionUpdated: DecisionListener | null = null;

  setDecisionHandler(handler: SessionListener): void {
    this.onDecisionNeeded = handler;
  }

  setSessionUpdateHandler(handler: DecisionListener): void {
    this.onSessionUpdated = handler;
  }

  isProtectionEnabled(): boolean {
    return settings.getProtectionEnabled();
  }

  getSession(downloadId: number): DownloadSession | undefined {
    return this.sessions.get(downloadId);
  }

  getDecision(downloadId: number): Decision {
    const session = this.sessions.get(downloadId);
    return session?.decision ?? null;
  }

  listSessions(): DownloadSession[] {
    return [...this.sessions.values()];
  }

  handleDetected(payload: DownloadPayload): {
    accepted: boolean;
    reason?: string;
    session?: DownloadSession;
  } {
    if (!this.isProtectionEnabled()) {
      return { accepted: false, reason: "Protection disabled." };
    }

    const adapter = getActiveAdapter();
    const normalized = adapter.normalizeDownload(payload);

    if (!Number.isFinite(normalized.downloadId) || normalized.downloadId <= 0) {
      return { accepted: false, reason: "Invalid downloadId." };
    }
    if (!normalized.filename || !normalized.url) {
      return { accepted: false, reason: "Invalid filename or URL." };
    }
    if (!/^https?:\/\//i.test(normalized.url) && !/^blob:/i.test(normalized.url) && !/^filesystem:/i.test(normalized.url)) {
      // Allow http(s); blob/filesystem rarely restartable but accept detection
      if (!normalized.url.includes("://")) {
        return { accepted: false, reason: "Invalid URL." };
      }
    }

    const existing = this.sessions.get(normalized.downloadId);
    if (existing) {
      logger.warn("Duplicate download event ignored:", normalized.downloadId);
      return { accepted: false, reason: "Duplicate downloadId.", session: existing };
    }

    const condition = selectCondition();
    const session: DownloadSession = {
      downloadId: normalized.downloadId,
      filename: normalized.filename,
      url: normalized.url,
      mime: normalized.mime || "application/octet-stream",
      totalBytes: normalized.totalBytes ?? -1,
      startTime: normalized.startTime || new Date().toISOString(),
      state: "WAITING_FOR_CONDITION",
      decision: null,
      condition,
      createdAt: Date.now(),
      dialogOpen: false,
    };

    this.sessions.set(session.downloadId, session);
    logger.info("Download received:", session.filename);
    logger.info("Download ID:", session.downloadId);

    this.armTimeout(session.downloadId);
    this.onDecisionNeeded?.(session);
    this.onSessionUpdated?.(session);

    return { accepted: true, session };
  }

  markConditionActive(downloadId: number): void {
    this.update(downloadId, { state: "CONDITION_ACTIVE", dialogOpen: true });
  }

  setSessionState(
    downloadId: number,
    state: DownloadSession["state"]
  ): void {
    const session = this.sessions.get(downloadId);
    if (!session || session.decision) return;
    this.update(downloadId, { state });
  }

  isPending(downloadId: number): boolean {
    const session = this.sessions.get(downloadId);
    return Boolean(session && !session.decision);
  }

  setDecision(
    downloadId: number,
    decision: Exclude<Decision, null>,
    error?: string
  ): void {
    const session = this.sessions.get(downloadId);
    if (!session) return;
    if (session.decision) return;

    this.clearTimeout(downloadId);
    session.decision = decision;
    session.state = decision;
    session.dialogOpen = false;
    if (error) session.error = error;

    logger.info("Decision:", decision, `(#${downloadId})`);
    this.onSessionUpdated?.(session);

    // Keep ALLOW/DENY readable for polling for a short period, then clean up.
    setTimeout(() => this.clearSession(downloadId), 120_000);
  }

  deny(downloadId: number, reason: string): void {
    logger.warn("DENY:", reason, `(#${downloadId})`);
    this.setDecision(downloadId, "DENY", reason);
  }

  allow(downloadId: number): void {
    this.setDecision(downloadId, "ALLOW");
  }

  clearSession(downloadId: number): void {
    this.clearTimeout(downloadId);
    this.sessions.delete(downloadId);
  }

  private update(downloadId: number, patch: Partial<DownloadSession>): void {
    const session = this.sessions.get(downloadId);
    if (!session) return;
    Object.assign(session, patch);
    this.onSessionUpdated?.(session);
  }

  private armTimeout(downloadId: number): void {
    this.clearTimeout(downloadId);
    const timer = setTimeout(() => {
      const session = this.sessions.get(downloadId);
      if (!session || session.decision) return;
      logger.warn("Decision timeout.", `(#${downloadId})`);
      this.deny(downloadId, "Decision timeout.");
    }, DECISION_TIMEOUT_MS);
    this.timeouts.set(downloadId, timer);
  }

  private clearTimeout(downloadId: number): void {
    const timer = this.timeouts.get(downloadId);
    if (timer) {
      clearTimeout(timer);
      this.timeouts.delete(downloadId);
    }
  }
}

export const downloadManager = new DownloadManager();
