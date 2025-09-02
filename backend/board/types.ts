export interface Board {
  id: string;
  // Title of the board. Backed by boards.title (or legacy boards.name if title is null).
  title: string;
  created_at: Date;
  updated_at: Date;
  // Optional owner of the board (nullable for legacy rows).
  owner_id?: string | null;
}

export interface Stroke {
  id: string;
  board_id: string;
  user_id: string;
  // JSONB structure that stores the stroke points and optional mode.
  // Expected format from frontend WhiteboardCanvas: { points: {x:number, y:number}[], mode?: "draw" | "erase" }
  path_data: Record<string, any>;
  color: string;
  thickness: number;
  created_at: Date;
}

export interface CreateBoardRequest {
  title: string;
}

export interface BoardWithStrokes {
  board: Board;
  strokes: Stroke[];
}

export interface ListBoardsResponse {
  boards: Board[];
}

export interface UpdateBoardRequest {
  id: string;
  data: Record<string, any>;
}

export interface User {
  id: string;
  username: string;
  color: string;
}

export interface Session {
  id: string;
  board_id: string;
  user_id: string;
  connected_at: Date;
  last_seen: Date;
}

export interface CreateUserRequest {
  username: string;
  color?: string;
}
