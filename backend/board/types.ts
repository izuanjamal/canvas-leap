export type Role = "owner" | "editor" | "viewer";

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
  // Optional title; if omitted or empty, a default title will be generated.
  title?: string;
}

export interface BoardWithStrokes {
  board: Board;
  strokes: Stroke[];
  // The caller's role for this board, if known (owner/editor/viewer).
  current_role?: Role;
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

/* Sharing / Permissions */

export interface ShareStatus {
  enabled: boolean;
  // Only present if enabled
  token?: string;
  role?: Exclude<Role, "owner">;
}

export interface ShareManageRequest {
  // path param
  id: string;
  // "enable" | "disable" | "rotate" | "status"
  action: "enable" | "disable" | "rotate" | "status";
  // desired role for public link (viewer/editor), defaults to "viewer" for enable/rotate
  role?: Exclude<Role, "owner">;
}

export interface ShareManageResponse {
  status: "enabled" | "disabled";
  token?: string;
  role?: Exclude<Role, "owner">;
}

export interface ShareStatusParams {
  id: string;
}
export interface ShareStatusResponse extends ShareStatus {}

export interface GetSharedParams {
  token: string;
}

export interface SharedBoardResponse {
  board: Board;
  strokes: Stroke[];
  role: Exclude<Role, "owner">;
}

export interface BoardPermission {
  id: string;
  board_id: string;
  user_id: string;
  role: Role;
  created_at: Date;
}

export interface UpdatePermissionsRequest {
  id: string; // path param for board id
  user_id?: string;
  email?: string;
  role: Role;
}

export interface UpdatePermissionsResponse {
  permission: BoardPermission;
}
