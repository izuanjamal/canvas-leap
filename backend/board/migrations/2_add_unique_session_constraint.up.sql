-- Ensure we can upsert on (board_id, user_id)
ALTER TABLE sessions
  ADD CONSTRAINT sessions_board_user_unique UNIQUE (board_id, user_id);
