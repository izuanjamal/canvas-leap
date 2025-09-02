import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { boardDB } from "./db";
import type { Board, ListBoardsResponse } from "./types";
import { getAuthData } from "~encore/auth";

interface ListBoardsParams {
  limit?: Query<number>;
}

// Retrieves boards for the current user (owner or has explicit permissions), ordered by most recently created.
export const list = api<ListBoardsParams, ListBoardsResponse>(
  { expose: true, method: "GET", path: "/boards", auth: true },
  async (params) => {
    const auth = getAuthData()!;
    const limit = params.limit || 100;

    const boards = await boardDB.rawQueryAll<Board>(
      `
      SELECT * FROM (
        SELECT
          b.id,
          COALESCE(b.title, b.name) AS title,
          b.created_at,
          b.updated_at,
          b.owner_id
        FROM boards b
        WHERE b.owner_id = $1
        UNION
        SELECT
          b.id,
          COALESCE(b.title, b.name) AS title,
          b.created_at,
          b.updated_at,
          b.owner_id
        FROM boards b
        JOIN board_permissions p ON p.board_id = b.id
        WHERE p.user_id = $1
      ) t
      ORDER BY t.created_at DESC
      LIMIT $2
      `,
      auth.userID,
      limit
    );

    return { boards };
  }
);
