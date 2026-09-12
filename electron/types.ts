export type Condition = "PERMISSION" | "SACRIFICE" | "WAIT" | "MERCY";

export type SessionState =
  | "DETECTED"
  | "CANCEL_REQUESTED"
  | "CANCELLED"
  | "WAITING_FOR_CONDITION"
  | "CONDITION_ACTIVE"
  | "WAITING_FOR_DECISION"
  | "SACRIFICE_FILE_SELECTION"
  | "SACRIFICE_CONFIRMATION"
  | "SACRIFICE_EXECUTING"
  | "SACRIFICE_SUCCESS"
  | "ALLOW"
  | "DENY"
  | "FAILED";

export type Decision = "ALLOW" | "DENY" | null;

export interface DownloadPayload {
  downloadId: number;
  filename: string;
  url: string;
  mime?: string;
  totalBytes?: number;
  startTime?: string;
  state?: string;
}

export interface DownloadSession {
  downloadId: number;
  filename: string;
  url: string;
  mime: string;
  totalBytes: number;
  startTime: string;
  state: SessionState;
  decision: Decision;
  condition: Condition | null;
  createdAt: number;
  dialogOpen: boolean;
  error?: string;
}

export interface BridgeStatus {
  enabled: boolean;
  port: number;
  chromeConnected: boolean;
  lastHeartbeat: number | null;
}
