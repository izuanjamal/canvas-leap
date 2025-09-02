-- Board permissions table
CREATE TABLE IF NOT EXISTS board_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','editor','viewer')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (board_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_board_permissions_board ON board_permissions(board_id);
CREATE INDEX IF NOT EXISTS idx_board_permissions_user ON board_permissions(user_id);
