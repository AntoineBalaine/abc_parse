export interface ClientMessage {
  type: string;
  [key: string]: any;
}

export interface ClickEvent {
  type: "click";
  startChar: number;
  endChar: number;
  tuneNumber?: number;
  classes?: string[];
}

export interface ContentMessage {
  type: "content";
  path: string;
  content: string;
}

export interface ConfigMessage {
  type: "config";
  config: Record<string, any>;
}

export interface ExportRequest {
  type: "requestExport";
  format: "html" | "svg";
  path: string;
  content?: string;
}

export interface ExportComplete {
  type: "exportComplete";
  format: "html" | "svg";
  path: string;
}

export interface ExportError {
  type: "exportError";
  error: string;
}

export interface CursorMoveMessage {
  type: "cursorMove";
  position: number;
}

export interface CleanupMessage {
  type: "cleanup";
  path: string;
}

export interface ServerInfoMessage {
  type: "serverInfo";
  port: number;
}

export type ServerMessage = ClickEvent | ContentMessage | ConfigMessage | ExportComplete | ExportError | CursorMoveMessage | CleanupMessage | ServerInfoMessage;
