import { api } from "encore.dev/api";
import { boardDB } from "../board/db";

interface ActiveUsersParams {
  boardId: string;
}

interface ActiveUser {
  id: string;
  display_name: string;
  avatar_url: string;
  last_seen: Date;
}

interface ActiveUsersResponse {
  users: ActiveUser[];
}

// Retrieves all currently active (authenticated) users on a specific board.
export const getActiveUsers = api<ActiveUsersParams, ActiveUsersResponse>(
  { expose: true, method: "GET", path: "/boards/:boardId/users", auth: true },
  async (params) => {
    // Get users who have been active in the last 5 minutes
    const users = await boardDB.queryAll<ActiveUser>`
      SELECT u.id, u.display_name, u.avatar_url, p.last_seen
      FROM presence p
      JOIN auth_users u ON p.user_id = u.id
      WHERE p.board_id = ${params.boardId}
        AND p.last_seen > NOW() - INTERVAL '5 minutes'
      ORDER BY p.last_seen DESC
    `;

    return { users };
  }
);
