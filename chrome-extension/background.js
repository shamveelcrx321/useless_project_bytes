const DEFAULT_PORT = 17843;
const BASE = `http://127.0.0.1:${DEFAULT_PORT}`;
const POLL_MS = 500;
const HEARTBEAT_MS = 4000;
const DECISION_TIMEOUT_MS = 65000;

/** @type {Map<number, object>} */
const handled = new Map();

/** Approved restart fingerprints to avoid intercept loops. */
/** @type {Set<string>} */
const approvedRestarts = new Set();

let authToken = null;
let protectionEnabled = true;

function log(...args) {
  console.log("[Chrome Extension]", ...args);
}

function basename(filename) {
  if (!filename) return "download";
  const parts = String(filename).split(/[/\\]/);
  return parts[parts.length - 1] || "download";
}

function restartKey(url, filename) {
  return `${url}::${basename(filename)}`;
}

async function handshake() {
  try {
    const res = await fetch(`${BASE}/handshake`, { method: "GET" });
    if (!res.ok) throw new Error(`handshake ${res.status}`);
    const data = await res.json();
    authToken = data.token;
    protectionEnabled = data.enabled !== false;
    await chrome.storage.session.set({ digambaranToken: authToken });
    return true;
  } catch (err) {
    authToken = null;
    return false;
  }
}

async function ensureToken() {
  if (authToken) return true;
  const stored = await chrome.storage.session.get(["digambaranToken"]);
  if (stored.digambaranToken) {
    authToken = stored.digambaranToken;
    return true;
  }
  return handshake();
}

async function api(path, options = {}) {
  const ok = await ensureToken();
  if (!ok || !authToken) {
    throw new Error("DIGAMBARAN not running");
  }

  const headers = {
    "Content-Type": "application/json",
    "X-Digambaran-Token": authToken,
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    authToken = null;
    await chrome.storage.session.remove("digambaranToken");
    const retried = await handshake();
    if (!retried) throw new Error("Unauthorized");
    headers["X-Digambaran-Token"] = authToken;
    const res2 = await fetch(`${BASE}${path}`, { ...options, headers });
    if (!res2.ok) {
      const text = await res2.text();
      throw new Error(text || `HTTP ${res2.status}`);
    }
    return res2.json();
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data.error || message;
      const err = new Error(message);
      err.data = data;
      throw err;
    } catch (e) {
      if (e.data) throw e;
      throw new Error(message);
    }
  }

  return res.json();
}

async function heartbeat() {
  try {
    const data = await api("/heartbeat", {
      method: "POST",
      body: JSON.stringify({ token: authToken }),
    });
    protectionEnabled = data.enabled !== false;
  } catch {
    // Digambaran may be offline; try handshake next time.
    authToken = null;
  }
}

function cancelDownload(downloadId) {
  return new Promise((resolve) => {
    chrome.downloads.cancel(downloadId, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({ ok: false, reason: err.message });
        return;
      }
      resolve({ ok: true });
    });
  });
}

function startDownload(url, filename) {
  return new Promise((resolve, reject) => {
    const options = { url };
    if (filename) {
      options.filename = basename(filename);
      options.conflictAction = "uniquify";
    }
    chrome.downloads.download(options, (id) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(id);
    });
  });
}

async function pollDecision(downloadId) {
  const started = Date.now();
  while (Date.now() - started < DECISION_TIMEOUT_MS) {
    try {
      const data = await api(`/decision/${downloadId}`, { method: "GET" });
      if (data.decision === "ALLOW" || data.decision === "DENY") {
        return data;
      }
    } catch (err) {
      log("Decision poll error:", err.message || err);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return { decision: "DENY", error: "Decision timeout." };
}

async function handleDownload(item) {
  if (!item || typeof item.id !== "number") return;

  if (handled.has(item.id)) {
    return;
  }

  const filename = basename(item.filename || item.url);
  const url = item.url || item.finalUrl || "";
  const key = restartKey(url, filename);

  if (approvedRestarts.has(key)) {
    approvedRestarts.delete(key);
    log("Approved download allowed.");
    log("Download ID:", item.id);
    handled.set(item.id, { approved: true });
    return;
  }

  // Only intercept restartable http(s) downloads.
  if (!/^https?:\/\//i.test(url)) {
    log("Skipping non-http(s) download:", url.slice(0, 64));
    return;
  }

  handled.set(item.id, { pending: true });

  const connected = await ensureToken();
  if (!connected) {
    log("DIGAMBARAN not running — leaving download alone.");
    handled.delete(item.id);
    return;
  }

  // Refresh enabled flag
  try {
    const status = await api("/status", { method: "GET" });
    protectionEnabled = status.enabled !== false;
  } catch {
    // continue with last known
  }

  if (!protectionEnabled) {
    log("Protection disabled — leaving download alone.");
    handled.delete(item.id);
    return;
  }

  log("Download detected:");
  log(filename);
  log("Download ID:");
  log(item.id);
  log("Cancellation requested.");

  const cancelResult = await cancelDownload(item.id);
  if (!cancelResult.ok) {
    log("Cancellation failed:", cancelResult.reason);
    try {
      await api("/cancel-failed", {
        method: "POST",
        body: JSON.stringify({
          token: authToken,
          downloadId: item.id,
          reason: cancelResult.reason || "Cancellation failed",
        }),
      });
    } catch {
      // ignore
    }
    handled.delete(item.id);
    return;
  }

  log("Download cancelled pending Digambaran decision.");

  try {
    await api("/download-detected", {
      method: "POST",
      body: JSON.stringify({
        token: authToken,
        downloadId: item.id,
        filename,
        url,
        mime: item.mime || "application/octet-stream",
        totalBytes: typeof item.totalBytes === "number" ? item.totalBytes : -1,
        startTime: item.startTime || new Date().toISOString(),
        state: item.state || "in_progress",
      }),
    });
  } catch (err) {
    log("Failed to notify Digambaran:", err.message || err);
    handled.delete(item.id);
    return;
  }

  const decision = await pollDecision(item.id);
  if (decision.decision === "ALLOW") {
    log("Restarting approved download.");
    approvedRestarts.add(key);
    // Safety TTL for approved keys
    setTimeout(() => approvedRestarts.delete(key), 60_000);
    try {
      await startDownload(url, filename);
    } catch (err) {
      log("Download restart failure:", err.message || err);
      approvedRestarts.delete(key);
    }
  } else {
    log("Decision DENY — download remains cancelled.");
  }

  handled.delete(item.id);
}

chrome.downloads.onCreated.addListener((item) => {
  // Defer slightly so Chrome finishes populating filename when possible.
  setTimeout(() => {
    void handleDownload(item);
  }, 50);
});

chrome.runtime.onInstalled.addListener(() => {
  log("Installed / updated.");
  void handshake();
});

chrome.runtime.onStartup.addListener(() => {
  void handshake();
});

void handshake();
setInterval(() => {
  void heartbeat();
}, HEARTBEAT_MS);
