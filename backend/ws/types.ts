export type ClientEventType =
  | "USER_JOIN"
  | "USER_LEAVE"
  | "BOARD_UPDATE"
  | "CURSOR_UPDATE"
  | "PING";

export type ServerEventType =
  | "USER_JOINED"
  | "USER_LEFT"
  | "BOARD_UPDATE"
  | "CURSOR_UPDATE"
  | "PONG"
  | "ERROR";

export interface ClientMessage {
  type: ClientEventType;
  boardId: string;
  // For BOARD_UPDATE: full board data (e.g. { elements: [...] })
  // For CURSOR_UPDATE: { x: number, y: number }
  data?: any;
  timestamp: number;
}

export interface ServerMessage {
  type: ServerEventType;
  boardId: string;
  userId?: string;
  // For USER_JOINED: { display_name: string, avatar_url: string }
  // For USER_LEFT: {}
  // For BOARD_UPDATE: full board data (e.g. { elements: [...] })
  // For CURSOR_UPDATE: { x: number, y: number, display_name?: string, avatar_url?: string }
  data?: any;
  timestamp: number;
}

export interface BoardSession {
  boardId: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
  lastSeen: Date;
}
