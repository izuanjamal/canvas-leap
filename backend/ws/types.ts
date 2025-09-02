export interface ClientMessage {
  type: "board_update" | "cursor_move" | "user_join" | "user_leave" | "ping";
  boardId: string;
  userId: string;
  data?: any;
  timestamp: number;
}

export interface ServerMessage {
  type: "board_update" | "cursor_move" | "user_joined" | "user_left" | "pong" | "error";
  boardId: string;
  userId?: string;
  data?: any;
  timestamp: number;
}

export interface BoardSession {
  boardId: string;
  userId: string;
  username: string;
  color: string;
  lastSeen: Date;
}
