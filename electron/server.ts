import * as http from "http";
import * as crypto from "crypto";
import { DEFAULT_PORT } from "./config";
import { downloadManager } from "./downloadManager";
import { logger } from "./logger";
import { settings } from "./settings";
import { DownloadPayload } from "./types";

export interface LocalServer {
  port: number;
  token: string;
  close: () => Promise<void>;
  getLastHeartbeat: () => number | null;
  isChromeConnected: () => boolean;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: Record<string, unknown>
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Digambaran-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  res.end(payload);
}

function extractToken(
  req: http.IncomingMessage,
  body: Record<string, unknown> | null
): string | null {
  const header =
    req.headers["x-digambaran-token"] ||
    req.headers["authorization"] ||
    "";
  if (typeof header === "string" && header.length > 0) {
    if (header.toLowerCase().startsWith("bearer ")) {
      return header.slice(7).trim();
    }
    return header.trim();
  }
  if (body && typeof body.token === "string") {
    return body.token;
  }
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export async function startLocalServer(
  preferredPort = DEFAULT_PORT
): Promise<LocalServer> {
  const token = crypto.randomBytes(32).toString("hex");
  let lastHeartbeat: number | null = null;

  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url || !req.method) {
        sendJson(res, 400, { error: "Bad request" });
        return;
      }

      if (req.method === "OPTIONS") {
        sendJson(res, 204, {});
        return;
      }

      const url = new URL(req.url, `http://127.0.0.1:${preferredPort}`);

      // Bootstrap: localhost-only token handoff for the extension.
      if (req.method === "GET" && url.pathname === "/handshake") {
        lastHeartbeat = Date.now();
        sendJson(res, 200, {
          ok: true,
          token,
          port: preferredPort,
          enabled: settings.getProtectionEnabled(),
          app: "DIGAMBARAN",
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, { ok: true, app: "DIGAMBARAN" });
        return;
      }

      let body: Record<string, unknown> | null = null;
      if (req.method === "POST") {
        const raw = await readBody(req);
        if (raw) {
          try {
            body = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            sendJson(res, 400, { error: "Invalid JSON" });
            return;
          }
        } else {
          body = {};
        }
      }

      const provided = extractToken(req, body);
      if (!provided || !timingSafeEqual(provided, token)) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }

      if (req.method === "POST" && url.pathname === "/heartbeat") {
        lastHeartbeat = Date.now();
        sendJson(res, 200, {
          ok: true,
          enabled: settings.getProtectionEnabled(),
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/status") {
        lastHeartbeat = Date.now();
        sendJson(res, 200, {
          ok: true,
          enabled: settings.getProtectionEnabled(),
          port: preferredPort,
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/download-detected") {
        lastHeartbeat = Date.now();
        const payload: DownloadPayload = {
          downloadId: Number(body?.downloadId),
          filename: String(body?.filename || ""),
          url: String(body?.url || ""),
          mime: body?.mime ? String(body.mime) : undefined,
          totalBytes:
            typeof body?.totalBytes === "number" ? body.totalBytes : Number(body?.totalBytes),
          startTime: body?.startTime ? String(body.startTime) : undefined,
          state: body?.state ? String(body.state) : undefined,
        };

        const result = downloadManager.handleDetected(payload);
        if (!result.accepted) {
          sendJson(res, 409, {
            ok: false,
            error: result.reason || "Rejected",
            decision: result.session?.decision ?? null,
          });
          return;
        }

        sendJson(res, 200, {
          ok: true,
          downloadId: result.session!.downloadId,
          condition: result.session!.condition,
          state: result.session!.state,
        });
        return;
      }

      const decisionMatch = url.pathname.match(/^\/decision\/(\d+)$/);
      if (req.method === "GET" && decisionMatch) {
        lastHeartbeat = Date.now();
        const downloadId = Number(decisionMatch[1]);
        const session = downloadManager.getSession(downloadId);
        if (!session) {
          sendJson(res, 404, { error: "Unknown downloadId", decision: "DENY" });
          return;
        }
        sendJson(res, 200, {
          decision: session.decision,
          state: session.state,
          condition: session.condition,
          filename: session.filename,
          url: session.url,
          error: session.error || null,
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/cancel-failed") {
        lastHeartbeat = Date.now();
        const downloadId = Number(body?.downloadId);
        const reason = String(body?.reason || "Cancellation failed");
        logger.warn("Cancel failed from extension:", downloadId, reason);
        downloadManager.deny(downloadId, reason);
        downloadManager.clearSession(downloadId);
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      logger.error("Local server error:", err);
      sendJson(res, 500, { error: "Internal error" });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(preferredPort, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  logger.info("Local server:");
  logger.info(`127.0.0.1:${preferredPort}`);

  return {
    port: preferredPort,
    token,
    getLastHeartbeat: () => lastHeartbeat,
    isChromeConnected: () => {
      if (!lastHeartbeat) return false;
      return Date.now() - lastHeartbeat < 15_000;
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
