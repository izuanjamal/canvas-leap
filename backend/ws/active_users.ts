import { api } from "encore.dev/api";
import { boardDB } from "../board/db";

interface ActiveUsersParams {
  boardId: string;
}

interface ActiveUser {
  id: string;
  username: string;
  color: string;
  last_seen: Date;
}

interface ActiveUsersResponse {
  users: ActiveUser[];
}

// Retrieves all currently active users on a specific board.
export const getActiveUsers = api<ActiveUsersParams, ActiveUsersResponse>(
  { expose: true, method: "GET", path: "/boards/:boardId/users" },
  async (params) => {
    // Get users who have been active in the last 5 minutes
    const users = await boardDB.queryAll<ActiveUser>`
      SELECT u.id, u.username, u.color, s.last_seen
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.board_id = ${params.boardId}
        AND s.last_seen > NOW() - INTERVAL '5 minutes'
      ORDER BY s.last_seen DESC
    `;

    return { users };
  }
);
