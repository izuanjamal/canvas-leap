-- Create presence table to track active connections per board for authenticated users
CREATE TABLE IF NOT EXISTS presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  connected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Ensure one presence record per (board, user)
CREATE UNIQUE INDEX IF NOT EXISTS uq_presence_board_user ON presence (board_id, user_id);
CREATE INDEX IF NOT EXISTS idx_presence_board ON presence (board_id);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence (last_seen DESC);
