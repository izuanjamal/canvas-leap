export interface Board {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
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

export interface CreateBoardRequest {
  name: string;
  data?: Record<string, any>;
}

export interface UpdateBoardRequest {
  id: string;
  data: Record<string, any>;
}

export interface CreateUserRequest {
  username: string;
  color?: string;
}
