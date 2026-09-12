import { APP_NAME } from "./config";

function stamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export const logger = {
  info(...args: unknown[]): void {
    console.log(`[${APP_NAME}]`, stamp(), ...args);
  },
  warn(...args: unknown[]): void {
    console.warn(`[${APP_NAME}]`, stamp(), ...args);
  },
  error(...args: unknown[]): void {
    console.error(`[${APP_NAME}]`, stamp(), ...args);
  },
};
