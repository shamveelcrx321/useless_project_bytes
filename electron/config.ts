export const APP_NAME = "DIGAMBARAN";
export const TAGLINE = "You can download anything... if Digambaran allows you.";

export const DEFAULT_PORT = 17843;
export const DECISION_TIMEOUT_MS = 60_000;
export const WAIT_DURATION_SECONDS = 30;
export const HEARTBEAT_STALE_MS = 15_000;

export const STORE_KEYS = {
  protectionEnabled: "protectionEnabled",
  openAtLogin: "openAtLogin",
  firstRunComplete: "firstRunComplete",
  lastCondition: "lastCondition",
} as const;
