import { Condition } from "./types";
import { settings } from "./settings";
import { logger } from "./logger";

const CONDITIONS: Condition[] = ["PERMISSION", "SACRIFICE", "WAIT", "MERCY"];

export function selectCondition(): Condition {
  const last = settings.getLastCondition();
  const pool = CONDITIONS.filter((c) => c !== last);
  const choices = pool.length > 0 ? pool : CONDITIONS;
  const picked = choices[Math.floor(Math.random() * choices.length)];
  settings.setLastCondition(picked);
  logger.info("Selected mode:", picked);
  return picked;
}
