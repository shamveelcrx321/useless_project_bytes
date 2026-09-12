import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import { STORE_KEYS } from "./config";
import { Condition } from "./types";
import { logger } from "./logger";

interface PersistedState {
  protectionEnabled: boolean;
  openAtLogin: boolean;
  firstRunComplete: boolean;
  lastCondition: Condition | null;
}

const DEFAULTS: PersistedState = {
  protectionEnabled: true,
  openAtLogin: true,
  firstRunComplete: false,
  lastCondition: null,
};

function storePath(): string {
  return path.join(app.getPath("userData"), "digambaran-state.json");
}

function read(): PersistedState {
  try {
    const raw = fs.readFileSync(storePath(), "utf8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function write(state: PersistedState): void {
  try {
    fs.mkdirSync(path.dirname(storePath()), { recursive: true });
    fs.writeFileSync(storePath(), JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    logger.error("Failed to persist state:", err);
  }
}

export const settings = {
  getProtectionEnabled(): boolean {
    return read().protectionEnabled;
  },
  setProtectionEnabled(value: boolean): void {
    const state = read();
    state.protectionEnabled = value;
    write(state);
  },
  getOpenAtLogin(): boolean {
    return read().openAtLogin;
  },
  setOpenAtLogin(value: boolean): void {
    const state = read();
    state.openAtLogin = value;
    write(state);
  },
  isFirstRunComplete(): boolean {
    return read().firstRunComplete;
  },
  setFirstRunComplete(value: boolean): void {
    const state = read();
    state.firstRunComplete = value;
    write(state);
  },
  getLastCondition(): Condition | null {
    return read().lastCondition;
  },
  setLastCondition(value: Condition): void {
    const state = read();
    state.lastCondition = value;
    write(state);
  },
  keys: STORE_KEYS,
};
