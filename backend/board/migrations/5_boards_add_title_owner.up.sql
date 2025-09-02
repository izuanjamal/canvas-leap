-- Add title and owner_id to boards, keep existing data/name columns for compatibility
ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS title TEXT;

-- Backfill title from legacy name column when title is NULL
UPDATE boards
SET title = name
WHERE title IS NULL;

-- Owner of the board (nullable, until we backfill or enforce)
ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth_users(id) ON DELETE SET NULL;

-- Helpful index for listing a user's boards
CREATE INDEX IF NOT EXISTS idx_boards_owner_created ON boards(owner_id, created_at DESC);
